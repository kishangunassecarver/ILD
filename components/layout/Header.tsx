"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Heart, Menu, Search, User, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { NAV } from "@/lib/cms";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A route change means the menu that triggered it has done its job.
  useEffect(() => {
    setOpenMenu(null);
    setDrawerOpen(false);
  }, [pathname]);

  // The drawer is a full-screen overlay, so the page behind it must not scroll.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenMenu(null);
      setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => clearTimer(), []);

  function clearTimer() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  /** A short close delay lets the pointer cross the gap into the panel. */
  function scheduleClose() {
    clearTimer();
    closeTimer.current = setTimeout(() => setOpenMenu(null), 140);
  }

  function open(label: string) {
    clearTimer();
    setOpenMenu(label);
  }

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const openItem = NAV.find((item) => item.label === openMenu && item.columns?.length);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="shell flex h-[var(--header-h)] items-center gap-4">
          <Logo className="shrink-0" />

          <nav aria-label="Main" className="hidden flex-1 justify-center lg:flex">
            <ul className="flex items-center gap-0.5">
              {NAV.map((item) => {
                const hasPanel = Boolean(item.columns?.length);
                const isOpen = openMenu === item.label;

                return (
                  <li
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => hasPanel && open(item.label)}
                    onMouseLeave={scheduleClose}
                  >
                    <div className="flex items-center">
                      <Link
                        href={item.href}
                        className={cn(
                          "rounded-md px-2.5 py-2 text-[0.8125rem] font-semibold uppercase tracking-wide transition",
                          isCurrent(item.href)
                            ? "text-brand-500"
                            : "text-ink-700 hover:text-brand-500"
                        )}
                        aria-current={isCurrent(item.href) ? "page" : undefined}
                      >
                        {item.label}
                      </Link>

                      {hasPanel && (
                        <button
                          type="button"
                          onClick={() => (isOpen ? setOpenMenu(null) : open(item.label))}
                          aria-expanded={isOpen}
                          aria-label={`${item.label} menu`}
                          className="-ml-1.5 grid h-7 w-5 place-items-center text-ink-400 transition hover:text-brand-500"
                        >
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 transition-transform",
                              isOpen && "rotate-180"
                            )}
                            aria-hidden
                          />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <IconLink href="/search" label="Search">
              <Search className="h-[1.15rem] w-[1.15rem]" aria-hidden />
            </IconLink>
            <IconLink href="/saved" label="Saved places" className="hidden sm:grid">
              <Heart className="h-[1.15rem] w-[1.15rem]" aria-hidden />
            </IconLink>
            <IconLink href="/join" label="Your account" className="hidden sm:grid">
              <User className="h-[1.15rem] w-[1.15rem]" aria-hidden />
            </IconLink>

            <Link
              href="/list-your-business"
              className="btn-primary ml-1.5 hidden py-2 text-[0.8125rem] md:inline-flex"
            >
              List Your Business
            </Link>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              className="ml-1 grid h-9 w-9 place-items-center rounded-md text-ink transition hover:bg-paper lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        {/* One panel for the whole header, aligned to the page shell rather than to
          the nav item, so it can never be pushed off the edge of the viewport. */}
        {openItem && (
          <div
            className="absolute inset-x-0 top-full hidden lg:block"
            onMouseEnter={clearTimer}
            onMouseLeave={scheduleClose}
          >
            <div className="shell pt-2">
              <MegaMenu item={openItem} onNavigate={() => setOpenMenu(null)} />
            </div>
          </div>
        )}
      </header>

      {/* Rendered as a sibling of the header, not a child: the header's
          backdrop-blur makes it a containing block, which would clip a
          position:fixed drawer to the height of the header bar. */}
      {drawerOpen && <MobileDrawer onClose={() => setDrawerOpen(false)} isCurrent={isCurrent} />}
    </>
  );
}

function IconLink({
  href,
  label,
  className,
  children,
}: {
  href: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full text-ink-700 transition hover:bg-paper hover:text-brand-500",
        className
      )}
    >
      {children}
    </Link>
  );
}

