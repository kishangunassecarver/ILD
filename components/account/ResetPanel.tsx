"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { useMember } from "@/components/account/MemberProvider";
import { resetPassword } from "@/lib/member";

/**
 * Where the emailed reset link lands. Reads the one-time token from the URL,
 * takes a new password, and signs the member straight in — a reset that ends
 * at another sign-in form is a chore with an extra step.
 */
export function ResetPanel() {
  const router = useRouter();
  const { refresh } = useMember();

  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "busy">("idle");
  const [error, setError] = useState("");

  // Read after mount: a static export has no server to parse the query string.
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;

    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }

    setState("busy");
    setError("");

    const result = await resetPassword(token, password);

    if (result.ok) {
      await refresh();
      router.push("/saved/");
      return;
    }

    setError(result.error ?? "Could not reset the password. Request a fresh link.");
    setState("idle");
  }

  if (token === null) {
    return (
      <div className="panel p-8 text-center">
        <h1 className="text-base font-bold text-snow">This link is incomplete</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          A password-reset link carries a one-time code, and this one does not have one. Open the
          link from the email directly, or request a fresh one.
        </p>
        <Link href="/join" className="btn-primary mt-5">
          Request a reset link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel p-6 sm:p-8">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-aqua-400/10">
        <KeyRound className="h-5 w-5 text-aqua-300" aria-hidden />
      </span>

      <h1 className="mt-3 text-base font-bold text-snow">Choose a new password</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        You will be signed in straight away, and signed out everywhere else.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="reset-password" className="mb-1.5 block text-xs font-semibold text-snow">
            New password <span className="text-brand-400">*</span>
          </label>
          <input
            id="reset-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="field"
          />
        </div>

        <div>
          <label htmlFor="reset-confirm" className="mb-1.5 block text-xs font-semibold text-snow">
            Confirm it <span className="text-brand-400">*</span>
          </label>
          <input
            id="reset-confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="The same password again"
            className="field"
          />
        </div>
      </div>

      <button type="submit" disabled={state === "busy"} className="btn-primary mt-5 w-full">
        {state === "busy" ? "Saving…" : "Set password & sign in"}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-xs font-medium leading-relaxed text-brand-400">
          {error}
        </p>
      )}
    </form>
  );
}
