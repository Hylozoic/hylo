# 23 — Paid content & Stripe

> Status: **BETA** (the Group Settings → Paid Content screen shows a `BETA` pill and the copy "We are testing paid content functionality during this beta phase. Features may change and you may encounter issues as we refine the experience."). No feature flag gates it: any user with the `Administration` responsibility in a group sees the tab.

## 1. Overview

Hylo lets a group charge money for:

- **Membership of the group itself**, with a **group paywall** (`groups.paywall = true`).
- **Access to paid spaces**. A space is a child group (`groups.type = 'space'`, see [15-views-streams-spaces.md](15-views-streams-spaces.md)) with `paywall = true`. This includes spaces that host a track ([21-tracks.md](21-tracks.md)).
- **Group roles**. Buying an offering can assign one or more roles ([12-roles-permissions-moderation.md](12-roles-permissions-moderation.md)).

Payments run on **Stripe Connect**:

- Each group gets its own *connected account*, created by Hylo through the Accounts v2-style `controller` properties.
- Charges are **direct charges** on the connected account. Hylo takes a **7 % application fee**.
- Checkout is **Stripe Hosted Checkout**. The buyer can add an optional **"Hylo platform contribution"** line item there; Hylo moves that amount to the platform account afterwards.
- Subscriptions are self-managed through the **Stripe Billing Portal**. Plan changes go through Hylo's own "Change plan" flow.

Every purchase or steward grant creates a **`content_access`** row. Database triggers turn each active row into **`user_scopes`** strings (`group:<id>`, `track:<id>`, `group_role:<groupId>:<roleId>`). Paywall checks only test those scopes. Stewards (`Administration`) and content managers (`Manage Content`) always bypass the paywall.

Actors:

| Actor | Can do |
|---|---|
| Group steward (responsibility `Administration`) | Connect Stripe, create and edit offerings, toggle the paywall, see subscribers and stats, grant / revoke / refund access |
| Member or visitor | See published offerings on the group About page or the offering page, buy them, manage subscriptions in **My Transactions**, change plan |
| Hylo platform staff (Management UI, `Admin.isSignedIn`) | See dispute and refund analytics across all groups; pause or resume a group's sales |
| Stripe (webhooks) | Drives fulfilment, renewal, cancellation, refund and dispute bookkeeping |

## 2. Concepts & data

### 2.1 Tables

#### `stripe_accounts`
| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | Internal id. `groups.stripe_account_id` references this id, **not** the `acct_` id. |
| `stripe_account_external_id` | varchar(255) | Stripe `acct_…` id |
| `refresh_token` | varchar(255) | Legacy Stripe OAuth (user-level, pre-Connect). Unused by group paid content. |

Many API arguments named `accountId` accept either form. If the value starts with `acct_` it is used as is; otherwise it is looked up as a `stripe_accounts.id` (helper `getExternalAccountId`).

#### `groups` (paid-content columns)
| Column | Type / default | Meaning |
|---|---|---|
| `stripe_account_id` | bigint FK → stripe_accounts | Connected account |
| `stripe_charges_enabled` | bool, false | Cached Stripe `charges_enabled` |
| `stripe_payouts_enabled` | bool, false | Cached `payouts_enabled` |
| `stripe_details_submitted` | bool, false | Cached `details_submitted` |
| `paywall` | bool, false | Group or space requires purchased access |
| `stripe_sales_paused` | bool NOT NULL, false | Platform-staff kill switch. Blocks checkout creation. |
| `stripe_sales_paused_at` | timestamptz | When sales were paused |
| `stripe_sales_paused_reason` | text | Why sales were paused |

GraphQL `Group` exposes:

- `paywall`, `stripeAccountId`, `stripeChargesEnabled`, `stripePayoutsEnabled`, `stripeDetailsSubmitted`.
- `stripeDashboardUrl` = `https://dashboard.stripe.com/<acct_id>`.
- `canAccess`: paywall check (see §5.1).
- `hasValidScope`: an unexpired `group:<id>` scope exists.
- `currentUserMembershipActive`: `true`, `false` (left), or `null` (never a member).

#### `stripe_products` ("offerings")
| Column | Type / default | Notes |
|---|---|---|
| `id` | bigint PK | Hylo offering id. Used in URLs. |
| `group_id` | bigint NOT NULL FK, cascade | Selling group |
| `stripe_product_id` | varchar NOT NULL | `prod_…` on the connected account |
| `stripe_price_id` | varchar NOT NULL | Current default `price_…` |
| `name` | varchar(255) NOT NULL | |
| `description` | text | Stored as **plain text**. HTML from the editor is stripped by `plainTextOfferingDescription` before saving. |
| `price_in_cents` | int NOT NULL | Unit price. For sliding scale this is the per-unit display price (see §5.4). |
| `currency` | varchar(3), `usd` | UI offers `usd`, `eur`, `gbp`, `cad` |
| `track_id` | int FK tracks | **Legacy**. Nulled by migration `20260728120000_paid_spaces_from_tracks`. |
| `access_grants` | jsonb `{}` | `{ groupIds?: int[], groupRoleIds?: int[] }`. Legacy keys `trackIds` and `commonRoleIds` are deprecated or stripped. |
| `metadata` | jsonb NOT NULL `{}` | `{ buyButtonText?: string(≤30), slidingScale?: { enabled: true, minimum?: int, maximum?: int } }` |
| `renewal_policy` | varchar(20), `manual` | `automatic` \| `manual` |
| `duration` | varchar(20), null | `day` (test only), `month`, `season`, `annual`, `lifetime`, or null |
| `publish_status` | varchar(20), `unpublished` | Enum `PublishStatus`: `unpublished`, `unlisted`, `published`, `archived` |
| `created_at` / `updated_at` | timestamptz | |

Publish status semantics:

| Status | Listed in group paywall / About | Reachable by direct link `/groups/:slug/offerings/:id` | Purchasable |
|---|---|---|---|
| `unpublished` | no | **yes**: `publicStripeOffering` applies no status filter, and the offering page shows a normal Buy button | **yes** (no status check in the UI or the API) |
| `unlisted` | no | yes | yes |
| `published` | yes | yes | yes |
| `archived` | no (hidden in the settings list unless "Show archived" is ticked) | yes, same as `unpublished` | yes |

> **Quirk:** neither `createStripeCheckoutSession` nor the offering-details page checks `publish_status`. Anyone with the link can buy an unpublished or archived offering.

Duration → Stripe price and expiry:

| `duration` | Stripe recurring | Default `renewal_policy` | Checkout mode | `content_access.expires_at` on purchase |
|---|---|---|---|---|
| null / `''` | none (one-time) | `manual` | `payment` | null (lifetime) |
| `lifetime` | none | `manual` | `payment` | null |
| `day` | `day` × 1 | `automatic` | `subscription` | now + 1 day |
| `month` | `month` × 1 | `automatic` | `subscription` | now + 30 days |
| `season` | `month` × 3 | `automatic` | `subscription` | now + 90 days |
| `annual` | `year` × 1 | `automatic` | `subscription` | now + 365 days |

The checkout mode is `subscription` **iff** `renewal_policy = 'automatic'`. The web UI never sends `renewalPolicy`, so it is always derived from the duration. A manually-renewing recurring offering (`renewal_policy = manual` with a recurring duration) can only be created through the API. If it is bought in `payment` mode against a recurring price, Stripe errors. If a subscription exists for such an offering, the renewal `invoice.paid` webhook sets `cancel_at_period_end` (§5.8).

The web create form exposes only `''`, `month`, `season` and `annual`. The list view also labels `day` as "1 Day".

`validateOfferingDurationForAccessGrants` (in `@hylo/shared`) currently **always returns null**: any duration is allowed with any grants.

#### `content_access` (access grants: one row = one scope)
| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `user_id` | bigint NOT NULL | Holder |
| `granted_by_group_id` | bigint NOT NULL | Group administering the grant (seller) |
| `group_id` | bigint | Target group or space. Null means the scope falls back to `granted_by_group_id`. |
| `product_id` | bigint FK stripe_products | Offering (purchases; optional for admin grants) |
| `track_id` | int | **Legacy** track grant |
| `group_role_id` | int FK groups_roles | Role grant |
| `common_role_id` | int | Added in migration `20260116…` and present in the migration, **not** in current `schema.sql` / unused (dropped when common roles were consolidated) |
| `access_type` | varchar(50) NOT NULL | `stripe_purchase` \| `admin_grant` (comment also lists `free`, which is unused) |
| `stripe_session_id` | varchar | Checkout session `cs_…`. For subscriptions rescued by `customer.subscription.created`, this may hold the `sub_…` id instead. |
| `stripe_subscription_id` | varchar | `sub_…` for recurring purchases (partial index) |
| `stripe_customer_id` | varchar | `cus_…` on the connected account |
| `status` | varchar(50), `active` | `active`, `expired`, `revoked`, `refunded` |
| `granted_by_id` | bigint | Steward who granted it (admin grants) |
| `expires_at` | timestamptz | Null = never |
| `metadata` | jsonb `{}` | See key list below |
| `created_at` / `updated_at` | | |

Recognised `metadata` keys:

| Area | Keys |
|---|---|
| Purchase | `paymentAmount` (session `amount_total`), `currency`, `purchasedAt`, `accessType: 'group'` (on group rows) |
| Admin grant | `reason` |
| Revoke | `revokedAt`, `revokedBy`, `revokeReason`, `subscriptionCancelled` |
| Refund (mutation) | `refundId`, `refundAmount`, `refundedAt`, `refundedBy`, `refundReason` (+ the revoke keys) |
| Refund (webhook) | `refunded_at`, `refund_amount`, `refund_reason`, `refund_charge_id`, `refund_source: 'stripe_webhook'` |
| Subscription cancel scheduled | `subscription_cancellation_scheduled_at`, `subscription_cancel_at_period_end: true`, `subscription_period_end`, `subscription_cancel_reason` |
| Subscription ended | `subscription_canceled_at`, `subscription_cancel_reason` |
| Renewal | `renewed_at`, `invoice_id`, `billing_reason`, `subscription_period_start`, `subscription_period_end`, `last_renewed_at` |
| Payment failure | `last_payment_failure`, `last_payment_failure_invoice` |
| Reminder / expiry email bookkeeping | `renewal_reminder_sent_at`, `renewal_reminder_sent_for_expires_at`, `expiration_email_sent_at`, `expiration_email_sent_for_expires_at` |
| Rescue path | `created_via_webhook: 'customer.subscription.created'`, `subscription_period_start`, `subscription_period_end` |

Status state machine:

```
          purchase / admin grant
                 │
                 ▼
             ┌────────┐  invoice.paid (renewal) → extendAccess (expires_at := period end, status stays/returns active)
             │ active │◄─────────────────────────────────────────────┐
             └────────┘                                              │
   │      │        │                │                                │
   │      │        │ cron: expires_at ≤ now (≤3 days ago)            │
   │      │        │ or checkAccess() lazily                         │
   │      │        ▼                                                 │
   │      │    expired ──────────── invoice.paid (extendAccess) ──────┘
   │      │        ▲
   │      │        └── customer.subscription.deleted (unless refunded/revoked)
   │      ▼
   │   revoked  (revokeContentAccess; also cancels subscription immediately)
   ▼
 refunded (refundContentAccess or charge.refunded webhook; terminal)
```

`extendAccess` always sets `status = active`. In principle a renewal can therefore revive an `expired` row. A `revoked` or `refunded` row is never revived by renewal, because its subscription has been cancelled.

