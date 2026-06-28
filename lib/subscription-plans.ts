// Subscription plan ↔ Stripe price mapping.
//
// Price IDs are NEVER hardcoded — they come from env so test/prod stay in sync
// with the Stripe account configured by STRIPE_SECRET_KEY.

export type PlanId = 'plus' | 'pro'
export type BillingInterval = 'monthly' | 'yearly'

export const TRIAL_DAYS = 7

/** Resolves the Stripe price ID for a plan + interval, or throws if unset. */
export function getPriceId(plan: PlanId, interval: BillingInterval): string {
  const key =
    plan === 'plus'
      ? interval === 'monthly'
        ? 'STRIPE_POS_PLUS_MONTHLY'
        : 'STRIPE_POS_PLUS_YEARLY'
      : interval === 'monthly'
        ? 'STRIPE_POS_PRO_MONTHLY'
        : 'STRIPE_POS_PRO_YEARLY'

  const priceId = process.env[key]
  if (!priceId) {
    throw new Error(`${key} is not set`)
  }
  return priceId
}

/** Reverse lookup: which plan/interval does a Stripe price ID correspond to. */
export function resolvePlanFromPriceId(
  priceId: string | null | undefined
): { plan: PlanId; interval: BillingInterval } | null {
  if (!priceId) return null
  const map: Record<string, { plan: PlanId; interval: BillingInterval }> = {
    [process.env.STRIPE_POS_PLUS_MONTHLY ?? '']: { plan: 'plus', interval: 'monthly' },
    [process.env.STRIPE_POS_PLUS_YEARLY ?? '']: { plan: 'plus', interval: 'yearly' },
    [process.env.STRIPE_POS_PRO_MONTHLY ?? '']: { plan: 'pro', interval: 'monthly' },
    [process.env.STRIPE_POS_PRO_YEARLY ?? '']: { plan: 'pro', interval: 'yearly' },
  }
  return map[priceId] ?? null
}

export function isValidPlan(value: unknown): value is PlanId {
  return value === 'plus' || value === 'pro'
}

export function isValidInterval(value: unknown): value is BillingInterval {
  return value === 'monthly' || value === 'yearly'
}
