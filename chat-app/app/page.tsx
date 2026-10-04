"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import ModeToggle from "@/components/ModeToggle";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BarChart3,
  Check,
  ChevronDown,
  Fingerprint,
  ImagePlus,
  Link2,
  MessageSquareReply,
  Minus,
  Plus,
  TimerOff,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.6, 0.35, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
      <span className="h-px w-8 bg-foreground/40" />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live, self-destructing chat demo (hero)                             */
/* ------------------------------------------------------------------ */

type DemoMessage = { id: number; who: "them" | "you"; name: string; text: string };

const SCRIPT: Omit<DemoMessage, "id">[] = [
  { who: "them", name: "ghost_41", text: "you there? room's open." },
  { who: "you", name: "you", text: "yep. no signup, no number, nothing." },
  { who: "them", name: "ghost_41", text: "send the doc before it expires" },
  { who: "you", name: "you", text: "sent. dropping the link after this." },
  { who: "them", name: "ghost_41", text: "got it. closing the room." },
];

function LiveChatDemo() {
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

/* ------------------------------------------------------------------ */
/* Monochrome protocol mesh (interactive canvas)                       */
/* ------------------------------------------------------------------ */

function ProtocolMesh() {
  const [messageInput, setMessageInput] = useState("");
  const [nodeCount, setNodeCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const addNodeRef = useRef<((label?: string) => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type VizNode = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      pulse: number;
      id: string;
      label?: string;
      born: number;
    };

    let width = 0;
    let height = 0;
    let raf = 0;
    const nodes: VizNode[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const makeId = () =>
      `0x${Math.random().toString(16).slice(2, 8).toUpperCase()}`;

    const addNode = (label?: string, x?: number, y?: number) => {
      nodes.push({
        x: x ?? Math.random() * Math.max(width - 120, 1) + 60,
        y: y ?? Math.random() * Math.max(height - 160, 1) + 60,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        pulse: Math.random() * Math.PI * 2,
        id: makeId(),
        label,
        born: performance.now(),
      });
      setNodeCount(nodes.length);
    };

    addNodeRef.current = (label) => addNode(label);

    const frame = () => {
      ctx.clearRect(0, 0, width, height);
      const now = performance.now();

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < 240) {
            ctx.strokeStyle = `rgba(255,255,255,${0.22 * (1 - d / 240)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      nodes.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += 0.04;
        if (n.x < 20 || n.x > width - 20) n.vx *= -1;
        if (n.y < 20 || n.y > height - 20) n.vy *= -1;

        const age = now - n.born;
        const ring = age < 1200 ? (age / 1200) * 42 : 0;
        if (ring) {
          ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - ring / 42)})`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, ring, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, 9 + Math.sin(n.pulse) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(n.x, n.y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "10px ui-monospace, 'Courier New', monospace";
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillText(n.label ? n.label.slice(0, 24) : n.id, n.x + 12, n.y - 10);
      });

      raf = requestAnimationFrame(frame);
    };

    resize();
    for (let i = 0; i < 7; i += 1) {
      addNode(undefined, Math.random() * width, Math.random() * height);
    }
    frame();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
      addNodeRef.current = null;
    };
  }, []);

  const send = () => {
    const text = messageInput.trim();
    if (!text) return;
    addNodeRef.current?.(text);
    setMessageInput("");
  };

  return (
    <div
      className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-border bg-[#0a0a0a] sm:aspect-video"
      ref={containerRef}
    >
      <canvas
        className="absolute inset-0 h-full w-full cursor-crosshair"
        onClick={() => addNodeRef.current?.()}
        ref={canvasRef}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="pointer-events-none absolute left-4 top-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-white/60 sm:left-6 sm:top-6 sm:text-[11px]">
        mesh / live
        <br />
        nodes: {String(nodeCount).padStart(2, "0")}
        <br />
        logs: 0
      </div>
      <div className="pointer-events-none absolute right-4 top-4 hidden font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 sm:right-6 sm:top-6 sm:block">
        click anywhere to add a node
      </div>

      <form
        className="absolute bottom-4 left-1/2 flex w-[92%] max-w-lg -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/70 p-1.5 backdrop-blur sm:bottom-6"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-4 py-2 font-mono text-xs text-white outline-none placeholder:text-white/40 sm:text-sm"
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Type a message, send it into the mesh…"
          type="text"
          value={messageInput}
        />
        <button
          className="rounded-full bg-white px-5 py-2 text-xs font-bold uppercase tracking-wide text-black transition-transform active:scale-95"
          type="submit"
        >
          Send
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page data                                                           */
/* ------------------------------------------------------------------ */

const MARQUEE = [
  "No accounts",
  "No phone numbers",
  "No message history",
  "No tracking",
  "No trace",
  "Rooms that vanish",
  "Links that burn",
];

const STEPS = [
  {
    n: "01",
    title: "Open a room",
    body: "One tap. No signup, no email, no verification. Pick a throwaway name and you're in.",
  },
  {
    n: "02",
    title: "Share the link",
    body: "Send a single invite link to whoever you want. They join straight from the browser.",
  },
  {
    n: "03",
    title: "Talk. Then vanish.",
    body: "When the session ends, the room, the messages and every shared file are wiped for everyone.",
  },
];

const FEATURES = [
  {
    icon: Fingerprint,
    title: "Anonymous by design",
    body: "A temporary name is all you need. It lasts for the session and disappears when you leave.",
    span: "md:col-span-2",
  },
  {
    icon: TimerOff,
    title: "Ephemeral rooms",
    body: "When the room ends, the slate is clean, including all shared media.",
    span: "",
  },
  {
    icon: Link2,
    title: "Links that burn",
    body: "Make a one-time link per person. It works once, then it is dead, even if someone copied it.",
    span: "",
  },
  {
    icon: ImagePlus,
    title: "Images up to 25MB",
    body: "Share pictures freely. They are deleted automatically when the room ends.",
    span: "",
  },
  {
    icon: AudioLines,
    title: "Voice messages",
    body: "Record and send voice notes without leaving the chat.",
    span: "",
  },
  {
    icon: BarChart3,
    title: "Live polls",
    body: "Single or multiple choice. Watch results land in real time.",
    span: "",
  },
  {
    icon: MessageSquareReply,
    title: "Replies & mentions",
    body: "Reply to specific messages and mention people by name so busy rooms stay readable.",
    span: "md:col-span-2",
  },
];

const COMPARE: { label: string; them: boolean; us: boolean }[] = [
  { label: "Requires phone number or email", them: true, us: false },
  { label: "Permanent message history", them: true, us: false },
  { label: "Profile tied to a real identity", them: true, us: false },
  { label: "Works instantly from a link", them: false, us: true },
  { label: "Media deleted when the chat ends", them: false, us: true },
];

const FAQ = [
  {
    q: "Do I need an account?",
    a: "No. You choose a temporary display name for the session. There is no email, phone number or password involved.",
  },
  {
    q: "What happens when a room ends?",
    a: "The room, its messages and any shared images or voice notes are removed for everyone.",
  },
  {
    q: "Can I share images and voice messages?",
    a: "Yes. Images up to 25MB and voice messages are supported, and they are cleaned up automatically along with the room.",
  },
  {
    q: "How do I invite people?",
    a: "Share the room link, or make a one-time link for each person from the Invite button. A one-time link works for a single person and then burns, so a forwarded or copied link can't be reused. They join straight from their browser.",
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [cursor, setCursor] = useState({ x: -600, y: -600 });
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-foreground selection:text-background">
      {/* scroll progress */}
      <motion.div
        className="fixed left-0 right-0 top-0 z-[60] h-[2px] origin-left bg-foreground"
        style={{ scaleX: progress }}
      />

      {/* background: grid + cursor spotlight */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] dark:opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at 50% 20%, black 20%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 20%, black 20%, transparent 75%)",
        }}
      />
      <div
        className="pointer-events-none fixed z-0 hidden h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full sm:block"
        style={{
          left: cursor.x,
          top: cursor.y,
          background:
            "radial-gradient(circle, hsl(var(--foreground) / 0.07) 0%, transparent 70%)",
        }}
      />

      {/* nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 md:px-8">
          <Link className="flex items-center gap-2" href="/">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-background" />
            </span>
            <span className="text-lg font-bold tracking-tighter">Nullchat</span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium md:flex">
            {[
              ["How it works", "#how"],
              ["Features", "#features"],
              ["Mesh", "#mesh"],
              ["FAQ", "#faq"],
            ].map(([label, href]) => (
              <a
                className="text-muted-foreground transition-colors hover:text-foreground"
                href={href}
                key={href}
              >
                {label}
              </a>
            ))}
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="/about"
            >
              About
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ModeToggle className="h-10 w-10 border-border bg-transparent text-foreground hover:border-foreground/40" />
            <Link
              className="rounded-full bg-foreground px-5 py-2 text-sm font-bold text-background transition-transform active:scale-95"
              href="/groups"
            >
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* HERO */}
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-24 pt-32 sm:px-6 md:px-8 md:pb-36 md:pt-44 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 backdrop-blur"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Anonymous · Ephemeral · Instant
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-5xl font-bold leading-[0.92] tracking-tighter sm:text-6xl md:text-7xl xl:text-8xl"
            >
              Talk freely.
              <br />
              <span className="text-muted-foreground">Leave nothing</span>
              <br />
              behind.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25 }}
              className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl"
            >
              Nullchat is group chat with no accounts and no history. Open a
              room, share a link, and when the conversation ends it&apos;s
              gone for everyone.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-10 flex flex-wrap items-center gap-4"
            >
              <Link
                className="group inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 text-base font-bold text-background transition-transform hover:scale-[1.03] active:scale-95"
                href="/groups"
              >
                Start chatting
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                className="inline-flex items-center gap-2 rounded-full border border-border px-7 py-4 text-base font-semibold transition-colors hover:border-foreground/50"
                href="#how"
              >
                How it works
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-12 flex flex-wrap gap-x-8 gap-y-3 font-mono text-xs text-muted-foreground"
            >
              {["No signup", "No logs", "Free to use"].map((t) => (
                <span className="flex items-center gap-2" key={t}>
                  <Check className="h-3.5 w-3.5 text-foreground" />
                  {t}
                </span>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3 }}
          >
            <LiveChatDemo />
          </motion.div>
        </section>

        {/* MARQUEE */}
        <div className="overflow-hidden border-y border-border py-5">
          <motion.div
            className="flex w-max gap-12 whitespace-nowrap"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 32, ease: "linear", repeat: Infinity }}
          >
            {[...MARQUEE, ...MARQUEE, ...MARQUEE, ...MARQUEE].map((t, i) => (
              <span
                className="flex items-center gap-12 font-mono text-sm uppercase tracking-[0.25em] text-muted-foreground"
                key={i}
              >
                {t}
                <span className="h-1 w-1 rounded-full bg-foreground/50" />
              </span>
            ))}
          </motion.div>
        </div>

        {/* HOW IT WORKS */}
        <section
          className="mx-auto max-w-7xl scroll-mt-20 px-4 py-28 sm:px-6 md:px-8 md:py-40"
          id="how"
        >
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
            <h2 className="max-w-3xl text-4xl font-bold leading-[0.95] tracking-tighter md:text-6xl">
              Three steps.
              <span className="text-muted-foreground"> Zero footprint.</span>
            </h2>
          </Reveal>

          <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal className="h-full" delay={i * 0.12} key={s.n}>
                <div className="group h-full bg-background p-8 transition-colors hover:bg-card md:p-10">
                  <div className="font-mono text-6xl font-bold tracking-tighter text-foreground/15 transition-colors group-hover:text-foreground/60 md:text-7xl">
                    {s.n}
                  </div>
                  <h3 className="mb-3 mt-10 text-2xl font-bold tracking-tight">
                    {s.title}
                  </h3>
                  <p className="leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section
          className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-28 sm:px-6 md:px-8 md:pb-40"
          id="features"
        >
          <Reveal>
            <Eyebrow>Features</Eyebrow>
            <h2 className="max-w-3xl text-4xl font-bold leading-[0.95] tracking-tighter md:text-6xl">
              Everything you need.
              <span className="text-muted-foreground"> Nothing you don&apos;t.</span>
            </h2>
          </Reveal>

          <div className="mt-16 grid gap-4 md:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Reveal
                className={f.span || "md:col-span-1"}
                delay={(i % 4) * 0.08}
                key={f.title}
              >
                <div className="group relative h-full overflow-hidden rounded-3xl border border-border bg-card/60 p-7 transition-all duration-500 hover:-translate-y-1 hover:border-foreground/40 md:p-8">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-foreground/5 transition-transform duration-700 group-hover:scale-[2.5]" />
                  <div className="relative mb-12 grid h-12 w-12 place-items-center rounded-2xl bg-foreground text-background">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="relative mb-2 text-xl font-bold tracking-tight">
                    {f.title}
                  </h3>
                  <p className="relative text-sm leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* MESH */}
        <section
          className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-28 sm:px-6 md:px-8 md:pb-40"
          id="mesh"
        >
          <Reveal>
            <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <Eyebrow>Interactive</Eyebrow>
                <h2 className="max-w-2xl text-4xl font-bold leading-[0.95] tracking-tighter md:text-6xl">
                  Every voice is a node.
                  <span className="text-muted-foreground"> None are recorded.</span>
                </h2>
              </div>
              <p className="max-w-sm text-muted-foreground">
                Type a message below and watch it join the mesh. Then refresh the
                page. It&apos;s gone, just like a real room.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <ProtocolMesh />
          </Reveal>
        </section>

        {/* COMPARE */}
        <section className="mx-auto max-w-4xl px-4 pb-28 sm:px-6 md:px-8 md:pb-40">
          <Reveal>
            <Eyebrow>The difference</Eyebrow>
            <h2 className="mb-12 text-4xl font-bold leading-[0.95] tracking-tighter md:text-5xl">
              Most chat apps remember everything.
              <span className="text-muted-foreground"> We forget on purpose.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="overflow-hidden rounded-3xl border border-border">
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-border bg-card/60 px-5 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground sm:gap-x-12 sm:px-8">
                <span />
                <span className="w-14 text-center sm:w-20">Typical</span>
                <span className="w-14 text-center text-foreground sm:w-20">Nullchat</span>
              </div>
              {COMPARE.map((row) => (
                <div
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-border px-5 py-5 last:border-b-0 sm:gap-x-12 sm:px-8"
                  key={row.label}
                >
                  <span className="text-sm font-medium sm:text-base">{row.label}</span>
                  <span className="grid w-14 place-items-center text-muted-foreground sm:w-20">
                    {row.them ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4 opacity-40" />}
                  </span>
                  <span className="grid w-14 place-items-center sm:w-20">
                    {row.us ? (
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-foreground text-background">
                        <Check className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="grid h-7 w-7 place-items-center rounded-full border border-border text-muted-foreground">
                        <X className="h-4 w-4" />
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* FAQ */}
        <section
          className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-28 sm:px-6 md:px-8 md:pb-40"
          id="faq"
        >
          <Reveal>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mb-12 text-4xl font-bold leading-[0.95] tracking-tighter md:text-5xl">
              Questions, answered.
            </h2>
          </Reveal>
          <div className="divide-y divide-border border-y border-border">
            {FAQ.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q}>
                  <button
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left text-lg font-semibold tracking-tight"
                    onClick={() => setOpenFaq(open ? null : i)}
                    type="button"
                  >
                    {item.q}
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border">
                      {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </span>
                  </button>
                  <motion.div
                    animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
                    className="overflow-hidden"
                    initial={false}
                    transition={{ duration: 0.3 }}
                  >
                    <p className="max-w-2xl pb-6 leading-relaxed text-muted-foreground">
                      {item.a}
                    </p>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 md:px-8 md:pb-32">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] bg-foreground px-6 py-20 text-center text-background md:rounded-[3rem] md:py-32">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.08]"
                style={{
                  backgroundImage:
                    "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
                  backgroundSize: "48px 48px",
                }}
              />
              <h2 className="relative mx-auto max-w-3xl text-4xl font-bold leading-[0.95] tracking-tighter sm:text-5xl md:text-7xl">
                Privacy isn&apos;t a feature.
                <br />
                <span className="opacity-50">It&apos;s the foundation.</span>
              </h2>
              <p className="relative mx-auto mt-8 max-w-lg text-lg opacity-70">
                Start your first anonymous session in under three seconds.
              </p>
              <Link
                className="group relative mt-10 inline-flex items-center gap-2 rounded-full bg-background px-10 py-5 text-lg font-bold text-foreground transition-transform hover:scale-[1.04] active:scale-95"
                href="/groups"
              >
                Open Nullchat
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-12 sm:px-6 md:flex-row md:px-8">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-foreground">
              <span className="h-2 w-2 rounded-full bg-background" />
            </span>
            <span className="font-bold tracking-tighter">Nullchat</span>
            <span className="ml-3 text-xs text-muted-foreground">
              © 2026 · Anonymous by design.
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            <Link className="transition-colors hover:text-foreground" href="/about">
              About
            </Link>
            <Link className="transition-colors hover:text-foreground" href="/privacy">
              Privacy
            </Link>
            <Link className="transition-colors hover:text-foreground" href="/terms">
              Terms
            </Link>
            <Link className="transition-colors hover:text-foreground" href="/status">
              Status
            </Link>
          </div>
          <a
            className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Back to top
            <ChevronDown className="h-3.5 w-3.5 rotate-180" />
          </a>
        </div>
      </footer>
    </div>
  );
}
