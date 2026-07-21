# Subscription change (v1) — rules, gaps, and TODO

This document captures product rules, engineering notes, and a work backlog for **changing group-membership subscriptions** (Hylo modal, Stripe Connect, shared sync).

### Billing model revision (March 2025)

**Decision:** For the few flows where we want an **immediate** upgrade (new access now), we do **not** want Stripe’s default subscription proration as the source of truth. Changes are **offering-level** (interval and/or content access can change), not “same subscription, different unit price.”

**Target behavior:**

- New **content access** starts **immediately** when the change is applied.
- **Billing cycle resets** to the change date (`billing_cycle_anchor: now` on subscription update).
- **Discount on the first invoice** = Hylo-defined **unused prepaid value** on the prior offering (e.g. paid $20 for 3 months with ~¼ of the period left → **$5** off the first charge at the new price), not Stripe’s time-on-line-item proration math.
- Stripe: **`proration_behavior: none`** for that path. **Commit:** unused prepaid credit via **`customers.createBalanceTransaction`** (negative amount = credit) on the Connect account, then **`subscriptions.update`** with **`billing_cycle_anchor: now`**. **Preview:** `invoices.createPreview` with the same `subscription_details`; Hylo credit as **`invoice_items`** negative line when Stripe allows it, else caller merges **`manualCreditCents`** into lines / `amount_due`.
- **Invoice preview** in app must mirror the same formula and Stripe parameters, or users will see misleading totals.

**Impacts:** `membershipChangeCommit` immediate path, `membershipChangeInvoicePreview` / `StripeService` preview, UI copy (`subscriptionChange.invoicePreview.*`, immediate-upgrade body copy), tests, and any runbook that assumed `create_prorations`.

### Implemented in repo (chunk 1)

- **Server rules:** `apps/backend/lib/subscriptionChangeRules.js` — `resolveSubscriptionChangeMode`, duration ↔ Stripe interval helpers, `SUBSCRIPTION_CHANGE_MODE` constants.
- **Unit tests:** `apps/backend/test/unit/lib/subscriptionChangeRules.test.js`
- **UI copy (English, for i18n):** `docs/SUBSCRIPTION_CHANGE_V1_COPY.md`

### Implemented in repo (chunk 2)

- **Migration:** `apps/backend/migrations/20260318120000_subscription_change_events_and_content_access_stripe_customer.js` — `subscription_change_events` table + `content_access.stripe_customer_id`.
- **Model:** `apps/backend/api/models/SubscriptionChangeEvent.js` (global: `SubscriptionChangeEvent`).
- **Eligibility helpers:** `apps/backend/lib/membershipOfferingEligibility.js` + tests `test/unit/lib/membershipOfferingEligibility.test.js`.
- **Checkout:** `stripe_customer_id` set on `content_access` from `session.customer` / `subscription.customer` in `StripeController` + threaded through `StripeProduct.generateContentAccessRecords` / `ContentAccess.recordPurchase`.
- **GraphQL:** `membershipChangeEligibleOfferings`, `membershipChangePreview` — `apps/backend/api/graphql/queries/membershipChange.js`, schema types `MembershipChangePreview`, `MembershipChangeEligibleOfferingsResult`.

### Implemented in repo (chunk 3)

