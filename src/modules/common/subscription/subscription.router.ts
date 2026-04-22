import { Router } from 'express';
import { verifyReader } from '../../../middlewares/auth.middleware';
import {
  confirmStripeSubscription,
  confirmRevenueCatSubscription,
  getSubscriptionStatus,
  cancelSubscription,
  stripeWebhook,
  revenueCatWebhook,
} from './subscription.controller';

const router = Router();

// ── Webhooks — called by Stripe/RevenueCat, NOT by your app ─────────────────
// rawBody is captured in app.ts via express.json verify option (needed for Stripe signature)
router.post('/webhook/stripe', stripeWebhook);
router.post('/webhook/revenuecat', revenueCatWebhook);

// ── Reader routes — called by your frontend/app after payment ────────────────
router.post('/confirm/stripe', verifyReader, confirmStripeSubscription);
router.post('/confirm/revenuecat', verifyReader, confirmRevenueCatSubscription);
router.get('/status', verifyReader, getSubscriptionStatus);
router.post('/cancel', verifyReader, cancelSubscription);

export default router;

/*
 * ═══════════════════════════════════════════════════════════════════════
 *  HOW THE SUBSCRIPTION FLOW WORKS
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  ── WEB (Stripe) ─────────────────────────────────────────────────────
 *
 *  1. Admin sets up plans first (run once):
 *     PATCH {{baseUrl}}/admin/subscription/plans/monthly
 *     PATCH {{baseUrl}}/admin/subscription/plans/yearly
 *     → This creates the Stripe Product + Price automatically.
 *       Admin gets back stripePriceId for each plan.
 *
 *  2. Frontend builds a Stripe Checkout page using the Publishable Key
 *     (pk_live_...) and the stripePriceId from step 1.
 *     Stripe redirects to your success URL on payment:
 *       https://yourapp.com/subscription/success?session_id=cs_live_...
 *
 *  3. Frontend calls your backend to confirm the subscription:
 *     POST {{baseUrl}}/subscription/confirm/stripe
 *     Auth: Bearer {{readerToken}}
 *     Body:
 *     {
 *       "sessionId": "cs_live_...",   ← from success URL query param
 *       "planType": "monthly"
 *     }
 *     → Backend verifies the session with Stripe, records subscription
 *       history, sets reader.isSubscribed = true.
 *
 *  4. When the billing period ends, Stripe fires webhooks automatically:
 *     - invoice.payment_succeeded  → new period starts, new history record
 *     - customer.subscription.deleted → access revoked, isSubscribed = false
 *     Backend handles these automatically. No action needed from frontend.
 *
 *  ── MOBILE (RevenueCat) ──────────────────────────────────────────────
 *
 *  1. In your mobile app, when the reader logs in, call:
 *       Purchases.logIn(reader._id)   ← MongoDB reader _id as app_user_id
 *
 *  2. After the reader purchases via RevenueCat, call your backend:
 *     POST {{baseUrl}}/subscription/confirm/revenuecat
 *     Auth: Bearer {{readerToken}}
 *     Body:
 *     {
 *       "planType": "monthly",
 *       "originalTransactionId": "rc_txn_abc123",
 *       "purchasedAtMs": 1745000000000,
 *       "expirationAtMs": 1747678400000
 *     }
 *     → Backend records subscription history, sets reader.isSubscribed = true.
 *
 *  3. RevenueCat fires lifecycle webhooks (RENEWAL, EXPIRATION, etc.)
 *     to {{baseUrl}}/subscription/webhook/revenuecat automatically.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  TESTING IN POSTMAN
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  STEP 1 — Setup plans (admin, once):
 *    PATCH {{baseUrl}}/admin/subscription/plans/monthly  → { price: 9.99, features: [...] }
 *    PATCH {{baseUrl}}/admin/subscription/plans/yearly   → { price: 99,   features: [...] }
 *
 *  STEP 2 — Get plan stripePriceId:
 *    GET  {{baseUrl}}/admin/subscription/plans           → copy stripePriceId
 *
 *  STEP 3 — Create a Stripe Checkout session manually in Postman
 *    (normally the frontend does this with Stripe.js)
 *    To simulate: use Stripe test mode, create a session via the Stripe dashboard
 *    or use Stripe CLI:
 *      stripe checkout sessions create \
 *        --price price_... \
 *        --mode subscription \
 *        --success-url "http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}" \
 *        --cancel-url "http://localhost:3000/cancel"
 *    Complete checkout with test card: 4242 4242 4242 4242
 *
 *  STEP 4 — Confirm subscription (what frontend calls after success URL):
 *    POST {{baseUrl}}/subscription/confirm/stripe
 *    Auth: Bearer {{readerToken}}
 *    Body: { "sessionId": "cs_test_...", "planType": "monthly" }
 *
 *  STEP 5 — Check status:
 *    GET  {{baseUrl}}/subscription/status
 *    Auth: Bearer {{readerToken}}
 *
 *  STEP 6 — Test Stripe webhooks locally:
 *    stripe listen --forward-to localhost:5000/api/v1/subscription/webhook/stripe
 *    stripe trigger customer.subscription.deleted   ← tests access revocation
 *
 *  STEP 7 — Test RevenueCat webhook manually in Postman:
 *    POST {{baseUrl}}/subscription/webhook/revenuecat
 *    Headers: Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET from .env>
 *    Body:
 *    {
 *      "event": {
 *        "type": "EXPIRATION",
 *        "app_user_id": "<reader MongoDB _id>",
 *        "product_id": "premium_monthly",
 *        "original_transaction_id": "rc_test_001",
 *        "expiration_at_ms": 1000000000
 *      }
 *    }
 *    → isSubscribed becomes false on that reader.
 * ═══════════════════════════════════════════════════════════════════════
 */
