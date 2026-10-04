import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

/** Shown when a room has reached its member limit. */
export default function RoomFull({ limit }: { limit: number | null }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6 text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 10%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 10%, transparent 70%)",
        }}
      />
      <div className="relative flex max-w-md flex-col items-center text-center">
        <div className="mb-8 grid h-16 w-16 place-items-center rounded-2xl bg-foreground text-background">
          <Users className="h-7 w-7" />
        </div>
        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          {limit ? `${limit} / ${limit} seats taken` : "Room full"}
        </div>
        <h1 className="text-4xl font-bold leading-[0.95] tracking-tighter md:text-5xl">This room is full.</h1>
        <p className="mt-4 text-muted-foreground">
          The host set a member limit and every seat is taken. Ask them to make room, or try again in a moment.
        </p>
        <Link
          className="group mt-8 inline-flex h-12 items-center rounded-full bg-foreground px-8 font-bold text-background transition-transform hover:scale-[1.03] active:scale-95"
          href="/groups"
        >
          Back to groups
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
