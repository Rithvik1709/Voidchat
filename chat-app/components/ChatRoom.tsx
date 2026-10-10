"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { importKey, encryptMessage, decryptMessage } from '@/lib/crypto';
import { deriveRoomKey, getRoomProof } from '@/lib/roomAuth';
import { describeBurn, formatCountdown, type RoomOptions } from '@/lib/roomOptions';
import RoomEnded from './RoomEnded';
import RoomFull from './RoomFull';
import InviteManager from './InviteManager';
import SandBurn from './SandBurn';
import { dueIds, mediaPathFromUrl, trackMessages } from '@/lib/burn';
import { createJoinerKeys, inviteMac, inviteTokenHash, isInviteToken, unwrapRoomKey } from '@/lib/invites';
import { loadJoinedKey, saveJoinedKey } from '@/lib/inviteSession';
import { useRoomGuard } from '@/lib/useRoomGuard';
import {
    createSigner, importPublicKey, verifySignature, messageSigData, voteSigData, updatePins,
    type Signer,
} from '@/lib/signing';
import { Button, Input, Card } from './ui/basic';
import { Send, ArrowLeft, ArrowRight, Loader2, Lock, Power, Reply, X, Users, Plus, Smile, BarChart3, Mic, Image as ImageIcon, KeyRound, Flame, Timer, UserPlus } from 'lucide-react';
import AudioRecorder from './AudioRecorder';
import AudioPlayer from './AudioPlayer';
import { cn } from '@/lib/utils';
import { motion, PanInfo } from "framer-motion";
import ModeToggle from "./ModeToggle";
import EmojiPickerPopover from './EmojiPicker';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
    MAX_AUDIO_SEND_B64, MAX_NAME_LENGTH, MAX_TEXT_LENGTH, MEDIA_URL_PREFIX,
    applyVote, escapeRegExp, isRecord, newId, sanitizeContent,
    type MessageContent, type PollData,
} from '@/lib/chatSafety';

interface Message {
    id: string;
    sender: string;
    content: MessageContent;
    timestamp: string;
    isSystem?: boolean;
    encryptedPayload?: string; 
}


