"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, Heart, LogOut, User } from "lucide-react";
import { useMember } from "@/components/account/MemberProvider";

/**
 * The header's account control.
 *
 * Signed out it is a plain link to /join. Signed in it becomes the member's
 * initial with a small menu, so there is always one obvious place to find your
 * saves and to sign out again.
 */
export function AccountMenu() {
  const { member, loading, signOut } = useMember();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Signed out — and while we are still finding out, which keeps the header
  // from flickering between two different controls on every page load.
  if (loading || !member) {
    return (
      <Link
        href="/join"
        aria-label="Join or sign in"
        title="Join or sign in"
        className="grid h-9 w-9 place-items-center rounded-md text-snow transition hover:bg-white/5"
      >
        <User className="h-[1.15rem] w-[1.15rem]" aria-hidden />
      </Link>
    );
  }

  const initial = (member.name || member.email).trim().charAt(0).toUpperCase();

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Your account"
        className="grid h-9 w-9 place-items-center rounded-full bg-aqua-500 text-[0.8125rem] font-bold text-white transition hover:bg-aqua-400"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-night-800 shadow-lift"
        >
          <div className="border-b border-line px-4 py-3">
            {member.name && <p className="text-sm font-bold text-snow">{member.name}</p>}
            <p className="truncate text-xs text-muted">{member.email}</p>
          </div>

          <Link
            href="/saved"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-mist transition hover:bg-white/5"
          >
            <Heart className="h-4 w-4 text-muted" aria-hidden />
            Saved places
          </Link>

          <Link
            href="/my-business"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-mist transition hover:bg-white/5"
          >
            <Building2 className="h-4 w-4 text-muted" aria-hidden />
            My business
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-left text-sm text-mist transition hover:bg-white/5"
          >
            <LogOut className="h-4 w-4 text-muted" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
