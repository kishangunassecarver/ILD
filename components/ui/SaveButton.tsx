"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, X } from "lucide-react";
import { useMember } from "@/components/account/MemberProvider";
import type { SaveKind } from "@/lib/member";
import { cn } from "@/lib/utils";

/**
 * Favourite toggle, backed by the member's account.
 *
 * When nobody is signed in, tapping it explains why rather than doing nothing
 * or silently saving to a browser that will forget: the whole point of an
 * account is that saves follow you to the app.
 */
export function SaveButton({
  label,
  kind = "listing",
  slug,
  className,
  variant = "bare",
}: {
  /** What is being saved, for the screen-reader label. */
  label: string;
  kind?: SaveKind;
  /** Identifies the thing being saved. Without it the button is display-only. */
  slug?: string;
  className?: string;
  variant?: "bare" | "chip";
}) {
  const { member, loading, isSaved, toggle } = useMember();
  const [prompt, setPrompt] = useState(false);

  const saved = Boolean(slug) && isSaved(kind, slug as string);

  async function onClick() {
    if (!slug) return;

    if (!member) {
      setPrompt(true);
      return;
    }

    await toggle(kind, slug);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        // Until we know, the button works but claims nothing about its state.
        aria-busy={loading || undefined}
        className={cn(
          "grid place-items-center transition",
          variant === "chip"
            ? "h-9 w-9 rounded-full border border-line bg-night-800/90 shadow-rail backdrop-blur hover:border-aqua-500/40"
            : "h-7 w-7 rounded-full hover:bg-aqua-400/10",
          className
        )}
      >
        <Heart
          className={cn(
            "h-4 w-4 transition",
            // The heart stays red — it is the brand mark, not an action.
            saved ? "scale-110 fill-brand-500 text-brand-500" : "text-muted hover:text-brand-600"
          )}
          aria-hidden
        />
        <span className="sr-only">
          {saved ? `Remove ${label} from your favourites` : `Save ${label} to your favourites`}
        </span>
      </button>

      {prompt && <SignInPrompt label={label} onClose={() => setPrompt(false)} />}
    </>
  );
}

/** Shown once, on the tap that needed an account. */
function SignInPrompt({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-prompt-title"
      className="fixed inset-0 z-[60] grid place-items-center p-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-ink/50"
      />

      <div className="panel relative w-full max-w-sm p-6 text-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-snow/5 hover:text-snow"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-brand-500/15">
          <Heart className="h-5 w-5 text-brand-600" aria-hidden />
        </span>

        <h2 id="save-prompt-title" className="mt-3 text-base font-bold text-snow">
          Save {label}?
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
          Join for free and your saved places follow you between this site and the app. No password
          to remember — we email you a link.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/join" className="btn-primary">
            Join or sign in
          </Link>
          <button type="button" onClick={onClose} className="btn-ghost">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
