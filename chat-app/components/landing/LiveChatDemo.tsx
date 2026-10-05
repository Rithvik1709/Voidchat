"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";


type DemoMessage = { id: number; who: "them" | "you"; name: string; text: string };

const SCRIPT: Omit<DemoMessage, "id">[] = [
  { who: "them", name: "ghost_41", text: "you there? room's open." },
  { who: "you", name: "you", text: "yep. no signup, no number, nothing." },
  { who: "them", name: "ghost_41", text: "send the doc before it expires" },
  { who: "you", name: "you", text: "sent. dropping the link after this." },
  { who: "them", name: "ghost_41", text: "got it. closing the room." },
];

export default function LiveChatDemo() {
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [burning, setBurning] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(() => !cancelled && fn(), ms));
    };

    let t = 700;
    SCRIPT.forEach((m, i) => {
      later(() => setTyping(true), t);
      t += 900;
      later(() => {
        setTyping(false);
        setMessages((prev) => [...prev, { ...m, id: cycle * 100 + i }]);
      }, t);
      t += 1100;
    });
    later(() => setBurning(true), t + 600);
    later(() => {
      setMessages([]);
      setBurning(false);
      setCycle((c) => c + 1);
    }, t + 2400);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [cycle]);

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-b from-foreground/10 to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground" />
            </span>
            <span className="font-mono text-xs tracking-wide">room/void-7x2k</span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            ephemeral
          </span>
        </div>

        <div className="relative flex h-[22rem] flex-col justify-end gap-2.5 overflow-hidden px-5 py-5">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={
                burning
                  ? { opacity: 0, y: -6, filter: "blur(6px)" }
                  : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
              }
              transition={{ duration: burning ? 0.8 : 0.35 }}
              className={`flex max-w-[82%] flex-col ${
                m.who === "you" ? "self-end items-end" : "self-start items-start"
              }`}
            >
              <span className="mb-1 px-1 font-mono text-[10px] text-muted-foreground">
                {m.name}
              </span>
              <span
                className={`rounded-2xl px-4 py-2.5 text-sm leading-snug ${
                  m.who === "you"
                    ? "rounded-br-md bg-foreground text-background"
                    : "rounded-bl-md bg-muted text-foreground"
                }`}
              >
                {m.text}
              </span>
            </motion.div>
          ))}

          {typing && !burning && (
            <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          )}

          {burning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pointer-events-none absolute inset-0 grid place-items-center"
            >
              <div className="rounded-full border border-border bg-background/90 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.25em] backdrop-blur">
                room closed · 0 bytes kept
              </div>
            </motion.div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-5 py-3.5">
          <div className="flex-1 rounded-full bg-muted px-4 py-2 text-xs text-muted-foreground">
            Message… nothing is stored
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
