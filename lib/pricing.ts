/**
 * Product pricing, single-sourced: the marketing page, the dashboard and the
 * amount PayFast actually charges all read this one number, so they can never
 * drift apart.
 */
export const PREMIUM_PRICE_RANDS = 10;

/**
 * Event placement tiers — ONE-OFF prices (an event ends, so nothing recurs).
 * Premium sits above Featured, which sits above free, everywhere events list.
 */
export const EVENT_TIER_PRICES_RANDS = {
  featured: 999,
  premium: 1999,
} as const;

export type EventPaidTier = keyof typeof EVENT_TIER_PRICES_RANDS;
