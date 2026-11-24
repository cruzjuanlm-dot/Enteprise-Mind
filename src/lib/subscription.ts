/**
 * Stripe is not connected. Do not call Stripe from this module.
 * requireActiveSubscription reads FLUX_SUBSCRIPTION_ACTIVE until a later slice
 * replaces the flag with a Stripe subscription lookup.
 */
export type StripeSubscriptionHook = {
  connected: false;
  provider: "stripe";
  note: string;
};

export const stripeSubscriptionHook: StripeSubscriptionHook = {
  connected: false,
  provider: "stripe",
  note: "Stripe is not connected. The meeting bot reads FLUX_SUBSCRIPTION_ACTIVE and does not call Stripe.",
};

export class SubscriptionInactiveError extends Error {
  readonly code = "subscription_inactive";
  readonly status = 403;

  constructor() {
    super("subscription_inactive");
    this.name = "SubscriptionInactiveError";
  }
}

export function requireActiveSubscription(env: NodeJS.ProcessEnv = process.env): void {
  void stripeSubscriptionHook.connected;
  const value = env.FLUX_SUBSCRIPTION_ACTIVE?.trim().toLowerCase() ?? "";
  if (value === "1" || value === "true" || value === "yes") return;
  throw new SubscriptionInactiveError();
}
