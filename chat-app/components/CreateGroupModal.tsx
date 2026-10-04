"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from './ui/basic';
import { generateKey, exportKey } from '@/lib/crypto';
import { getRoomProof, saveRoomKey } from '@/lib/roomAuth';
import { ArrowRight, Check, Copy, Loader2, Lock, X } from 'lucide-react';

export default function CreateGroupModal({ onClose, creatorId, onSuccess }: { onClose: () => void; creatorId: string; onSuccess?: () => void }) {
    const [name, setName] = useState('');
    const [tags, setTags] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [shareLink, setShareLink] = useState('');
    const [copied, setCopied] = useState(false);
    const router = useRouter();

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsLoading(true);
        try {
            const key = await generateKey();
            const exportedKey = await exportKey(key);

            const res = await fetch('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                    proof: await getRoomProof(exportedKey),
                    creator_id: creatorId
                })
            });

            if (!res.ok) {
                const err = await res.json();
                alert(err.error || 'Failed to create group');
                setIsLoading(false);
                return;
            }

            const group = await res.json();
            saveRoomKey(group.id, exportedKey);
            const hashKey = encodeURIComponent(exportedKey);
            const link = `${window.location.origin}/chat/${group.id}#key=${hashKey}`;
            setShareLink(link);
            setIsLoading(false);
        } catch (error) {
            console.error(error);
            alert('Something went wrong');
            setIsLoading(false);
        }
    };

    const handleCopyLink = async () => {
        if (!shareLink) return;
        try {
            await navigator.clipboard.writeText(shareLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Copy failed', error);
        }
    };

    const inputCls =
        'h-12 rounded-full border-border bg-background/60 px-5 text-foreground placeholder:text-muted-foreground focus-visible:ring-foreground/30 disabled:opacity-60';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-border bg-card p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 sm:p-8">
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
                        backgroundSize: '32px 32px',
                    }}
                />

                <div className="relative mb-7 flex items-start justify-between">
                    <div>
                        <div className="mb-3 flex w-fit items-center gap-2 rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            <Lock className="h-3 w-3" /> {shareLink ? 'Room ready' : 'Encrypted room'}
                        </div>
                        <h2 className="text-3xl font-bold leading-none tracking-tighter text-foreground">
                            {shareLink ? 'Share the link.' : 'New group'}
                        </h2>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        disabled={isLoading}
                        aria-label="Close"
                        className="h-10 w-10 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <form onSubmit={handleCreate} className="relative space-y-5">
                    <div className="space-y-2">
                        <label className="ml-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            Group name
                        </label>
                        <Input
                            placeholder="e.g. Late Night Yapping"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            maxLength={30}
                            required
                            autoFocus
                            disabled={!!shareLink}
                            className={inputCls}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="ml-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            Tags <span className="normal-case tracking-normal opacity-70">(comma separated)</span>
                        </label>
                        <Input
                            placeholder="fun, random, chill"
                            value={tags}
                            onChange={e => setTags(e.target.value)}
                            disabled={!!shareLink}
                            className={inputCls}
                        />
                    </div>

                    {shareLink && (
                        <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-4 animate-in slide-in-from-bottom-2 fade-in duration-300">
                            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                                Invite link
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={shareLink}
                                    readOnly
                                    onFocus={e => e.currentTarget.select()}
                                    className="h-10 rounded-full border-border bg-card px-4 font-mono text-xs text-foreground"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCopyLink}
                                    className="h-10 shrink-0 rounded-full border-border px-4 hover:border-foreground/40"
                                >
                                    {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
                                    {copied ? 'Copied' : 'Copy'}
                                </Button>
                            </div>
                            <Button
                                type="button"
                                onClick={() => router.push(shareLink.replace(window.location.origin, ''))}
                                className="group h-11 w-full rounded-full bg-foreground font-bold text-background hover:bg-foreground/90"
                            >
                                Open group
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isLoading}
                            className="h-12 rounded-full border-border px-6 hover:border-foreground/40"
                        >
                            {shareLink ? 'Done' : 'Cancel'}
                        </Button>
                        {!shareLink && (
                            <Button
                                type="submit"
                                disabled={isLoading || !name.trim()}
                                className="h-12 rounded-full bg-foreground px-8 font-bold text-background transition-transform hover:scale-[1.03] hover:bg-foreground active:scale-95 disabled:opacity-50"
                            >
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create
                            </Button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
