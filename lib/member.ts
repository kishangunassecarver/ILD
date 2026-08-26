/**
 * Browser-side client for the member API.
 *
 * The site is a static export, so nothing about the signed-in member exists at
 * build time — every page renders as though nobody is signed in, and this fills
 * that in after load. Which is also why every call has to tolerate the API not
 * being there at all: the Worker is deployed separately, and a 404 from
 * /api/me has to read as "signed out", not as a broken page.
 */

export interface Member {
  id: string;
  email: string;
  name: string | null;
}

export interface Save {
  kind: SaveKind;
  slug: string;
  created_at: number;
}

export type SaveKind = "listing" | "event" | "deal" | "page";

/** A key for the in-memory set of saves, since a slug alone is not unique. */
export function saveKey(kind: SaveKind, slug: string): string {
  return `${kind}:${slug}`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(path, {
      ...init,
      // Session cookie is HttpOnly, so it only travels if we ask for it.
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });

    if (!response.ok) return null;

    return (await response.json()) as T;
  } catch {
    // Offline, or the API is not deployed. Callers treat null as "no answer".
    return null;
  }
}

export async function fetchMember(): Promise<Member | null> {
  const data = await call<{ member: Member | null }>("/api/me");

  return data?.member ?? null;
}

export async function fetchSaves(): Promise<Save[]> {
  const data = await call<{ saves: Save[] }>("/api/saves");

  return data?.saves ?? [];
}

/** Toggles a save. Returns the new state, or null if the call did not land. */
export async function toggleSave(kind: SaveKind, slug: string): Promise<boolean | null> {
  const data = await call<{ saved: boolean }>("/api/saves", {
    method: "POST",
    body: JSON.stringify({ kind, slug }),
  });

  return data ? data.saved : null;
}

export async function requestSignIn(
  email: string,
  name?: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch("/api/auth/request", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });

    const data = (await response.json()) as { message?: string; error?: string };

    return {
      ok: response.ok,
      message:
        data.message ??
        data.error ??
        "Something went wrong. Please try again in a moment.",
    };
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check your connection and try again.",
    };
  }
}

export async function signOut(): Promise<void> {
  await call("/api/auth/signout", { method: "POST" });
}

/* -------------------------------------------------------------------------
 * Password sign-in
 * ---------------------------------------------------------------------- */

export async function registerWithPassword(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ ok: boolean; error?: string }> {
  return post("/api/auth/register", input);
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  return post("/api/auth/login", { email, password });
}

export async function requestPasswordReset(
  email: string
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const result = await post("/api/auth/forgot", { email });

  return { ...result, message: result.data?.message as string | undefined };
}

export async function resetPassword(
  token: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  return post("/api/auth/reset", { token, password });
}

/* -------------------------------------------------------------------------
 * Business owners
 * ---------------------------------------------------------------------- */

export interface Claim {
  id: string;
  slug: string;
  hub: string;
  business_name: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: number;
  decided_at: number | null;
  decided_note: string | null;
}

export interface EditSubmission {
  id: string;
  slug: string;
  fields: Record<string, unknown>;
  status: "pending" | "applied" | "rejected" | "superseded";
  created_at: number;
  decided_at: number | null;
  decided_note: string | null;
}

export interface MyBusinesses {
  claims: Claim[];
  edits: EditSubmission[];
  editable: Record<string, { label: string; kind: string }>;
}

export async function fetchMyBusinesses(): Promise<MyBusinesses | null> {
  return call<MyBusinesses>("/api/business/mine");
}

/**
 * POST helper that surfaces the server's own error message — these forms have
 * field-level validation on the other end, and "something went wrong" would
 * throw that detail away.
 */
async function post(
  path: string,
  body: unknown
): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> {
  try {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      return {
        ok: false,
        error:
          typeof data.error === "string"
            ? data.error
            : "Something went wrong. Please try again in a moment.",
      };
    }

    return { ok: true, data };
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }
}

export async function claimListing(input: {
  slug: string;
  hub: string;
  businessName?: string;
  contactName?: string;
  contactPhone?: string;
  role?: string;
  note?: string;
}): Promise<{ ok: boolean; error?: string; status?: string }> {
  const result = await post("/api/business/claim", input);

  return { ...result, status: result.data?.status as string | undefined };
}

export async function submitListingEdit(
  slug: string,
  fields: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  return post("/api/business/edit", { slug, fields });
}

export async function submitEnquiry(input: {
  name: string;
  email: string;
  phone?: string;
  business?: string;
  plan?: string;
  message?: string;
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  const result = await post("/api/enquiries", input);

  return { ...result, message: result.data?.message as string | undefined };
}