function MegaMenu({ item, onNavigate }: { item: (typeof NAV)[number]; onNavigate: () => void }) {
  return (
    <div className="animate-slide-down" role="group" aria-label={`${item.label} links`}>
      <div className="grid gap-6 rounded-card border border-line bg-white p-6 shadow-lift sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
        {item.columns?.map((column) => (
          <div key={column.heading}>
            <p className="mb-2.5 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted">
              {column.heading}
            </p>
            <ul className="space-y-1.5">
              {column.links.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    className="block text-[0.8125rem] font-medium text-ink-700 transition hover:text-brand-500"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {item.feature && (
          <div className="rounded-lg bg-paper p-4">
            <p className="text-sm font-bold text-ink">{item.feature.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{item.feature.body}</p>
            <Link
              href={item.feature.href}
              onClick={onNavigate}
              className="mt-3 inline-block text-xs font-semibold text-brand-500 hover:text-brand-600"
            >
              {item.feature.cta} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileDrawer({
  onClose,
  isCurrent,
}: {
  onClose: () => void;
  isCurrent: (href: string) => boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  /*
   * Backdrop and panel are each positioned against the viewport directly,
   * rather than the panel being absolute inside a fixed wrapper. Nesting made
   * the panel inherit any error in the wrapper's box — and when that box came
   * out wider than the viewport, the panel slid off-screen while the backdrop
   * still covered everything and swallowed taps, so the menu looked like it had
   * broken the page rather than simply failed to open.
   */
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close menu"
        // Deliberately no backdrop-blur here. backdrop-filter on a full-screen
        // fixed overlay is a known source of rendering glitches in mobile
        // Safari, and it already caused one bug in this component by making the
        // header a containing block. A plain dim costs nothing and cannot
        // misbehave.
        className="fixed inset-0 z-50 bg-ink/50"
      />

      {/*
       * Anchored left and sized in viewport units on phones, rather than
       * right-aligned.
       *
       * A right-aligned fixed panel only lands on screen if its containing
       * block is exactly as wide as the viewport. On a real Android device that
       * was not true — the overlay dimmed the page while the panel sat somewhere
       * off to the right, so the menu looked like it had broken the site. The
       * left edge is reliably at zero, and 100vw is the viewport by definition,
       * so this cannot land off-screen however the containing block is measured.
       *
       * dvh rather than vh so the height tracks mobile toolbars as they
       * collapse. The right-hand drawer returns at sm and up.
       */}
      <div className="fixed left-0 top-0 z-50 flex h-[100dvh] w-[100vw] max-w-[100vw] flex-col bg-white shadow-lift sm:left-auto sm:right-0 sm:w-[22rem]">
        <div className="flex h-[var(--header-h)] shrink-0 items-center justify-between border-b border-line px-4">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-9 w-9 place-items-center rounded-md text-ink transition hover:bg-paper"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 py-3">
          <ul className="divide-y divide-line">
            {NAV.map((item) => {
              const hasPanel = Boolean(item.columns?.length);
              const isOpen = expanded === item.label;

              return (
                <li key={item.label} className="py-1">
                  <div className="flex items-center">
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex-1 py-2.5 text-sm font-semibold",
                        isCurrent(item.href) ? "text-brand-500" : "text-ink"
                      )}
                    >
                      {item.label}
                    </Link>
                    {hasPanel && (
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : item.label)}
                        aria-expanded={isOpen}
                        aria-label={`${item.label} sub-menu`}
                        className="grid h-9 w-9 place-items-center rounded-md text-muted transition hover:bg-paper"
                      >
                        <ChevronDown
                          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
                          aria-hidden
                        />
                      </button>
                    )}
                  </div>

                  {hasPanel && isOpen && (
                    <ul className="mb-2 space-y-1.5 border-l border-line pl-4">
                      {item.columns
                        ?.flatMap((column) => column.links)
                        .map((link) => (
                          <li key={link.href + link.label}>
                            <Link
                              href={link.href}
                              onClick={onClose}
                              className="block py-1 text-[0.8125rem] text-muted transition hover:text-brand-500"
                            >
                              {link.label}
                            </Link>
                          </li>
                        ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 space-y-2 border-t border-line p-4">
          <Link href="/list-your-business" onClick={onClose} className="btn-primary w-full">
            List Your Business
          </Link>
          <Link href="/join" onClick={onClose} className="btn-ghost w-full">
            Join for free
          </Link>
        </div>
      </div>
    </div>
  );
}
