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
