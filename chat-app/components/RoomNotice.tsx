import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

/** Full-screen notice shared by the "room ended" and "room full" screens. */
export default function RoomNotice({ label, title, accent, body }: { label: string; title: string; accent: string; body: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(40% 45% at 50% 100%, hsl(var(--ember) / 0.18), transparent 70%)" }}
      />
      <div className="relative flex max-w-xl flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="mb-8 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-ember shadow-[0_0_10px_2px_hsl(var(--ember)/0.6)]" />
          {label}
        </div>
        <h1 className="font-[family-name:var(--font-serif)] text-6xl leading-[0.9] tracking-[-0.02em] md:text-8xl">
          {title} <span className="italic text-ember">{accent}</span>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">{body}</p>
        <Link
          className="group mt-10 inline-flex items-center gap-3 rounded-full bg-primary py-2.5 pl-6 pr-2.5 text-[15px] font-medium text-primary-foreground shadow-[0_14px_30px_-14px_rgba(23,20,18,0.8)] transition-transform hover:-translate-y-0.5"
          href="/groups"
        >
          Back to your rooms
          <span className="grid h-9 w-9 place-items-center rounded-full bg-ember text-[#171412] transition-transform duration-500 group-hover:rotate-45">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
