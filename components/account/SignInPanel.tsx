"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Heart, Mail } from "lucide-react";
import { useMember } from "@/components/account/MemberProvider";
import { requestSignIn } from "@/lib/member";

/**
 * Sign in or join, by emailed link.
 *
 * One field and no password. The email address is the account, so there is
 * nothing to remember, nothing to reset, and nothing for us to leak.
 */
export function SignInPanel() {
  const { member, loading, signOut } = useMember();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [linkFailed, setLinkFailed] = useState(false);

  // The verify endpoint sends people back here with ?error=link when a link has
  // expired or been used already.
  useEffect(() => {
    setLinkFailed(new URLSearchParams(window.location.search).get("error") === "link");
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.includes("@")) return;

    setState("sending");
    const result = await requestSignIn(email.trim(), name.trim() || undefined);

    setMessage(result.message);
    setState(result.ok ? "sent" : "error");
  }

  if (loading) {
    return (
      <div className="panel p-8 text-center text-sm text-muted" aria-busy>
        Checking whether you are signed in…
      </div>
    );
  }

  if (member) {
    return (
      <div className="panel p-8 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-brand-50">
          <Check className="h-5 w-5 text-brand-500" aria-hidden />
        </span>
        <h2 className="mt-3 text-base font-bold text-ink">
          You are signed in{member.name ? `, ${member.name}` : ""}
        </h2>
        <p className="mt-1.5 text-sm text-muted">{member.email}</p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/saved" className="btn-primary">
            Your saved places
          </Link>
          <button type="button" onClick={() => void signOut()} className="btn-ghost">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (state === "sent") {
    return (
      <div className="panel p-8 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-brand-50">
          <Mail className="h-5 w-5 text-brand-500" aria-hidden />
        </span>
        <h2 className="mt-3 text-base font-bold text-ink">Check your inbox</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{message}</p>
        <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-muted">
          The link works once. If it does not arrive, check your spam folder before trying again —
          asking repeatedly invalidates the earlier links.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="btn-ghost mt-5"
        >
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel p-6 sm:p-8">
      {linkFailed && (
        <p role="alert" className="mb-5 rounded-lg bg-brand-50 p-3 text-xs leading-relaxed text-brand-700">
          That sign-in link has expired or was already used. Links work once and last 15 minutes —
          enter your email below for a fresh one.
        </p>
      )}

      <h2 className="text-base font-bold text-ink">Join or sign in</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Enter your email and we will send you a link. No password to choose or remember.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="signin-email" className="mb-1.5 block text-xs font-semibold text-ink">
            Email address <span className="text-brand-500">*</span>
          </label>
          <input
            id="signin-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="field"
          />
        </div>

        <div>
          <label htmlFor="signin-name" className="mb-1.5 block text-xs font-semibold text-ink">
            First name <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="signin-name"
            type="text"
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="So we know what to call you"
            className="field"
          />
        </div>
      </div>

      <button type="submit" disabled={state === "sending"} className="btn-primary mt-5 w-full">
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>

      {state === "error" && (
        <p role="alert" className="mt-3 text-xs font-medium text-brand-600">
          {message}
        </p>
      )}

      <p className="mt-4 flex items-start gap-2 text-[0.6875rem] leading-relaxed text-muted">
        <Heart className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" aria-hidden />
        We store your email address and what you save. Nothing else, and nothing is passed to
        advertisers. See our <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </form>
  );
}