- **Mutation:** `membershipChangeCommit` — `apps/backend/api/graphql/mutations/membershipChange.js`; Stripe helpers including `createCustomerBalanceCredit`, `previewMembershipImmediateUpgradeWithHyloCredit`, `updateSubscriptionPrimaryItemPrice` (optional `billingCycleAnchor: 'now'`) in `StripeService.js`. Schema: `MembershipChangeCommitResult`. **Immediate / past_due upgrade:** Hylo credit + anchor reset (see [billing model revision](#billing-model-revision-march-2025)).
- **Credit helper:** `apps/backend/lib/membershipChangeCredit.js` — linear unused-time credit from subscription period + line price.

---

Run migration locally: `yarn migrate` from `apps/backend`.

---

## Product rules (v1)

### Scope

- **In scope:** Recurring offerings that **grant group access** (same canonical check everywhere: UI + API + sync).
- **Out of scope for “day” duration:** Treat `day` as **test-only**; do not use it in production proration / duration-order logic.
- **Sliding-scale subscriptions:** Allow **changing quantity (units)** only (major variable). **No proration** for that change; **new unit amount applies from the next billing cycle** (schedule at period boundary).

### Immediate upgrade vs schedule (non–sliding-scale, non–lifetime)

**Immediate upgrade** (when rules allow): access **now**, **`billing_cycle_anchor: now`**, **`proration_behavior: none`**, plus a **Hylo-computed** credit for unused prepaid value on the current offering applied to the **first** charge (see [billing model revision](#billing-model-revision-march-2025)). Do **not** rely on Stripe’s default proration lines as the product story.

| Situation | Behavior |
|-----------|----------|
| New plan has **longer** billing period than current (by interval + interval_count; e.g. monthly → seasonal → annual) | **Immediate** upgrade: reset billing to now + Hylo prepaid credit + new price/interval. _(Stripe `create_prorations` is not the target behavior.)_ |
| **Same** billing period (same interval + interval_count), **higher** unit price | **Immediate** upgrade: reset billing to now + Hylo prepaid credit + new price. |
| **Different currency** than current subscription | **Do not** immediate-upgrade with blended credit; **schedule** the new plan to start **at end of current period** (tack on). **UI must state this clearly** so users understand why there’s no mid-cycle price blend. |
| **Change to lifetime** (one-time purchase) | **No prepaid credit / proration swap.** User **keeps** `content_access` from the **old** subscription until those entitlements **expire naturally** (subscription lapses / period ends). Lifetime access is then whatever the lifetime offering grants. |
| Other cases (shorter period, lower price, downgrade, etc.) | **Scheduled** change at **end of current billing period** (no immediate swap). |

### Past due

- If the subscription is **past_due** and the user changes plan: use the **same immediate-upgrade Stripe shape** as other upgrades (**anchor `now`**, **`proration_behavior: none`**, Hylo unused-prepaid **customer balance** credit when the current period still has remaining time).

### One membership per user per group

- **Enforce** in UI + server for v1 (no concurrent duplicate “membership” subscriptions for the same group).

---

## Gap resolutions

### 1) Stripe customer id vs subscription id

- **Today:** `content_access` stores **`stripe_subscription_id`** (and `stripe_session_id`). It does **not** persist Stripe **customer** id on the row.
- **Sufficient:** `stripe.subscriptions.retrieve(subscriptionId, { stripeAccount })` returns **`customer`** (`cus_...`). Use that whenever you need the customer for portal, updates, or invoices.
- **Optional hardening:** Persist `stripe_customer_id` on first successful checkout / first subscription write (reduces Stripe round-trips and simplifies queries). Not strictly required if every flow can start from `subscription_id` + connected account id.

### 2) One membership per group — **enforce (v1)**

- Block second checkout for same group membership class; route to **change subscription** instead (once built).

### 3) Eligibility (group-access offerings only) — **yes**

- Single shared helper: e.g. `offeringGrantsGroupAccess(offering, groupId)` (or equivalent) used by list endpoint and UI.

### 4) `content_access` updates vs replace

- When applying a new offering, **update** rows where the **same access type + scope** already exists (e.g. same group membership line); **deactivate** obsolete rows; **create** new rows for new scopes. All driven by one **shared sync function** so behavior matches webhooks and API.

### 5) Webhooks — **expand coverage**

- Audit existing `customer.subscription.*` / `invoice.*` handlers; add or extend handling so **subscription changes** (plan, quantity, cancel at period end, past_due) reconcile Hylo. Itemize in TODO below.

### 6) Past due + change — **no Stripe proration**

- See **Past due** above; uses **anchor reset + Hylo credit** like `immediate_upgrade` (separate mode id `past_due_no_proration` for analytics only).

### 7) Unique id per subscription change + “record every change?”

**Correlation id:** Every user-initiated change (and idempotent webhook processing) should have a **unique id** (e.g. UUID) passed to Stripe `metadata` and stored on any audit row / pending job.

**Pros of a DB row per subscription change (audit table)**

| Pros | Cons |
|------|------|
| Full **audit trail** for support (“what did user click vs what Stripe did”) | More tables and migrations |
| **Replay / debug** when webhooks arrive out of order | Must keep **idempotent** upserts |
| **Analytics** on upgrades/downgrades | Slight write overhead |
| Clear link between **pending** vs **applied** state | Needs **retention / GDPR** policy if PII in metadata |

**Pros of only mutating `content_access` + Stripe logs**

| Pros | Cons |
|------|------|
| Less schema | Harder support story; “what was in effect last Tuesday?” |
| Stripe Dashboard has invoices | **Hylo-specific** entitlement history is fuzzy |

**Recommendation for v1:** At minimum: **append-only `subscription_change_events`** (or similar) with `id`, `user_id`, `group_id`, `from_product_id`, `to_product_id`, `mode` (immediate/scheduled), `stripe_subscription_id`, `correlation_id`, `status`, `payload` JSON, timestamps. Optionally still **supersede** `content_access` rows for live state.

---

## Sliding scale (change within same offering)

- UI: adjust **quantity** (adjustable quantity) only.
- **No proration**; change effective **next invoice / next period** (confirm exact Stripe parameterization in implementation).
- Document in UI: “New quantity applies starting next billing date.”

---

## Shared sync function

- **Single** function, e.g. `applyGroupMembershipOfferingChange(...)` (name TBD), invoked by:
  - **Immediate** path after Stripe confirms subscription update (+ invoice success if required by policy).
  - **Scheduled** path when the **scheduled** transition fires (webhook / job).
- **Idempotent:** safe under webhook retries; use `correlation_id` + Stripe event id deduplication.
- **TODO (billing revision):** For **immediate upgrade** with anchor reset + customer balance, define when **`content_access`** switches to the new offering (`invoice.paid` vs post-update webhook only) so access “starts straight away” matches Stripe payment guarantees.

---

## Full TODO list

### Product & copy

- [x] Document **duration ordering** for “longer period” (ignore `day` for production rules). _(See `subscriptionChangeRules.js` + table below.)_
- [x] **Currency mismatch:** block plan switches across currencies in v1, with explicit UI messaging.
- [x] **Lifetime upgrade path:** copy that old subscription access continues until natural expiry; no proration. _(Copy file.)_
- [x] **Sliding scale:** copy that quantity change applies **next billing cycle**, no proration. _(Copy file.)_
- [x] **Past due** path: copy that billing restarts from change date (no proration). _(Copy file.)_
- [x] **Immediate upgrade:** modal / `subscriptionChange.immediateProrate.body` + `subscriptionChange.invoicePreview.totalExplainer` updated (en/es/de/fr/pt/hi). _(Optional: refresh `docs/SUBSCRIPTION_CHANGE_V1_COPY.md` for parity.)_

### Rules engine (server)

- [x] Implement **interval + interval_count** comparison (monthly vs seasonal vs annual). via `getStripeBillingSpec` + month weights in `apps/backend/lib/subscriptionChangeRules.js`
- [x] Implement **immediate vs scheduled** decision from: duration change, price change, currency match, lifetime, sliding scale, past_due. via `resolveSubscriptionChangeMode`
- [x] **Immediate-upgrade semantics:** GraphQL mode renamed to `immediate_upgrade`; behavior remains **Hylo credit + anchor reset**. Credit formula: `membershipChangeCredit.js`.
- [x] **Sliding scale:** only **quantity** change path returns `sliding_scale_next_cycle` (API wiring in a later chunk).

### Data model

- [x] Add **audit / event** table for subscription changes (recommended) with **unique correlation id** per attempt. _(Table `subscription_change_events`; rows created in a later chunk when mutation exists.)_
- [x] Optional: add **`stripe_customer_id`** to `content_access` or user–group–stripe mapping (populate on checkout). _(Column + webhook/checkout populate.)_
- [x] **Pending change** state if not fully represented by Stripe alone: `to_product_id`, `pending_effective_at`, `status`, `correlation_id`. _(Columns on `subscription_change_events`.)_

### Stripe (Connect)

- [x] **Immediate upgrade:** **`billing_cycle_anchor: now`**, **`proration_behavior: none`**, **customer balance** credit (`createCustomerBalanceCredit`), `membershipChangeCommit` + `previewMembershipImmediateUpgradeWithHyloCredit`. _(Preview uses negative `invoice_items` when possible; else `manualCreditCents` merge.)_
- [x] **Sliding scale quantity** (v1 slice): `StripeService.updateSubscriptionPrimaryItemQuantity` + `membershipChangeCommit` (`proration_behavior: none`).
- [x] **Past_due** immediate path: same as immediate upgrade (credit + anchor + `none`); tests in `membershipChange.test.js`.
- [x] **Scheduled** branch: implemented in `membershipChangeCommit` via `StripeService.scheduleSubscriptionPrimaryItemPriceAtPeriodEnd` (Stripe subscription schedules). Writes pending event with `pending_effective_at`.
- [x] **Currency mismatch:** blocked in `membershipChangeCommit` with explicit error + UI-disabled options.
- [x] **Lifetime:** `membershipChangeCommit` now performs no-proration transition by setting current recurring subscription to cancel at period end and recording pending event state. Lifetime offering checkout remains a separate purchase action (tracked in payload as `requiresLifetimeCheckout`).

### Webhooks & reconciliation

- [ ] **Credit + invoices:** when Hylo applies customer balance / coupons / custom invoice items, confirm **`invoice.paid`** / **`customer.subscription.updated`** reconciliation and Connect `stripeAccount` usage still match `content_access` + `subscription_change_events`. _(Re-audit after immediate-upgrade implementation.)_
- [x] Audit existing handlers; **list** gaps for `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, and schedule-related events if used. _(See notes below.)_
- [x] Connect: verify **`event.account`** (or equivalent) maps to group’s connected account. — `verifyStripeConnectAccountKnown` in `StripeController.webhook` (unknown `acct_` → 200 + skip; no insert so ops can fix account mapping and replay from Stripe if needed).
- [x] **Idempotency:** store processed Stripe event ids if not already. — Table `stripe_webhook_processed_events`; mark **after** successful handler run so failures still retry.
- [x] Call **shared sync** from webhook when subscription actually reflects new price/phase. — `syncContentAccessForAppliedSubscriptionChange` in `StripeController` updates active `content_access` rows (`product_id` from old offering to new offering) once Stripe subscription primary price matches target for pending scheduled/currency-mismatch change.

**Handler audit (current gaps / notes)**

| Event | Status |
|-------|--------|
| `customer.subscription.updated` | Updates cancel-at-period-end metadata on `content_access`; reconciles pending **scheduled** `subscription_change_events` when primary price matches target (`hylo_correlation_id`). |
| `customer.subscription.deleted` | Expires access; marks pending **lifetime** transition change events applied. |
| `invoice.paid` | Extends access on renewal; **now** passes Connect `stripeAccount` for `subscriptions.update` / `retrieve` when `event.account` is set. |
| `invoice.payment_failed` | Metadata on access; **now** passes Connect options for payment intent retrieve when needed. |
| `checkout.session.completed` / `product.updated` | **Now** passes Connect options for invoice retrieve / product retrieve where applicable. |
| Subscription schedule lifecycle (`subscription_schedule.*`) | Not handled — only used indirectly via Stripe when scheduling price changes; revisit if we need explicit phase logging. |

### API

- [x] Query: **eligible offerings** for change (recurring, group access, exclude test-only day if desired). — `membershipChangeEligibleOfferings`
- [x] Query: **rule preview** (no Stripe call). — `membershipChangePreview`
- [x] Query: **`membershipChangeInvoicePreview`** — Hylo credit + anchor reset preview; field **`hyloPrepaidCreditCents`**. Tests: `membershipChange.test.js` (queries).
- [x] Mutation: **`membershipChangeCommit`** — immediate-upgrade path implements billing revision; payload includes **`hyloPrepaidCreditCents`** when applicable. **Hylo `content_access` / product linkage still follows webhooks + shared sync (not done in this mutation alone).**

### UI

- [x] “Change subscription” entry (e.g. My payments) → modal with eligible list.
- [x] **Invoice preview** (`ChangeSubscriptionModal` / `membershipChangeInvoicePreview`): lines + explainer from API; optional **`hyloPrepaidCreditCents`** in query for future UI.
- [x] **Currency mismatch** explicit messaging + disabled plan options in the selector.
- [x] **Sliding scale** quantity picker in modal (same offering and cross-offering when sliding-scale target requires quantity).
- [x] Clarify overlapping group-access subscriptions: additional purchases can exist, but extra group-access grants do not stack.

### Testing & ops

- [x] **`membershipChangeCommit` + `membershipChangeInvoicePreview`:** updated for Hylo credit + anchor; **`membershipChangeCredit.test.js`** for credit math.
- [ ] Stripe test matrix: upgrade, downgrade, cross-interval, cross-currency, lifetime, sliding quantity, past_due, webhook replay (**add** cases for customer balance / coupon / invoice line shape after redesign).
- [ ] Runbook: manual **reconcile** or replay for missed webhook.

---

## Testing matrix (v1)

| Area | Scenario | Expected |
|---|---|---|
| Eligibility | Eligible list excludes non-group-access, excludes `day` recurring test offerings | Only valid membership-changing offerings shown |
| Immediate upgrade | Month $10 → Month $50 (same currency) | `mode=immediate_upgrade`; Stripe update uses `billing_cycle_anchor=now`, `proration_behavior=none`; Hylo credit applied |
| Immediate upgrade interval | Month → Annual (same currency) | `mode=immediate_upgrade`; immediate swap and anchor reset |
| Downgrade scheduled | Month $50 → Month $10 | `mode=scheduled_period_end`; pending event created with `pending_effective_at` |
| Currency mismatch blocked | USD → EUR | Preview returns blocked mode; UI disables target option; commit rejected with clear error |
| Sliding scale same offering | Same offering, quantity 1 → 4 | `mode=sliding_scale_next_cycle`; quantity update at next cycle |
| Sliding scale cross-offering | Fixed offering → sliding-scale offering with quantity chosen | Quantity required; commit succeeds; Stripe update/schedule carries quantity |
| Sliding scale validation | Missing quantity / below min / above max | UI blocks submit; API rejects invalid quantity with explicit message |
| Lifetime transition | Recurring → lifetime | Current sub set `cancel_at_period_end`; pending lifetime event persisted |
| Past due | `past_due` sub with change | `mode=past_due_no_proration`; anchor reset + Hylo credit semantics preserved |
| Optimistic UI immediate | Immediate mode commit | Transaction row updates immediately; delayed reconcile refreshes later |
| Scheduled UI visibility | Scheduled mode commit | Immediate refetch shows “Upcoming plan change” banner with target offering |
| Webhook sync immediate | `customer.subscription.updated` after immediate commit | `content_access.product_id` switches to target, change event marked applied |
| Webhook sync scheduled | At scheduled phase transition | Pending event applied; `content_access` switches at boundary |
| Invoice paid resilience | `invoice.paid` with missing/odd period fields | No crash; guarded date logic prevents `Invalid time value` throw |
| Replay/idempotency | Repeat same Stripe webhook event id | Second delivery no-op via `stripe_webhook_processed_events` |
| Multi-subscription overlap | User has extra subscription that also grants group access | UI copy clarifies overlap; no false promise of stacked group-access effect |
| Localization | New strings in en/de/es/fr/pt/hi | No i18next missingKey logs for changed flows |

---

## References (code)

- `content_access.stripe_subscription_id` — subscription id for recurring purchases.
- `StripeService.getTransactionDetails` / billing portal — uses subscription retrieve (includes **customer**).
- `StripeController` / webhooks — extend for subscription lifecycle reconciliation.
- `membershipChangeCommit` — `apps/backend/api/graphql/mutations/membershipChange.js`; audit rows in `subscription_change_events`.
