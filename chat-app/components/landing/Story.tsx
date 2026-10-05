"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Check, Copy, Flame } from "lucide-react";
import LiveChatDemo from "@/components/landing/LiveChatDemo";
import { AppWindow, Note, Spot } from "@/components/landing/parts";

const STEPS = [
  {
    title: "Open a room",
    body: "One tap. No signup, no email, no verification. Pick a throwaway name and you're in.",
    url: "nullchat.tech / new-room",
  },
  {
    title: "Share a link that burns",
    body: "Send one invite link, or make a one-time link for each person. They join straight from the browser.",
    url: "nullchat.tech / room / void-7x2k / invite",
  },
  {
    title: "Talk. Then vanish.",
    body: "When the session ends, the room, the messages and every shared file are wiped for everyone.",
    url: "nullchat.tech / room / void-7x2k",
  },
];

const fade = {
  initial: { opacity: 0, y: 16, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -12, filter: "blur(6px)" },
  transition: { duration: 0.4 },
};

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-emerald-400/90" : "bg-white/15"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </span>
  );
}

function CreatePanel() {
  const rows: [string, string, boolean][] = [
    ["Burn mode", "Messages turn to sand after 5 min", true],
    ["Member limit", "8 people", true],
    ["Room password", "Ask for a password on top of the link", false],
    ["Invite-only", "Enter only through one-time links", false],
  ];
  return (
    <div className="space-y-4 p-6 md:p-8">
      <div className="text-lg font-medium text-white">Create a room</div>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">Display name</div>
        <div className="mt-1 text-sm text-white">ghost_41</div>
      </div>
      <div className="divide-y divide-white/[0.06] rounded-xl border border-white/10 bg-white/[0.03]">
        {rows.map(([t, d, on], i) => (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center justify-between gap-4 px-4 py-3.5"
            initial={{ opacity: 0, x: -10 }}
            key={t}
            transition={{ delay: 0.15 + i * 0.1 }}
          >
            <div>
              <div className="text-sm font-medium text-white">{t}</div>
              <div className="text-xs text-white/40">{d}</div>
            </div>
            <Toggle on={on} />
          </motion.div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black">
        Create room
        <span className="font-mono text-[11px] font-normal text-black/50">no account needed</span>
      </div>
    </div>
  );
}

function InvitePanel() {
  const links: [string, string, "burned" | "waiting"][] = [
    ["Link for Priya", "nullchat.tech/j/8f3k…", "burned"],
    ["Link for Sam", "nullchat.tech/j/2m9q…", "waiting"],
    ["Link for Alex", "nullchat.tech/j/x71d…", "waiting"],
  ];
  return (
    <div className="space-y-4 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div className="text-lg font-medium text-white">Invite people</div>
        <div className="font-mono text-[11px] text-white/40">3 one-time links</div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">Room link</div>
          <div className="truncate font-mono text-sm text-white">nullchat.tech/chat/void-7x2k</div>
        </div>
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/70">
          <Copy className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="divide-y divide-white/[0.06] rounded-xl border border-white/10 bg-white/[0.03]">
        {links.map(([who, url, state], i) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-3 px-4 py-3.5"
            initial={{ opacity: 0, y: 10 }}
            key={who}
            transition={{ delay: 0.2 + i * 0.12 }}
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">{who}</div>
              <div className={`truncate font-mono text-xs ${state === "burned" ? "text-white/25 line-through" : "text-white/45"}`}>
                {url}
              </div>
            </div>
            {state === "burned" ? (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-1 font-mono text-[10px] text-red-300">
                <Flame className="h-3 w-3" /> Burned
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] text-emerald-300">
                <Check className="h-3 w-3" /> Ready
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ChatPanel() {
  return (
    <div className="p-4 md:p-6">
      <LiveChatDemo />
    </div>
  );
}

export default function Story() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length))));
  });

  const panels = [<CreatePanel key="a" />, <InvitePanel key="b" />, <ChatPanel key="c" />];

  return (
    <div className="relative h-[330vh]" id="how" ref={ref}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <Spot />
        <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.4fr] lg:gap-16">
          <div className="relative flex gap-5">
            <div className="relative hidden w-7 shrink-0 sm:block">
              <div className="absolute inset-y-0 left-1/2 w-7 -translate-x-1/2 rounded-full border border-white/10 bg-white/[0.04]" />
              <motion.div
                animate={{ top: `${6 + active * 33}%` }}
                className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.7)]"
                transition={{ type: "spring", stiffness: 160, damping: 22 }}
              />
            </div>
            <div className="space-y-6">
              {STEPS.map((s, i) => (
                <div className={`transition-opacity duration-500 ${i === active ? "opacity-100" : "opacity-30"}`} key={s.title}>
                  <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/40">0{i + 1}</div>
                  <h3 className="mt-1 text-2xl font-medium leading-tight tracking-[-0.03em] text-white md:text-4xl">{s.title}</h3>
                  <motion.p
                    animate={{ height: i === active ? "auto" : 0, opacity: i === active ? 1 : 0 }}
                    className="max-w-sm overflow-hidden text-sm leading-relaxed text-white/50 md:text-base"
                    initial={false}
                  >
                    <span className="block pt-2">{s.body}</span>
                  </motion.p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <Note arrow="left" className="-top-10 right-6" color="#8fd3ff">
              no signup, ever
            </Note>
            <AppWindow sidebar status={active === 2 ? "Live" : "Ready"} url={STEPS[active].url}>
              <div className="relative min-h-[26rem] md:min-h-[31rem]">
                <AnimatePresence mode="wait">
                  <motion.div key={active} {...fade}>
                    {panels[active]}
                  </motion.div>
                </AnimatePresence>
              </div>
            </AppWindow>
          </div>
        </div>
      </div>
    </div>
  );
}