#### `user_scopes` (materialised entitlements)
| Column | Notes |
|---|---|
| `user_id`, `scope` | Composite PK |
| `expires_at` | Null = never |
| `source_kind` | `grant` (from content_access) or `role` (from a role's `scopes`) |
| `source_id` | content_access id or `group_memberships_group_roles` id |

Scope string formats (`lib/scopes.js`): `group:<groupId>`, `track:<trackId>`, `group_role:<groupId>:<roleId>`.

Trigger `compute_user_scopes_from_content_access` runs AFTER INSERT/UPDATE/DELETE on `content_access`.

- While `status = 'active'` it upserts one scope:
  - `track_id` set → `track:<track_id>`.
  - `group_role_id` set → `group_role:<COALESCE(group_id, granted_by_group_id)>:<group_role_id>`.
  - Neither set → `group:<COALESCE(group_id, granted_by_group_id)>`. Before migration `20260902013000` this always used `granted_by_group_id`, so paid-space grants were wrongly scoped to the parent.
- On conflict, `expires_at` becomes NULL if either side is NULL; otherwise the later of the two.
- When status is not active, it deletes the scope row **only if `source_id = this content_access.id`**. If a second active grant had earlier "won" the row's `source_id`, revoking the first grant leaves the scope in place. Revoking the grant that owns the row removes it, even when another active grant still covers the same scope. The upsert does not change `source_id`; it keeps the first grant's id.

Trigger `compute_user_scopes_from_role` on `group_memberships_group_roles`: when `active`, every string in `groups_roles.scopes` (jsonb array) is inserted with `source_kind = 'role'` and `expires_at = NULL`. When inactive, those rows are deleted.

> **Bug:** both delete triggers reference `NEW`, which is NULL in a Postgres DELETE trigger. Deleting rows therefore does not clean up scopes.

#### `subscription_change_events`
| Column | Notes |
|---|---|
| `user_id`, `group_id` | |
| `correlation_id` varchar(64) UNIQUE | uuid v4. Also written to Stripe subscription metadata as `hylo_correlation_id`. |
| `from_product_id`, `to_product_id` | FK stripe_products, ON DELETE SET NULL |
| `mode` | One of the `SUBSCRIPTION_CHANGE_MODE` values (§5.6) |
| `stripe_subscription_id`, `stripe_customer_id` | |
| `status` | `pending` → `applied` \| `failed` |
| `payload` jsonb | See key list below |
| `pending_effective_at` | Period end, for scheduled or lifetime changes |
| `applied_at`, `error_message` | |

`payload` keys:

- Always: `modeReason`, `meta`, `targetStripePriceId`, `targetQuantity`.
- Immediate upgrade: `hyloPrepaidCreditCents`.
- Scheduled change: `scheduled`.
- Lifetime target: `scheduledCancellationAtPeriodEnd`, `requiresLifetimeCheckout`.
- On apply: `applied`.
- After webhook sync: `syncedContentAccessAt`, `syncedContentAccessCount`, `syncedFromWebhookType`, `syncedFromWebhookEventId`, `appliedFromWebhookType`, `appliedFromWebhookEventId`.

#### `stripe_webhook_processed_events`
`stripe_event_id` PK, `created_at`. Used for idempotency.

#### `stripe_logs`
Created by migration `20260327113000`, which replaced the tables `stripe_refunds`, `stripe_disputes` and `stripe_alert_logs`.

| Column | Notes |
|---|---|
| `log_type` | `refund`, `dispute`, `alert`, `admin_action` |
| `external_id` | Charge id (refund) or dispute id. `UNIQUE(log_type, external_id)`. |
| `alert_type` | `dispute_rate_warning`, `dispute_rate_critical`, `dispute_spike` |
| `threshold_triggered`, `charge_id`, `amount`, `currency`, `reason`, `status`, `metadata` | |
| `group_id`, `stripe_account_id`, `content_access_id` | |

### 2.2 Stripe objects Hylo creates

| Object | Account | Created by | Key fields / metadata |
|---|---|---|---|
| Connected account | platform | `createStripeConnectedAccount` | `controller.fees.payer='account'`, `controller.losses.payments='stripe'`, `controller.stripe_dashboard.type='full'`; `metadata.group_id`, `metadata.platform='hylo'`; `business_profile.name` |
| (existing account connect, service only) | | `connectExistingAccount` | Adds `metadata.connected_at`. Not exposed by any current mutation; `existingAccountId` is passed to the resolver but ignored. |
| Account link | platform | `createStripeAccountLink` | `type: 'account_onboarding'` |
| Product + default price | connected | `createStripeOffering` | `default_price_data { unit_amount, currency, recurring? }`; plain-text description |
| New price on edit | connected | `updateStripeOffering` | When price or currency changes, a new Price is created and set as `default_price`. The old price is left active. |
| Contribution product | connected (cached per account in process memory) | first checkout | Name "Choose Your Hylo Contribution" (localised), description "Choose your level of contribution to support the Hylo platform."; `metadata.hylo_donation_product='true'`; price $1.00 USD one-time with `metadata.hylo_donation_price='true'` |
| Sliding-scale unit product | connected | first sliding checkout per currency + interval | Name "Set Your Contribution Amount (<CUR> units)", description "Adjust quantity to choose your contribution amount."; metadata `hylo_sliding_scale_unit_product='true'`, `hylo_sliding_scale_unit_currency=<cur>`; price `unit_amount=100` in that currency, recurring matching the offering's interval if subscription |
| Checkout session | connected | `createStripeCheckoutSession` | See §5.3 |
| Customer balance transaction | connected | `membershipChangeCommit` (immediate upgrade) | `amount = -credit`, description `Hylo membership change — unused prepaid time (<correlationId>)` |
| Subscription schedule | connected | `membershipChangeCommit` (scheduled) | Two phases; `proration_behavior: 'none'` |
| Transfer | platform | contribution transfer | `source_transaction = chargeId`, no destination; description `Hylo platform contribution` (` (test)` suffix outside production) |
| Refund | connected | `refundContentAccess` | `reason: 'requested_by_customer'` |
| Billing portal session | connected | `myTransactions` | `return_url = <PROTOCOL>://<DOMAIN>/groups/<slug>` |

Stripe API version: `2025-10-29.clover`. The `/noo/stripe/health` endpoint reports `2025-09-30.clover` (stale string).

Checkout-session metadata keys: `groupId`, `offeringId`, `userId`, `priceAmount`, `currency`, any caller `metadata` (the web sends `spaceSlug` or `trackId`), and `hasContributionOption='true'`.

Subscription metadata keys:

- `subscription_data.metadata` mirrors the session metadata.
- `sessionId` is added afterwards (only when the session already has a subscription, which is rare at creation).
- Plan changes add `hylo_correlation_id`, `hylo_swap_credit_cents` and `hylo_swap_anchor='now'`.

Payment-intent metadata: `session_id` is set to `placeholder`, then updated to the real session id when the PI exists at creation.

## 3. Routes / entry points

### Web routes
| Route | Component | Auth | Purpose |
|---|---|---|---|
| `/groups/:slug/settings/paid-content` (sub-tab `account`, the default) | `PaidContentTab` → `AccountTab` | Administration | Connect Stripe and see its status. Query param `?onboarding=complete` triggers an automatic status check; `?onboarding=refresh` is the refresh URL. |
| `/groups/:slug/settings/paid-content/offerings` | `OfferingsTab` | Administration | Paywall toggle; create, edit and list offerings; subscribers. Query `?create=1&spaceId=<id>` opens the create form with that space preselected. The id is validated against the group's child spaces; an invalid id is removed from the URL. |
| `/groups/:slug/settings/paid-content/content-access` | `ContentAccessTab` | Administration | Grant access; list, revoke and refund records. Query `?grant=1&spaceId=<id>` opens the grant form preset to that space. |
| `/groups/:slug/offerings/:offeringId` | `OfferingDetails` | **Public** (in both `RootRouter` and `AuthLayoutRouter`) | Shareable offering page with Buy button |
| `/groups/:slug/payment/success?session_id=&offering_id=[&spaceSlug=]` | `PaymentSuccess` | Auth | Stripe success return |
| `/groups/:slug/payment/cancel`, `/groups/:slug/payment/failure` | `PaymentFailure` | Auth | Stripe cancel return |
| `/my/transactions` | `MyTransactions` | Auth | Buyer's purchases and subscriptions |
| `/groups/:slug/about`, `/groups/:slug/spaces/:spaceSlug` (join interstitial) | `GroupDetail` / `JoinSection` → `PaywallOfferingsSection`; `SpaceJoinPage` | Public / Auth | Paywall purchase prompt; retained-access rejoin |
| `/management/paid-content/stripe-analytics` | `Management/StripeAnalytics` | Hylo admin session | Disputes and refunds dashboard; pause sales |
| `/settings/payment` (user settings tab "Payment") | `PaymentSettingsTab` | Feature flag `PROJECT_CONTRIBUTIONS` | **Legacy** per-user Stripe OAuth for project contributions. Not part of group paid content. |

Settings-menu entry: "Paid Content" (`path: 'paid-content'`, header icon `CreditCard`). It is visible only when `canAdminister`.

Entry from space settings: the space settings modal (Access = Paid) lists "Offerings that include this space" (non-archived offerings whose `groupIds` contain the space). It shows:

- Copy: "If there are no offerings that allow access to this space, members won't be able to join."
- Button **Create Offering** → `…/settings/paid-content/offerings?create=1&spaceId=<id>`.
- Button **Grant Access** → `…/settings/paid-content/content-access?grant=1&spaceId=<id>`.

The space Access option **Paid** has the description "Anyone can see it, but must pay to join". It is disabled until the parent group has Stripe ready (account set, charges, payouts and details all true), with the tooltip "Paid access requires a connected Stripe account. Finish setup in this group's Paid Content settings."

### HTTP endpoints (backend)
| Method + path | Handler | Notes |
|---|---|---|
| `POST /noo/stripe/webhook` | `StripeController.webhook` | Raw body (`bodyParser.raw({type:'application/json'})` mounted for this path) |
| `GET /noo/stripe/health` | `health` | `{status:'configured'|'not_configured', message, apiVersion}` |
| `GET /noo/stripe/checkout/success?session_id&account_id` | `checkoutSuccess` | JSON `{success, message:'Payment successful!', session:{id,payment_status,amount_total,currency}}`. Not used by the web, which uses its own success route. |
| `GET /noo/stripe/checkout/cancel` | `checkoutCancel` | `{success:false, message:'Checkout was cancelled'}` |
| `GET /noo/admin/stripe-analytics` | `AdminController.stripeAnalytics` | Admin |
| `POST /noo/admin/stripe-sales-pause` | `AdminController.setStripeSalesPaused` | Admin; body `{groupId, paused, reason}` |
| `GET|POST /noo/payment/registerStripe?code=` | `PaymentController.registerStripe` | Legacy user-level Stripe OAuth. Redirects to payment settings with `?registered=success|error`. |

Email-template links point at `<FRONTEND_URL>/settings/subscriptions`. **No such web route exists** (the transactions page is `/my/transactions`), so those links land on a 404 or a redirect.

## 4. UX specification

### 4.1 Paid Content settings shell
- Header: desktop "Group Settings > Paid Content", mobile "Paid Content".
- Pill tab bar, centred in a `bg-black/10` rounded strip. The selected tab uses `bg-selected` with a shadow and a hover scale of 1.05.

  | Tab | Desktop label | Mobile label | Route |
  |---|---|---|---|
  | Account | "Payments Account" | "Account" | `''` |
  | Offerings | "Paid Offerings" | "Offerings" | `offerings` |
  | Content access | "Paid Content Access" | "Content Access" | `content-access` |

- `BETA` amber pill and italic disclaimer (see top of this module).
- H2 per tab: "Accept Payments for {{groupName}}" / "Setup Paid Content Offerings" / "Manage Paid Content Access".
- Intro copy:
  - Account: "Use Paid Content to charge for membership in your group or access to a track in your group." and "To start, set up Stripe Connect to accept payments for group memberships, spaces, and other offerings. Stripe handles all payment processing securely."
    - Plus an amber notice when charges or payouts are not both enabled: "After you finish the steps on Stripe, account verification often completes within a couple of hours, but it can take longer. You can use Check Stripe Status or refresh the page while you wait."
  - Offerings: "To charge for group membership or spaces, set up an offering. For example, if you want to create a paywall for your group, click Create Offering and set the payment terms you'd like. Options include one-time or recurring fees, price tiers, and sliding scale. Once the offering is created and your Stripe account is connected, you can check the box to enable a group paywall."
  - Content access: "View who has access to paid content in your group and manage those permissions."
- Error banner (destructive colour, AlertCircle icon): title "Error", then the message.
- On mount, if the group has `stripeAccountId`, the screen loads `stripeAccountStatus` and `stripeOfferings` (every offering of the group, any status).

### 4.2 Account tab
**No account yet: `AccountSetupSection`**

- Heading "Get started with payments".
- Copy: "Set up Stripe Connect to accept payments. If you already have a Stripe account, Stripe will prompt you to connect it during onboarding."
- Box "What happens next", an ordered list:
  1. "Submit this form to create your group's connected account."
  2. "You will be sent to Stripe to confirm business details and, if needed, link a bank account for payouts."
  3. Amber callout: "When Stripe sends you back here, we will refresh your status. Verification often takes a couple of hours but can take longer."
  4. "Once payments are enabled, open the Paid Offerings tab to create what you want to sell."
- Form fields:

  | Field | Default | Validation | Help text |
  |---|---|---|---|
  | Email | current user's email | Required. Format checked with `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Failures show `window.alert`: "Email is required" / "Please enter a valid email address". | "This email will be associated with your Stripe account" |
  | Business Name | group name | Optional | "The name of your business or organization (defaults to group name)" |
  | Country | `US` | Select | "Country where your business is located" |

  Country options: United States (US), Canada (CA), United Kingdom (GB), Australia (AU), Ireland (IE), New Zealand (NZ), Germany (DE), France (FR), Spain (ES), Netherlands (NL).
- Submit button: "Create Account" ("Creating..." while busy).
- On success the screen refetches group settings and **immediately starts onboarding**, redirecting the browser to the Stripe account link.
- Footer box "About Stripe Connect:" with four bullets:
  - "Accept credit card and other payment methods"
  - "Automatic payouts to your bank account"
  - "Full dashboard access to view transactions"
  - "Stripe handles all payment disputes and fraud"

**Account exists: `StripeStatusSection`.** The card's state is derived from the DB-cached flags.

- Fully onboarded (`charges && payouts`):
  - Green CheckCircle, title "Account Active".
  - "Your Stripe account is fully set up and ready to accept payments."
  - "Next steps in Hylo", a numbered list:
    1. "Use the [Paid Offerings] tab to create offerings for memberships, track access, roles, and more."
    2. "Publish at least one offering before turning on a group paywall or track paywalls, if you use those."
    3. "Use Paid Content Access any time to see who has purchased or been granted access."
- Pending (`detailsSubmitted` but not charges+payouts):
  - Amber icon, title "Account Status: Pending".
  - Amber callout: "Your account details have been submitted to Stripe and are being reviewed. Verification often completes within a couple of hours, but it can take from a few minutes to a day or longer."
  - "While you wait": "Use Check Stripe Status above to pull the latest state from Stripe." and "When Accept Payments and Receive Payouts show Yes, open the [Paid Offerings] tab to create what you want to sell."
- Needs onboarding (`!detailsSubmitted`):
  - Title "Stripe Account Setup Required".
  - "Complete your account setup to start accepting payments."
  - "Before you open Stripe":
    1. "Click Complete Onboarding below. You will leave Hylo and finish setup on Stripe's site."
    2. Amber callout: "After Stripe redirects you back here, we check your status automatically. Verification often takes a couple of hours but can take longer."
    3. "When your account is active, use the Paid Offerings tab to create what you want to sell."
- Top-right outline button "Check Stripe Status" ("Checking..." while busy). It calls `checkStripeStatus`, refetches the group, then reloads the live status.
- Three status badges, each a dot (green = yes, grey = no) with "Yes"/"No": "Details Submitted", "Accept Payments", "Receive Payouts".
- "Open Stripe Dashboard" external link (`stripeDashboardUrl`, new tab), shown when available.
- "Complete Onboarding" primary button (ExternalLink icon), shown only when `!detailsSubmitted`. It creates an account link with:
  - `returnUrl = <host>/groups/<slug>/settings/paid-content?onboarding=complete`
  - `refreshUrl = …?onboarding=refresh`

  and sets `window.location.href` to it.
- Returning with `?onboarding=complete` automatically calls `checkStripeStatus`.

### 4.3 Offerings tab
Top to bottom:

**1. Group Paywall card** (`GroupPaywallSection`)

- Label "Group Paywall"; help "When enabled, users must purchase access to join this group".
- Switch plus text "Enabled" / "Disabled".
- Readiness (`isPaywallReady`) requires all of:
  - a Stripe account, with charges, payouts and details all true;
  - at least one offering with `publishStatus === 'published'` whose `accessGrants.groupIds` contains **this group's id**. Unlike the server, the client does not treat "no groupIds" as "grants the owner group".
- Status line under the switch:
  - Ready and on: "Paywall enabled".
  - Ready and off: "This group is ready to have a paywall added".
  - Not ready (destructive colour): "To have a paywall to group access, the group needs to have a Stripe Connect account, have that account verified and then have at least ONE published offering that allows access to the group".
- The switch is disabled while saving, or when the paywall is off and the group is not ready. It can always be turned **off**.
- Toggling calls `updateGroupSettings(group.id, {paywall})`, i.e. the `updateGroupSettings` mutation ([11-group-settings.md](11-group-settings.md)). Failure alert: "Failed to update paywall setting: {{error}}".
- No server-side readiness check exists: the API accepts `paywall: true` at any time.

**2. "Create Offering" full-width outline button** (PlusCircle icon). Opens the form.

**3. Create form**, headed "Create New Offering" with an X (aria "Close"):

| Field | Control | Notes |
|---|---|---|
| Offering Name* | text | Placeholder "e.g., Premium Membership" |
| Description | Rich text `HyloEditor` (`type='offeringDescription'`, menu, extended menu), min-height 120px, dashed border | Placeholder "What does this offering include?". Sent as editor text. The server strips HTML, so the description is shown as plain text everywhere. |
| Price* | number, step 0.01, min 0, placeholder `20.00` | Hidden when sliding scale is on. Under it, a live fee breakdown: "Estimated Stripe fee (US cards)" = `amount×0.029+0.30`; "Hylo platform fee (7%)" = `amount×0.07`; "Estimated net to group" (bold); footnote "Estimates only. Stripe fees vary by country, payment method, and account settings." Amounts use 2 decimals plus the upper-case currency. |
| Currency | select USD / EUR / GBP / CAD | Values lower-case |
| Sliding scale | Switch, label "Sliding scale"; right hint "Users choose quantity in Stripe within this range" | Turning it on clears the price |
| Minimum quantity / Maximum quantity | number, digits only, placeholders `1` / `10` | Shown when sliding is on. Errors (thrown, then shown via alert): "Sliding scale minimum must be at least 1", "Sliding scale maximum must be at least 1", "Sliding scale maximum must be >= minimum" |
| Content Access | `LineItemsSelector` | See below |
| Duration | select | Options: "One-time purchase (lifetime access)" (`''`), "Monthly (recurring)" (`month`), "Every 3 months (recurring)" (`season`), "Annual (recurring)" (`annual`). Help: "Recurring billing interval. Monthly, seasonal, and annual options auto-renew each period. Leave empty for one-time payment with lifetime access." |
| Buy button text | text, hard-capped at 30 chars | Help: 'Optional custom label for the purchase button (e.g. "Join now", "Subscribe"). Leave blank for "Buy Now". Max {{max}} characters.' Placeholder "e.g., Join now" |
| Publish Status | select Unpublished / Unlisted / Published / Archived | Help "Control when and how this offering is visible". Default `unpublished`. |
| Buttons | "Discard" (outline), "Save" ("Creating..." while busy) | |

Submit behaviour:

- Validation: name required, and price required unless sliding is on. Failure alert: "Please fill in all required fields".
- `priceInCents = round(price×100)`. For sliding scale the price defaults to `'1'`, so the unit is 100 cents = 1.00 per unit. Negative or NaN → "Invalid price".
- `accessGrants` sent to the API: `{groupIds?, groupRoleIds?, buyButtonText?, slidingScale?: {enabled:true, minimum?, maximum?}}`. The server moves `buyButtonText` and `slidingScale` into `metadata`.
- Error alert: "Failed to create offering: {{error}}".

`LineItemsSelector` ("Content Access"):

- Help: "Select spaces, groups, and roles that this offering grants access to".
- Bordered row "Grant access to this group" with help "When enabled, purchasing this offering grants access to join this group" and a Switch. On adds the group id to `groupIds`.
- Chips list "Spaces:" and "Roles:" (role emoji + name), each with a remove X.
- Buttons "Add Space" and "Add Role" (outline, PlusCircle) open a Command palette:
  - Spaces: placeholder "Search spaces..."; lists **only child spaces with `paywall = true`** that are not yet selected; empty "No paid spaces found"; heading "Spaces".
  - Roles: placeholder "Search roles..."; lists the group's roles; empty "No roles found"; heading "Roles".
  - Search is debounced 300 ms. Selected items show "(Already selected)" and are disabled.
- Roles are validated server-side by `GroupRole.assertAssignableRoleIds`.

**4. Edit form**, headed "Edit Offering". The page scrolls smoothly to it when it opens.

- Same fields **except Price, Currency and Sliding scale, which cannot be edited from the UI** (the API supports price and currency).
- Buttons "Cancel" and "Update Offering" ("Updating...").
- Only changed fields are sent. `accessGrants` is compared after normalising (sorted ids plus buyButtonText).
- Error alerts: "Failed to update offering: {{error}}" and "Cannot update offering: missing offering ID".
- Unknown space ids in an existing offering show as "Space {{id}}".
- **Quirk:** whenever `accessGrants` is sent on update, the server rewrites `metadata` from it. The edit form never includes `slidingScale`, so **editing grants or the buy-button text silently removes sliding scale** from the offering. The Stripe price is then the original 100-cent unit, so the offering is sold for 1.00.

**5. "Offerings" list card**

- Filter "Offerings with:" with options "All", "Group access" (`groupIds` non-empty), "Role access".
- Checkbox "Show archived" (archived offerings are hidden by default).
- Empty state (CreditCard icon): "No offerings yet" / "Create your first offering to start accepting payments".
- `OfferingListItem`:
  - Name plus a status pill: Published = green, Unlisted = blue, Archived = grey, Unpublished = yellow.
  - Plain-text description.
  - Meta line, one of:
    - sliding scale: "Pay {{min}} - {{max}} {{currency}} (your choice)" or "Pay at least {{min}} {{currency}} (your choice)" (min = unit×minimum, default 1);
    - otherwise "Price: $X.XX CUR". The `$` sign is hard-coded for all currencies.
  - "Duration: …" (labels as above; `day` → "1 Day"; none → "Lifetime").
  - "Grants access to the group" (bold) if the group is in `groupIds`.
  - "Grants access to:" followed by "Spaces:" and "Roles:" chips.
  - Right-hand buttons:
    - Users icon with a chevron (title "View subscribed users"). Accordion: only one offering is expanded at a time.
    - "Link" / "Copied!" (2 s): copies `origin + /groups/<slug>/offerings/<id>`.
    - "Edit" / "Editing..." (disabled while that offering is being edited).
  - While being edited, the item gets a blue border and 75 % opacity.
- `SubscribersPanel` (when expanded):
  - Three stats: "Active Subscribers"; "Monthly Revenue" (`$` + cents/100, always `$`); "Lapsed" (muted).
  - Header "Active Members" / "Lapsed Members" with `(total)`, and a toggle button "Show Lapsed" / "Show Active".
  - Rows: avatar (or a Users placeholder), name, "Active" or "Lapsed", "Joined: <short date>", plus "Expired: <date>" on lapsed rows.
  - Empty states: "No active subscribers yet" / "No lapsed members".
  - Pagination at 50 per page: "Previous" / "Page X of Y" / "Next".
  - Error: "Error loading subscriber data: …".
  - **Quirk:** the "active" list is not filtered. `lapsedOnly=false` returns *all* rows for the offering, including lapsed ones.

### 4.4 Content Access tab (`ContentAccessTab`)
Two modes, toggled by header buttons "View Records" / "Grant Access". The title follows the mode: "Content Access Records" / "Grant Access". Subtitle:

- View mode: "View and manage all content access grants for your group".
- Grant mode: "Grant users access to group content, spaces, or offerings".

**View Records**

- Filters:
  - "Search by member name" (placeholder "Type member name..."; `ilike` on `users.name`).
  - "Access Type": All Types / Stripe Purchase / Admin Grant.
  - "Status": All Status / Active / Expired / Revoked / Refunded.
  - "Offering": All Offerings, or "No offerings available".
  - "Space": All Spaces plus child spaces.
  - "Role": All Roles plus roles labelled "name (Group)" or "(Common)".
- Page size 20, sorted by `created_at`; button "Load More". Count line: "Showing {{count}} of {{total}} records". Empty: "No content access records found".
- Record card:
  - Avatar, name.
  - Sub-line: offering name • "Group:" or "Space:" plus label • legacy track space name • role emoji and name.
  - Access-type badge: "Purchased" (accent) or "Admin Grant" (blue).
  - Status badge: "Cancelling" (orange, when `subscriptionCancelAtPeriodEnd`), "Active" green, "Expired" yellow, "Refunded" purple, "Revoked" red.
  - "Granted: <date>"; then either "Cancels: <periodEnd>" (orange) or "Expires: <date>".
  - "Granted by: <name>" for admin grants.
- Kebab menu (only when status is active):
  - "Revoke Access" (red, Ban icon) opens a dialog:
    - Title "Revoke Access".
    - Body "This will immediately revoke access for {{userName}}. Any active subscription will be cancelled, but no refund will be issued."
    - Buttons "Cancel" / "Revoke Access" ("Revoking...").
    - Sends `reason: 'Revoked by admin'`.
  - "Refund" (orange, RefreshCcw; purchases only) opens a dialog:
    - Title "Refund Purchase".
    - Body "This will revoke access for {{userName}}, cancel any active subscription, and issue a refund for the most recent payment. This action cannot be undone."
    - Buttons "Cancel" / "Refund" ("Processing...").
    - Sends `reason: 'Refunded by admin'`.

**Grant Access**

- Intro "Select a user and choose what access to grant them."
- "Select User": searchable picker over group members (paged); placeholder "Search for a user..."; empty "No users found".
- Checkbox "Or, grant access to all current group members".
- "Access Type" radio-style choices: "Offering", "Group Access", "Space".
  - Offering → "Select Offering" with placeholder option "Choose an offering...".
  - Group Access → note: "Granting group access will add the selected user as a member of this group." or, for all members, "Granting group access to all members will ensure each member has an active access record for this group."
  - Space → "Select Space": "Choose a space...", options "name (Paid)" for paywalled spaces; empty "No spaces found in this group".
- Buttons "Cancel" / "Grant Access" or "Grant Access to All Members" ("Granting...").
- Validation errors: "Please select an access type" / "Please select a user and an access type". Failure: "Failed to grant access".
- Payload: `{userId|null, grantedByGroupId: group.id, groupId: group.id | spaceId | null, productId: offeringId|null, reason: 'Admin grant via settings' | 'Admin grant to all group members via settings', grantToAllMembers}`. The UI offers **no expiry date and no role grant**; the API supports both.
- **Quirk:** an "Offering" grant creates one row with `product_id` set and no `group_id`. It does **not** expand the offering's `access_grants`: no space scopes, no roles. Its scope is `group:<grantingGroup>`, and no membership is created.

### 4.5 Paywall purchase prompt (group About / join; space join page)
`PaywallOfferingsSection({group, sellingGroup})` renders inside `JoinSection` whenever `group.paywall` is true (it replaces the normal join buttons), and on `SpaceJoinPage` for paid spaces.

- Offerings come from `publicStripeOfferings(groupId = sellingGroup.id || (space ? parentId : group.id))`, then filtered client-side to those whose `groupIds` contain the target group or space id.
- States:

  | State | Shown | Copy |
  |---|---|---|
  | Loading | dashed box | "Loading payment options..." |
  | No offerings | DollarSign icon | Title "This group requires payment to join" / "This space requires payment to join"; body "No payment options are currently available. Please contact the group administrators." / "…the space administrators." |
  | Offerings available | DollarSign heading, then cards | Heading "This group requires a fee to join" / "This space requires a fee to join". Lapsed member (has membership but `canAccess === false`) sees italic "Either your membership has lapsed or the group stewards have added a paywall to the group." / "…space stewards…space." Then "Choose a payment option below to gain access to this group:" / "…this space:". |

- Offering card (`data-testid="paywall-offering-card"`, `data-offering-id`):
  - Name, plain description.
  - Price line (sliding-scale text or "Price: $X.XX CUR"); "Duration: …" / "Lifetime".
  - "Grants access to the group" / "…the space"; legacy "Tracks:" chips (space banner thumbnail + name); "Roles:" chips.
  - Full-width secondary button:
    - signed in: CreditCard + (`buyButtonText` || "Purchase Access"), "Processing..." while busy;
    - signed out: LogIn + "Sign up to Purchase". This saves the return path and navigates to `/login?returnToUrl=<current>`.
- Join barriers: if the group has join questions or agreements (`JoinBarriers` from module [10-joining-invitations.md](10-joining-invitations.md)), the first click expands them above the cards. Buttons stay disabled until the barriers are satisfied; the next click goes to checkout.
- Checkout URLs:
  - Success: `<host>/groups/<sellingSlug>/payment/success`, plus `?spaceSlug=<localSpaceSlug>` for spaces.
  - Cancel: for spaces `<host>/groups/<sellingSlug>/spaces/<localSpaceSlug>`, else `<host>/groups/<sellingSlug>/payment/cancel`.
  - Metadata `{offeringId, groupId, groupSlug, spaceSlug?}`.
  - Failure alert: "Failed to start payment process: {{error}}". Missing ids: "Unable to process payment. Please contact support."
- In sandbox/demo mode the helper throws "Not available in the demo".

Lapsed paying members: `AuthLayoutRouter` redirects a member of a paywalled group whose `canAccess === false` to the group home view (`/groups/<slug><homeRoute||/all>`) from any other path except `/offerings/…`. On mobile widths it also closes the nav. The stream view then shows the paywall prompt.

### 4.6 Offering details page (`/groups/:slug/offerings/:id`)
- Full-height scroll page.
- Header: group banner (or the default banner) with a 50 % black overlay, the group avatar (96px, rounded-xl) and the group name in white bold 2xl.
- Card (`bg-midground`):
  - H1 offering name (4xl bold); plain description (lg).
  - Price: sliding text (2xl bold) or "$X.XX" plus currency.
  - "Duration: …" / "Lifetime".
  - Access section: "Grants access to the group", "Grants access to:" with "Tracks:" (legacy; banner thumbnail, space name, 1-line description) and "Roles:".
  - Primary large button (`data-testid="offering-purchase-button"`): `buyButtonText` || "Buy Now", or "Sign up to Purchase" when signed out.
  - Footnote: "You'll have the option to add a contribution to Hylo during checkout".
- Success URL `<origin>/groups/<slug>/payment/success`; cancel URL = the offering page.
- Errors:
  - "Invalid offering ID", "Offering not found", "Failed to load offering" — shown in a centred block with title "Error".
  - Null offering: title "Offering Not Found", "The offering you are looking for does not exist."
- **No publish-status, paused-sales or already-purchased checks** happen before checkout. A paused group fails at session creation with "This group cannot accept payments right now. Please contact the group stewards."

### 4.7 Stripe Checkout (hosted) — what the buyer sees
- The offering line, quantity 1, or an adjustable quantity between min and max for sliding scale.
- Optional add-on "Choose Your Hylo Contribution" at $1 per unit, preset quantity **5**, adjustable 0–100. Copy is localised to the **majority locale of the group's administrators** (ties prefer `en`, then alphabetical).
- Mode `payment` or `subscription`.

### 4.8 Payment success / cancel pages
- **Success**:
  - While fulfilling: spinner, "Payment Successful!", "Granting access...".
  - The page calls `fulfillStripeCheckoutSession(session_id, offering_id)` and then refetches the current user. Errors are swallowed.
  - Then: green CheckCircle, "Payment Successful!", "Thank you for your purchase. Your access to this group has been granted." (or "…to this space…" when `spaceSlug` is present), "Session ID: cs_…".
  - Button "Return to Group" / "Go to Space" ("Redirecting..."), and "You will be redirected automatically in a few seconds...". Auto-navigates after **5000 ms** to the space or group URL.
- **Cancel / failure**: red XCircle, "Payment Cancelled", "Your payment was cancelled. No charges were made to your account.", "If you experienced any issues during checkout, please try again or contact support for assistance." Buttons "Try Again" (secondary, ArrowLeft) and "Return to Group" (outline). Both go to the group URL.

### 4.9 Retained access (left a paid group but still holds a valid scope)
`isRetainedAccessGroup(group)` is true when all of these hold:

- `paywall` is true;
- `hasValidScope` is true;
- `currentUserMembershipActive === false`;
- the group is active;
- the status is not draft or archived.

Behaviour:

- Non-members visiting such a group's routes are redirected to `/groups/<slug>/about`.
- `RetainedAccessPanel`:
  - "You still have access to {{name}}".
  - "You are not currently a member of {{name}}, but your access is still valid. Rejoin to participate again."
  - Button "Rejoin {{name}}" ("Rejoining..."), calling `rejoinGroup(groupId)`.
  - For a space whose parent membership is inactive: "To rejoin this space, you need to be a member of its parent group first." with link "Go to {{name}} about page".
  - Error: "Your access may have expired. Refresh this page to check your options."
- Backend `group` query: `findGroupWithRetainedPaidAccess` returns hidden or protected paywalled groups to such former members.
- `rejoinGroup` rules:
  - The group must not be draft or archived, and must have the paywall ("This group does not have retained paid access").
  - A prior inactive membership is required ("No previous membership found").
  - For a space, the parent membership must be active ("You must rejoin the parent group first").
  - A valid `group:<id>` scope is required, checked with a FOR UPDATE lock ("You no longer have access to this group").
  - Re-adding the member restores prior settings with `showJoinForm: false, leftSpace: false`.

### 4.10 My Transactions (`/my/transactions`)
- Header title "My Transactions". Intro "Manage your purchases and subscriptions below."
- Filters card titled "Filters":
  - "Status": All Status / Active / Expired / Revoked / Refunded.
  - "Payment Type": All Types / Subscription / One-time purchase.
  - "Offering": All Offerings plus offerings seen so far.
  - Changing a filter resets the offset.
- Count line "Showing {{count}} of {{total}} transactions"; "Loading..."; "Load More".
- Empty states: "No transactions yet" / "Your purchases and subscriptions will appear here." Filtered: "No transactions found" / "Try adjusting your filters to see more results."
- Error: "Error loading transactions".
- Transaction card:
  - Title: offering name, or "Unnamed Offering".
  - Status chip: "Cancelling" if cancel-at-period-end, else "Active" (green), "Expired" (grey), otherwise "Revoked" (red). `refunded` also shows "Revoked".
  - Pending plan change box (subscriptions only), titled "Upcoming plan change", body from the `transactions.pendingChange.*` strings:
    - `scheduled_period_end`: "You will move to {{offeringName}} on {{date}}. Until then, nothing changes: you keep this plan and your access." (no-date variant: "…at the end of your current billing period. Until then, you keep this plan and your access.")
    - `lifetime_no_proration`: "This subscription is set to end on {{date}}. If you chose a lifetime option, complete checkout for that offering so access continues." (and a no-date variant)
    - generic: "A plan change is pending. Next plan: {{offeringName}}."
  - Key/value grid:
    - "Group:" (link `/groups/<slug>`)
    - "Track:" (legacy)
    - "Access Type:" Group / Track / Role
    - "Payment Type:" Subscription / One-time purchase
    - "Billing period:" Daily / Monthly / Every 3 months / Yearly / One-time
    - "Amount:" (Intl `en-US` currency format) with a cadence suffix "per day" / "per month" / "per 3 months" / "per year"
    - "Purchased:"
    - subscriptions: "Cancels:" (if cancelling), else "Renews:" (when Stripe status is `active`) or "Status:" with the Stripe status
    - one-time: "Expires:" (if set)
  - Actions:
    - "Manage in Stripe" (subscription → `manageUrl`, a fresh Billing Portal session) or "View in Stripe" (one-time → `receiptUrl`).
    - "Change subscription", shown when payment type is subscription, status is `active`, and the group and offering exist.

### 4.11 Change subscription modal (`ChangeSubscriptionModal`)
- Title "Change subscription"; subtitle "Choose a new plan for this membership. Changes follow your group billing rules."
- Loads `membershipChangeEligibleOfferings(groupId)`:
  - published offerings only;
  - `renewal_policy = automatic`;
  - duration `month`, `season` or `annual`;
  - granting group access.

  Empty: "No eligible offerings are available for this group right now."
- Shows "Current plan" (name, or "Current subscription") and a "New plan" select (placeholder "Choose an offering...").
  - Option label: name — price/cadence, or "— Sliding scale (min–max)".
  - The current plan is highlighted with an emerald left border and a "Current" chip.
  - Options in a different currency are disabled with a "Not available" chip, plus the notice: "Plans with a different currency are shown but disabled. Choose a plan in the same currency as your current subscription."
- "Quantity" input for a sliding-scale target, clamped to the minimum.
- Selected plan details: "Price:", "Duration:", "Currency:". Access summary: "N Group access", "N Track access", "N Role access".
- Preview: calls `membershipChangePreview`; while loading, "Updating preview...". Mode explanation copy:

  | Mode | Copy key | Text |
  |---|---|---|
  | `immediate_upgrade` | `subscriptionChange.immediateProrate.body` | "We'll update your subscription now. Your billing cycle resets to today at the new plan's price. You get a credit on this charge for the unused part of your current period (based on what you paid for that period)." |
  | `scheduled_period_end` | `scheduledPeriodEnd.body` | "This change will take effect at the end of your current billing period. You keep your current plan and access until then." |
  | `currency_mismatch_blocked` | `currencyMismatch.blocked` | "Your current plan uses {{currentCurrency}} and this plan uses {{targetCurrency}}. Switching between different currencies isn't supported right now." |
  | `sliding_scale_next_cycle` | `slidingScale.nextCycle` | "New quantity applies on your next billing date. There's no charge or proration today." |
  | `past_due_no_proration` | `pastDue.body` | "Your subscription is past due. Changing plans won't use proration: your new plan starts from today once payment succeeds." |
  | `lifetime_no_proration` | `lifetime.body` | "Switching to this one-time purchase does not refund or shorten your current subscription. You'll keep the access from your current plan until that subscription ends, then your new purchase applies." |

- For `immediate_upgrade` it also loads `membershipChangeInvoicePreview`, shown under the heading "Invoice preview":
  - Line items, with "(Proration)" tags.
  - "Estimated due now: <amount>".
  - Explainer: "Estimated total is the sum of the lines above. The credit line is unused prepaid time from your current plan. The subscription line is the new plan for the billing period starting today. Amounts are finalized when you confirm; tax or account settings can change the exact total."
  - On failure: "Couldn't load the Stripe invoice preview. Estimated line items may be missing; charges are finalized when you confirm."
- Footer notice (`groupAccessOverlapNotice`): "If you buy another subscription that also grants group access elsewhere, the extra group-access portion doesn't stack. You still keep any other included benefits (like tracks or roles)."
- Buttons "Cancel" / "Confirm plan change" ("Loading..." while committing).
- On success the modal closes. Non-deferred modes apply an optimistic update to the transaction (offering name, duration, `amountPaid = unit×qty`). Failure: "Could not update subscription".
- Lifetime targets never appear in the eligible list, so `lifetime_no_proration` is reachable only through the API.

### 4.12 Platform admin: Stripe Disputes & Refunds (`/management/paid-content/stripe-analytics`)
English-only, hard-coded strings.

- Title "Stripe Disputes & Refunds".
- Intro: "Stripe flags accounts at 0.75% (early warning) and 1.0% (critical risk). Groups above either threshold may have received an alert email. Dispute rates are calculated over the last 90 days."
- Stat tiles: "Total disputes (90d)", "Open disputes" (yellow if > 0), "Total refunds (90d)", "Total charges (90d)".
- Table columns: Group (link plus `acct_` link to the Stripe dashboard), Charges (90d), Disputes (90d), Dispute rate (coloured), Disputes (7d) (red if ≥ 20), Open, Refunds (90d), Last alert ("date — type" with the threshold as a tooltip, or "None"), Sales control.
- Sales control button: "Pause sales" / "Resume sales" ("Saving..."). Pausing prompts: "Reason for pausing Stripe sales for this group (required for audit log):". A paused row shows "Paused: <reason>".
- Empty: "No groups with Stripe Connect accounts found." Error: "Error loading analytics: …".
- Rows are sorted by dispute rate descending, then open disputes.

## 5. Business rules & side effects

### 5.1 Access checks (paywall enforcement)
- `Group.canAccess(userId)`:
  - `true` if `!paywall`.
  - `false` if there is no user.
  - `true` if the user has `Administration` or `Manage Content` in the group (`hasFullAccessResponsibility`).
  - Otherwise `true` only if there is an unexpired `group:<groupId>` scope in `user_scopes`.
- `Track.canAccess` (legacy, `access_controlled`): the same pattern with `track:<id>`. Every track was set to `access_controlled=false` in the paid-spaces migration.
- `GroupRole.canAccess`: checks the `group_role:<groupId>:<roleId>` scope.
- REST policy `checkAndSetMembership` (used by `/noo/...` group routes): it requires a membership **and** `group.canAccess`; otherwise `403`.
- GraphQL `Group.canAccess` is exposed. The web uses it to redirect lapsed members (§4.5).
- Joining a paid space (`joinSpace`, see [15-views-streams-spaces.md](15-views-streams-spaces.md)): blocked with "This space requires purchased access to join" unless the user administers the parent group. Purchased access creates the membership directly instead.
- Setting a space to `paywall=true` (create or update) forces `visibility=PROTECTED (1)`, `accessibility=RESTRICTED (1)`, `required_roles=null`.
- Space menu visibility (web `shouldShowSpaceInMenu`): a paywalled space is shown to non-managers only if a **published** offering of the parent lists the space in `groupIds`. Draft and archived spaces are shown only to managers.
- `InvitationService` and the `joinGroup` mutation carry `TODO STRIPE` comments. Invite links and joinGroup **do not check the paywall** at the API level: a user can become a member through an invite, but `canAccess` stays false, so content is still gated.

### 5.2 Connect onboarding
1. `createStripeConnectedAccount(groupId, email, businessName, country)`:
   - Requires Administration.
   - Errors "This group already has a Stripe account connected" if `groups.stripe_account_id` points at an existing `stripe_accounts` row. A dangling FK lets it proceed.
   - Defaults: `email ← "<groupName>@hylo.com"`, `country ← US`, `businessName ← group name`.
   - Creates the account, finds or creates the `stripe_accounts` row, and sets `groups.stripe_account_id`.
   - Queues `Email.sendNewStripeConnectedAccountAdminNotification` to `PAYMENTS_NOTIFICATION_EMAIL`: plain text, subject `New Stripe Account: <group>`, with group name, slug, id, URL, `acct_` id and the actor's name, email and profile URL.
   - Returns `{id: groupId, accountId: acct_…, success, message:'Connected account created successfully'}`.
2. `createStripeAccountLink` (Administration) → `{url, expiresAt, success}`.
3. `checkStripeStatus(groupId)` (Administration) retrieves the account and patches the three cached flags. Returns `{success, message:'Stripe status updated successfully', chargesEnabled, payoutsEnabled, detailsSubmitted}`.
4. Webhook `account.updated`:
   - Uses `metadata.group_id` to find the group.
   - Finds or creates the `stripe_accounts` row.
   - Saves `stripe_account_id` and the three flags.
5. E2E seeds use fake ids `acct_e2e_*`. `getAccountStatus` short-circuits them to fully enabled.

### 5.3 Checkout session creation (`createStripeCheckoutSession`)
1. Preconditions, each failing with the quoted message:
   - The user is logged in ("You must be logged in to purchase an offering"; deliberately mandatory).
   - The offering exists ("Offering not found").
   - The offering belongs to `groupId` ("Offering does not belong to the specified group").
   - The group exists ("Group not found").
   - The group has a Stripe account ("Group does not have a Stripe account configured").
   - Sales are not paused ("This group cannot accept payments right now. Please contact the group stewards.").
   - The offering has a price id ("Offering does not have a Stripe price ID").
2. Sliding scale: taken from `metadata.slidingScale`, falling back to legacy `access_grants.slidingScale` / `sliding_scale`. It applies only when `enabled`. An explicit `adjustableQuantity` argument overrides it.
   - Effective minimum defaults to 1; maximum defaults to 999999.
   - The price becomes the shared **unit price** (100 minor units of the offering currency). It is recurring in subscription mode; a non-recurring duration in subscription mode errors "Sliding scale subscriptions require a recurring duration (month, season, annual, or day)".
   - **Note:** the offering's own `price_in_cents` is ignored at checkout. The amount is always quantity × 1.00. The UI's displayed "Pay min–max" uses `price_in_cents` as the unit, which is 100 when created through the UI.
3. Mode: `subscription` if `renewal_policy='automatic'`, else `payment`.
4. Fee: `applicationFeeAmount = round(unit_amount × initialQuantity × 0.07)`, where initialQuantity = sliding min ?? quantity ?? 1. It is used only in payment mode (`payment_intent_data.application_fee_amount`).
   - For sliding scale the fee is computed on the **minimum** quantity, so buyers who choose more pay a lower effective fee rate.
   - Subscriptions use `subscription_data.application_fee_percent: 7.0`.
5. Line items: `[{price, quantity, adjustable_quantity?}]`. `optional_items` holds the contribution price (qty 5, adjustable 0–100). If contribution setup fails, checkout continues without it.
6. `success_url = successUrl + (?|&)session_id={CHECKOUT_SESSION_ID}&offering_id=<id>`, keeping existing params.
7. Metadata (§2.2). **Quirk:** caller `metadata` is spread *after* `userId`, `groupId` and `offeringId`, so a client-supplied `userId` overrides the buyer. The webhook would then grant access to that user; the success-page fallback rejects it as "does not belong to you".
8. Returns `{sessionId, url, success}`.

### 5.4 Fulfilment (grant on payment)
There are two paths, both calling `grantCheckoutSessionAccess(session)`. The function is idempotent per session id.

- **Webhook** `checkout.session.completed`: proceeds only if `payment_status ∈ {paid, no_payment_required}`.
- **Success-page fallback** `fulfillStripeCheckoutSession(sessionId, offeringId)`:
  - It loads the offering (offeringId is required in practice; otherwise "Offering not found") and re-retrieves the session from Stripe.
  - It requires the metadata keys `userId`, `offeringId` and `groupId` ("Checkout session is missing grant metadata").
  - It requires `metadata.userId == caller` ("This checkout session does not belong to you").
  - It requires a paid session ("Payment is not complete yet").
  - Messages: "Access granted" / "Access already granted". Failure: `Could not grant access: <reason>`.

`grantCheckoutSessionAccess`:

1. Requires the metadata `userId`, `groupId` and `offeringId` (reason `missing_metadata`). The offering must exist (`offering_not_found`) and `offering.group_id` must equal `groupId` (`group_mismatch`).
2. For each group in {selling group} ∪ `access_grants.groupIds`, it runs `GroupMembership.ensureMembership(user, group)` and then `membership.acceptAgreements()` (buying implies accepting the agreements). It pins the group to the global nav unless it is a space. Errors per group are logged and ignored.
3. If `content_access` rows already exist for `session.id`, it returns `already: true`.
4. Otherwise it calls `offering.generateContentAccessRecords({userId, sessionId, stripeSubscriptionId: session.subscription, stripeCustomerId: session.customer, metadata:{paymentAmount, currency, purchasedAt}})`:
   - **Empty `access_grants`** → one row `{granted_by_group_id = group_id = NULL…}`, i.e. `group_id` null, which scopes to `group:<sellingGroup>`.
   - For each `groupIds[i]` → a row with `group_id = i` and `metadata.accessType = 'group'`. This produces scope `group:<i>`.
   - For each `groupRoleIds[r]` × each target group (the `groupIds`, or the selling group when `groupIds` is empty):
     - creates a `MemberGroupRole {user, group, role, active:true}` if it does not exist;
     - creates a row with `group_id` and `group_role_id`, producing scope `group_role:<g>:<r>`.
   - **Quirk:** an offering with only `groupRoleIds` (no groupIds) gives the role but **no `group:<selling>` scope**. On a paywalled group the buyer is a member without access.
   - **Quirk:** role assignments made at purchase are never removed when access expires, is revoked or is refunded. Only the role *scope* goes away.
   - `expires_at` = duration-based (`calculateExpirationDate`: day +1d, month +30d, season +90d, annual +365d; lifetime/none = null). For subscriptions this is replaced by Stripe period ends at renewal.
5. Webhook side effects after granting (all errors swallowed):
   - **Platform contribution transfer**:
     - The webhook re-retrieves the session with `line_items`.
     - It sums the line items whose product name matches (case-insensitive) one of: "hylo platform donation", "donation to hylo", "hylo platform contribution", "contribution to hylo", "recurring donation to hylo", "recurring contribution to hylo".
     - If the sum is > 0 and `session.payment_intent` exists, it creates a Transfer of that amount with `source_transaction = charge`.
     - **Quirk:** the current product name "Choose Your Hylo Contribution" matches **none** of these patterns, so contributions are not transferred to the platform.
     - In subscription mode `session.payment_intent` is null, so no transfer happens there either.
   - **Purchase email** (`Queue.classMethod('Email', …)`, version `Redesign 2025`, user locale):
     - Legacy track offering (`offering.track_id`) → `sendTrackAccessPurchased` with `user_name`, `track_name`, `track_description`, `track_url`, `track_image_url`, `group_name`, `group_url`, `offering_name`, `price_formatted`, `purchase_date`, `is_enrolled`, `start_learning_url`, `group_avatar_url`.
     - Otherwise `sendPurchaseConfirmation` with:
       - `user_name`, `offering_name`, `offering_description`, `price_formatted` (session `amount_total`, formatted en-US), `currency`, `purchase_date`;
       - `access_type` (`group`, `track`, or `bundle` when more than one groupId);
       - `group_name`, `group_url`, `is_subscription`, `group_avatar_url`;
       - subscriptions: `renewal_date`, `renewal_period` (`monthly`, `N-month`, `annual`, `N-year`, `weekly` or the raw interval) and `manage_subscription_url`;
       - one-time with a non-lifetime duration: `expires_at` (calendar-month math, which differs from the 30-day DB expiry);
       - `stripe_receipt_url` (invoice hosted URL or PDF), when available.
   - `TODO STRIPE: Send notification to group admins` — no steward notification on purchase.

### 5.5 Subscription lifecycle (webhooks)
| Event | Effect |
|---|---|
| `customer.subscription.created` | If rows already exist for the subscription, no-op. Otherwise this is the rescue path. Metadata comes from the subscription, falling back to `checkout.sessions.list({subscription})`. Needs `offeringId` and `userId`. If the offering's `access_grants` is empty, it is "voluntary" and nothing happens. Otherwise it ensures memberships (selling group, groupIds, role groups), accepts agreements, pins non-space groups, and generates rows with `sessionId = sessionId || subscription.id` and metadata `{created_via_webhook, subscription_period_start, subscription_period_end}`. |
| `customer.subscription.updated` | First applies plan-change sync (§5.6). Then, if `cancel_at_period_end` or `cancel_at` is set, it writes cancellation metadata on all rows of the subscription: `subscription_cancellation_scheduled_at=now`, `subscription_cancel_at_period_end=true`, `subscription_period_end = cancel_at || current_period_end`, `subscription_cancel_reason = cancellation_details.reason || 'User requested cancellation'`. Status stays active. Else, if `status === 'active'` and the rows had cancellation metadata, it removes those keys (reactivation). |
| `customer.subscription.deleted` | Marks pending `lifetime_no_proration` change events as applied. Sets every row of the subscription to `expired` (skipping `refunded` and `revoked`), with metadata `subscription_canceled_at` and `subscription_cancel_reason` (default 'Subscription ended'). Emails the buyer `sendSubscriptionCancelled` {`user_name`, `offering_name`, `group_name`, `group_url`, `cancelled_at`, `access_ends_at` (period end if later than canceled_at, else now), `resubscribe_url`, `group_avatar_url`, `reason?`}. Emails **each Administration holder** `sendSubscriptionCancelledAdminNotification` {`admin_name`, `user_name`, `user_email`, `user_profile_url`, `offering_name`, `group_name`, `group_url`, `cancelled_at`, `access_ends_at`, `cancellation_type` (`at_period_end`/`immediate`), `subscription_amount`, `subscription_period` (`daily`/`monthly`/`quarterly`/`annual`), `revenue_lost`, `view_content_access_url` = `<FRONTEND_URL>/groups/<slug>/settings/paid-content/access` (**wrong path**: the real sub-route is `content-access`), `contact_user_url` = `<profile>/message`, `group_avatar_url`, `reason?`}. |
| `invoice.paid` | Ignored when there is no `invoice.subscription`, or when `billing_reason === 'subscription_create'`. If the offering's `renewal_policy='manual'`, it sets `cancel_at_period_end=true` on the subscription and stops (no extension). Otherwise it resolves the period end (subscription `current_period_end`, then invoice line periods, then invoice `period_end`, re-fetching the invoice with lines if needed). If none is found, it skips. Then `extendAccess` runs on every row: `expires_at=periodEnd`, `status=active`, metadata `renewed_at`, `invoice_id`, `billing_reason`, `subscription_period_start`, `subscription_period_end`, `last_renewed_at`. Emails `sendSubscriptionRenewed` {`user_name`, `offering_name`, `group_name`, `group_url`, `amount_paid`, `payment_date`, `next_renewal_date`, `manage_subscription_url`, `group_avatar_url`, `stripe_receipt_url?`}. Runs the contribution transfer for renewal invoices (same name-matching caveat). |
| `invoice.payment_failed` | Adds `last_payment_failure` and `last_payment_failure_invoice` to every row (access is **not** revoked; Stripe retries). Emails `sendPaymentFailed` {`user_name`, `offering_name`, `group_name`, `group_url`, `failure_reason` (invoice `last_payment_error.message`, or the PI's, or 'Payment could not be processed'), `manage_subscription_url`, `update_payment_url`, `group_avatar_url`, `retry_date?` (next_payment_attempt), `access_ends_date?` (current_period_end)}. |
| `product.updated` | Finds the offering by `stripe_product_id` and syncs `name`, `description`, `price_in_cents`, `currency` and `stripe_price_id` from the expanded default price. **Bug:** `stripe_price_id` is compared to and assigned the *expanded price object*, so it always "differs". Bookshelf would then try to save an object into a varchar column. |
| `charge.refunded` | Gets `payment_intent.metadata.session_id`, then calls `ContentAccess.findBySessionId(sessionId)`. **That method does not exist** (the model has `forStripeSession`), so this handler throws and the webhook answers `400 {error:'Webhook processing failed'}`. Stripe keeps retrying. The intended behaviour: skip refunded or revoked rows; `revoke` (which cancels the subscription); set status `refunded` with metadata `refunded_at`, `refund_amount`, `refund_reason`, `refund_charge_id`, `refund_source='stripe_webhook'`; insert a `stripe_logs` refund row. Subscription invoices lack `session_id` on the PI, so even when fixed they would be skipped. |
| `charge.dispute.created` | Find the group by `event.account`, upsert a `stripe_logs` dispute row, then `checkAndSendDisputeAlerts`. |
| `charge.dispute.updated` / `.closed` | Update the dispute row's status, reason, amount, currency and charge. |
| other | Ignored (still recorded as processed) |

Webhook pipeline:

1. Verify the signature with `STRIPE_WEBHOOK_SECRET` and the `stripe-signature` header. On failure: 400 "Missing signature" / "Invalid signature", or 500 "Webhook secret not configured".
   - `STRIPE_WEBHOOK_BYPASS_SIGNATURE=true` parses the raw JSON instead (dev and tests). Tests may inject `global.__stripeWebhookConstructEvent`.
2. If `event.account` is set and unknown → `200 {received:true, skipped:'unknown_connect_account'}`.
3. If already processed → `200 {received:true, duplicate:true}`.
4. Dispatch the handler. On success, insert the event id into `stripe_webhook_processed_events` and return `{received:true}`. Any thrown error → `400 {error:'Webhook processing failed', message}`; the event is not marked processed, so Stripe retries.

### 5.6 Membership plan change (subscription change v1)
`resolveSubscriptionChangeMode(input)` checks these rules in order:

1. `isPastDue` → `past_due_no_proration` (`subscription_past_due`)
2. `isSlidingScaleQuantityOnly` → `sliding_scale_next_cycle`
3. target is lifetime or one-time (not automatic + `day|month|season|annual`) → `lifetime_no_proration`
4. currencies differ → `currency_mismatch_blocked` (meta `{currentCurrency,targetCurrency}`)
5. either duration is `day` → `scheduled_period_end` (`day_duration_test_only_no_immediate_proration`)
6. unknown or non-recurring months → `scheduled_period_end` (`unknown_or_non_recurring_duration`)
7. target months > current months (month=1, season=3, annual=12) → `immediate_upgrade` (`longer_billing_period`)
8. same period and target price > current price → `immediate_upgrade` (`same_period_higher_price`), otherwise `scheduled_period_end` (`same_period_same_or_lower_price`)
9. otherwise → `scheduled_period_end` (`shorter_period_or_other`)

`membershipChangeCommit(groupId, fromOfferingId, toOfferingId, newQuantity?)`:

- **Preconditions** (each fails with the quoted error):
  - The user is an active member of the group.
  - Both offerings belong to the group.
  - The target grants group access. Server rule: `groupIds` contains the group, or `groupIds` is empty and the owner is the group.
  - The target is lifetime/one-time or recurring (month/season/annual).
  - A sliding-scale target requires `newQuantity` ("This plan uses sliding scale. Please choose a quantity before confirming."). The quantity must be ≥ 1 and within min/max ("Quantity must be at least N" / "Quantity cannot exceed N").
  - The same offering is allowed only as a sliding-scale quantity change.
  - The source grants group access.
  - An active `content_access` row for (user, fromOffering, group_id or granted_by_group_id = group) with a subscription id must exist ("No active subscription found for this membership offering"). More than one distinct subscription → "Multiple active subscriptions found for this membership; contact support."
- **Stripe status:** the subscription is fetched; `isPastDue = status === 'past_due'`.
- **Blocked:** `currency_mismatch_blocked` throws "Cannot switch between plans with different currencies. Choose a plan in the same currency."
- **Event record:** inserts a `subscription_change_events` row (`pending`) with a uuid correlation id.
- **Per-mode Stripe calls:**
  - `sliding_scale_next_cycle`: update the subscription item quantity with `proration_behavior:'none'` and metadata `hylo_correlation_id`.
  - `immediate_upgrade` and `past_due_no_proration`:
    - Compute the period price (item unit × qty; else the Stripe Price; else the offering list price).
    - **Hylo credit** = `round(periodPrice × (periodEnd − now) / (periodEnd − periodStart))`, clamped to 0..periodPrice.
    - If the credit is > 0, add a customer balance credit (negative balance transaction) on the connected account.
    - Update the subscription item to the new price (and quantity for sliding scale), with `proration_behavior:'none'`, `billing_cycle_anchor:'now'`, and metadata `hylo_correlation_id`, `hylo_swap_credit_cents`, `hylo_swap_anchor`.
    - Status `applied`. Message "Subscription updated".
    - (The credit is also applied in the past-due case.)
  - `scheduled_period_end`:
    - Create a subscription schedule from the subscription.
    - Update the schedule to two phases: the current price until period end, then the new price. `proration_behavior none`.
    - Copy the metadata onto the subscription.
    - The event stays `pending` with `pending_effective_at = current_period_end` and `payload.scheduled = true`.
    - Message "Subscription change scheduled for period end".
  - `lifetime_no_proration`:
    - Set `cancel_at_period_end`.
    - The event stays `pending` with `requiresLifetimeCheckout`.
    - Message "Current subscription will end at period boundary. Complete checkout for the lifetime offering separately."
    - The user must buy the lifetime offering separately.
- **Failure:** any Stripe error sets the event `failed` with `error_message`, and the message is rethrown.
- **Webhook reconciliation (`customer.subscription.updated`):**
  - Scheduled events: when the subscription's primary price equals `payload.targetStripePriceId`, the active rows for (subscription, from_product) get `product_id := to_product_id`. The event is set `applied`, with `syncedContentAccess*` and `appliedFromWebhook*` added to the payload.
  - Immediate modes: the same `product_id` sync, keyed by the correlation id and price match.
  - `customer.subscription.deleted` marks lifetime events `applied`.
  - **Note:** `expires_at` is **not** recalculated at change time. It follows the next `invoice.paid`. An immediate upgrade creates a `subscription_update` invoice, and `invoice.paid` extends access to the new period end.

Previews (no side effects):

- `membershipChangePreview` evaluates the rules from DB values only. The client may pass `isPastDue` and `isSlidingScaleQuantityOnly`.
- `membershipChangeInvoicePreview`:
  - Returns null pricing for non-immediate modes.
  - Otherwise computes the credit and calls `invoices.createPreview` with `proration_behavior none`, `billing_cycle_anchor now`, and the new price, plus the credit as a negative `invoice_items` line ("Unused prepaid time (prior membership offering)").
  - If Stripe rejects negative lines, it previews without them and appends a manual credit line, `amountDue = max(0, due − credit)`.
  - Returns `{mode, reason, amountDue, currency, subtotal, total, nextPaymentAttempt, lines[{description, amount, currency, proration}], hyloPrepaidCreditCents}`.

### 5.7 Revoke & refund (stewards)
- **`revokeContentAccess(accessId, reason)`**:
  - Requires Administration in `granted_by_group_id`.
  - If the row has a subscription, it is cancelled **immediately** on the connected account (failure is logged and ignored).
  - Then `status=revoked`, metadata `revokedAt`, `revokedBy`, `revokeReason`, `subscriptionCancelled`.
  - Returns the `ContentAccess`.
  - Membership is **not** removed. The user stays a member without `canAccess`.
- **`refundContentAccess(accessId, reason)`**:
  - Requires Administration.
  - The row must be `stripe_purchase` ("Only Stripe purchases can be refunded. Admin grants should be revoked instead."). The group must have Stripe ("No Stripe account found for the granting group").
  - **Finding the payment, subscription rows**: `StripeService.refund({subscriptionId})` tries five strategies in order:
    1. paid invoices' PI or charge;
    2. `latest_invoice` PI or charge;
    3. any invoice;
    4. the customer's first paid, unrefunded charge;
    5. the customer's first succeeded PI.

    If all fail and a session id exists, it falls back to the session invoice ("This subscription had a $0 invoice - no payment was made, so there is nothing to refund." for $0), then the session PI.
  - **Finding the payment, one-time rows**: the session's `payment_intent`.
  - No payment found → "Unable to issue refund: no payment found for this access record".
  - It refunds the **full amount of one payment** (the most recent) with `reason:'requested_by_customer'`.
  - Before cancelling, it saves `status=refunded` with metadata `refundId`, `refundAmount`, `refundedAt`, `refundedBy`, `revokedAt`, `revokedBy`, `refundReason`. This prevents the deletion webhook from overwriting the status with `expired`.
  - It then cancels the subscription immediately and sets `subscriptionCancelled`.
  - Email `Email.sendRefundProcessed` (direct, not queued) {`user_name`, `offering_name` ('Paid access' default), `group_name`, `group_url`, `refund_amount_formatted`, `currency`, `refund_date`, `refund_reason`, `support_email` = `EMAIL_SENDER`||'help@hylo.com'}.
  - The Hylo application fee is not refunded (no `refund_application_fee` flag), and the contribution transfer is not reversed.

### 5.8 Daily cron (`cron.js` daily)
- **`ContentAccess.sendRenewalReminders()`**:
  - Selects active rows with a subscription and `expires_at` between now+6d and now+8d.
  - Skips a row if a reminder was already sent for the same `expires_at`, or any reminder was sent in the last 8 days.
  - Queues `sendSubscriptionRenewalReminder` {`user_name`, `offering_name`, `group_name`, `group_url`, `renewal_date`, `renewal_amount` (offering list price), `renewal_period` (`daily`/`monthly`/`quarterly`/`annual`), `manage_subscription_url`, `update_payment_url`, `group_avatar_url`}.
  - Records `renewal_reminder_sent_for_expires_at` and `renewal_reminder_sent_at`.
- **`ContentAccess.sendExpiredAccessNotifications()`**:
  - Selects rows with `expires_at` in [now−3d, now], any status except `revoked`. **Refunded rows are included.**
  - Skips a row if already notified for that `expires_at`.
  - Sets `status=expired` if the row is still active.
  - Queues `sendAccessExpired` {`user_name`, `access_type` (`track` or `group`), `group_name`, `group_url`, `expired_at`, `renew_url` (group URL), `available_offerings`[{name, price}] (all published offerings of the granting group, only when the row has a product), `group_avatar_url`, `track_name?`}.
  - Note: admin grants with an expiry get this email too.
- Lazy expiry: `ContentAccess.checkAccess` (the `checkContentAccess` query) flips an expired active row to `expired`.
- Scope expiry is enforced at read time (`expires_at > now`). A scope with a past `expires_at` stays in the table and is simply ignored.

### 5.9 Admin grant side effects
`grantContentAccess`:

- **Checks:**
  - The granting group exists ("Granting group not found").
  - The caller holds Administration ("You must be an administrator of the granting group to grant content access").
  - A `userId` or `grantToAllMembers` is given ("Must specify userId or set grantToAllMembers").
  - The target `groupId` is the granting group or a **direct child space** of it ("Target group must be the granting group or one of its spaces").
  - At least one of `groupId`, `productId`, `groupRoleId` is set ("Must specify either groupId, productId, or groupRoleId").
  - Roles are assignable.
- **Writes:** one `admin_grant` row per user, with `metadata.reason`, `granted_by_id` and `expires_at`. If `groupId` is set, `ensureMembership(user, groupId)`.
- **Email:** `sendAccessGranted` {`user_name`, `access_type` (`group_role`/`offering`/`group`), `access_name`, `access_url`, `granted_by_name` (default 'Administrator'), `group_name`, `group_url`, `group_avatar_url`, `expires_at?`}.
- **All members:** iterates `grantingGroup.members()` sequentially. Message "Access granted to N group members", or "No group members to grant access to". There is no duplicate check, so repeated grants create duplicate rows.
- **Roles:** a `groupRoleId` grant creates only the scope row. It does **not** create a `MemberGroupRole`, so the user does not actually hold the role in the UI.

### 5.10 Dispute alerting
After each `charge.dispute.created`, `checkAndSendDisputeAlerts` computes four counts:

| Count | Source |
|---|---|
| `disputes90d` | `stripe_logs` disputes in the last 90 days |
| `disputes7d` | disputes in the last 7 days |
| `refunds90d` | refund logs in the last 90 days |
| `charges90d` | `content_access` rows with `group_id = group` (note: not `granted_by_group_id`), `status != 'cancelled'`, `stripe_customer_id` not null, created in the last 90 days |

`rate = disputes90d / charges90d`.

| Condition | `alert_type` |
|---|---|
| rate ≥ 0.01 | `dispute_rate_critical` |
| else rate ≥ 0.0075 | `dispute_rate_warning` |
| disputes7d ≥ 20 (independent of the rate checks) | `dispute_spike` |

- Each alert type has a 24 h cooldown, checked against `stripe_logs` alert rows.
- On firing, it inserts an alert log and sends `Email.sendStripeAlertEmail` to `NEW_GROUP_EMAIL`:
  - Plain text from "Hylo Platform Alerts" `dev+bot@hylo.com`.
  - Subject `[Hylo Alert] Stripe <label> — Group: <name>`.
  - Body sections: WHY THIS MATTERS, THRESHOLD TRIGGERED, GROUP DETAILS, STATS, RECOMMENDED NEXT STEPS, and "This alert will not repeat for this group for 24 hours."

### 5.11 Platform sales pause
`POST /noo/admin/stripe-sales-pause {groupId, paused, reason}`:

- Patches the three `stripe_sales_paused*` columns.
- Writes a `stripe_logs` row `log_type:'admin_action'` with metadata `{action:'pause_sales'|'resume_sales', actor_user_id, reason}`.
- Returns `{success, groupId, stripeSalesPaused, stripeSalesPausedAt, stripeSalesPausedReason}`.

A pause only blocks *new* checkout sessions. Existing subscriptions keep renewing.

## 6. Permissions
| Operation | Who |
|---|---|
| `createStripeConnectedAccount`, `createStripeAccountLink`, `checkStripeStatus`, `createStripeOffering`, `updateStripeOffering`, `stripeOfferings`, `offeringSubscriptionStats`, `offeringSubscribers` | `Administration` in the group (for update: in the offering's group) |
| `contentAccess` root query | `Administration` in **every** group in `groupIds` (at least one required) |
| `Group.contentAccess` field | Same filter function, via the group relation (see 03) |
| `grantContentAccess`, `revokeContentAccess`, `refundContentAccess` | `Administration` in the granting group |
| `stripeAccountStatus` | Any active member of the group (it leaks `email` and `requirements`) |
| `publicStripeOfferings`, `publicStripeOffering` | Anyone, including logged out. `publicStripeOffering` returns any offering including unpublished and archived, with its `accessGrants`, `metadata`, Stripe ids and group. |
| `createStripeCheckoutSession` | Any logged-in user. Registered as a public mutation too, but it errors without a user. |
| `fulfillStripeCheckoutSession` | The buyer (metadata `userId` must match) |
| `myTransactions` | Self |
| `membershipChange*` | Active member of the group |
| `checkContentAccess(userId, …)` | Any logged-in user, **for any `userId`** (no ownership check) |
| `recordStripePurchase` | **Any logged-in user, no checks at all.** It creates a `stripe_purchase` content_access row for arbitrary user, group and product. Marked "internal use". Security hole. |
| Paywall bypass | `Administration` or `Manage Content` in the group |
| Stripe analytics / sales pause | Hylo platform admin session (`/noo/admin/*`) |

## 7. API (GraphQL summary)
Full signatures are in [03-graphql-api.md](03-graphql-api.md).

**Queries:**

- `stripeAccountStatus(groupId!, accountId!)` → `{accountId, chargesEnabled, payoutsEnabled, detailsSubmitted, email, requirements}`
- `stripeOfferings(groupId!, accountId!)` → `{offerings, success}`. Every offering of the group; `accountId` is unused.
- `publicStripeOfferings(groupId!)` → published offerings with non-empty `groupIds` or `groupRoleIds`.
- `publicStripeOffering(offeringId!)` → `StripeOffering`.
- `offeringSubscriptionStats(offeringId!, groupId!)` → `{activeCount, lapsedCount, monthlyRevenueCents, currency, success, message}`.
  - Active = status active and not expired.
  - Lapsed = expired or revoked, or active but past `expires_at`. Refunded rows count in neither.
  - Revenue for `month`, `season`, `annual`: the sum over active Stripe subscriptions for the offering's **current** `stripe_price_id`, normalised to monthly (day ÷ 30.44, week ÷ 4.35). Subscriptions on older prices (after a price edit) and sliding-scale subscriptions (shared unit price) are not counted, and quantity is ignored.
  - Otherwise: the count of one-time purchases in the last 30 days × list price.
- `offeringSubscribers(offeringId!, groupId!, page=1, pageSize=50 (max 100), lapsedOnly=false)` → `{total, hasMore, items[{id, userId, userName, userAvatarUrl, status:'active'|'lapsed', joinedAt, expiresAt, stripeSubscriptionId}], page, pageSize, totalPages}`. `totalPages` is not declared in the schema type.
- `contentAccess(groupIds, search, accessType, status, offeringId, trackId, groupId, groupRoleId, first, offset, order, sortBy ∈ created_at|expires_at|user_name)` → `ContentAccessQuerySet`. Invalid `sortBy` → "Cannot sort by \"x\"".
- `checkContentAccess(userId!, grantedByGroupId!, groupId?, productId?, trackId?, groupRoleId?)` → `{hasAccess, accessType, expiresAt}`.
- `myTransactions(first=20, offset=0, status?, accessType? (group|track|role, filtered in JS after paging), offeringId?, paymentType? (subscription|one_time))` → `UserTransactionQuerySet`.
  - Only `stripe_purchase` rows, newest first. One row per content_access, so bundles show several.
  - Each item is enriched live from Stripe:
    - subscription: `status`, `current_period_end`, amount = unit × qty, `latest_invoice.hosted_invoice_url`;
    - session: `amount_total`, PI receipt URL;
    - a Billing Portal session is created **for every item on every request**.
- `membershipChangeEligibleOfferings(groupId!)`, `membershipChangePreview(...)`, `membershipChangeInvoicePreview(...)`.

**Mutations:**

- `createStripeConnectedAccount(groupId!, email!, businessName!, country)`
- `createStripeAccountLink(groupId!, accountId!, returnUrl!, refreshUrl!)`
- `createStripeOffering(input: StripeOfferingInput!)` → `{productId, priceId, name, databaseId, success, message:'Offering created successfully'}`
- `updateStripeOffering(offeringId!, name, description, priceInCents, currency, accessGrants, renewalPolicy, duration, publishStatus)` → `{success, message:'Offering updated successfully'}`. The `offering` field is never filled.
  - Name, description, price and currency are synced to Stripe first. A price or currency change creates a new Price and stores the new `stripe_price_id`.
  - Changing `duration` does **not** create a new recurring Stripe price, so the Stripe interval and the Hylo duration can diverge.
- `createStripeCheckoutSession(groupId!, offeringId!, quantity, adjustableQuantity{enabled,minimum,maximum}, successUrl!, cancelUrl!, metadata)` → `{sessionId, url, success}`
- `checkStripeStatus(groupId!)`
- `fulfillStripeCheckoutSession(sessionId!, offeringId)` → `{success, message}`
- `membershipChangeCommit(groupId!, fromOfferingId!, toOfferingId!, newQuantity)` → `{success, message, mode, subscriptionChangeEventId}`
- `grantContentAccess(...)` → `ContentAccessResult`; `revokeContentAccess(accessId!, reason)`; `refundContentAccess(accessId!, reason)`; `recordStripePurchase(...)`
- `rejoinGroup(groupId)` → `Membership`
- `updateGroupSettings` / `createSpace` / `updateSpace` accept `paywall`.

**Legacy (pre-Connect project contributions, feature `PROJECT_CONTRIBUTIONS`):**

- `processStripeToken(postId, token, amount)` and `registerStripeAccount(authorizationCode)`: Stripe OAuth `connect.stripe.com/oauth/token` using `STRIPE_API_KEY`.
- `updateStripeAccount(accountId)`.
- `Me.hasStripeAccount` ("NOT CURRENTLY USED").
- `RefundResult` type is defined but unused.

## 8. Edge cases & known quirks
- Description is stored as plain text, so rich formatting typed in the editor is lost. All UIs render with `stripHtml` and `whitespace-pre-wrap`.
- Price display always uses a `$` prefix regardless of currency (offering list, paywall card, offering page, Monthly Revenue). My Transactions uses `Intl` with the real currency.
- A purchase whose `access_grants` contains only roles leaves the buyer without `group:<selling>` access on a paywalled group (§5.4).
- The client-side paywall readiness rule (an explicit `groupIds` entry) and the server-side membership-change eligibility rule (empty `groupIds` = owner group) disagree.
- Duplicate purchases are not prevented. A member who already has active access can buy again, creating a second subscription. Change plan then errors "Multiple active subscriptions…".
- `content_access.expires_at` for subscriptions starts at now + 30/90/365 days, not Stripe's real period end. It is corrected at the first renewal.
- One-time purchases with a recurring duration are impossible from the UI: any recurring duration means `automatic`, which means subscription.
- `day` duration offerings show "1 Day" in admin lists but are not selectable in the UI (test only).
- Changing an offering's price does not migrate existing subscribers. They keep the old price, and revenue stats only count subscribers on the new price.
- The webhook rescue (`customer.subscription.created`) stores `sub_…` in `stripe_session_id` when no session was found.
- `stripe_logs` `charges90d` counts content_access rows by `group_id`. Purchases of the group itself with `access_grants.groupIds` contain the group id; the empty-grants case has `group_id` null and is not counted. Dispute rates may be inflated or zero.
- Contribution transfer is effectively dead: name matching misses the current product name, and subscriptions have no session PI (§5.4).
- `charge.refunded` handler crashes (missing `findBySessionId`). Dashboard refunds therefore never update Hylo status, and the event is retried and eventually dropped by Stripe.
- `product.updated` handler compares the price object with the id (§5.5).
- The connected-account email default `"<group name>@hylo.com"` can contain spaces (invalid), but the UI always sends the form email.
- Sandbox/demo mode blocks checkout ("Not available in the demo").
- Leaving a paid group keeps the content_access and scope, which enables "retained access" and rejoin until expiry. Leaving does not cancel the subscription.

## 9. Docs vs. code
| Source | Claim | Code reality |
|---|---|---|
| GitBook paid guide | "estimate of Stripe fees (approx. 0.5%)" | UI estimate is 2.9 % + 0.30 (US cards) |
| GitBook paid guide | Grant Access offers "Track — grants access to a specific track" and the records filter has a "Track" filter | The grant UI offers Offering / Group Access / **Space**; filters are Space and Role. Tracks became paid spaces (migration `20260728120000`). |
| GitBook paid guide | "Add Space to gate access to a specific track" | Correct in spirit: track spaces are gated as paid spaces |
| GitBook paid guide | Refund only refunds the most recent payment for recurring offerings | Matches code |
| `docs/PAID_CONTENT_WORKFLOW.md` | Access is created on `payment_intent.succeeded`; offerings have `trackIds` | Access is created on `checkout.session.completed` (plus the success-page fallback); `trackIds` are deprecated and ignored |
| `docs/CONTENT_ACCESS_SUMMARY.md` | Triggers mirror `expires_at` into `group_memberships`, `tracks_users`, etc. | Replaced by `user_scopes` triggers (migration `20251110143609`) |
| `docs/STRIPE_CONNECT_INTEGRATION.md` | Connect existing account flow | `connectExistingAccount` exists in the service but no mutation path uses it |
| Email templates | Manage link `/settings/subscriptions`; admin link `/settings/paid-content/access` | Real routes: `/my/transactions` and `/settings/paid-content/content-access` |
| Health endpoint | `apiVersion: 2025-09-30.clover` | The client uses `2025-10-29.clover` |

## 10. Source references
- Backend:
  - `apps/backend/api/models/{StripeAccount,StripeProduct,ContentAccess,SubscriptionChangeEvent,UserScope,Group,Track}.js`
  - `apps/backend/api/services/{StripeService,OfferingStatsService,Email}.js`
  - `apps/backend/api/controllers/{StripeController,AdminController,PaymentController}.js`
  - `apps/backend/api/graphql/mutations/{stripe,contentAccess,membershipChange,membership,spaces}.js`
  - `apps/backend/api/graphql/queries/{stripe,contentAccess,transactions,membershipChange}.js`
  - `apps/backend/api/graphql/{makeModels,makeSchema,schema.graphql}`
  - `apps/backend/api/services/Search/util.js` (`filterAndSortContentAccess`), `apps/backend/api/policies/checkAndSetMembership.js`
  - `apps/backend/lib/{grantCheckoutSessionAccess,membershipChangeCredit,membershipOfferingEligibility,offeringAccessGrants,stripeOfferingMetadata,subscriptionChangeRules,scopes}.js`
  - `apps/backend/cron.js`, `apps/backend/config/{routes,customMiddleware}.js`
  - Migrations `20251020160838`, `20251110143609`, `20251117111349`, `20260116151442`, `20260318120000`, `20260319100000`, `20260327113000`, `20260327120000`, `20260728120000`, `20260902013000`
- Shared: `packages/shared/src/OfferingHelpers.js`
- Web:
  - `apps/web/src/routes/GroupSettings/PaidContentTab/*`
  - `apps/web/src/routes/{OfferingDetails,MyTransactions}/*`
  - `apps/web/src/routes/GroupDetail/{PaywallOfferingsSection,JoinSection,PaymentSuccess,PaymentFailure,GroupDetail}.jsx`
  - `apps/web/src/routes/SpaceJoinPage/SpaceJoinPage.jsx`
  - `apps/web/src/components/RetainedAccessPanel/RetainedAccessPanel.jsx`
  - `apps/web/src/routes/AuthLayoutRouter/{AuthLayoutRouter.js,components/ContextMenu/{spaceFormConstants.js,SpaceSettingsModal.jsx}}`
  - `apps/web/src/util/{offerings,accessGrants,membershipChangeModes,spaceVisibility}.js`
  - `apps/web/src/routes/Management/StripeAnalytics/StripeAnalytics.js`
  - `apps/web/src/routes/UserSettings/PaymentSettingsTab/*`
- Docs: `docs/{PAID_CONTENT_WORKFLOW,STRIPE_CONNECT_INTEGRATION,STRIPE_WEBHOOKS_TESTING_GUIDE,CONTENT_ACCESS_SUMMARY,SUBSCRIPTION_CHANGE_V1_TODO}.md`; GitBook "Set up and manage paid groups and content with Stripe integration".
