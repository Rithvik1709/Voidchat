"use client";

import { useEffect, useRef, useState } from "react";

export default function ProtocolMesh() {
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
