"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from './ui/basic';
import { generateKey, exportKey } from '@/lib/crypto';
import { getRoomProof, saveRoomKey } from '@/lib/roomAuth';
import {
    DEFAULT_BURN_SECONDS, EXPIRY_CHOICES, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, describeBurn, parseBurnSeconds, parseMemberLimit,
} from '@/lib/roomOptions';
import { ArrowRight, Check, ChevronDown, Copy, Flame, KeyRound, Loader2, Lock, QrCode as QrIcon, Timer, Users, X } from 'lucide-react';
import QrCode from './QrCode';
import { cn } from '@/lib/utils';

export default function CreateGroupModal({ onClose, creatorId, onSuccess }: { onClose: () => void; creatorId: string; onSuccess?: () => void }) {
    const [name, setName] = useState('');
    const [tags, setTags] = useState('');
    const [showOptions, setShowOptions] = useState(false);
    const [password, setPassword] = useState('');
    const [expiryMinutes, setExpiryMinutes] = useState<number | null>(null);
    const [limitText, setLimitText] = useState('');
    const [inviteOnly, setInviteOnly] = useState(false);
    const [burnOn, setBurnOn] = useState(false);
    const [burnText, setBurnText] = useState(String(DEFAULT_BURN_SECONDS));
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [shareLink, setShareLink] = useState('');
    const [created, setCreated] = useState<{ hasPassword: boolean; expiryLabel: string | null; maxMembers: number | null; inviteOnly: boolean; burnSeconds: number | null } | null>(null);
    const [showQr, setShowQr] = useState(false);
    const [copied, setCopied] = useState(false);
    const router = useRouter();

    const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
    const { value: maxMembers, error: limitError } = parseMemberLimit(limitText);
    const { value: burnSeconds, error: burnParseError } = parseBurnSeconds(burnText);
    const burnError = burnOn ? burnParseError : null;

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || passwordTooShort || limitError || burnError) return;

        setIsLoading(true);
        setError('');
        try {
            const key = await generateKey();
            const exportedKey = await exportKey(key);

            const res = await fetch('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                    proof: await getRoomProof(exportedKey, password || undefined),
                    creator_id: creatorId,
                    expires_in_minutes: expiryMinutes,
                    max_members: maxMembers,
                    password_protected: password.length > 0,
                    invite_only: inviteOnly,
                    burn_seconds: burnOn ? burnSeconds : null,
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setError(err.error || 'Failed to create group');
                setIsLoading(false);
                return;
            }

            const group = await res.json();
            saveRoomKey(group.id, exportedKey);
            const hashKey = encodeURIComponent(exportedKey);
            setShareLink(`${window.location.origin}/chat/${group.id}#key=${hashKey}`);
            setCreated({
                hasPassword: password.length > 0,
                expiryLabel: EXPIRY_CHOICES.find(c => c.minutes === expiryMinutes)?.label ?? null,
                maxMembers,
                inviteOnly,
                burnSeconds: burnOn ? burnSeconds : null,
            });
            setIsLoading(false);
        } catch (err) {
            console.error(err);
            setError('Something went wrong. Please try again.');
            setIsLoading(false);
        }
    };

    const handleCopyLink = async () => {
        if (!shareLink) return;
        try {
            await navigator.clipboard.writeText(shareLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed', err);
        }
    };

    const inputCls =
        'h-12 rounded-full border-border bg-background/60 px-5 text-foreground placeholder:text-muted-foreground focus-visible:ring-foreground/30 disabled:opacity-60';
    const labelCls = 'ml-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground';
    const chip = (active: boolean) =>
        cn(
            'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
            active ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
        );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative my-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-border bg-card p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 sm:p-8">
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
                        <label className={labelCls} htmlFor="group-name">Group name</label>
                        <Input
                            id="group-name"
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
                        <label className={labelCls} htmlFor="group-tags">
                            Tags <span className="normal-case tracking-normal opacity-70">(comma separated)</span>
                        </label>
                        <Input
                            id="group-tags"
                            placeholder="fun, random, chill"
                            value={tags}
                            onChange={e => setTags(e.target.value)}
                            disabled={!!shareLink}
                            className={inputCls}
                        />
                    </div>

                    {!shareLink && (
                        <div className="rounded-2xl border border-border">
                            <button
                                type="button"
                                aria-expanded={showOptions}
                                onClick={() => setShowOptions(o => !o)}
                                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
                            >
                                <span className="flex items-center gap-2">
                                    Room options
                                    {(password || expiryMinutes || maxMembers || inviteOnly || burnOn) && (
                                        <span className="rounded-full bg-foreground px-2 py-0.5 font-mono text-[10px] text-background">
                                            {[password && 'password', expiryMinutes && 'timer', maxMembers && 'limit', inviteOnly && 'invites', burnOn && 'burn'].filter(Boolean).length} on
                                        </span>
                                    )}
                                </span>
                                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', showOptions && 'rotate-180')} />
                            </button>

                            {showOptions && (
                                <div className="space-y-5 border-t border-border p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="space-y-2">
                                        <span className={cn(labelCls, 'flex items-center gap-1.5')}>
                                            <Flame className="h-3 w-3" /> Links
                                        </span>
                                        <div className="grid grid-cols-2 gap-1 rounded-full border border-border p-1 text-xs font-semibold">
                                            <button className={cn('rounded-full py-2 transition-colors', !inviteOnly ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')} onClick={() => setInviteOnly(false)} type="button">
                                                Reusable link
                                            </button>
                                            <button className={cn('rounded-full py-2 transition-colors', inviteOnly ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')} onClick={() => setInviteOnly(true)} type="button">
                                                One-time links only
                                            </button>
                                        </div>
                                        <p className="ml-2 text-xs text-muted-foreground">
                                            {inviteOnly
                                                ? 'No shareable room link. Inside the room you make a link per person, and each one burns after it is used.'
                                                : 'One link anyone can use. You can still make one-time links later.'}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <span className={cn(labelCls, 'flex items-center gap-1.5')}>
                                            <Flame className="h-3 w-3" /> Burn mode
                                        </span>
                                        <div className="grid grid-cols-2 gap-1 rounded-full border border-border p-1 text-xs font-semibold">
                                            <button className={cn('rounded-full py-2 transition-colors', !burnOn ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')} onClick={() => setBurnOn(false)} type="button">
                                                Off
                                            </button>
                                            <button className={cn('rounded-full py-2 transition-colors', burnOn ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')} onClick={() => setBurnOn(true)} type="button">
                                                Messages burn
                                            </button>
                                        </div>
                                        {burnOn && (
                                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <Input
                                                    aria-label="Seconds until a message burns"
                                                    inputMode="numeric"
                                                    autoComplete="off"
                                                    value={burnText}
                                                    onChange={e => setBurnText(e.target.value)}
                                                    aria-invalid={Boolean(burnError)}
                                                    className={cn(inputCls, 'w-28 text-center', burnError && 'border-destructive')}
                                                />
                                                <span className="text-sm text-muted-foreground">seconds</span>
                                            </div>
                                        )}
                                        <p className={cn('ml-2 text-xs', burnError ? 'text-destructive' : 'text-muted-foreground')} role={burnError ? 'alert' : undefined}>
                                            {burnError ?? (burnOn && burnSeconds
                                                ? `Every message turns to sand ${describeBurn(burnSeconds)} after it appears, for everyone.`
                                                : 'Messages stay until the room ends.')}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className={cn(labelCls, 'flex items-center gap-1.5')} htmlFor="group-password">
                                            <KeyRound className="h-3 w-3" /> Password
                                        </label>
                                        <Input
                                            id="group-password"
                                            type="password"
                                            autoComplete="new-password"
                                            placeholder="Optional, shared separately from the link"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            maxLength={MAX_PASSWORD_LENGTH}
                                            className={cn(inputCls, passwordTooShort && 'border-destructive')}
                                        />
                                        <p className="ml-2 text-xs text-muted-foreground">
                                            {passwordTooShort
                                                ? `At least ${MIN_PASSWORD_LENGTH} characters.`
                                                : 'With a password, the link alone can\'t open or read the room.'}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <span className={cn(labelCls, 'flex items-center gap-1.5')}>
                                            <Timer className="h-3 w-3" /> Close automatically
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {EXPIRY_CHOICES.map(c => (
                                                <button className={chip(expiryMinutes === c.minutes)} key={c.label} onClick={() => setExpiryMinutes(c.minutes)} type="button">
                                                    {c.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className={cn(labelCls, 'flex items-center gap-1.5')} htmlFor="group-limit">
                                            <Users className="h-3 w-3" /> Member limit
                                        </label>
                                        <Input
                                            id="group-limit"
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            placeholder="Any number, or leave empty for no limit"
                                            value={limitText}
                                            onChange={e => setLimitText(e.target.value)}
                                            aria-invalid={Boolean(limitError)}
                                            className={cn(inputCls, limitError && 'border-destructive')}
                                        />
                                        <p className={cn('ml-2 text-xs', limitError ? 'text-destructive' : 'text-muted-foreground')} role={limitError ? 'alert' : undefined}>
                                            {limitError ?? (maxMembers ? `Up to ${maxMembers.toLocaleString()} people can be in the room at once.` : 'No limit: anyone with the link can join.')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive animate-in slide-in-from-top-1" role="alert">
                            {error}
                        </p>
                    )}

                    {shareLink && created && created.inviteOnly && (
                        <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-4 animate-in slide-in-from-bottom-2 fade-in duration-300">
                            <p className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                                <Flame className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                                <span>
                                    This room has <strong className="text-foreground">no reusable link</strong>. Open it, then use the
                                    <strong className="text-foreground"> Invite</strong> button to make a one-time link for each person.
                                    Each link works once and then burns.
                                </span>
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {created.hasPassword && <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><KeyRound className="h-3 w-3" /> Password: share it separately</span>}
                                {created.expiryLabel && created.expiryLabel !== 'Never' && <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><Timer className="h-3 w-3" /> Closes in {created.expiryLabel}</span>}
                                {created.maxMembers && <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><Users className="h-3 w-3" /> Up to {created.maxMembers}</span>}
                                    {created.burnSeconds && <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><Flame className="h-3 w-3" /> Messages burn after {describeBurn(created.burnSeconds)}</span>}
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

                    {shareLink && created && !created.inviteOnly && (
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

                            {(created.hasPassword || created.expiryLabel || created.maxMembers || created.burnSeconds) && (
                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    {created.hasPassword && <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><KeyRound className="h-3 w-3" /> Password: share it separately</span>}
                                    {created.expiryLabel && created.expiryLabel !== 'Never' && <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><Timer className="h-3 w-3" /> Closes in {created.expiryLabel}</span>}
                                    {created.maxMembers && <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><Users className="h-3 w-3" /> Up to {created.maxMembers}</span>}
                                    {created.burnSeconds && <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><Flame className="h-3 w-3" /> Messages burn after {describeBurn(created.burnSeconds)}</span>}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => setShowQr(q => !q)}
                                aria-expanded={showQr}
                                className="flex w-full items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-semibold transition-colors hover:border-foreground/40"
                            >
                                <QrIcon className="h-4 w-4" /> {showQr ? 'Hide QR code' : 'Show QR code'}
                            </button>
                            {showQr && (
                                <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                                    <QrCode value={shareLink} />
                                    <p className="text-center text-xs text-muted-foreground">
                                        This code contains the room key. Only show it to people you want inside.
                                    </p>
                                </div>
                            )}

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
                            onClick={() => { if (shareLink) onSuccess?.(); onClose(); }}
                            disabled={isLoading}
                            className="h-12 rounded-full border-border px-6 hover:border-foreground/40"
                        >
                            {shareLink ? 'Done' : 'Cancel'}
                        </Button>
                        {!shareLink && (
                            <Button
                                type="submit"
                                disabled={isLoading || !name.trim() || passwordTooShort || Boolean(limitError) || Boolean(burnError)}
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
