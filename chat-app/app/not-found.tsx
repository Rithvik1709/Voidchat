import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/SiteChrome";

export default function NotFound() {
  return (
    <PageShell>
      <section className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center px-4 pt-24 text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Error 404
        </div>
        <h1 className="mt-6 text-[7rem] font-bold leading-none tracking-tighter sm:text-[10rem]">
          Null<span className="text-muted-foreground">.</span>
        </h1>
        <p className="mt-4 max-w-md text-lg text-muted-foreground">
          This page doesn&apos;t exist, or it vanished. Rooms do that.
        </p>
        <Link
          className="group mt-10 inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 font-bold text-background transition-transform hover:scale-[1.03] active:scale-95"
          href="/"
        >
          Back home
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </section>
    </PageShell>
  );
}
