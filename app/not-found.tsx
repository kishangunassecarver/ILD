import Link from "next/link";
import { Compass } from "lucide-react";
import { HUBS } from "@/lib/cms";

export default function NotFound() {
  return (
    <div className="shell py-16">
      <div className="panel mx-auto max-w-xl p-10 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-aqua-400/10">
          <Compass className="h-5 w-5 text-aqua-300" aria-hidden />
        </span>

        <p className="mt-4 font-display text-4xl font-extrabold leading-none tracking-tight text-snow">
          404
        </p>
        <h1 className="mt-2 text-lg font-bold text-snow">This page has moved on</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          The link is broken or the listing has come down. The city is still here though — start
          from one of these.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-1.5">
          {HUBS.map((hub) => (
            <Link key={hub.slug} href={`/${hub.slug}`} className="chip">
              {hub.label}
            </Link>
          ))}
          <Link href="/events" className="chip">
            Events
          </Link>
          <Link href="/deals" className="chip">
            Deals
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-primary">
            Back to the home page
          </Link>
          <Link href="/search" className="btn-ghost">
            Search the site
          </Link>
        </div>
      </div>
    </div>
  );
}
