/**
 * PayFast — recurring subscription billing.
 *
 * The browser never talks to us about money: it posts a signed form straight
 * to PayFast, and PayFast tells us what happened server-to-server (the ITN
 * webhook). Nothing the visitor can edit changes what we believe — the ITN is
 * verified by signature, by a validation postback to PayFast, and by amount.
 *
 * Without live credentials configured, everything runs against the PayFast
 * sandbox with its public test merchant, so the whole flow is testable before
 * a cent is real.
 */
import type { Env } from "./lib";

/** PayFast's public sandbox merchant — fine to hardcode, it is documentation. */
const SANDBOX = {
  merchantId: "10000100",
  merchantKey: "46f0cd694581a",
  passphrase: "jt7NOE43FZPn",
  host: "sandbox.payfast.co.za",
};

export const PREMIUM_PRICE_RANDS = 199;

export interface PayfastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  host: string;
  live: boolean;
}

export function payfastConfig(env: Env): PayfastConfig {
  const live = Boolean(env.PAYFAST_MERCHANT_ID && env.PAYFAST_MERCHANT_KEY);

  if (!live) {
    return { ...SANDBOX, live: false };
  }

  return {
    merchantId: env.PAYFAST_MERCHANT_ID as string,
    merchantKey: env.PAYFAST_MERCHANT_KEY as string,
    passphrase: env.PAYFAST_PASSPHRASE ?? "",
    host: "www.payfast.co.za",
    live: true,
  };
}

/* -------------------------------------------------------------------------
 * MD5
 *
 * PayFast signatures are MD5 and WebCrypto does not provide it, so a small
 * public-domain implementation lives here. MD5 is fine for this use — it is
 * a message-authentication convention required by the gateway, not storage
 * of anything secret.
 * ---------------------------------------------------------------------- */

export function md5(input: string): string {
  const bytes = new TextEncoder().encode(input);

  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15,
    21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i += 1) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32);

  const length = bytes.length;
  const withPadding = ((length + 8) >> 6) * 64 + 64;
  const buffer = new Uint8Array(withPadding + 8);
  buffer.set(bytes);
  buffer[length] = 0x80;
  const bitLength = length * 8;
  new DataView(buffer.buffer).setUint32(withPadding, bitLength >>> 0, true);
  new DataView(buffer.buffer).setUint32(withPadding + 4, Math.floor(bitLength / 2 ** 32), true);

  let [a0, b0, c0, d0] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  const view = new DataView(buffer.buffer);

  for (let chunk = 0; chunk < buffer.length; chunk += 64) {
    let [A, B, C, D] = [a0, b0, c0, d0];

    for (let i = 0; i < 64; i += 1) {
      let F: number;
      let g: number;

      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }

      const M = view.getUint32(chunk + g * 4, true);
      F = (F + A + K[i] + M) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << s[i]) | (F >>> (32 - s[i])))) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, a0, true);
  dv.setUint32(4, b0, true);
  dv.setUint32(8, c0, true);
  dv.setUint32(12, d0, true);

  return [...out].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** PayFast wants PHP-style urlencoding: spaces as +, uppercase hex. */
function pfEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+").replace(/'/g, "%27");
}

/**
 * The signature: every non-empty field, in the exact order given, as a
 * querystring, with the passphrase appended, MD5'd.
 */
export function pfSignature(fields: [string, string][], passphrase: string): string {
  const parts = fields
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `${key}=${pfEncode(value.trim())}`);

  if (passphrase) parts.push(`passphrase=${pfEncode(passphrase.trim())}`);

  return md5(parts.join("&"));
}

/* -------------------------------------------------------------------------
 * Checkout
 * ---------------------------------------------------------------------- */

export interface CheckoutInput {
  paymentId: string;
  email: string;
  itemName: string;
  itemDescription: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  /** Passed back to us in the ITN. */
  customSlug: string;
  customMemberId: string;
}

/**
 * The signed form the browser auto-submits to PayFast.
 *
 * Field order matters — the signature is computed over the fields in this
 * exact sequence, per PayFast's documentation.
 */
export function buildCheckout(
  env: Env,
  input: CheckoutInput
): { action: string; fields: Record<string, string>; sandbox: boolean } {
  const config = payfastConfig(env);
  const amount = PREMIUM_PRICE_RANDS.toFixed(2);

  const ordered: [string, string][] = [
    ["merchant_id", config.merchantId],
    ["merchant_key", config.merchantKey],
    ["return_url", input.returnUrl],
    ["cancel_url", input.cancelUrl],
    ["notify_url", input.notifyUrl],
    ["email_address", input.email],
    ["m_payment_id", input.paymentId],
    ["amount", amount],
    ["item_name", input.itemName],
    ["item_description", input.itemDescription],
    ["custom_str1", input.customSlug],
    ["custom_str2", input.customMemberId],
    // Recurring: subscription_type 1, monthly (frequency 3), forever (cycles 0).
    ["subscription_type", "1"],
    ["recurring_amount", amount],
    ["frequency", "3"],
    ["cycles", "0"],
  ];

  const fields = Object.fromEntries(ordered);
  fields.signature = pfSignature(ordered, config.passphrase);

  return {
    action: `https://${config.host}/eng/process`,
    fields,
    sandbox: !config.live,
  };
}

/* -------------------------------------------------------------------------
 * ITN (the webhook)
 * ---------------------------------------------------------------------- */

export interface Itn {
  params: Map<string, string>;
  raw: string;
}

/** Parse the ITN body preserving field order — the signature depends on it. */
export function parseItn(body: string): Itn {
  const params = new Map<string, string>();

  for (const pair of body.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq));
    const value = eq === -1 ? "" : decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, "%20"));
    params.set(key, value);
  }

  return { params, raw: body };
}

/** Signature check: the posted fields, in posted order, minus the signature. */
export function itnSignatureValid(itn: Itn, passphrase: string): boolean {
  const fields: [string, string][] = [];
  for (const [key, value] of itn.params) {
    if (key !== "signature") fields.push([key, value]);
  }

  return pfSignature(fields, passphrase) === (itn.params.get("signature") ?? "");
}

/**
 * Ask PayFast itself whether this notification is genuine. Belt to the
 * signature's braces — a forged POST fails here even if a passphrase leaked.
 */
export async function itnConfirmedByPayfast(itn: Itn, config: PayfastConfig): Promise<boolean> {
  try {
    const response = await fetch(`https://${config.host}/eng/query/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: itn.raw,
    });

    return (await response.text()).trim() === "VALID";
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------
 * Subscription management (cancel)
 * ---------------------------------------------------------------------- */

/**
 * Cancel a subscription by its PayFast token.
 *
 * The API signs an alphabetised set of the headers plus the passphrase —
 * a different scheme from the checkout form, per PayFast's API docs.
 */
export async function cancelSubscription(env: Env, token: string): Promise<boolean> {
  const config = payfastConfig(env);
  const timestamp = new Date().toISOString().slice(0, 19) + "+02:00";

  const signed: [string, string][] = [
    ["merchant-id", config.merchantId],
    ["passphrase", config.passphrase],
    ["timestamp", timestamp],
    ["version", "v1"],
  ];

  const signature = md5(
    signed
      .filter(([, value]) => value !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${pfEncode(value)}`)
      .join("&")
  );

  const testing = config.live ? "" : "?testing=true";

  try {
    const response = await fetch(
      `https://api.payfast.co.za/subscriptions/${encodeURIComponent(token)}/cancel${testing}`,
      {
        method: "PUT",
        headers: {
          "merchant-id": config.merchantId,
          version: "v1",
          timestamp,
          signature,
        },
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}