const getAvatarColor = (name: string) => {
    const shades = [
        'bg-ember text-[#171412]',
        'bg-primary text-primary-foreground',
        'bg-[#d9cebc] text-[#171412]',
        'bg-[#8a3b1c] text-[#f1ece3]',
        'bg-card text-foreground ring-1 ring-border',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return shades[Math.abs(hash) % shades.length];
};


const NO_OPTIONS: RoomOptions = { hasPassword: false, expiresAt: null, serverNow: '', maxMembers: null, inviteOnly: false, burnSeconds: null };

export default function ChatRoom({ groupId, groupName, options = NO_OPTIONS }: { groupId: string; groupName: string; options?: RoomOptions }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [username, setUsername] = useState('');
    const [isJoined, setIsJoined] = useState(false);
    const [userCount, setUserCount] = useState(0);
    const [participants, setParticipants] = useState<string[]>([]);
    const [showParticipants, setShowParticipants] = useState(false);
    const [key, setKey] = useState<CryptoKey | null>(null);
    const [error, setError] = useState('');
    const [joinError, setJoinError] = useState('');
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [showEndConfirm, setShowEndConfirm] = useState(false);
    const [isEnding, setIsEnding] = useState(false);
    const [endError, setEndError] = useState('');
    const [endedBySomeone, setSessionEnded] = useState<{ by: string; self: boolean } | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [passwordInput, setPasswordInput] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [roomFull, setRoomFull] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteMode, setInviteMode] = useState(false);
    const [joinStatus, setJoinStatus] = useState('');
    const inviteTokenRef = useRef('');
    const [nowMs, setNowMs] = useState(0);
    const rawKeyRef = useRef('');
    const serverOffsetRef = useRef(0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [showPlusMenu, setShowPlusMenu] = useState(false);
    const [showPollModal, setShowPollModal] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [pollType, setPollType] = useState<'single' | 'multiple'>('single');
    const [showAudioRecorder, setShowAudioRecorder] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [imageError, setImageError] = useState('');
    const [sendError, setSendError] = useState('');
    const plusMenuRef = useRef<HTMLDivElement>(null);
    const proofRef = useRef('');
    const signerRef = useRef<Promise<Signer> | null>(null);
    const usernameRef = useRef('');
    const messagesRef = useRef<Message[]>([]);

    const emojiPickerRef = useRef<HTMLDivElement>(null)
    const channelRef = useRef<RealtimeChannel | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // ---- Auto-close timer ----------------------------------------------------------------
    // Counts down against the SERVER clock (so a wrong device clock doesn't matter) and ends the
    // room for everyone when it hits zero. The server also refuses expired rooms on its own.
    const expiresAtMs = options.expiresAt ? Date.parse(options.expiresAt) : null;
    useEffect(() => {
        if (expiresAtMs === null) return;
        serverOffsetRef.current = options.serverNow ? Date.parse(options.serverNow) - Date.now() : 0;
        const tick = () => setNowMs(Date.now() + serverOffsetRef.current);
        const first = setTimeout(tick, 0);
        const id = setInterval(tick, 1000);
        return () => { clearTimeout(first); clearInterval(id); };
    }, [expiresAtMs, options.serverNow]);
    const remainingMs = expiresAtMs !== null && nowMs ? expiresAtMs - nowMs : null;
    const timerExpired = remainingMs !== null && remainingMs <= 0;
    // The room is over when someone ended it, or its timer ran out while we were inside
    const sessionEnded = endedBySomeone ?? (timerExpired && isJoined ? { by: 'timer', self: false } : null);
    const hasEnded = sessionEnded !== null; // stable value for effect dependencies

    useEffect(() => {
        if (!timerExpired || !isJoined) return;
        fetch(`/api/groups/${groupId}/end`, { method: 'DELETE', headers: { 'x-room-proof': proofRef.current } }).catch(() => undefined);
    }, [timerExpired, isJoined, groupId]);

    useEffect(() => { usernameRef.current = username; }, [username]);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    const notify = useCallback((text: string) => {
        setMessages(prev => [...prev, {
            id: newId(),
            sender: 'System',
            content: { text },
            timestamp: new Date().toISOString(),
            isSystem: true
        }]);
    }, []);

    // ---- Burn mode ------------------------------------------------------------------------
    // Every message burns a fixed time after it appears on THIS device (so no clocks need to agree).
    const burnMs = options.burnSeconds ? options.burnSeconds * 1000 : null;
    const [burningIds, setBurningIds] = useState<ReadonlySet<string>>(new Set());
    const burningRef = useRef<ReadonlySet<string>>(new Set());
    const seenRef = useRef(new Map<string, number>());

    useEffect(() => {
        if (!burnMs || !isJoined) return;
        const id = setInterval(() => {
            const now = Date.now();
            trackMessages(seenRef.current, messagesRef.current.map(m => m.id), now);
            const due = dueIds(seenRef.current, burningRef.current, now, burnMs);
            if (due.length > 0) {
                const next = new Set(burningRef.current);
                due.forEach(d => next.add(d));
                burningRef.current = next;
                setBurningIds(next);
            }
        }, 250);
        return () => clearInterval(id);
    }, [burnMs, isJoined]);

    // Called when a message's sand has finished falling: it is gone for good
    const finishBurn = useCallback((id: string) => {
        const gone = messagesRef.current.find(m => m.id === id);
        setMessages(prev => prev.filter(m => m.id !== id));
        const next = new Set(burningRef.current);
        next.delete(id);
        burningRef.current = next;
        setBurningIds(next);
        seenRef.current.delete(id);
        setReplyingTo(r => (r?.id === id ? null : r));

        // A picture I sent: delete the file too, so a burned image is not still reachable by its link
        if (gone && gone.sender === usernameRef.current && gone.content.image) {
            const path = mediaPathFromUrl(gone.content.image, groupId, MEDIA_URL_PREFIX);
            if (path) {
                setTimeout(() => {
                    fetch('/api/upload', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json', 'x-room-proof': proofRef.current },
                        body: JSON.stringify({ groupId, path })
                    }).catch(() => undefined);
                }, 8000);
            }
        }
    }, [groupId]);

    // One signing key per tab, created on first use and kept only in memory
    const getSigner = () => (signerRef.current ??= createSigner());

    const flashSendError = (message: string) => {
        setSendError(message);
        setTimeout(() => setSendError(''), 4000);
    };

    const confirmLeave = () => {
        router.push('/groups');
    };

    const handleExitRequest = () => {
        if (isJoined) {
            setShowLeaveConfirm(true);
        } else {
            router.push('/groups');
        }
    };

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isJoined && !hasEnded) {
                e.preventDefault();
                e.returnValue = ''; 
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isJoined, hasEnded]);

    // After a session ends, send everyone back to the group list
    useEffect(() => {
        if (!hasEnded) return;
        const t = setTimeout(() => router.push('/groups'), 4000);
        return () => clearTimeout(t);
    }, [hasEnded, router]);

    useEffect(() => {
        if (replyingTo) {
            inputRef.current?.focus();
        }
    }, [replyingTo]);

    // Close the emoji picker / plus menu when clicking outside them
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setIsEmojiPickerOpen(false);
            }
            if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
                setShowPlusMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Initialize encryption key (and the proof the server uses to check we know it).
    // A room link carries the key; a one-time link carries only a token and the key arrives
    // after the invite is claimed (see receiveKeyViaInvite).
    useEffect(() => {
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.replace('#', '?'));
        const keyString = params.get('key');
        const inviteToken = params.get('invite');
        const savedKey = loadJoinedKey(groupId); // kept for this tab after joining by invite, so a refresh works

        if (!keyString && !savedKey) {
            if (isInviteToken(inviteToken)) {
                inviteTokenRef.current = inviteToken;
                setInviteMode(true);
            } else {
                setError(inviteToken ? 'This invite link is not valid.' : 'Missing encryption key. Please join via a valid link.');
            }
            return;
        }

        const init = async () => {
            try {
                const rawKey = keyString ? decodeURIComponent(keyString) : (savedKey as string);
                rawKeyRef.current = rawKey;
                const importedKey = await importKey(rawKey); // also validates the link's key
                if (options.hasPassword) return; // the real key is derived from the password at join
                proofRef.current = await getRoomProof(rawKey);
                setKey(importedKey);
            } catch (err) {
                console.error(err);
                setError('Invalid encryption key.');
            }
        };

        init();
        // runs once on mount: the link is read exactly once
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!key) return;

        const channel = supabase.channel(`room:${groupId}`, {
            config: {
                presence: {
                    key: isJoined ? username : undefined,
                },
            },
        });

        channelRef.current = channel;

        // ---- Sender verification -------------------------------------------------------------
        // pins: which public key is trusted for each username (see lib/signing.ts)
        let pins = new Map<string, string>();
        let contested = new Set<string>();
        const keyCache = new Map<string, CryptoKey>();
        const lastNotice = new Map<string, number>();
        const pending: { kind: 'message' | 'vote'; payload: unknown }[] = [];
        const voteClock = new Map<string, number>();

        let presenceReady = false;
        const announce = (text: string) =>
            setMessages(prev => [...prev, {
                id: newId(),
                sender: 'System',
                content: { text },
                timestamp: new Date().toISOString(),
                isSystem: true
            }]);

        const noticeOnce = (name: string, text: string) => {
            const now = Date.now();
            if (now - (lastNotice.get(name) || 0) < 15000) return;
            lastNotice.set(name, now);
            announce(text);
        };

        type Check = 'ok' | 'wait' | 'bad';
        const checkSender = async (sender: string, data: string, sig: unknown): Promise<Check> => {
            // Nobody else can legitimately speak as me: my own messages are never echoed back
            if (isJoined && sender === usernameRef.current) return 'bad';
            if (contested.has(sender)) return 'bad';
            const canon = pins.get(sender);
            const pub = canon ? keyCache.get(canon) : undefined;
            if (!pub) return 'wait'; // presence for this sender has not arrived yet
            return typeof sig === 'string' && await verifySignature(pub, data, sig) ? 'ok' : 'bad';
        };

        const blocked = (sender: string) =>
            noticeOnce(
                sender,
                isJoined && sender === usernameRef.current
                    ? 'Blocked a message pretending to be you'
                    : `Blocked a message pretending to be ${sender}`
            );

        const processMessage = async (payload: unknown): Promise<'done' | 'wait'> => {
            try {
                if (!isRecord(payload)) return 'done';
                const { id, sender, timestamp, encryptedPayload, sig } = payload;
                if (typeof id !== 'string' || !id || id.length > 64) return 'done';
                if (typeof sender !== 'string' || !sender || sender.length > MAX_NAME_LENGTH || sender === 'System') return 'done';
                if (typeof encryptedPayload !== 'string' || typeof timestamp !== 'string') return 'done';

                const status = await checkSender(sender, messageSigData(groupId, { id, sender, timestamp, encryptedPayload }), sig);
                if (status === 'wait') return 'wait';
                if (status === 'bad') {
                    blocked(sender);
                    return 'done';
                }

                const decryptedString = await decryptMessage(encryptedPayload, key);
                let parsed: unknown;
                try {
                    parsed = JSON.parse(decryptedString);
                } catch {
                    return 'done';
                }

                const content = sanitizeContent(parsed);
                // The sender is signed on the envelope AND bound inside the encrypted payload
                if (!content || content.from !== sender) return 'done';

                const ts = !Number.isNaN(Date.parse(timestamp)) ? timestamp : new Date().toISOString();

                setMessages(prev => {
                    if (prev.some(m => m.id === id)) return prev;
                    return [...prev, { id, sender, timestamp: ts, content, encryptedPayload }];
                });
            } catch (err) {
                console.error('Failed to process message', err);
            }
            return 'done';
        };

        // A vote can only change that voter's own selections. It can never rewrite a message.
        const processVote = async (payload: unknown): Promise<'done' | 'wait'> => {
            try {
                if (!isRecord(payload)) return 'done';
                const { messageId, sender, encryptedPayload, sig } = payload;
                if (typeof messageId !== 'string' || typeof encryptedPayload !== 'string') return 'done';
                if (typeof sender !== 'string' || !sender || sender.length > MAX_NAME_LENGTH) return 'done';

                const status = await checkSender(sender, voteSigData(groupId, { messageId, sender, encryptedPayload }), sig);
                if (status === 'wait') return 'wait';
                if (status === 'bad') {
                    blocked(sender);
                    return 'done';
                }

                const parsed: unknown = JSON.parse(await decryptMessage(encryptedPayload, key));
                if (!isRecord(parsed) || parsed.voter !== sender || !Array.isArray(parsed.selections)) return 'done';
                if (typeof parsed.ts !== 'number') return 'done';

                // A replayed older vote must not undo a newer one
                const clockKey = `${messageId}|${sender}`;
                if (parsed.ts <= (voteClock.get(clockKey) ?? 0)) return 'done';
                voteClock.set(clockKey, parsed.ts);

                const selections = parsed.selections.filter((o): o is string => typeof o === 'string');
                setMessages(prev => prev.map(m =>
                    m.id === messageId && m.content.poll
                        ? { ...m, content: { ...m.content, poll: applyVote(m.content.poll, sender, selections) } }
                        : m
                ));
            } catch (err) {
                console.error('Vote decrypt failed', err);
            }
            return 'done';
        };

        const handleIncoming = async (kind: 'message' | 'vote', payload: unknown) => {
            const result = kind === 'message' ? await processMessage(payload) : await processVote(payload);
            if (result === 'wait') {
                // Their key may not have been announced yet; retry briefly, then give up quietly
                const item = { kind, payload };
                pending.push(item);
                setTimeout(() => {
                    const i = pending.indexOf(item);
                    if (i !== -1) pending.splice(i, 1);
                }, 5000);
            }
        };

        const flushPending = async () => {
            for (const item of [...pending]) {
                const result = item.kind === 'message' ? await processMessage(item.payload) : await processVote(item.payload);
                if (result === 'done') {
                    const i = pending.indexOf(item);
                    if (i !== -1) pending.splice(i, 1);
                }
            }
        };

        // Presence updates are applied one at a time so key imports can't interleave
        let pinChain: Promise<void> = Promise.resolve();
        const refreshPins = () => {
            pinChain = pinChain.then(async () => {
                const next = updatePins(pins, channel.presenceState() as unknown as Record<string, unknown[]>);
                for (const [canon, jwk] of next.jwkByCanon) {
                    if (keyCache.has(canon)) continue;
                    const imported = await importPublicKey(jwk);
                    if (imported) keyCache.set(canon, imported);
                }
                const newlyContested = [...next.contested].filter(n => !contested.has(n));
                pins = next.pins;
                contested = next.contested;
                if (presenceReady) {
                    newlyContested.forEach(n => noticeOnce(n, `${n} is contested: two people use this name, so its messages are blocked`));
                }
                await flushPending();
            }).catch(err => console.error('Pin update failed', err));
        };

        // Presence "join" events also fire for everyone already in the room (and for yourself)
        // while the first state sync arrives. Only announce people who arrive afterwards.
        channel
            .on('broadcast', { event: 'message' }, ({ payload }) => handleIncoming('message', payload))
            .on('broadcast', { event: 'vote' }, ({ payload }) => handleIncoming('vote', payload))
            .on('broadcast', { event: 'clear' }, ({ payload }) => {
                setMessages([]);
                setReplyingTo(null);
                const by = isRecord(payload) && typeof payload.by === 'string' ? payload.by.slice(0, MAX_NAME_LENGTH) : '';
                setSessionEnded({ by: by || 'The host', self: false });
            })
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                const users = Object.keys(newState).filter(k => k && k !== 'undefined');
                setParticipants(users);
                setUserCount(users.length);
                refreshPins();
                presenceReady = true;
            })
            .on('presence', { event: 'join' }, ({ key: who }) => {
                if (!presenceReady || !who || who === 'undefined' || who === usernameRef.current) return;
                announce(`${who} joined`);
            })
            .on('presence', { event: 'leave' }, ({ key: who }) => {
                if (!presenceReady || !who || who === 'undefined' || who === usernameRef.current) return;
                announce(`${who} left`);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    if (isJoined && username) {
                        try {
                            const signer = await getSigner();
                            await channel.track({ online_at: new Date().toISOString(), pub: signer.publicJwk });
                        } catch (err) {
                            console.error('Could not announce signing key', err);
                            setError('Your browser could not create a signing key, so you cannot join this room.');
                        }
                    }
                }
            });

        const postJson = (url: string, body: Record<string, unknown>) =>
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...body, proof: proofRef.current })
            });

        let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
        let leftRoom = false;
        let joinAccepted = false; // only a seat we were actually given needs giving back
        let disposed = false;

        // Runs on unmount AND when the tab is closed / backgrounded for good (pagehide),
        // because React cleanup never runs when a tab is simply closed.
        const leaveRoom = () => {
            if (!isJoined || !joinAccepted || leftRoom) return;
            leftRoom = true;
            const data = JSON.stringify({ action: 'leave', proof: proofRef.current });
            const url = `/api/groups/${groupId}/membership`;
            if (navigator.sendBeacon) {
                navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
            } else {
                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    keepalive: true,
                    body: data
                }).catch(e => console.error('Leave failed', e));
            }
        };

        if (isJoined && username) {
            postJson(`/api/groups/${groupId}/membership`, { action: 'join' })
                .then(async (res) => {
                    if (res.status === 409) {
                        setRoomFull(true);
                        setIsJoined(false);
                        return;
                    }
                    if (res.status === 403) {
                        setError('You could not join this room. Check the link and the password.');
                        setIsJoined(false);
                        return;
                    }
                    const data = await res.json().catch(() => ({}));
                    if (data?.ended) {
                        setSessionEnded({ by: 'The room', self: false });
                        return;
                    }
                    joinAccepted = true;
                    if (disposed) leaveRoom(); // left before the server answered: give the seat back
                })
                .catch(e => console.error('Join failed', e));

            heartbeatInterval = setInterval(async () => {
                try {
                    await postJson('/api/groups/heartbeat', { groupId });
                } catch (e) {
                    console.error('Heartbeat failed', e);
                }
            }, 60000);

            postJson('/api/groups/heartbeat', { groupId }).catch(err => console.error(err));

            window.addEventListener('pagehide', leaveRoom);
        }

        return () => {
            disposed = true;
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            window.removeEventListener('pagehide', leaveRoom);
            supabase.removeChannel(channel);
            channelRef.current = null;
            leaveRoom();
        };
    }, [key, isJoined, groupId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, replyingTo]);

    /**
     * One-time link: claim the invite (this is what burns it), then wait for the person who made
     * it to send the room key, encrypted so that only this browser can read it.
     */
    const receiveKeyViaInvite = async (): Promise<string> => {
        const token = inviteTokenRef.current;
        const joiner = await createJoinerKeys();
        const mac = await inviteMac(token, joiner.publicJwk);

        setJoinStatus('Using your invite…');
        const claimRes = await fetch('/api/invites/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, tokenHash: await inviteTokenHash(token), pub: joiner.publicJwk, mac })
        });
        if (!claimRes.ok) {
            const data = await claimRes.json().catch(() => ({}));
            throw new Error(data.error || 'This invite could not be used.');
        }
        const { inviteId } = await claimRes.json() as { inviteId: string };

        setJoinStatus('Waiting for the person who invited you to let you in…');
        const deadline = Date.now() + 100_000; // the server frees an unanswered claim after 2 minutes
        while (Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const res = await fetch(`/api/invites/${inviteId}/delivery?mac=${mac}`, { cache: 'no-store' });
            if (res.status === 404) throw new Error('This invite was taken over by someone else.');
            if (!res.ok) continue;
            const data = await res.json();
            if (data.status === 'released') throw new Error('Nobody let you in in time. Open the link again to retry.');
            if (data.delivery) return unwrapRoomKey(data.delivery, joiner.privateKey, inviteId);
        }
        throw new Error('The person who invited you is not in the room right now. Open the link again once they are.');
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isJoining) return;
        const trimmedName = username.trim();
        if (!trimmedName) return;

        if (participants.some(p => p.toLowerCase() === trimmedName.toLowerCase())) {
            setJoinError(`Username "${trimmedName}" is already taken.`);
            setTimeout(() => setJoinError(''), 3000);
            return;
        }

        // Check this before an invite is used up, so a typo here never costs someone their link
        if (options.hasPassword && !passwordInput) {
            setJoinError('Enter the room password.');
            return;
        }

        setIsJoining(true);
        try {
            // 1) Get the room key: from the link (already loaded) or through a one-time invite
            if (!rawKeyRef.current) {
                if (!inviteTokenRef.current) {
                    setError('Missing encryption key. Please join via a valid link.');
                    return;
                }
                const received = await receiveKeyViaInvite();
                await importKey(received); // reject anything that is not a usable key
                rawKeyRef.current = received;
                saveJoinedKey(groupId, received);
                setInviteMode(false);
            }

            // 2) Password rooms: check the password, then derive the real key from it
            if (options.hasPassword) {
                const proof = await getRoomProof(rawKeyRef.current, passwordInput);
                const res = await fetch(`/api/groups/${groupId}/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ proof })
                });
                if (res.status === 404) {
                    setError('This room has ended.');
                    return;
                }
                if (res.status === 429) {
                    setJoinError('Too many attempts. Wait a minute and try again.');
                    return;
                }
                if (!res.ok) {
                    setJoinError('Wrong password.');
                    return;
                }
                proofRef.current = proof;
                setKey(await deriveRoomKey(rawKeyRef.current, passwordInput));
            } else if (!key) {
                proofRef.current = await getRoomProof(rawKeyRef.current);
                setKey(await importKey(rawKeyRef.current));
            }
        } catch (err) {
            console.error(err);
            setJoinError(err instanceof Error && err.message ? err.message : 'Could not join. Try again.');
            return;
        } finally {
            setIsJoining(false);
            setJoinStatus('');
        }

        setIsJoined(true);
    };

    // Room safety check: the server ends the room if Llama Guard flags a severe category.
    // Tell everyone else, then show the usual "room closed" screen.
    useRoomGuard({
        groupId,
        active: isJoined && !hasEnded && Boolean(key),
        messages,
        proofRef,
        onTerminate: () => {
            channelRef.current
                ?.send({ type: 'broadcast', event: 'clear', payload: { by: 'Nullchat', at: new Date().toISOString() } })
                .catch((err) => console.error('Failed to notify participants', err));
            setMessages([]);
            setReplyingTo(null);
            setSessionEnded({ by: 'Nullchat', self: false });
        },
    });

    const handleEndSession = () => {
        setEndError('');
        setShowEndConfirm(true);
    };

    const confirmEndSession = async () => {
        if (isEnding) return;
        setIsEnding(true);
        setEndError('');

        try {
            // Delete the room (and its media) first so a failure never half-ends the session
            const res = await fetch(`/api/groups/${groupId}/end`, {
                method: 'DELETE',
                headers: { 'x-room-proof': proofRef.current }
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Could not end the session. Please try again.');
            }

            // Tell everyone else in the room it is over
            try {
                await channelRef.current?.send({
                    type: 'broadcast',
                    event: 'clear',
                    payload: { by: username, at: new Date().toISOString() }
                });
            } catch (broadcastErr) {
                console.error('Failed to notify participants', broadcastErr);
            }

            setMessages([]);
            setReplyingTo(null);
            setShowEndConfirm(false);
            setSessionEnded({ by: username, self: true });
        } catch (err) {
            console.error('Failed to end session', err);
            setEndError(err instanceof Error ? err.message : 'Could not end the session.');
        } finally {
            setIsEnding(false);
        }
    };

    // Every outgoing message goes through here so a failed send is reported instead of
    // silently showing up in your own chat only.
    const sendBroadcast = async (event: string, payload: unknown) => {
        const channel = channelRef.current;
        if (!channel) throw new Error('Not connected yet. Try again in a moment.');
        const status = await channel.send({ type: 'broadcast', event, payload });
        if (status !== 'ok') {
            throw new Error(status === 'timed out' ? 'Message timed out. Check your connection.' : 'Message failed to send.');
        }
    };

    const postMessage = async (content: MessageContent) => {
        if (!key) throw new Error('Encryption key is not ready yet.');
        const bound: MessageContent = { ...content, from: username };
        const encryptedPayload = await encryptMessage(JSON.stringify(bound), key);
        const messageData = {
            id: newId(),
            sender: username,
            timestamp: new Date().toISOString(),
            encryptedPayload
        };
        const signer = await getSigner();
        const sig = await signer.sign(messageSigData(groupId, messageData));
        await sendBroadcast('message', { ...messageData, sig });
        setMessages(prev => [...prev, { ...messageData, content: bound }]);
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file size
        const MAX_SIZE = 25 * 1024 * 1024; // 25MB
        if (file.size > MAX_SIZE) {
            setImageError('File size must be less than 25MB');
            setTimeout(() => setImageError(''), 3000);
            return;
        }

        // Validate file type (SVG is not allowed: it can carry scripts)
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setImageError('Only JPEG, PNG, GIF and WebP images are allowed');
            setTimeout(() => setImageError(''), 3000);
            if (imageInputRef.current) imageInputRef.current.value = '';
            return;
        }

        setIsUploadingImage(true);
        setImageError('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('groupId', groupId);
            formData.append('proof', proofRef.current);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Upload failed');
            }

            const data = await response.json();
            await postMessage({ text: '🖼️ Image', image: data.url });
        } catch (err) {
            console.error('Image upload error:', err);
            setImageError(err instanceof Error ? err.message : 'Failed to upload image');
            setTimeout(() => setImageError(''), 3000);
        } finally {
            setIsUploadingImage(false);
            if (imageInputRef.current) {
                imageInputRef.current.value = '';
            }
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (showMentions && filteredParticipants.length > 0) return;

        if (!input.trim() || !key) return;

        try {
            await postMessage({
                text: input.trim().slice(0, MAX_TEXT_LENGTH),
                replyTo: replyingTo ? {
                    id: replyingTo.id,
                    sender: replyingTo.sender,
                    text: replyingTo.content.text.substring(0, 50) + (replyingTo.content.text.length > 50 ? '...' : '')
                } : undefined
            });

            setInput('');
            setReplyingTo(null);
        } catch (err) {
            // Keep what was typed so it can be retried
            console.error(err);
            flashSendError(err instanceof Error ? err.message : 'Message failed to send.');
        }
    };

    const sendAudioMessage = async (audioBlob: Blob) => {
        if (!key) return;

        const reader = new FileReader();
        reader.onerror = () => {
            setShowAudioRecorder(false);
            flashSendError('Could not read the recording.');
        };
        reader.onloadend = async () => {
            try {
                const base64Data = String(reader.result).split(',')[1] || '';
                if (!base64Data) throw new Error('The recording was empty.');
                if (base64Data.length > MAX_AUDIO_SEND_B64) {
                    throw new Error('Voice message is too long. Keep it under 30 seconds.');
                }
                await postMessage({ text: '🎤 Voice message', audio: base64Data });
            } catch (err) {
                console.error('Error sending audio:', err);
                flashSendError(err instanceof Error ? err.message : 'Voice message failed to send.');
            } finally {
                setShowAudioRecorder(false);
            }
        };
        reader.readAsDataURL(audioBlob);
    };

    if (error) {
        return (
            <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-4 text-foreground">
                <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(45% 40% at 50% 100%, hsl(var(--ember) / 0.12), transparent 70%)' }} />
                <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card/70 p-8 text-center backdrop-blur">
                    <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-foreground text-background">
                        <Lock className="h-6 w-6" />
                    </div>
                    <h2 className="mb-2 font-[family-name:var(--font-serif)] text-4xl leading-none">Access <span className="italic text-ember">denied.</span></h2>
                    <p className="mb-8 text-sm leading-relaxed text-muted-foreground">{error}</p>
                    <Button onClick={() => router.push('/groups')} className="h-11 w-full rounded-full bg-foreground font-bold text-background hover:bg-foreground/90">
                        Return to Groups
                    </Button>
                </div>
            </div>
        );
    }

    if (roomFull) {
        return <RoomFull limit={options.maxMembers} />;
    }

    // Timer ran out while the join screen was open
    if (timerExpired && !isJoined) {
        return <RoomEnded />;
    }

    if (!isJoined) {
        return (
            <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 text-foreground animate-in fade-in duration-500">
                <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(45% 40% at 50% 100%, hsl(var(--ember) / 0.12), transparent 70%)' }} />
                <div className="absolute right-4 top-4 z-10"><ModeToggle /></div>

                <div className="relative w-full max-w-sm">
                    <div className="absolute -inset-10 -z-10 rounded-full bg-ember/15 blur-3xl" />
                    <div className="rounded-[26px] bg-card p-8 shadow-[0_40px_90px_-30px_rgba(60,40,20,0.55)]">
                        <div className="mb-8 text-center">
                            <div className="mx-auto mb-6 flex w-fit items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                <span className="h-1.5 w-1.5 rounded-full bg-ember shadow-[0_0_10px_2px_hsl(var(--ember)/0.6)]" /> End-to-end encrypted
                            </div>
                            <h1 className="font-[family-name:var(--font-serif)] text-5xl leading-[0.9]">Join the <span className="italic text-ember">room.</span></h1>
                            {groupName && (
                                <p className="mt-3 truncate font-mono text-xs text-muted-foreground">{groupName}</p>
                            )}
                            <p className="mt-3 text-sm text-muted-foreground">Pick a temporary name. It disappears when you leave.</p>
                            {inviteMode && (
                                <p className="mx-auto mt-4 flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] text-foreground">
                                    <Flame className="h-3 w-3" /> You have a one-time invite. It burns when you use it.
                                </p>
                            )}
                            {(options.hasPassword || options.expiresAt || options.maxMembers || options.burnSeconds) && (
                                <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] text-muted-foreground">
                                    {options.burnSeconds && <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><Flame className="h-3 w-3" /> Messages burn after {describeBurn(options.burnSeconds)}</span>}
                                    {options.hasPassword && <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><KeyRound className="h-3 w-3" /> Password</span>}
                                    {remainingMs !== null && <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><Timer className="h-3 w-3" /> Closes in {formatCountdown(remainingMs)}</span>}
                                    {options.maxMembers && <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><Users className="h-3 w-3" /> Up to {options.maxMembers}</span>}
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleJoin} className="space-y-4">
                            <div className="relative">
                                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-mono text-sm text-muted-foreground">@</span>
                                <Input
                                    placeholder="username"
                                    value={username}
                                    onChange={e => {
                                        setUsername(e.target.value.replace(/\s/g, ''));
                                        setJoinError('');
                                    }}
                                    autoFocus
                                    required
                                    maxLength={15}
                                    className={cn(
                                        "h-12 rounded-full border-border bg-background/60 pl-9 font-mono focus-visible:ring-ember/40",
                                        joinError && "border-destructive focus-visible:ring-destructive"
                                    )}
                                />
                            </div>
                            {options.hasPassword && (
                                <div className="relative">
                                    <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        type="password"
                                        autoComplete="off"
                                        placeholder="room password"
                                        value={passwordInput}
                                        onChange={e => {
                                            setPasswordInput(e.target.value);
                                            setJoinError('');
                                        }}
                                        required
                                        maxLength={64}
                                        className="h-12 rounded-full border-border bg-background/60 pl-11 focus-visible:ring-ember/40"
                                    />
                                </div>
                            )}
                            {joinError && (
                                <p className="px-2 text-xs font-medium text-destructive animate-in slide-in-from-top-1" role="alert">{joinError}</p>
                            )}
                            {isJoining && joinStatus && (
                                <p className="px-2 text-center text-xs text-muted-foreground" aria-live="polite">{joinStatus}</p>
                            )}
                            <Button type="submit" size="lg" disabled={isJoining} className="group h-12 w-full rounded-full bg-ember font-semibold text-[#171412] shadow-[0_14px_30px_-14px_rgba(120,40,0,0.7)] transition-transform hover:scale-[1.02] hover:bg-ember active:scale-95">
                                {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {isJoining ? 'Please wait…' : inviteMode ? 'Use invite & enter' : 'Enter room'}
                                {!isJoining && <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />}
                            </Button>
                        </form>

                        <div className="mt-6 flex items-center justify-between border-t border-border pt-5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                            <button type="button" onClick={() => router.push('/groups')} className="transition-colors hover:text-foreground">
                                ← Cancel
                            </button>
                            <span>No logs · No trace</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const mentionMatch = input.match(/@(\w*)$/);
    const hasPreviousMention = input.replace(/@(\w*)$/, '').includes('@');
    const showMentions = mentionMatch && !hasPreviousMention ? true : false;
    const mentionQuery = mentionMatch ? mentionMatch[1].toLowerCase() : '';
    const filteredParticipants = participants.filter(p => p.toLowerCase().includes(mentionQuery) && p !== username);

    const insertMention = (name: string) => {
        const newInput = input.replace(/@(\w*)$/, `@${name} `);
        setInput(newInput);
        inputRef.current?.focus();
        setSelectedIndex(0);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showMentions && filteredParticipants.length > 0) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredParticipants.length - 1));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev < filteredParticipants.length - 1 ? prev + 1 : 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                insertMention(filteredParticipants[selectedIndex]);
            }
        }
    };

    return (
        <div className="fixed inset-0 flex w-full overflow-hidden bg-background text-foreground">
            {/* Main Chat Area */}
            <div className="relative flex min-w-0 flex-1 flex-col">
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{ background: 'radial-gradient(45% 40% at 50% 0%, hsl(var(--ember) / 0.12), transparent 70%)' }}
                />

                {/* Header */}
                <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border/60 bg-background/70 px-3 py-3 backdrop-blur-xl sm:px-5">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <Button variant="ghost" size="icon" onClick={handleExitRequest} className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="min-w-0">
                            <h2 className="max-w-[160px] truncate font-[family-name:var(--font-serif)] text-xl italic leading-tight sm:max-w-md md:text-2xl">
                                {groupName || "Group Chat"}
                            </h2>
                            <div className="mt-0.5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember opacity-60" />
                                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ember" />
                                    </span>
                                    {userCount} online
                                </span>
                                <span className="hidden items-center gap-1 sm:flex"><Lock className="h-2.5 w-2.5" /> encrypted</span>
                                {options.burnSeconds && (
                                    <span className="flex items-center gap-1" title="Messages burn after this long">
                                        <Flame className="h-2.5 w-2.5 text-ember" /> burn {describeBurn(options.burnSeconds)}
                                    </span>
                                )}
                                {remainingMs !== null && !timerExpired && (
                                    <span className={cn("flex items-center gap-1", remainingMs < 60_000 && "text-ember animate-pulse")}>
                                        <Timer className="h-2.5 w-2.5" /> {formatCountdown(remainingMs)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                        <ModeToggle />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowInvite(true)}
                            className="rounded-full border-border bg-transparent px-3 hover:border-foreground/40"
                            title="Invite people"
                        >
                            <UserPlus className="h-4 w-4 sm:mr-1.5" />
                            <span className="hidden sm:inline">Invite</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEndSession}
                            className="rounded-full border-border bg-transparent px-3 text-xs font-semibold hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                        >
                            End<span className="hidden sm:inline">&nbsp;Session</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowParticipants(!showParticipants)}
                            className={cn(
                                "h-9 w-9 rounded-full transition-all",
                                showParticipants ? "bg-ember text-[#171412] hover:bg-ember/90 hover:text-[#171412]" : "text-muted-foreground hover:text-foreground"
                            )}
                            title="Toggle Participants"
                        >
                            <Users className="h-5 w-5" />
                        </Button>
                    </div>
                </header>

                {/* Messages Container */}
                <div className="relative flex-1 overflow-y-auto scroll-smooth p-4 pb-28">
                    <div className="mx-auto max-w-2xl space-y-1">
                        {messages.filter(m => !m.isSystem).length === 0 && (
                            <div className="flex flex-col items-center px-6 pb-4 pt-16 text-center animate-in fade-in duration-700">
                                <div className="relative mb-6 grid h-20 w-20 place-items-center">
                                    <span className="absolute inset-0 animate-ping rounded-full border border-ember/40" />
                                    <span className="absolute inset-3 rounded-full border border-ember/50" />
                                    <span className="relative grid h-10 w-10 place-items-center rounded-full bg-foreground text-background">
                                        <Lock className="h-4 w-4" />
                                    </span>
                                </div>
                                <h3 className="font-[family-name:var(--font-serif)] text-4xl leading-none">Room is <span className="italic text-ember">open.</span></h3>
                                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                                    {options.burnSeconds
                                        ? `Burn mode is on: every message turns to sand ${options.burnSeconds} seconds after it appears.`
                                        : 'Messages are encrypted and exist only while this session is live.'}{' '}
                                    Say something, or invite someone.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowInvite(true)}
                                    className="mt-6 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground/40"
                                >
                                    <UserPlus className="h-4 w-4" />
                                    Invite people
                                </button>
                            </div>
                        )}
                        {messages.map((msg, index) => {
                            if (msg.isSystem) {
                                return (
                                    <div key={msg.id} className="relative my-4 flex items-center justify-center gap-3 opacity-70">
                                        <span className="h-px w-8 bg-border" />
                                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground" data-burn-target data-burn-bubble>
                                            {msg.content.text}
                                        </span>
                                        <span className="h-px w-8 bg-border" />
                                        {burnMs && <SandBurn burning={burningIds.has(msg.id)} onDone={() => finishBurn(msg.id)} />}
                                    </div>
                                );
                            }

                            const isMe = msg.sender === username;
                            const prevMsg = messages[index - 1];
                            const prevTimeString = prevMsg ? new Date(prevMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                            const currTimeString = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const isSameSender = prevMsg && prevMsg.sender === msg.sender;
                            const isSameTime = prevTimeString === currTimeString;
                            const showHeader = !isSameSender || !isSameTime || prevMsg.isSystem;

                            return (
                                <motion.div
                                    key={msg.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={cn(
                                        "group flex w-full relative items-center",
                                        isMe ? "flex-row-reverse" : "flex-row",
                                        showHeader ? "mt-6" : "mt-1"
                                    )}
                                >
                                    {/* Swipe Action Background (Reply Icon) */}
                                    <div className={cn(
                                        "absolute flex items-center justify-center w-10 h-10 rounded-full transition-opacity duration-200",
                                        isMe ? "right-full mr-2 opacity-0" : "left-0 -ml-12 opacity-0"
                                    )}>
                                        <Reply className="h-5 w-5 text-muted-foreground" />
                                    </div>

                                    {/* Draggable Message Container */}
                                    <motion.div
                                        drag="x"
                                        dragConstraints={{ left: 0, right: 0 }}
                                        dragElastic={0.2}
                                        onDragEnd={(_e: unknown, info: PanInfo) => {
                                            if (info.offset.x > 50) {
                                                setReplyingTo(msg);
                                            }
                                        }}
                                        className={cn(
                                            "flex gap-3 w-full relative z-10",
                                            isMe ? "flex-row-reverse" : "flex-row"
                                        )}
                                        style={{ x: 0 }} 
                                        whileDrag={{ x: 50 }} 
                                    >
                                        {/* Avatar: Show only if it's the TOP message of the group (showHeader) */}
                                        <div className={cn(
                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold select-none transition-opacity",
                                            getAvatarColor(msg.sender),
                                            showHeader ? "opacity-100" : "opacity-0 invisible" 
                                        )}>
                                            {msg.sender[0].toUpperCase()}
                                        </div>

                                        {/* Message Bubble Container */}
                                        <div className={cn("flex flex-col max-w-[75%]", isMe ? "items-end" : "items-start")} data-burn-target>
                                            {showHeader && (
                                                <div className="flex items-baseline gap-2 mb-1 px-1">
                                                    <span className="font-mono text-[11px] font-semibold text-foreground/80">{msg.sender}</span>
                                                    <span className="font-mono text-[9px] text-muted-foreground">
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Reply action button (Desktop Hover) */}
                                            <div className="relative group/bubble">
                                                <div
                                                    data-burn-bubble
                                                    className={cn(
                                                        "relative px-4 py-2.5 text-sm break-words whitespace-pre-wrap leading-relaxed", // Added whitespace-pre-wrap
                                                        isMe
                                                            ? "bg-foreground text-background rounded-2xl rounded-tr-md"
                                                            : "bg-card shadow-[0_6px_18px_-12px_rgba(60,40,20,0.45)] ring-1 ring-border/60 rounded-2xl rounded-tl-md text-foreground",
                                                        !showHeader && isMe && "rounded-tr-2xl", // Round corners if middle of group
                                                        !showHeader && !isMe && "rounded-tl-2xl"
                                                    )}
                                                >
                                                    {msg.content.replyTo && (
                                                        <div className={cn(
                                                            "mb-2 p-2 rounded text-xs border-l-2 bg-black/5 dark:bg-white/5",
                                                            isMe ? "border-primary-foreground/40" : "border-foreground/20"
                                                        )}>
                                                            <p className={cn("font-bold mb-0.5 opacity-80", isMe ? "text-primary-foreground" : "text-foreground")}>
                                                                {msg.content.replyTo.sender}
                                                            </p>
                                                            <p className="line-clamp-1 opacity-70 italic">
                                                                {msg.content.replyTo.text}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {msg.content.poll ? (
                                                        // Interactive Poll Display
                                                        <div className="space-y-3">
                                                            <div className="font-semibold text-base mb-2">
                                                                {msg.content.poll.question}
                                                            </div>
                                                            <div className="text-xs opacity-70 mb-3 flex items-center gap-2">
                                                                <span>{msg.content.poll.type === 'single' ? 'Single Choice' : 'Multiple Choice'}</span>
                                                                <span>•</span>
                                                                <span>by {msg.content.poll.creator}</span>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {msg.content.poll.options.map((option, idx) => {
                                                                    const voteCount = msg.content.poll!.votes[option]?.length || 0;
                                                                    const hasVoted = msg.content.poll!.votes[option]?.includes(username);
                                                                    const totalVotes = Object.values(msg.content.poll!.votes).reduce((sum, voters) => sum + voters.length, 0);
                                                                    const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                                                                    
                                                                    return (
                                                                        <button
                                                                            key={idx}
                                                                            onClick={async () => {
                                                                                const poll = msg.content.poll!;
                                                                                const mine = poll.options.filter(o => poll.votes[o]?.includes(username));
                                                                                const selections = poll.type === 'single'
                                                                                    ? (hasVoted ? [] : [option])
                                                                                    : (hasVoted ? mine.filter(o => o !== option) : [...mine, option]);

                                                                                try {
                                                                                    // Only this voter's selections travel; nobody else's votes or the question can change
                                                                                    const encryptedPayload = await encryptMessage(JSON.stringify({ voter: username, selections, ts: Date.now() }), key!);
                                                                                    const signer = await getSigner();
                                                                                    const sig = await signer.sign(voteSigData(groupId, { messageId: msg.id, sender: username, encryptedPayload }));
                                                                                    await sendBroadcast('vote', { messageId: msg.id, sender: username, encryptedPayload, sig });
                                                                                    setMessages(prev => prev.map(m =>
                                                                                        m.id === msg.id && m.content.poll
                                                                                            ? { ...m, content: { ...m.content, poll: applyVote(m.content.poll, username, selections) } }
                                                                                            : m
                                                                                    ));
                                                                                } catch (err) {
                                                                                    console.error('Vote error:', err);
                                                                                    flashSendError(err instanceof Error ? err.message : 'Vote failed to send.');
                                                                                }
                                                                            }}
                                                                            className={cn(
                                                                                "w-full text-left p-3 rounded-lg border transition-all relative overflow-hidden",
                                                                                hasVoted 
                                                                                    ? "border-primary bg-primary/10 font-medium" 
                                                                                    : "border-border hover:border-primary/50 hover:bg-accent/50",
                                                                                isMe ? "text-primary-foreground" : "text-foreground"
                                                                            )}
                                                                        >
                                                                            {/* Vote percentage bar */}
                                                                            <div 
                                                                                className="absolute inset-0 bg-primary/5 transition-all duration-300"
                                                                                style={{ width: `${percentage}%` }}
                                                                            />
                                                                            
                                                                            <div className="relative flex items-center justify-between gap-2">
                                                                                <div className="flex items-center gap-2 flex-1">
                                                                                    <span className={cn(
                                                                                        "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                                                                        hasVoted ? "border-primary bg-primary" : "border-current"
                                                                                    )}>
                                                                                        {hasVoted && <span className="w-2 h-2 bg-primary-foreground rounded-full" />}
                                                                                    </span>
                                                                                    <span className="text-sm">{option}</span>
                                                                                </div>
                                                                                <span className="text-xs opacity-70 font-medium">
                                                                                    {voteCount} {voteCount === 1 ? 'vote' : 'votes'} ({percentage}%)
                                                                                </span>
                                                                            </div>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ) : msg.content.audio ? (
                                                        // Audio message
                                                        <AudioPlayer
                                                            audioData={msg.content.audio}
                                                            sender={msg.sender}
                                                            timestamp={msg.timestamp}
                                                            isOwn={isMe}
                                                        />
                                                    ) : msg.content.image ? (
                                                        // Image message
                                                        <div className="flex flex-col gap-2">
                                                            <img
                                                                src={msg.content.image}
                                                                referrerPolicy="no-referrer"
                                                                alt="Shared image"
                                                                className="max-w-xs max-h-96 rounded-lg shadow-md object-cover"
                                                                loading="lazy"
                                                            />
                                                            {msg.content.text !== '🖼️ Image' && (
                                                                <p className="text-sm opacity-80">{msg.content.text}</p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        // Regular text message
                                                        msg.content.text.split(new RegExp(`(@${escapeRegExp(username)})(?!\\w)`, 'gi')).map((part, i) =>
                                                            part.toLowerCase() === `@${username}`.toLowerCase() ? (
                                                                <span key={i} className="bg-foreground/15 font-bold px-1 rounded mx-0.5 underline underline-offset-2">
                                                                    {part}
                                                                </span>
                                                            ) : (
                                                                <span key={i}>{part}</span>
                                                            )
                                                        )
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => setReplyingTo(msg)}
                                                    className={cn(
                                                        "hidden md:block absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1.5 rounded-full bg-background shadow-sm border hover:bg-accent",
                                                        isMe ? "-left-10" : "-right-10"
                                                    )}
                                                    title="Reply"
                                                >
                                                    <Reply className="h-4 w-4 text-muted-foreground" />
                                                </button>
                                            </div>
                                            {burnMs && !burningIds.has(msg.id) && (
                                                <span
                                                    aria-hidden
                                                    data-burn-ember
                                                    className="mt-1 h-[2px] w-full origin-left rounded-full bg-foreground/30"
                                                    style={{ animation: `burn-shrink ${burnMs}ms linear forwards` }}
                                                />
                                            )}
                                        </div>
                                    </motion.div>
                                    {burnMs && <SandBurn burning={burningIds.has(msg.id)} onDone={() => finishBurn(msg.id)} />}
                                </motion.div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-background via-background/90 to-transparent px-3 pb-4 pt-8 sm:px-4">
                    <div className="max-w-2xl mx-auto space-y-2 relative">

                        {sendError && (
                            <div className="px-3 py-2 rounded-2xl bg-destructive/10 border border-destructive/50 text-destructive text-sm animate-in slide-in-from-top-1">
                                {sendError}
                            </div>
                        )}

                        {imageError && (
                            <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/50 text-destructive text-sm animate-in slide-in-from-top-1">
                                {imageError}
                            </div>
                        )}

                        {showMentions && filteredParticipants.length > 0 && (
                            <div className="absolute bottom-full left-0 mb-2 z-40 bg-popover/95 backdrop-blur border shadow-2xl rounded-xl p-2 w-48 animate-in slide-in-from-bottom-2 fade-in duration-200">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">Suggestions</div>
                                {filteredParticipants.map((p, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "flex items-center gap-2 text-sm p-2 rounded-lg cursor-pointer transition-colors",
                                            i === selectedIndex ? "bg-primary/20 text-primary" : "hover:bg-primary/10 text-foreground"
                                        )}
                                        onClick={() => insertMention(p)}
                                    >
                                        <div className={cn("w-3 h-3 rounded-full", getAvatarColor(p))} />
                                        <span className={cn("font-medium", i === selectedIndex && "font-bold")}>{p}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {replyingTo && (
                            <div className="flex items-center justify-between rounded-2xl border border-border border-l-4 border-l-foreground bg-card p-2 px-3 animate-in slide-in-from-bottom-2">
                                <div className="text-sm overflow-hidden">
                                    <span className="font-semibold block text-xs">Replying to {replyingTo.sender}</span>
                                    <span className="text-muted-foreground truncate block text-xs mt-0.5">{replyingTo.content.text}</span>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setReplyingTo(null)} className="h-6 w-6 rounded-full hover:bg-background/80">
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        )}

                        <form onSubmit={sendMessage} className="flex items-center gap-1 rounded-full border border-border bg-card/80 p-1.5 pl-2 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.35)] transition-colors focus-within:border-foreground/40">
                            <div className="relative shrink-0" ref={plusMenuRef}>
                                <button
                                    type="button"
                                    aria-label="More"
                                    onClick={() => setShowPlusMenu(!showPlusMenu)}
                                    className={cn("grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-all hover:bg-accent hover:text-foreground", showPlusMenu && "rotate-45 bg-accent text-foreground")}
                                >
                                    <Plus className="h-5 w-5" />
                                </button>
                                {showPlusMenu && (
                                    <div className="absolute bottom-full left-0 z-50 mb-3 w-44 rounded-2xl border border-border bg-popover/95 p-1.5 shadow-2xl backdrop-blur animate-in slide-in-from-bottom-2 fade-in duration-200">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowPollModal(true);
                                                setShowPlusMenu(false);
                                            }}
                                            className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-sm text-foreground transition-colors hover:bg-accent"
                                        >
                                            <BarChart3 className="h-4 w-4" />
                                            <span>Create poll</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAudioRecorder(true)}
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                title="Send voice message"
                            >
                                <Mic className="h-[18px] w-[18px]" />
                            </button>
                            <button
                                type="button"
                                onClick={() => imageInputRef.current?.click()}
                                disabled={isUploadingImage}
                                className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50", isUploadingImage && "animate-pulse")}
                                title="Share image (max 25MB)"
                            >
                                <ImageIcon className="h-[18px] w-[18px]" />
                            </button>
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageSelect}
                                className="hidden"
                            />
                            <div className="relative shrink-0" ref={emojiPickerRef}>
                                {isEmojiPickerOpen && <EmojiPickerPopover onSelect={(emoji) => {
                                    setInput(prev => prev + emoji);
                                }} />
                                }
                                <button
                                    type="button"
                                    onClick={() => setIsEmojiPickerOpen(isOpen => !isOpen)}
                                    className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                    title="Emoji"
                                >
                                    <Smile className="h-[18px] w-[18px]" />
                                </button>
                            </div>
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={e => {
                                    setInput(e.target.value);
                                    setSelectedIndex(0);
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder={replyingTo ? "Type your reply…" : "Message… (@ to mention)"}
                                className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                aria-label="Send"
                                className={cn(
                                    "grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all",
                                    input.trim() ? "scale-100 bg-ember text-[#171412] shadow-[0_8px_20px_-8px_rgba(120,40,0,0.7)] hover:scale-105 active:scale-95" : "scale-95 bg-muted text-muted-foreground"
                                )}
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </form>
                    </div>
                </div>


                {/* Mobile Overlay Background (Optional) */}
                {showParticipants && (
                    <div
                        className="md:hidden absolute inset-0 bg-background/80 backdrop-blur-sm z-20"
                        onClick={() => setShowParticipants(false)}
                    />
                )}

                {/* Re-apply absolute positioning for sidebar on mobile to act as drawer */}
                <div className={cn(
                    "md:hidden absolute top-0 right-0 h-full bg-background border-l shadow-2xl transition-transform duration-300 ease-in-out z-30 w-72 flex flex-col",
                    showParticipants ? "translate-x-0" : "translate-x-full"
                )}>
                    <div className="p-4 border-b border-border/50 flex items-center justify-between shrink-0 h-[61px]">
                        <h3 className="font-bold flex items-center gap-2">
                            Participants
                            <span className="bg-secondary text-secondary-foreground text-[10px] px-2 py-0.5 rounded-full">{participants.length}</span>
                        </h3>
                        <Button variant="ghost" size="icon" onClick={() => setShowParticipants(false)} className="h-8 w-8 rounded-full">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        <div className="space-y-1">
                            {participants.length > 0 ? participants.map((p, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer group transition-colors" onClick={() => {
                                    insertMention(p);
                                    setShowParticipants(false);
                                }}>
                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold", getAvatarColor(p))}>
                                        {p[0].toUpperCase()}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={cn("text-sm font-medium", p === username ? "text-primary" : "text-foreground")}>
                                            {p} {p === username && "(You)"}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground text-primary/70">
                                            Online
                                        </span>
                                    </div>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground space-y-2 opacity-50">
                                    <Users className="h-8 w-8 mb-2" />
                                    <span className="text-xs">No active participants</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Poll Creation Modal */}
                {showPollModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <Card className="w-full max-w-md relative overflow-hidden rounded-[2rem] bg-card border border-border shadow-2xl animate-in zoom-in-95 duration-300 p-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-[family-name:var(--font-serif)] text-3xl leading-none text-foreground">Create a <span className="italic text-ember">poll.</span></h3>
                                    <Button variant="ghost" size="icon" onClick={() => {
                                        setShowPollModal(false);
                                        setPollQuestion('');
                                        setPollOptions(['', '']);
                                        setPollType('single');
                                    }} className="h-8 w-8 rounded-full">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1 block">Poll Type</label>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant={pollType === 'single' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setPollType('single')}
                                                className="flex-1 rounded-full"
                                            >
                                                Single Choice
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={pollType === 'multiple' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setPollType('multiple')}
                                                className="flex-1 rounded-full"
                                            >
                                                Multiple Choice
                                            </Button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1 block">Question</label>
                                        <Input
                                            value={pollQuestion}
                                            onChange={(e) => setPollQuestion(e.target.value)}
                                            placeholder="Ask a question..."
                                            className="rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1 block">Options</label>
                                        {pollOptions.map((option, i) => (
                                            <div key={i} className="flex gap-2 mb-2">
                                                <Input
                                                    value={option}
                                                    onChange={(e) => {
                                                        const newOptions = [...pollOptions];
                                                        newOptions[i] = e.target.value;
                                                        setPollOptions(newOptions);
                                                    }}
                                                    placeholder={`Option ${i + 1}`}
                                                    className="rounded-lg"
                                                />
                                                {pollOptions.length > 2 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                                                        className="shrink-0"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                        {pollOptions.length < 5 && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPollOptions([...pollOptions, ''])}
                                                className="rounded-full mt-1"
                                            >
                                                <Plus className="h-4 w-4 mr-1" />
                                                Add Option
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setShowPollModal(false);
                                            setPollQuestion('');
                                            setPollOptions(['', '']);
                                            setPollType('single');
                                        }}
                                        className="flex-1 rounded-full h-11 border-border hover:bg-muted"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={async () => {
                                            const filteredOptions = Array.from(new Set(pollOptions.map(o => o.trim()).filter(Boolean)));
                                            if (!pollQuestion.trim() || filteredOptions.length < 2) {
                                                return;
                                            }
                                            const pollData: PollData = {
                                                question: pollQuestion.trim().slice(0, 200),
                                                options: filteredOptions.map(o => o.slice(0, 100)),
                                                votes: Object.fromEntries(filteredOptions.map(o => [o.slice(0, 100), []])),
                                                creator: username,
                                                type: pollType
                                            };

                                            try {
                                                await postMessage({ text: `📊 Poll: ${pollData.question}`, poll: pollData });
                                                setShowPollModal(false);
                                                setPollQuestion('');
                                                setPollOptions(['', '']);
                                                setPollType('single');
                                            } catch (err) {
                                                console.error(err);
                                                flashSendError(err instanceof Error ? err.message : 'Poll failed to send.');
                                            }
                                        }}
                                        disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                                        className="flex-1 rounded-full h-11 shadow-lg"
                                    >
                                        Create Poll
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                <InviteManager
                    groupId={groupId}
                    groupName={groupName}
                    open={showInvite}
                    onClose={() => setShowInvite(false)}
                    roomKeyRef={rawKeyRef}
                    proofRef={proofRef}
                    inviteOnly={options.inviteOnly}
                    hasPassword={options.hasPassword}
                    onNotice={notify}
                />

                {/* End Session Confirmation Dialog */}
                {showEndConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-border bg-card p-7 text-center shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300">
                            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-foreground text-background">
                                <Power className="h-6 w-6" />
                            </div>
                            <h3 className="font-[family-name:var(--font-serif)] text-4xl leading-none text-foreground">End the <span className="italic text-ember">session?</span></h3>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                This closes the room for everyone and permanently deletes all messages and shared media. This can&apos;t be undone.
                            </p>
                            {endError && (
                                <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs font-medium text-destructive animate-in slide-in-from-top-1">
                                    {endError}
                                </p>
                            )}
                            <div className="mt-6 flex gap-3">
                                <Button
                                    variant="outline"
                                    disabled={isEnding}
                                    onClick={() => setShowEndConfirm(false)}
                                    className="h-11 flex-1 rounded-full border-border hover:border-foreground/40"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    disabled={isEnding}
                                    onClick={confirmEndSession}
                                    className="h-11 flex-1 rounded-full bg-foreground font-bold text-background hover:bg-foreground/90"
                                >
                                    {isEnding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {isEnding ? 'Ending…' : endError ? 'Try again' : 'End session'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Leave Confirmation Dialog */}
                {showLeaveConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <Card className="w-full max-w-sm relative overflow-hidden rounded-[2rem] bg-card border border-border shadow-2xl animate-in zoom-in-95 duration-300 p-6">
                            <div className="text-center space-y-4">
                                <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                                    <X className="h-6 w-6 text-destructive" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-[family-name:var(--font-serif)] text-3xl leading-none text-foreground">Leave the <span className="italic text-ember">chat?</span></h3>
                                    <p className="text-sm text-muted-foreground">
                                        Are you sure you want to leave? Your presence will be removed and you won&apos;t receive new messages.
                                    </p>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowLeaveConfirm(false)}
                                        className="flex-1 rounded-full h-11 border-border hover:bg-muted"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={confirmLeave}
                                        className="flex-1 rounded-full h-11 bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/20"
                                    >
                                        Leave
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </div>

            {/* Right Sidebar for Participants - Responsive & Collapsible */}
            <div className={cn(
                "border-l border-border/50 bg-background/95 backdrop-blur transition-all duration-300 ease-in-out overflow-hidden hidden md:flex flex-col z-20 shadow-xl",
                showParticipants ? "w-72 opacity-100" : "w-0 opacity-0"
            )}>
                <div className="p-4 border-b border-border/50 flex items-center justify-between shrink-0 h-[61px]">
                    <h3 className="font-bold flex items-center gap-2 truncate">
                        Participants
                        <span className="bg-secondary text-secondary-foreground text-[10px] px-2 py-0.5 rounded-full">{participants.length}</span>
                    </h3>
                    <Button variant="ghost" size="icon" onClick={() => setShowParticipants(false)} className="h-8 w-8 rounded-full shrink-0">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 min-w-[18rem]">
                    <div className="space-y-1">
                        {participants.length > 0 ? participants.map((p, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer group transition-colors" onClick={() => {
                                insertMention(p);
                                if (window.innerWidth < 768) setShowParticipants(false);
                            }}>
                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold", getAvatarColor(p))}>
                                    {p[0].toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                    <span className={cn("text-sm font-medium", p === username ? "text-primary" : "text-foreground")}>
                                        {p} {p === username && "(You)"}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground group-hover:text-primary/70 transition-colors">
                                        Online
                                    </span>
                                </div>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground space-y-2 opacity-50">
                                <Users className="h-8 w-8 mb-2" />
                                <span className="text-xs">No active participants</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Session ended overlay */}
            {sessionEnded && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background p-6 text-foreground animate-in fade-in duration-500">
                    <div
                        className="pointer-events-none absolute inset-0"
                        style={{ background: 'radial-gradient(45% 40% at 50% 100%, hsl(var(--ember) / 0.12), transparent 70%)' }}
                    />
                    <div className="relative flex max-w-md flex-col items-center text-center">
                        <div className="relative mb-8 grid h-24 w-24 place-items-center">
                            <span className="absolute inset-0 animate-ping rounded-full border border-ember/40" />
                            <span className="absolute inset-3 rounded-full border border-ember/50" />
                            <span className="relative grid h-12 w-12 place-items-center rounded-full bg-foreground text-background">
                                <Power className="h-5 w-5" />
                            </span>
                        </div>
                        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                            0 bytes kept
                        </div>
                        <h2 className="font-[family-name:var(--font-serif)] text-6xl leading-[0.9] md:text-7xl">Session <span className="italic text-ember">ended.</span></h2>
                        <p className="mt-4 text-muted-foreground">
                            {sessionEnded.by === 'timer'
                                ? "This room's timer ran out."
                                : sessionEnded.self ? 'You closed this room.' : `${sessionEnded.by} closed this room.`} All messages and media have been wiped.
                        </p>
                        <Button
                            onClick={() => router.push('/groups')}
                            className="group mt-8 h-12 rounded-full bg-foreground px-8 font-bold text-background hover:bg-foreground/90"
                        >
                            Back to groups
                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            Redirecting automatically…
                        </p>
                    </div>
                </div>
            )}

            {/* Audio Recorder Modal */}
            {showAudioRecorder && (
                <AudioRecorder
                    onSend={sendAudioMessage}
                    onCancel={() => setShowAudioRecorder(false)}
                    username={username}
                />
            )}
        </div>
    );
}
