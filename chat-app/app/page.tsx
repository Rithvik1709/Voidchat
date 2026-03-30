"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ModeToggle from "@/components/ModeToggle";
import {
  ArrowRight,
  Lock,
  ShieldCheck,
  TimerOff,
  Zap,
} from "lucide-react";

export default function Home() {
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [messageInput, setMessageInput] = useState("");
  const [nodeCount, setNodeCount] = useState(0);
  const [visualizerReady, setVisualizerReady] = useState(false);
  const visualizerContainerRef = useRef<HTMLDivElement>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);
  const sendNodeRef = useRef<((text?: string) => void) | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursor({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const container = visualizerContainerRef.current;
    const canvas = visualizerCanvasRef.current;

    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type VizNode = {
      x: number;
      y: number;
      id: string;
      size: number;
      pulse: number;
      connections: VizNode[];
      vx: number;
      vy: number;
      update: () => void;
      draw: () => void;
    };

    let width = 0;
    let height = 0;
    let animationFrameId = 0;
    const nodes: VizNode[] = [];

    const makeNodeId = () =>
      `0x${Math.random().toString(16).slice(2, 10).toUpperCase()}`;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width;
      canvas.height = height;
    };

    const createNode = (x: number, y: number) => {
      const node: VizNode = {
        x,
        y,
        id: makeNodeId(),
        size: 4,
        pulse: 0,
        connections: [],
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        update() {
          this.x += this.vx;
          this.y += this.vy;
          this.pulse += 0.05;

          if (this.x < 0 || this.x > width) this.vx *= -1;
          if (this.y < 0 || this.y > height) this.vy *= -1;
        },
        draw() {
          const glow = Math.sin(this.pulse) * 5 + 10;

          ctx.beginPath();
          this.connections.forEach((connection) => {
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(connection.x, connection.y);
          });
          ctx.strokeStyle = "rgba(0, 242, 255, 0.2)";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fillStyle = "#00f2ff";
          ctx.shadowBlur = glow;
          ctx.shadowColor = "#00f2ff";
          ctx.fill();

          ctx.shadowBlur = 0;
          ctx.fillStyle = "#00ffcc";
          ctx.font = "10px 'Courier New', monospace";
          ctx.fillText(this.id, this.x + 10, this.y - 10);
        },
      };

      nodes.forEach((otherNode) => {
        const distance = Math.hypot(node.x - otherNode.x, node.y - otherNode.y);
        if (distance < 300) {
          node.connections.push(otherNode);
        }
      });

      nodes.push(node);
      setNodeCount(nodes.length);
    };

    sendNodeRef.current = () => {
      const x = Math.random() * Math.max(width - 100, 1) + 50;
      const y = Math.random() * Math.max(height - 120, 1) + 50;
      createNode(x, y);

      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(0, 0, width, height);
    };

    const animate = () => {
      ctx.fillStyle = "rgba(10, 10, 12, 0.2)";
      ctx.fillRect(0, 0, width, height);

      nodes.forEach((node) => {
        node.update();
        node.draw();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    resize();
    for (let i = 0; i < 5; i += 1) {
      createNode(Math.random() * width, Math.random() * height);
    }
    setVisualizerReady(true);
    animate();

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
      sendNodeRef.current = null;
      setVisualizerReady(false);
    };
  }, []);

  const handleSendNode = () => {
    const text = messageInput.trim();
    if (!text) return;
    sendNodeRef.current?.(text);
    setMessageInput("");
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f6f7f8] text-[#1f2328] dark:bg-[#131313] dark:text-[#e2e2e2]">
      <div
        className="pointer-events-none fixed inset-0 z-20 opacity-[0.018] dark:opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />

      <div
        className="pointer-events-none fixed z-10 hidden h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full dark:hidden sm:block"
        style={{
          left: `${cursor.x}px`,
          top: `${cursor.y}px`,
          background:
            "radial-gradient(circle, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0) 70%)",
        }}
      />
      <div
        className="pointer-events-none fixed z-10 hidden h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full dark:block sm:block"
        style={{
          left: `${cursor.x}px`,
          top: `${cursor.y}px`,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 70%)",
        }}
      />

      <nav className="fixed top-0 z-50 w-full bg-white/70 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.2)] dark:bg-[#1B1B1B]/60 dark:shadow-[0_40px_60px_rgba(226,222,222,0.06)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 md:px-8 md:py-4">
          <div className="text-lg font-bold tracking-tighter text-foreground sm:text-xl">
            Nullchat
          </div>
          <div className="hidden items-center gap-8 text-sm font-medium tracking-tight md:flex">
            <a
              className="font-semibold text-foreground transition-colors duration-300"
              href="#features"
            >
              Features
            </a>
            <a
              className="text-[#4f555c] transition-colors duration-300 hover:text-foreground dark:text-[#C7C6C6] dark:hover:text-white"
              href="#security"
            >
              Security
            </a>
          </div>
          <div className="flex items-center gap-4 md:gap-6">
            <ModeToggle className="h-10 w-10 border-border bg-transparent text-foreground hover:border-foreground/40" />
            <Link
              className="rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background transition-transform active:scale-95 sm:px-5 sm:text-sm"
              href="/groups"
            >
              Launch App
            </Link>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto px-4 pb-3 text-xs font-semibold uppercase tracking-widest text-[#4f555c] dark:text-[#c7c6c6] md:hidden">
          <a href="#features">Features</a>
          <a href="#security">Security</a>
        </div>
      </nav>

      <main className="relative z-30 pt-36 md:pt-32">
        <section className="mx-auto mb-28 max-w-7xl px-4 sm:px-6 md:mb-48 md:px-8">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center rounded-full border border-black/10 bg-black/5 px-3 py-1 dark:border-[#444748]/30 dark:bg-[#2a2a2a] md:mb-8">
              <span className="mr-2 text-[10px] font-bold uppercase tracking-widest text-foreground dark:text-white">
                New
              </span>
              <span className="text-xs font-medium text-[#4f555c] dark:text-[#c4c7c8]">
                Encrypted V2 protocol is live
              </span>
            </div>

            <h1 className="mb-6 max-w-4xl text-4xl font-bold leading-[0.9] tracking-tighter text-foreground sm:text-5xl md:mb-8 md:text-8xl">
              Conversations, <br />
              <span className="text-[#5e6368] dark:text-[#c7c6c6]">
                without the footprint.
              </span>
            </h1>

            <p className="mb-10 max-w-2xl text-base leading-relaxed text-[#4f555c] dark:text-[#c4c7c8] sm:text-lg md:mb-12 md:text-xl">
              The ultra-minimalist messaging protocol for those who
              value absolute anonymity. No logs, no data, no trace.
              Just pure, ephemeral dialogue.
            </p>

            <div className="flex w-full max-w-sm flex-col items-center justify-center gap-3 sm:max-w-none sm:flex-row sm:gap-4">
              <Link
                className="mx-auto flex w-fit items-center justify-center gap-2 rounded-full bg-foreground px-8 py-4 text-base font-bold text-background transition-all hover:scale-[1.02] active:scale-95 md:text-lg"
                href="/groups"
              >
                Start Chatting
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>

          <div className="relative mt-16 overflow-hidden rounded-xl border border-black/10 bg-white/60 p-2 backdrop-blur-[12px] dark:border-[#444748]/30 dark:bg-[#1b1b1b] sm:p-4 md:mt-24">
            <div
              className="relative aspect-video w-full overflow-hidden rounded-lg border border-[#00f2ff]/20 bg-[#0a0a0c]"
              ref={visualizerContainerRef}
            >
              <canvas
                className="absolute inset-0 h-full w-full"
                onClick={() => sendNodeRef.current?.()}
                ref={visualizerCanvasRef}
              />

              {!visualizerReady && (
                <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-xs font-bold uppercase tracking-[0.16em] text-[#8dece2]/80">
                  Initializing protocol mesh...
                </div>
              )}

              <div className="pointer-events-none absolute left-2 top-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#00ffcc]/90 sm:left-4 sm:top-4 sm:text-[11px] sm:tracking-[0.18em]">
                Protocol: NULLCHAT_V2
                <br />
                Status: ENCRYPTED_MESH_READY
                <br />
                Nodes: {nodeCount}
              </div>

              <form
                className="absolute bottom-2 left-1/2 z-10 flex w-[94%] max-w-xl -translate-x-1/2 flex-col gap-2 rounded-md border border-[#00f2ff]/50 bg-[rgba(0,20,20,0.82)] p-2 shadow-[0_0_20px_rgba(0,242,255,0.2)] sm:bottom-4 sm:w-[92%] sm:flex-row sm:p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendNode();
                }}
              >
                <input
                  autoComplete="off"
                  className="w-full border border-[#00f2ff]/80 bg-transparent px-3 py-2 font-mono text-xs text-white outline-none placeholder:text-[#8dece2]/50 sm:text-sm"
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Enter encrypted message..."
                  type="text"
                  value={messageInput}
                />
                <button
                  className="bg-[#00f2ff] px-5 py-2 text-xs font-extrabold uppercase tracking-wide text-black transition-all hover:-translate-y-[1px] hover:shadow-[0_0_20px_rgba(0,242,255,0.8)] sm:text-sm"
                  type="submit"
                >
                  Send
                </button>
              </form>

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(0,242,255,0.12),transparent_35%),radial-gradient(circle_at_80%_75%,rgba(0,255,204,0.12),transparent_40%)]" />
              <button
                className="absolute right-4 top-4 z-20 hidden rounded border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60 transition-colors hover:text-white sm:block"
                onClick={() => sendNodeRef.current?.()}
                type="button"
              >
                See the protocol live
              </button>
            </div>
          </div>
        </section>

        <section
          className="mx-auto mb-24 max-w-7xl rounded-[2rem] bg-white/70 px-4 py-12 dark:bg-[#1b1b1b] sm:px-6 md:mb-48 md:rounded-[3rem] md:px-8 md:py-24"
          id="features"
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="group flex flex-col justify-between rounded-3xl border border-black/10 bg-white/70 p-6 transition-all duration-500 hover:bg-white dark:border-[#444748]/20 dark:bg-[#1f1f1f] dark:hover:bg-[#2a2a2a] sm:p-8 md:col-span-8 md:p-10">
              <div>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-black/5 text-foreground dark:bg-white dark:text-black">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="mb-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Anonymous by design
                </h3>
                <p className="max-w-md leading-relaxed text-[#4f555c] dark:text-[#c4c7c8]">
                  No email, no phone number, no metadata. We
                  don&apos;t even log your IP address. Your identity
                  is a void.
                </p>
              </div>
              <div className="mt-8 flex h-36 items-end overflow-hidden rounded-2xl bg-black/5 px-4 dark:bg-[#1b1b1b] sm:mt-12 sm:h-40 sm:px-6">
                <div className="mx-1 h-[80%] flex-1 rounded-t-lg bg-black/20 transition-all group-hover:h-[90%] dark:bg-[#444748]/50" />
                <div className="mx-1 h-[40%] flex-1 rounded-t-lg bg-black/20 transition-all group-hover:h-[60%] dark:bg-[#444748]/50" />
                <div className="mx-1 h-[60%] flex-1 rounded-t-lg bg-foreground transition-all group-hover:h-[75%] dark:bg-white" />
                <div className="mx-1 h-[30%] flex-1 rounded-t-lg bg-black/20 transition-all group-hover:h-[50%] dark:bg-[#444748]/50" />
                <div className="mx-1 h-[50%] flex-1 rounded-t-lg bg-black/20 transition-all group-hover:h-[70%] dark:bg-[#444748]/50" />
              </div>
            </div>

            <div className="flex flex-col rounded-3xl border border-black/10 bg-white/70 p-6 transition-all duration-500 hover:bg-white dark:border-[#444748]/20 dark:bg-[#1f1f1f] dark:hover:bg-[#2a2a2a] sm:p-8 md:col-span-4 md:p-10">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-black/5 text-foreground dark:bg-[#353535] dark:text-white">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mb-4 text-2xl font-bold tracking-tight text-foreground">
                Instant Invites
              </h3>
              <p className="mb-8 leading-relaxed text-[#4f555c] dark:text-[#c4c7c8]">
                Generate a unique one-time link and start talking.
                Links burn after use.
              </p>
              <div className="mt-auto border-t border-black/10 pt-6 dark:border-[#444748]/30">
                <div className="truncate rounded-xl bg-black/5 p-4 font-mono text-xs text-[#4f555c] dark:bg-[#1b1b1b] dark:text-[#c7c6c6]">
                  nullchat.io/temp/8xK2-pL9q-mN5v
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-black/10 bg-white/70 p-6 transition-all duration-500 hover:bg-white dark:border-[#444748]/20 dark:bg-[#1f1f1f] dark:hover:bg-[#2a2a2a] sm:p-8 md:col-span-4 md:p-10">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-black/5 text-foreground dark:bg-[#353535] dark:text-white">
                <TimerOff className="h-6 w-6" />
              </div>
              <h3 className="mb-4 text-2xl font-bold tracking-tight text-foreground">
                Ephemeral Rooms
              </h3>
              <p className="leading-relaxed text-[#4f555c] dark:text-[#c4c7c8]">
                Data exists only in RAM. Once the tab closes, the
                room and its history vanish forever.
              </p>
            </div>

            <div
              className="flex flex-col items-start justify-between gap-8 rounded-3xl border border-black/10 bg-white/70 p-6 transition-all duration-500 hover:bg-white dark:border-[#444748]/20 dark:bg-[#1f1f1f] dark:hover:bg-[#2a2a2a] sm:p-8 md:col-span-8 md:flex-row md:items-center md:p-10"
              id="security"
            >
              <div className="max-w-sm">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-black/5 text-foreground dark:bg-[#353535] dark:text-white">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="mb-4 text-2xl font-bold tracking-tight text-foreground">
                  Post-Quantum Crypto
                </h3>
                <p className="leading-relaxed text-[#4f555c] dark:text-[#c4c7c8]">
                  Prepared for the future of decryption. Your
                  messages are wrapped in industry-leading
                  quantum-resistant layers.
                </p>
              </div>
              <div className="relative hidden h-48 w-48 lg:block">
                <div className="absolute inset-0 animate-pulse rounded-full border-[10px] border-black/10 dark:border-white/10" />
                <div className="absolute inset-8 rounded-full border-[10px] border-black/20 dark:border-white/20" />
                <div className="absolute inset-16 rounded-full bg-black/30 dark:bg-white/30" />
              </div>
            </div>
          </div>
        </section>

        <section
          className="mx-auto mb-24 max-w-4xl px-4 py-20 text-center sm:px-6 md:px-8 md:py-32"
          id="pricing"
        >
          <h2 className="mb-8 text-3xl font-bold leading-tight tracking-tighter text-foreground sm:text-4xl md:text-6xl">
            Privacy is not a feature.
            <br />
            <span className="text-[#5e6368] dark:text-[#c4c7c8]">It&apos;s the foundation.</span>
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-lg text-[#4f555c] dark:text-[#c7c6c6]">
            Join the silent revolution. Start your first anonymous
            session in less than 3 seconds.
          </p>
          <Link
            className="inline-block rounded-full bg-foreground px-12 py-5 text-xl font-bold text-background shadow-xl transition-all hover:-translate-y-1 hover:shadow-black/10 dark:hover:shadow-white/10"
            href="/groups"
          >
            Open Nullchat
          </Link>
        </section>
      </main>

      <footer className="w-full border-t border-black/10 bg-[#f6f7f8] py-20 dark:border-white/5 dark:bg-[#131313]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-4 sm:px-6 md:flex-row md:px-8">
          <div className="flex flex-col items-center gap-4 md:items-start">
            <div className="text-lg font-bold text-foreground">Nullchat</div>
            <p className="text-xs font-light leading-relaxed text-[#4f555c] dark:text-[#C4C7C8]">
              © 2026 Nullchat. Anonymous by design.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-xs font-light text-[#4f555c] dark:text-[#C4C7C8] sm:gap-8">
            <a
              className="transition-all hover:underline decoration-black/30 dark:decoration-white/30"
              href="#"
            >
              Privacy
            </a>
            <a
              className="transition-all hover:underline decoration-black/30 dark:decoration-white/30"
              href="#"
            >
              Terms
            </a>
            <a
              className="transition-all hover:underline decoration-black/30 dark:decoration-white/30"
              href="#"
            >
              Github
            </a>
            <a
              className="transition-all hover:underline decoration-black/30 dark:decoration-white/30"
              href="#"
            >
              Status
            </a>
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <div className="flex -space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#f6f7f8] bg-black/10 text-[10px] font-bold dark:border-[#131313] dark:bg-[#1f1f1f]">
                JD
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#f6f7f8] bg-black/10 text-[10px] font-bold dark:border-[#131313] dark:bg-[#1f1f1f]">
                MK
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#f6f7f8] bg-black/10 text-[10px] font-bold dark:border-[#131313] dark:bg-[#1f1f1f]">
                AS
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#4f555c] dark:text-[#c4c7c8]">
              12k Active Nodes
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
