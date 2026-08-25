"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Favourite toggle.
 *
 * Local state only — the real thing writes to a member account, which is an
 * app concern rather than a static-site one. Kept as a component so wiring it
 * up later touches one file.
 */
export function SaveButton({
  label,
  className,
  variant = "bare",
}: {
  /** What is being saved, for the screen-reader label. */
  label: string;
  className?: string;
  variant?: "bare" | "chip";
}) {
  const [saved, setSaved] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setSaved((s) => !s)}
      aria-pressed={saved}
      className={cn(
        "grid place-items-center transition",
        variant === "chip"
          ? "h-9 w-9 rounded-full border border-line bg-white/95 shadow-rail hover:border-brand-200"
          : "h-7 w-7 rounded-full hover:bg-brand-50",
        className
      )}
    >
      <Heart
        className={cn(
          "h-4 w-4 transition",
          saved ? "fill-brand-500 text-brand-500" : "text-muted hover:text-brand-500"
        )}
        aria-hidden
      />
      <span className="sr-only">
        {saved ? `Remove ${label} from your favourites` : `Save ${label} to your favourites`}
      </span>
    </button>
  );
}
