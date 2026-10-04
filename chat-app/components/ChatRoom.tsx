"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { importKey, encryptMessage, decryptMessage } from '@/lib/crypto';
import { getRoomProof } from '@/lib/roomAuth';
import {
    createSigner, importPublicKey, verifySignature, messageSigData, voteSigData, updatePins,
    type Signer,
} from '@/lib/signing';
import { Button, Input, Card } from './ui/basic';
import { Send, ArrowLeft, ArrowRight, Check, Loader2, Lock, Power, Reply, X, Users, Plus, Smile, Share2, BarChart3, Mic, Image as ImageIcon } from 'lucide-react';
import AudioRecorder from './AudioRecorder';
import AudioPlayer from './AudioPlayer';
import { cn } from '@/lib/utils';
import { motion, PanInfo } from "framer-motion";
import ModeToggle from "./ModeToggle";
import EmojiPickerPopover from './EmojiPicker';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ReplyContext {
    id: string;
    sender: string;
    text: string;
}

interface PollData {
    question: string;
    options: string[];
    votes: { [option: string]: string[] }; // option -> array of usernames who voted
    creator: string;
    type: 'single' | 'multiple'; // single or multiple choice
}

interface MessageContent {
    text: string;
    replyTo?: ReplyContext;
    poll?: PollData;
    audio?: string; // base64 encoded audio data
    image?: string; // URL to uploaded image
    from?: string; // sender name, bound inside the encrypted payload
}

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
        'bg-neutral-950 text-white dark:bg-white dark:text-black',
        'bg-neutral-700 text-white dark:bg-neutral-300 dark:text-black',
        'bg-neutral-500 text-white dark:bg-neutral-400 dark:text-black',
        'bg-neutral-300 text-black dark:bg-neutral-600 dark:text-white',
        'bg-neutral-200 text-black ring-1 ring-border dark:bg-neutral-800 dark:text-white',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return shades[Math.abs(hash) % shades.length];
};

