import Stripe from 'stripe'

// Server-only Stripe client. Reads the secret key from env (TEST key in dev).
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})
