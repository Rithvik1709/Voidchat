"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { importKey, encryptMessage, decryptMessage } from '@/lib/crypto';
import { Button, Input, Card } from './ui/basic';
import { Send, ArrowLeft, ArrowRight, Check, Lock, Reply, X, Users, Plus, Smile, Share2, BarChart3, Mic, Image as ImageIcon } from 'lucide-react';
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
    const plusMenuRef = useRef<HTMLDivElement>(null);

    const emojiPickerRef = useRef<HTMLDivElement>(null)
    const channelRef = useRef<RealtimeChannel | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

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
            if (isJoined) {
                e.preventDefault();
                e.returnValue = ''; 
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isJoined]);

    useEffect(() => {
        if (replyingTo) {
            inputRef.current?.focus();
        }
    }, [replyingTo]);

    // Initialize encryption key
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
                const importedKey = await importKey(decodeURIComponent(keyString));
                setKey(importedKey);
            } catch (err) {
                console.error(err);
                setError('Invalid encryption key.');
            }
        };

        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setIsEmojiPickerOpen(false);
            }
            if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
                setShowPlusMenu(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
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

        const handleMessage = async (payload: any) => {
            try {

                const decryptedString = await decryptMessage(payload.encryptedPayload, key);
                let content: MessageContent;

                try {
                    content = JSON.parse(decryptedString);
                    if (typeof content !== 'object') throw new Error('Not object');
                } catch {
                    content = { text: decryptedString };
                }

                setMessages(prev => {
                    if (prev.some(m => m.id === payload.id)) return prev;
                    return [...prev, { ...payload, content }];
                });
            } catch (err) {
                console.error('Failed to decrypt message', err);
            }
        };

        const handleVote = async (payload: any) => {
            try {
                const decryptedString = await decryptMessage(payload.encryptedPayload, key);
                const content: MessageContent = JSON.parse(decryptedString);
                
                setMessages(prev => prev.map(m => 
                    m.id === payload.messageId ? { ...m, content } : m
                ));
            } catch (err) {
                console.error('Vote decrypt failed', err);
            }
        };

        channel
            .on('broadcast', { event: 'message' }, ({ payload }) => handleMessage(payload))
            .on('broadcast', { event: 'vote' }, ({ payload }) => handleVote(payload))
            .on('broadcast', { event: 'clear' }, () => {
                setMessages([]);
                setReplyingTo(null);
            })
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                const users = Object.keys(newState).filter(k => k && k !== 'undefined');
                setParticipants(users);
                setUserCount(users.length);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    sender: 'System',
                    content: { text: `${key} joined` },
                    timestamp: new Date().toISOString(),
                    isSystem: true
                }]);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    sender: 'System',
                    content: { text: `${key} left` },
                    timestamp: new Date().toISOString(),
                    isSystem: true
                }]);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    if (isJoined && username) {
                        await channel.track({ online_at: new Date().toISOString() });
                    }
                }
            });

        let heartbeatInterval: NodeJS.Timeout;

        if (isJoined && username) {
            fetch(`/api/groups/${groupId}/membership`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'join' })
            }).catch(e => console.error('Join failed', e));

            heartbeatInterval = setInterval(async () => {
                try {
                    await fetch('/api/groups/heartbeat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ groupId })
                    });
                } catch (e) {
                    console.error('Heartbeat failed', e);
                }
            }, 60000); 

            fetch('/api/groups/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId })
            }).catch(err => console.error(err));
        }

        return () => {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            supabase.removeChannel(channel);
            channelRef.current = null;

            if (isJoined) {

                const data = JSON.stringify({ action: 'leave' });
                if (navigator.sendBeacon) {
                    const blob = new Blob([data], { type: 'application/json' });
                    navigator.sendBeacon(`/api/groups/${groupId}/membership`, blob);
                } else {
                    fetch(`/api/groups/${groupId}/membership`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        keepalive: true, 
                        body: data
                    }).catch(e => console.error('Leave failed', e));
                }
            }
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

    const handleEndSession = async () => {
        if (!channelRef.current) return;

        const confirmed = window.confirm('End session and clear all messages for everyone?');
        if (!confirmed) return;

        try {
            await channelRef.current.send({
                type: 'broadcast',
                event: 'clear',
                payload: { by: username, at: new Date().toISOString() }
            });

            await fetch(`/api/groups/${groupId}/end`, { method: 'DELETE' });

            setMessages([]);
            setReplyingTo(null);
        } catch (err) {
            console.error('Failed to end session', err);
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

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) {
            setImageError('Only image files are allowed');
            setTimeout(() => setImageError(''), 3000);
            return;
        }

        setIsUploadingImage(true);
        setImageError('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('groupId', groupId);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Upload failed');
            }

            const data = await response.json();
            
            // Send image message
            if (key) {
                const content: MessageContent = {
                    text: '🖼️ Image',
                    image: data.url
                };

                const payloadString = JSON.stringify(content);
                const encryptedPayload = await encryptMessage(payloadString, key);

                const messageData = {
                    id: Date.now().toString(),
                    sender: username,
                    timestamp: new Date().toISOString(),
                    encryptedPayload: encryptedPayload
                };

                await supabase.channel(`room:${groupId}`).send({
                    type: 'broadcast',
                    event: 'message',
                    payload: messageData
                });
                setMessages(prev => [...prev, { ...messageData, content }]);
            }
        } catch (err) {
            console.error('Image upload error:', err);
            setImageError(err instanceof Error ? err.message : 'Failed to upload image');
            setTimeout(() => setImageError(''), 3000);
        } finally {
            setIsUploadingImage(false);
            // Reset input
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
            const content: MessageContent = {
                text: input.trim(),
                replyTo: replyingTo ? {
                    id: replyingTo.id,
                    sender: replyingTo.sender,
                    text: replyingTo.content.text.substring(0, 50) + (replyingTo.content.text.length > 50 ? '...' : '')
                } : undefined
            };

            const payloadString = JSON.stringify(content);
            const encryptedPayload = await encryptMessage(payloadString, key);

            const messageData = {
                id: Date.now().toString(),
                sender: username,
                timestamp: new Date().toISOString(),
                encryptedPayload: encryptedPayload
            };

            await supabase.channel(`room:${groupId}`).send({
                type: 'broadcast',
                event: 'message',
                payload: messageData
            });
            setMessages(prev => [...prev, { ...messageData, content }]);

            setInput('');
            setReplyingTo(null);
        } catch (err) {
            console.error(err);
        }
    };

    const sendAudioMessage = async (audioBlob: Blob) => {
        if (!key) return;

        try {
            // Convert blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = reader.result as string;
                // Remove data URL prefix
                const base64Data = base64Audio.split(',')[1];

                const content: MessageContent = {
                    text: '🎤 Voice message',
                    audio: base64Data
                };

                const payloadString = JSON.stringify(content);
                const encryptedPayload = await encryptMessage(payloadString, key);

                const messageData = {
                    id: Date.now().toString(),
                    sender: username,
                    timestamp: new Date().toISOString(),
                    encryptedPayload: encryptedPayload
                };

                await supabase.channel(`room:${groupId}`).send({
                    type: 'broadcast',
                    event: 'message',
                    payload: messageData
                });
                setMessages(prev => [...prev, { ...messageData, content }]);
                
                // Clean up the UI
                setShowAudioRecorder(false);
            };
        } catch (err) {
            console.error('Error sending audio:', err);
            // Clean up even on error
            setShowAudioRecorder(false);
        }
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
                                        onDragEnd={(e: any, info: PanInfo) => {
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
                                                                                const newVotes = { ...poll.votes };
                                                                                
                                                                                // If single choice, remove vote from all other options
                                                                                if (poll.type === 'single') {
                                                                                    Object.keys(newVotes).forEach(opt => {
                                                                                        newVotes[opt] = newVotes[opt].filter(u => u !== username);
                                                                                    });
                                                                                }
                                                                                
                                                                                // Toggle vote for this option
                                                                                if (hasVoted) {
                                                                                    newVotes[option] = newVotes[option].filter(u => u !== username);
                                                                                } else {
                                                                                    newVotes[option] = [...(newVotes[option] || []), username];
                                                                                }
                                                                                
                                                                                const updatedPoll: PollData = {
                                                                                    ...poll,
                                                                                    votes: newVotes
                                                                                };
                                                                                
                                                                                // Broadcast the updated poll
                                                                                try {
                                                                                    const content: MessageContent = {
                                                                                        text: msg.content.text,
                                                                                        poll: updatedPoll
                                                                                    };
                                                                                    const payloadString = JSON.stringify(content);
                                                                                    const encryptedPayload = await encryptMessage(payloadString, key!);
                                                                                    
                                                                                    await supabase.channel(`room:${groupId}`).send({
                                                                                        type: 'broadcast',
                                                                                        event: 'vote',
                                                                                        payload: {
                                                                                            messageId: msg.id,
                                                                                            encryptedPayload: encryptedPayload
                                                                                        }
                                                                                    });
                                                                                    
                                                                                    // Update local state
                                                                                    setMessages(prev => prev.map(m => 
                                                                                        m.id === msg.id ? { ...m, content } : m
                                                                                    ));
                                                                                } catch (err) {
                                                                                    console.error('Vote error:', err);
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
                                                        msg.content.text.split(new RegExp(`(@${username}\\b)`, 'gi')).map((part, i) =>
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
                            <div className="relative shrink-0">
                                <div ref={emojiPickerRef}>
                                    {isEmojiPickerOpen && <EmojiPickerPopover onSelect={(emoji) => {
                                        setInput(prev => prev + emoji);
                                    }} />
                                    }
                                </div>
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
                                            if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
                                                return;
                                            }
                                            const filteredOptions = pollOptions.filter(o => o.trim());
                                            const pollData: PollData = {
                                                question: pollQuestion.trim(),
                                                options: filteredOptions,
                                                votes: Object.fromEntries(filteredOptions.map(o => [o, []])),
                                                creator: username,
                                                type: pollType
                                            };
                                            
                                            try {
                                                const content: MessageContent = {
                                                    text: `📊 Poll: ${pollData.question}`,
                                                    poll: pollData
                                                };
                                                const payloadString = JSON.stringify(content);
                                                const encryptedPayload = await encryptMessage(payloadString, key!);
                                                const messageData = {
                                                    id: Date.now().toString(),
                                                    sender: username,
                                                    timestamp: new Date().toISOString(),
                                                    encryptedPayload: encryptedPayload
                                                };
                                                await supabase.channel(`room:${groupId}`).send({
                                                    type: 'broadcast',
                                                    event: 'message',
                                                    payload: messageData
                                                });
                                                setMessages(prev => [...prev, { ...messageData, content }]);
                                            } catch (err) {
                                                console.error(err);
                                            }
                                            
                                            setShowPollModal(false);
                                            setPollQuestion('');
                                            setPollOptions(['', '']);
                                            setPollType('single');
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
                                        Are you sure you want to leave? Your presence will be removed and you won't receive new messages.
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
