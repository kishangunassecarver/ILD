"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchMember,
  fetchSaves,
  saveKey,
  signOut as apiSignOut,
  toggleSave as apiToggleSave,
  type Member,
  type SaveKind,
} from "@/lib/member";

/**
 * Holds the signed-in member and their saves for the whole app.
 *
 * One fetch of each on load rather than per-component: a listing grid can have
 * forty save buttons on it, and each asking the API whether it is saved would be
 * forty requests to answer one question.
 *
 * `loading` matters to the UI — a save button must not flash "not saved" before
 * the answer arrives, and a signed-in visitor must not be shown a sign-in
 * prompt for a moment on every page.
 */
interface MemberContextValue {
  member: Member | null;
  loading: boolean;
  /** Keys of everything saved, as `kind:slug`. */
  saved: Set<string>;
  isSaved: (kind: SaveKind, slug: string) => boolean;
  toggle: (kind: SaveKind, slug: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const MemberContext = createContext<MemberContextValue | null>(null);

export function MemberProvider({ children }: { children: React.ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const found = await fetchMember();
    setMember(found);

    if (found) {
      const saves = await fetchSaves();
      setSaved(new Set(saves.map((s) => saveKey(s.kind, s.slug))));
    } else {
      setSaved(new Set());
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isSaved = useCallback(
    (kind: SaveKind, slug: string) => saved.has(saveKey(kind, slug)),
    [saved]
  );

  const toggle = useCallback(
    async (kind: SaveKind, slug: string) => {
      const key = saveKey(kind, slug);
      const wasSaved = saved.has(key);

      // Optimistic, so the heart responds to the tap rather than to the network.
      setSaved((current) => {
        const next = new Set(current);
        if (wasSaved) next.delete(key);
        else next.add(key);
        return next;
      });

      const result = await apiToggleSave(kind, slug);

      // Put it back if the server disagreed or never answered.
      if (result === null || result === wasSaved) {
        setSaved((current) => {
          const next = new Set(current);
          if (wasSaved) next.add(key);
          else next.delete(key);
          return next;
        });
      }
    },
    [saved]
  );

  const signOut = useCallback(async () => {
    await apiSignOut();
    setMember(null);
    setSaved(new Set());
  }, []);

  const value = useMemo<MemberContextValue>(
    () => ({ member, loading, saved, isSaved, toggle, signOut, refresh: load }),
    [member, loading, saved, isSaved, toggle, signOut, load]
  );

  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>;
}

/**
 * Read the member state.
 *
 * Returns a signed-out default rather than throwing when there is no provider,
 * so a component can be rendered in isolation without one.
 */
export function useMember(): MemberContextValue {
  const context = useContext(MemberContext);

  if (context) return context;

  return {
    member: null,
    loading: false,
    saved: new Set(),
    isSaved: () => false,
    toggle: async () => {},
    signOut: async () => {},
    refresh: async () => {},
  };
}
