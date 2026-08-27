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

/** A brand-new listing submitted from the dashboard. */
export interface ListingSubmission {
  id: string;
  slug: string;
  hub: string;
  fields: Record<string, unknown>;
  image_url: string | null;
  plan: "free" | "premium";
  status: "pending" | "approved" | "rejected";
  created_at: number;
  decided_at: number | null;
  decided_note: string | null;
}

export interface Subscription {
  id: string;
  slug: string;
  status: "initiated" | "active" | "cancelled" | "failed";
  amount_cents: number;
  last_paid_at: number | null;
  created_at: number;
}

/** One paid billing event; the invoice endpoint renders it. */
export interface Invoice {
  pf_payment_id: string;
  status: string;
  amount_cents: number;
  created_at: number;
  slug: string;
}

export interface MyBusinesses {
  claims: Claim[];
  submissions: ListingSubmission[];
  edits: EditSubmission[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  premiumPrice: number;
  editable: Record<string, { label: string; kind: string }>;
}

export async function fetchMyBusinesses(): Promise<MyBusinesses | null> {
  return call<MyBusinesses>("/api/business/mine");
}

/* -------------------------------------------------------------------------
 * Adding a listing
 * ---------------------------------------------------------------------- */

/** Upload the listing photo; returns the /api/media/… URL to submit with. */
export async function uploadListingImage(
  file: File
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const response = await fetch("/api/business/upload", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": file.type },
      body: file,
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      return {
        ok: false,
        error: typeof data.error === "string" ? data.error : "The upload did not go through.",
      };
    }

    return { ok: true, url: data.url as string };
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }
}

export async function createListing(input: {
  hub: string;
  fields: Record<string, unknown>;
  image?: string | null;
}): Promise<{ ok: boolean; error?: string; slug?: string }> {
  const result = await post("/api/business/create", input);

  return { ...result, slug: result.data?.slug as string | undefined };
}

/* -------------------------------------------------------------------------
 * Premium billing
 * ---------------------------------------------------------------------- */

/**
 * Start the PayFast checkout: ask the Worker for the signed form, then build
 * and submit it so the browser lands on PayFast's payment page.
 */
export async function startPremiumCheckout(slug: string): Promise<{ ok: boolean; error?: string }> {
  const result = await post("/api/billing/checkout", { slug });

  if (!result.ok || !result.data) return result;

  const action = result.data.action as string;
  const fields = result.data.fields as Record<string, string>;

  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();

  return { ok: true };
}

export async function cancelPremium(slug: string): Promise<{ ok: boolean; error?: string }> {
  return post("/api/billing/cancel", { slug });
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
