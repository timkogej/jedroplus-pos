import Stripe from 'stripe'

// Server-only Stripe client. Reads the secret key from env (TEST key in dev).
// Lazily initialized so importing this module never instantiates Stripe at
// build time (Next.js "collect page data") when env vars are absent.
let stripeClient: Stripe | null = null

function getStripe(): Stripe {
  if (!stripeClient) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    stripeClient = new Stripe(apiKey, {
      apiVersion: '2026-04-22.dahlia',
    })
  }
  return stripeClient
}

// Proxy preserves the `stripe.foo.bar(...)` call style at every existing call
// site while deferring construction until the first property access at runtime.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver)
  },
})