// ---------------------------------------------------------------------------
// Input hardening: everything that arrives over the room channel is untrusted.
// ---------------------------------------------------------------------------
const MAX_TEXT_LENGTH = 4000;
const MAX_NAME_LENGTH = 15;
const MAX_AUDIO_RECEIVE_B64 = 400_000;
const MAX_AUDIO_SEND_B64 = 160_000; // keeps the encrypted broadcast under realtime payload limits
const MEDIA_URL_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chat-images/`;

const newId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const isMediaUrl = (v: unknown): v is string =>
    typeof v === 'string' && v.startsWith(MEDIA_URL_PREFIX) && !/\s/.test(v) && v.length < 600;

function sanitizePoll(raw: unknown): PollData | null {
    if (!isRecord(raw)) return null;
    const { question, options, votes, creator, type } = raw;
    if (typeof question !== 'string' || !question || question.length > 200) return null;
    if (!Array.isArray(options) || options.length < 2 || options.length > 10) return null;
    if (!options.every(o => typeof o === 'string' && o.length > 0 && o.length <= 100)) return null;
    const opts = Array.from(new Set(options as string[]));
    if (opts.length < 2) return null;
    if (type !== 'single' && type !== 'multiple') return null;

    const safeVotes: PollData['votes'] = {};
    const rawVotes = isRecord(votes) ? votes : {};
    for (const o of opts) {
        const v = rawVotes[o];
        safeVotes[o] = Array.isArray(v)
            ? Array.from(new Set(v.filter((u): u is string => typeof u === 'string' && u.length > 0 && u.length <= MAX_NAME_LENGTH))).slice(0, 200)
            : [];
    }
    return {
        question,
        options: opts,
        votes: safeVotes,
        creator: typeof creator === 'string' ? creator.slice(0, MAX_NAME_LENGTH) : '',
        type,
    };
}

function sanitizeContent(raw: unknown): MessageContent | null {
    if (!isRecord(raw)) return null;
    if (typeof raw.text !== 'string' || raw.text.length > MAX_TEXT_LENGTH) return null;

    const content: MessageContent = { text: raw.text };

    if (typeof raw.from === 'string') content.from = raw.from;

    if (isRecord(raw.replyTo)) {
        const r = raw.replyTo;
        if (typeof r.id === 'string' && typeof r.sender === 'string' && typeof r.text === 'string') {
            content.replyTo = { id: r.id.slice(0, 64), sender: r.sender.slice(0, MAX_NAME_LENGTH), text: r.text.slice(0, 80) };
        }
    }
    if (raw.poll !== undefined) {
        const poll = sanitizePoll(raw.poll);
        if (!poll) return null;
        content.poll = poll;
    }
    if (typeof raw.audio === 'string' && raw.audio.length <= MAX_AUDIO_RECEIVE_B64 && /^[A-Za-z0-9+/=]+$/.test(raw.audio)) {
        content.audio = raw.audio;
    }
    if (isMediaUrl(raw.image)) content.image = raw.image;

    return content;
}

/** Apply one person's selections to a poll without touching anyone else's votes. */
function applyVote(poll: PollData, voter: string, selections: string[]): PollData {
    const chosen = new Set(selections.filter(o => poll.options.includes(o)));
    const picked = poll.type === 'single' ? Array.from(chosen).slice(0, 1) : Array.from(chosen);
    const votes: PollData['votes'] = {};
    for (const o of poll.options) {
        const others = (poll.votes[o] || []).filter(u => u !== voter);
        votes[o] = picked.includes(o) ? [...others, voter] : others;
    }
    return { ...poll, votes };
}

const GRID_BG = {
    backgroundImage:
        'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
    backgroundSize: '56px 56px',
} as const;

export default function ChatRoom({ groupId, groupName }: { groupId: string; groupName: string }) {
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
    const [sessionEnded, setSessionEnded] = useState<{ by: string; self: boolean } | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [shareCopied, setShareCopied] = useState(false);
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

    useEffect(() => { usernameRef.current = username; }, [username]);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

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
            if (isJoined && !sessionEnded) {
                e.preventDefault();
                e.returnValue = ''; 
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isJoined, sessionEnded]);

    // After a session ends, send everyone back to the group list
    useEffect(() => {
        if (!sessionEnded) return;
        const t = setTimeout(() => router.push('/groups'), 4000);
        return () => clearTimeout(t);
    }, [sessionEnded, router]);

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

    // Initialize encryption key (and the proof the server uses to check we know it)
    useEffect(() => {
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.replace('#', '?'));
        const keyString = params.get('key');

        if (!keyString) {
            setError('Missing encryption key. Please join via a valid link.');
            return;
        }

        const init = async () => {
            try {
                const rawKey = decodeURIComponent(keyString);
                const importedKey = await importKey(rawKey);
                proofRef.current = await getRoomProof(rawKey);
                setKey(importedKey);
            } catch (err) {
                console.error(err);
                setError('Invalid encryption key.');
            }
        };

        init();
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

        // Runs on unmount AND when the tab is closed / backgrounded for good (pagehide),
        // because React cleanup never runs when a tab is simply closed.
        const leaveRoom = () => {
            if (!isJoined || leftRoom) return;
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

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = username.trim();
        if (!trimmedName) return;

        if (participants.some(p => p.toLowerCase() === trimmedName.toLowerCase())) {
            setJoinError(`Username "${trimmedName}" is already taken.`);
            setTimeout(() => setJoinError(''), 3000);  
            return;
        }

        setIsJoined(true);
    };

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

    const handleShareLink = async () => {
        const keyHash = window.location.hash || '';
        const link = `${window.location.origin}/chat/${groupId}${keyHash}`;

        try {
            await navigator.clipboard.writeText(link);
            setShareCopied(true);
            setTimeout(() => setShareCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed', err);
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
                <div className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.07]" style={{ ...GRID_BG, maskImage: 'radial-gradient(ellipse at center, black 10%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 10%, transparent 70%)' }} />
                <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card/70 p-8 text-center backdrop-blur">
                    <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-foreground text-background">
                        <Lock className="h-6 w-6" />
                    </div>
                    <h2 className="mb-2 text-2xl font-bold tracking-tighter">Access denied</h2>
                    <p className="mb-8 text-sm leading-relaxed text-muted-foreground">{error}</p>
                    <Button onClick={() => router.push('/groups')} className="h-11 w-full rounded-full bg-foreground font-bold text-background hover:bg-foreground/90">
                        Return to Groups
                    </Button>
                </div>
            </div>
        );
    }

    if (!isJoined) {
        return (
            <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 text-foreground animate-in fade-in duration-500">
                <div className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.07]" style={{ ...GRID_BG, maskImage: 'radial-gradient(ellipse at center, black 10%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 10%, transparent 70%)' }} />
                <div className="absolute right-4 top-4 z-10"><ModeToggle /></div>

                <div className="relative w-full max-w-sm">
                    <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-b from-foreground/10 to-transparent blur-2xl" />
                    <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.4)] backdrop-blur">
                        <div className="mb-8 text-center">
                            <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                <Lock className="h-3 w-3" /> End-to-end encrypted
                            </div>
                            <h1 className="text-4xl font-bold leading-[0.95] tracking-tighter">Join the room</h1>
                            {groupName && (
                                <p className="mt-3 truncate font-mono text-xs text-muted-foreground">{groupName}</p>
                            )}
                            <p className="mt-3 text-sm text-muted-foreground">Pick a temporary name. It disappears when you leave.</p>
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
                                        "h-12 rounded-full border-border bg-background/60 pl-9 font-mono focus-visible:ring-foreground/30",
                                        joinError && "border-destructive focus-visible:ring-destructive"
                                    )}
                                />
                            </div>
                            {joinError && (
                                <p className="px-2 text-xs font-medium text-destructive animate-in slide-in-from-top-1">{joinError}</p>
                            )}
                            <Button type="submit" size="lg" className="group h-12 w-full rounded-full bg-foreground font-bold text-background transition-transform hover:scale-[1.02] hover:bg-foreground active:scale-95">
                                Enter room
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
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
                    className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.05]"
                    style={{ ...GRID_BG, maskImage: 'radial-gradient(ellipse at 50% 0%, black 10%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black 10%, transparent 70%)' }}
                />

                {/* Header */}
                <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border/60 bg-background/70 px-3 py-3 backdrop-blur-xl sm:px-5">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <Button variant="ghost" size="icon" onClick={handleExitRequest} className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="min-w-0">
                            <h2 className="max-w-[160px] truncate text-sm font-bold leading-tight tracking-tight sm:max-w-md md:text-base">
                                {groupName || "Group Chat"}
                            </h2>
                            <div className="mt-0.5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-60" />
                                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground" />
                                    </span>
                                    {userCount} online
                                </span>
                                <span className="hidden items-center gap-1 sm:flex"><Lock className="h-2.5 w-2.5" /> encrypted</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                        <ModeToggle />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleShareLink}
                            className="rounded-full border-border bg-transparent px-3 hover:border-foreground/40"
                            title="Copy invite link"
                        >
                            {shareCopied ? <Check className="h-4 w-4 sm:mr-1.5" /> : <Share2 className="h-4 w-4 sm:mr-1.5" />}
                            <span className="hidden sm:inline">{shareCopied ? 'Copied' : 'Share'}</span>
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
                                showParticipants ? "bg-foreground text-background hover:bg-foreground/90 hover:text-background" : "text-muted-foreground hover:text-foreground"
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
                                    <span className="absolute inset-0 animate-ping rounded-full border border-foreground/20" />
                                    <span className="absolute inset-3 rounded-full border border-foreground/30" />
                                    <span className="relative grid h-10 w-10 place-items-center rounded-full bg-foreground text-background">
                                        <Lock className="h-4 w-4" />
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold tracking-tighter">Room is open.</h3>
                                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                                    Messages are encrypted and exist only while this session is live. Say something, or share the link.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleShareLink}
                                    className="mt-6 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground/40"
                                >
                                    {shareCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                                    {shareCopied ? 'Link copied' : 'Copy invite link'}
                                </button>
                            </div>
                        )}
                        {messages.map((msg, index) => {
                            if (msg.isSystem) {
                                return (
                                    <div key={msg.id} className="my-4 flex items-center justify-center gap-3 opacity-70">
                                        <span className="h-px w-8 bg-border" />
                                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                            {msg.content.text}
                                        </span>
                                        <span className="h-px w-8 bg-border" />
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
                                        <div className={cn("flex flex-col max-w-[75%]", isMe ? "items-end" : "items-start")}>
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
                                                    className={cn(
                                                        "relative px-4 py-2.5 text-sm break-words whitespace-pre-wrap leading-relaxed", // Added whitespace-pre-wrap
                                                        isMe
                                                            ? "bg-foreground text-background rounded-2xl rounded-tr-md"
                                                            : "bg-card border border-border rounded-2xl rounded-tl-md text-foreground",
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
                                        </div>
                                    </motion.div>
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
                                    input.trim() ? "scale-100 bg-foreground text-background hover:scale-105 active:scale-95" : "scale-95 bg-muted text-muted-foreground"
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
                                    <h3 className="text-xl font-bold tracking-tight text-foreground">Create Poll</h3>
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

                {/* End Session Confirmation Dialog */}
                {showEndConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-border bg-card p-7 text-center shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300">
                            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-foreground text-background">
                                <Power className="h-6 w-6" />
                            </div>
                            <h3 className="text-2xl font-bold tracking-tighter text-foreground">End session?</h3>
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
                                    <h3 className="text-xl font-bold tracking-tight text-foreground">Leave Chat?</h3>
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
                        className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.07]"
                        style={{ ...GRID_BG, maskImage: 'radial-gradient(ellipse at center, black 10%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 10%, transparent 70%)' }}
                    />
                    <div className="relative flex max-w-md flex-col items-center text-center">
                        <div className="relative mb-8 grid h-24 w-24 place-items-center">
                            <span className="absolute inset-0 animate-ping rounded-full border border-foreground/20" />
                            <span className="absolute inset-3 rounded-full border border-foreground/30" />
                            <span className="relative grid h-12 w-12 place-items-center rounded-full bg-foreground text-background">
                                <Power className="h-5 w-5" />
                            </span>
                        </div>
                        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                            0 bytes kept
                        </div>
                        <h2 className="text-4xl font-bold leading-[0.95] tracking-tighter md:text-5xl">Session ended.</h2>
                        <p className="mt-4 text-muted-foreground">
                            {sessionEnded.self ? 'You closed this room.' : `${sessionEnded.by} closed this room.`} All messages and media have been wiped.
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
