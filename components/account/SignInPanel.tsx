"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Heart, Mail } from "lucide-react";
import { useMember } from "@/components/account/MemberProvider";
import {
  registerWithPassword,
  requestPasswordReset,
  requestSignIn,
  signInWithPassword,
} from "@/lib/member";
import { cn } from "@/lib/utils";

/**
 * Sign in, create an account, or recover a password.
 *
 * Password sign-in is the front door. The emailed one-time link stays as the
 * side door — it is how accounts from before passwords existed get in, and how
 * anyone gets in without remembering anything.
 */
type Mode = "signin" | "register" | "forgot" | "link";

export function SignInPanel() {
  const { member, loading, signOut, refresh } = useMember();
  const [mode, setMode] = useState<Mode>("signin");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // The verify endpoint sends people back here with ?error=link when an email
  // link has expired or been used already.
  const [linkFailed, setLinkFailed] = useState(false);
  useEffect(() => {
    setLinkFailed(new URLSearchParams(window.location.search).get("error") === "link");
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setState("idle");
    setError("");
    setNotice("");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.includes("@")) return;

    setState("busy");
    setError("");

    if (mode === "signin") {
      const result = await signInWithPassword(email.trim(), password);
      if (result.ok) {
        await refresh();
        return;
      }
      setError(result.error ?? "That email and password do not match.");
      setState("idle");
      return;
    }

    if (mode === "register") {
      const result = await registerWithPassword({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
      });
      if (result.ok) {
        await refresh();
        return;
      }
      setError(result.error ?? "Could not create the account. Please try again.");
      setState("idle");
      return;
    }

    if (mode === "forgot") {
      const result = await requestPasswordReset(email.trim());
      if (result.ok) {
        setNotice(result.message ?? "If that address has an account, a reset link is on its way.");
        setState("sent");
        return;
      }
      setError(result.error ?? "Could not send the reset link. Please try again.");
      setState("idle");
      return;
    }

    // mode === "link"
    const result = await requestSignIn(email.trim(), name.trim() || undefined);
    if (result.ok) {
      setNotice(result.message);
      setState("sent");
      return;
    }
    setError(result.message);
    setState("idle");
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
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-aqua-400/10">
          <Check className="h-5 w-5 text-aqua-600" aria-hidden />
        </span>
        <h2 className="mt-3 text-base font-bold text-snow">
          You are signed in{member.name ? `, ${member.name}` : ""}
        </h2>
        <p className="mt-1.5 text-sm text-muted">{member.email}</p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/saved" className="btn-primary">
            Your saved places
          </Link>
          <Link href="/my-business" className="btn-ghost">
            My business
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
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-aqua-400/10">
          <Mail className="h-5 w-5 text-aqua-600" aria-hidden />
        </span>
        <h2 className="mt-3 text-base font-bold text-snow">Check your inbox</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{notice}</p>
        <p className="mx-auto mt-3 max-w-sm text-[0.8125rem] leading-relaxed text-muted">
          The link works once and lasts 15 minutes. If it does not arrive, check your spam folder
          before trying again.
        </p>
        <button type="button" onClick={() => switchMode("signin")} className="btn-ghost mt-5">
          Back to sign in
        </button>
      </div>
    );
  }

  const heading =
    mode === "register"
      ? "Create your account"
      : mode === "forgot"
        ? "Reset your password"
        : mode === "link"
          ? "Email me a sign-in link"
          : "Sign in";

  const intro =
    mode === "register"
      ? "Free, and it takes a minute. Save places, book, earn Durban Points and manage your business."
      : mode === "forgot"
        ? "Enter your email and we will send a link to choose a new password. It also works for accounts that never had one."
        : mode === "link"
          ? "No password needed — we email you a one-time link that signs you in."
          : "Welcome back.";

  return (
    <div className="panel p-6 sm:p-8">
      {/* Sign in / Create account switch. */}
      {(mode === "signin" || mode === "register") && (
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-pill border border-line p-1">
          {(["signin", "register"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => switchMode(tab)}
              aria-pressed={mode === tab}
              className={cn(
                "rounded-pill py-2 text-sm font-semibold transition",
                mode === tab ? "bg-aqua-500 text-white" : "text-mist hover:text-snow"
              )}
            >
              {tab === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      )}

      {linkFailed && mode === "signin" && (
        <p
          role="alert"
          className="mb-5 rounded-lg bg-brand-500/15 p-3 text-xs leading-relaxed text-brand-200"
        >
          That sign-in link has expired or was already used. Sign in below, or request a fresh
          link.
        </p>
      )}

      <h2 className="text-base font-bold text-snow">{heading}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{intro}</p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        {mode === "register" && (
          <div>
            <label htmlFor="auth-name" className="mb-1.5 block text-xs font-semibold text-snow">
              First name <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="auth-name"
              type="text"
              autoComplete="given-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="So we know what to call you"
              className="field"
            />
          </div>
        )}

        <div>
          <label htmlFor="auth-email" className="mb-1.5 block text-xs font-semibold text-snow">
            Email address <span className="text-brand-600">*</span>
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="field"
          />
        </div>

        {(mode === "signin" || mode === "register") && (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label htmlFor="auth-password" className="block text-xs font-semibold text-snow">
                Password <span className="text-brand-600">*</span>
              </label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs font-semibold text-aqua-600 transition hover:text-aqua-500"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              id="auth-password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              className="field"
            />
          </div>
        )}

        <button type="submit" disabled={state === "busy"} className="btn-primary w-full">
          {state === "busy"
            ? "One moment…"
            : mode === "register"
              ? "Create account"
              : mode === "forgot"
                ? "Email me a reset link"
                : mode === "link"
                  ? "Email me a sign-in link"
                  : "Sign in"}
        </button>

        {error && (
          <p role="alert" className="text-xs font-medium leading-relaxed text-brand-600">
            {error}
          </p>
        )}
      </form>

      <div className="mt-4 space-y-1.5 text-center text-[0.8125rem]">
        {mode !== "link" ? (
          <button
            type="button"
            onClick={() => switchMode("link")}
            className="font-semibold text-aqua-600 transition hover:text-aqua-500"
          >
            Email me a sign-in link instead
          </button>
        ) : (
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className="font-semibold text-aqua-600 transition hover:text-aqua-500"
          >
            Sign in with a password instead
          </button>
        )}

        {mode === "forgot" && (
          <p>
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="font-semibold text-muted transition hover:text-snow"
            >
              Back to sign in
            </button>
          </p>
        )}
      </div>

      <p className="mt-5 flex items-start gap-2 text-[0.6875rem] leading-relaxed text-muted">
        <Heart className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
        We store your email address, your password as a salted hash, and what you save. Nothing
        else, and nothing is passed to advertisers. See our{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
