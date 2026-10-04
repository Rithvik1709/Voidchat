"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Check, Copy, Flame, KeyRound, Link2, Loader2, QrCode as QrIcon, Share2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/basic";
import QrCode from "@/components/QrCode";
import { cn } from "@/lib/utils";
import { inviteTokenHash, newInviteToken, verifyInviteMac, wrapRoomKey } from "@/lib/invites";
import { sanitizePublicJwk } from "@/lib/signing";
import { loadMyInvites, saveMyInvites } from "@/lib/inviteSession";

type Status = "unused" | "claimed" | "used";
type Mine = { id: string; token: string; status: Status };
type ServerInvite = { id: string; status: Status; claim_pub: unknown; claim_mac: string | null };

const POLL_MS = 3000;

/**
 * Makes and answers one-time invite links. It stays mounted for as long as you are in the room:
 * when someone opens one of your links, YOUR browser is the one that checks their claim and
 * hands them the room key (encrypted to them), so you need to stay in the room until they are in.
 */
export default function InviteManager({
  groupId,
  groupName,
  open,
  onClose,
  roomKeyRef,
  proofRef,
  inviteOnly,
  hasPassword,
  onNotice,
}: {
  groupId: string;
  groupName: string;
  open: boolean;
  onClose: () => void;
  roomKeyRef: MutableRefObject<string>;
  proofRef: MutableRefObject<string>;
  inviteOnly: boolean;
  hasPassword: boolean;
  onNotice: (text: string) => void;
}) {
  const [mine, setMine] = useState<Mine[]>([]);
  const [tab, setTab] = useState<"one-time" | "room">("one-time");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);

  const mineRef = useRef<Mine[]>([]);
  const loaded = useRef(false);
  const answered = useRef(new Set<string>());

  useEffect(() => {
    mineRef.current = mine;
  }, [mine]);

  // Restore the invites this tab made (so a refresh doesn't strand a pending claim)
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      if (!alive) return;
      setMine(loadMyInvites(groupId).map(i => ({ ...i, status: "unused" as Status })));
      loaded.current = true;
    });
    return () => {
      alive = false;
    };
  }, [groupId]);

  useEffect(() => {
    if (!loaded.current) return;
    saveMyInvites(groupId, mine.filter(i => i.status !== "used").map(({ id, token }) => ({ id, token })));
  }, [mine, groupId]);

  const hasOpen = mine.some(i => i.status === "unused" || i.status === "claimed");

  // Watch for people opening our links, and answer them
  useEffect(() => {
    if (!hasOpen) return;
    let stopped = false;

    const answer = async (inv: Mine, srv: ServerInvite, handledKey: string) => {
      const pub = sanitizePublicJwk(srv.claim_pub);
      const genuine = pub && typeof srv.claim_mac === "string" && (await verifyInviteMac(inv.token, pub, srv.claim_mac));
      if (!genuine || !pub) {
        // Whoever claimed does not hold the real link (or the server tampered). Ignore; the claim lapses.
        onNotice("A claim on one of your invite links could not be verified and was ignored.");
        return;
      }
      try {
        const delivery = await wrapRoomKey(roomKeyRef.current, pub, inv.id);
        const res = await fetch(`/api/groups/${groupId}/invites/${inv.id}/deliver`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-room-proof": proofRef.current },
          body: JSON.stringify({ delivery }),
        });
        if (res.ok) {
          setMine(prev => prev.map(i => (i.id === inv.id ? { ...i, status: "used" } : i)));
          onNotice("Someone just joined through a one-time link.");
        } else {
          answered.current.delete(handledKey);
        }
      } catch {
        answered.current.delete(handledKey);
      }
    };

    const tick = async () => {
      try {
        if (!mineRef.current.some(i => i.status === "unused" || i.status === "claimed")) return;
        const res = await fetch(`/api/groups/${groupId}/invites`, { headers: { "x-room-proof": proofRef.current }, cache: "no-store" });
        if (!res.ok || stopped) return;
        const { invites } = (await res.json()) as { invites: ServerInvite[] };
        const byId = new Map(invites.map(i => [i.id, i]));

        for (const inv of mineRef.current) {
          const srv = byId.get(inv.id);
          if (srv?.status === "claimed") {
            const handledKey = `${inv.id}:${srv.claim_mac}`;
            if (!answered.current.has(handledKey)) {
              answered.current.add(handledKey);
              void answer(inv, srv, handledKey);
            }
          }
        }

        setMine(prev =>
          prev.flatMap((inv): Mine[] => {
            const srv = byId.get(inv.id);
            if (!srv) return inv.status === "used" ? [inv] : []; // revoked or expired elsewhere
            return srv.status === inv.status ? [inv] : [{ ...inv, status: srv.status }];
          })
        );
      } catch {
        /* try again on the next tick */
      }
    };

    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [hasOpen, groupId, proofRef, roomKeyRef, onNotice]);

  const linkFor = (token: string) => `${window.location.origin}/chat/${groupId}#invite=${token}`;
  const roomLink = () => `${window.location.origin}/chat/${groupId}#key=${encodeURIComponent(roomKeyRef.current)}`;

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(c => (c === id ? null : c)), 2000);
    } catch {
      setError("Could not copy automatically. Select the link and copy it.");
    }
  };

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const token = newInviteToken();
      const res = await fetch(`/api/groups/${groupId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-room-proof": proofRef.current },
        body: JSON.stringify({ tokenHash: await inviteTokenHash(token) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not create a link. Try again.");
        return;
      }
      const { id } = (await res.json()) as { id: string };
      setMine(prev => [...prev, { id, token, status: "unused" }]);
      await copy(id, linkFor(token));
    } catch (err) {
      console.error(err);
      setError("Could not create a link. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/invites/${id}`, { method: "DELETE", headers: { "x-room-proof": proofRef.current } });
      if (res.ok || res.status === 404) setMine(prev => prev.filter(i => i.id !== id));
      else setError("Could not revoke that link.");
    } catch {
      setError("Could not revoke that link.");
    }
  };

  if (!open) return null;

  const visible = [...mine].reverse();
  const statusText: Record<Status, string> = {
    unused: "Waiting: nobody has opened it yet",
    claimed: "Opened: letting them in…",
    used: "Used: this link is burned",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="relative my-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-border bg-card p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Invite people"
      >
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 h-9 w-9 rounded-full">
          <X className="h-4 w-4" />
        </Button>

        <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Invite people</div>
        <h3 className="mb-5 truncate pr-8 text-2xl font-bold tracking-tighter">{groupName}</h3>

        {!inviteOnly && (
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-border p-1 text-sm font-semibold">
            {(["one-time", "room"] as const).map(t => (
              <button
                className={cn("rounded-full py-2 transition-colors", tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                key={t}
                onClick={() => setTab(t)}
                type="button"
              >
                {t === "one-time" ? "One-time link" : "Room link"}
              </button>
            ))}
          </div>
        )}

        {(inviteOnly || tab === "one-time") && (
          <div className="space-y-4">
            <p className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
              <Flame className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <span>
                Each link lets in <strong className="text-foreground">one person</strong> and then burns. A copy of it is useless
                afterwards. Stay in this room until they have joined: your browser is what hands them the key.
                {hasPassword && " They will also need the password."}
              </span>
            </p>

            <Button
              onClick={create}
              disabled={busy}
              className="h-12 w-full rounded-full bg-foreground font-bold text-background hover:bg-foreground/90"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Create a one-time link
            </Button>

            {error && (
              <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            )}

            {visible.length > 0 && (
              <ul className="space-y-2">
                {visible.map(inv => (
                  <li className="rounded-2xl border border-border bg-background/60 p-3" key={inv.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span className={cn("flex items-center gap-2 text-xs", inv.status === "used" ? "text-muted-foreground" : "text-foreground")}>
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            inv.status === "unused" && "bg-foreground",
                            inv.status === "claimed" && "animate-pulse bg-foreground",
                            inv.status === "used" && "bg-muted-foreground"
                          )}
                        />
                        {statusText[inv.status]}
                      </span>
                      {inv.status !== "used" && (
                        <button
                          aria-label="Revoke this link"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                          onClick={() => revoke(inv.id)}
                          title="Revoke"
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {inv.status === "unused" && (
                      <div className="mt-3 space-y-3">
                        <div className="flex gap-2">
                          <button
                            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-full border border-border text-sm font-semibold transition-colors hover:border-foreground/40"
                            onClick={() => copy(inv.id, linkFor(inv.token))}
                            type="button"
                          >
                            {copied === inv.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copied === inv.id ? "Copied" : "Copy link"}
                          </button>
                          <button
                            aria-label="Show QR code"
                            aria-pressed={qrFor === inv.id}
                            className={cn(
                              "grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors",
                              qrFor === inv.id ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40"
                            )}
                            onClick={() => setQrFor(q => (q === inv.id ? null : inv.id))}
                            type="button"
                          >
                            <QrIcon className="h-4 w-4" />
                          </button>
                        </div>
                        {qrFor === inv.id && (
                          <div className="mx-auto flex w-fit rounded-2xl border border-border bg-white p-2 animate-in fade-in zoom-in-95 duration-200">
                            <QrCode value={linkFor(inv.token)} size={200} />
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!inviteOnly && tab === "room" && (
          <div className="space-y-4 text-center">
            <p className="text-sm leading-relaxed text-muted-foreground">
              A reusable link: anyone who has it can join, as many times as it is shared. It contains the room key.
              {hasPassword && " They will still need the password."}
            </p>
            <div className="mx-auto flex w-fit rounded-2xl border border-border bg-white p-2">
              <QrCode value={roomLink()} size={220} />
            </div>
            <Button onClick={() => copy("room", roomLink())} variant="outline" className="h-11 w-full rounded-full border-border hover:border-foreground/40">
              {copied === "room" ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
              {copied === "room" ? "Link copied" : "Copy room link"}
            </Button>
          </div>
        )}

        <p className="mt-5 flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          <KeyRound className="h-3 w-3" /> The server never sees the room key
        </p>
      </div>
    </div>
  );
}
