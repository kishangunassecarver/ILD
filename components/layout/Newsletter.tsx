"use client";

import { useState } from "react";
import { Check, Facebook, Instagram, Youtube, type LucideIcon } from "lucide-react";
import { NEWSLETTER, SOCIALS } from "@/lib/cms";

/**
 * Lucide ships marks for some networks and not others. The ones it does not
 * cover fall back to a wordmark initial rather than a wrong icon.
 */
const SOCIAL_ICONS: Record<string, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
};

/**
 * Newsletter sign-up.
 *
 * A static export has nowhere to POST to, so this validates and acknowledges
 * locally. Point `ENDPOINT` at the list provider (Mailchimp, Brevo, a Worker)
 * to make it live — the markup does not need to change.
 */
const ENDPOINT: string | null = null;

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;

    if (!ENDPOINT) {
      setState("done");
      return;
    }

    setState("sending");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="border-t border-ink-700 bg-ink" aria-labelledby="newsletter-title">
      <div className="shell flex flex-wrap items-center gap-x-8 gap-y-5 py-7">
        <div className="min-w-[15rem] flex-1">
          <h2 id="newsletter-title" className="text-lg font-bold text-white">
            {NEWSLETTER.title}
          </h2>
          <p className="mt-1 text-sm text-white/60">{NEWSLETTER.body}</p>
        </div>

        {state === "done" ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-aqua-500">
              {" "}
              <Check className="h-3.5 w-3.5 text-white" aria-hidden />
            </span>
            You&apos;re on the list. Watch your inbox.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex w-full max-w-md gap-0 sm:w-auto">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="h-10 w-full min-w-0 rounded-l-pill border border-r-0 border-white/15 bg-white/10 px-4 text-sm text-snow placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-aqua-400 sm:w-64"
            />
            <button
              type="submit"
              disabled={state === "sending"}
              className="btn h-10 shrink-0 rounded-l-none rounded-r-pill bg-aqua-500 px-5 font-bold text-white hover:bg-aqua-400"
            >
              {state === "sending" ? "Sending…" : NEWSLETTER.cta}
            </button>
          </form>
        )}

        {state === "error" && (
          <p role="alert" className="w-full text-xs text-brand-200">
            That didn&apos;t go through. Please try again in a moment.
          </p>
        )}

        <ul className="flex items-center gap-2">
          {SOCIALS.map((social) => {
            const Mark = SOCIAL_ICONS[social.icon];
            return (
              <li key={social.label}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-[0.6875rem] font-bold text-white/70 transition hover:border-aqua-400 hover:text-white"
                >
                  {Mark ? (
                    <Mark className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  ) : (
                    /* Placeholder until the brand SVGs are added to /public. */
                    <span aria-hidden>{social.label.slice(0, 2)}</span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
