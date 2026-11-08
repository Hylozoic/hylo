# Content Access System Summary

## Overview

The database schema has been updated to support **content access, for both paid (via Stripe) and freely granted (by admin)**.

## Database Changes

### Migration: `20251020160838_paid-content-stripe.js`

#### 1. Moved Stripe Association from Users to Groups
- Removed `stripe_account_id` from `users` table
- Added `stripe_account_id` to `groups` table
- Added Stripe status columns to groups:
  - `stripe_charges_enabled`
  - `stripe_payouts_enabled`
  - `stripe_details_submitted`

#### 2. Created `stripe_products` Table
Tracks products/offerings created by groups:
- Links to groups and optionally to tracks
- Stores Stripe product/price IDs
- Tracks product details (name, description, price, currency)

#### 3. Created `content_access` Table (Key Feature!)
**This supplements the original `stripe_purchases` concept** to support multiple access types:

**Access Types:**
- `stripe_purchase` - User paid via Stripe
- `admin_grant` - Admin gave free access

**Key Columns:**
- `user_id` - Who has access
- `granted_by_group_id` - Which group is granting the access (required, not null)
- `group_id` - Which group access is FOR (optional, nullable) - can differ from granting group
- `product_id` - Product id denotes the entity in Stripe that tracks an offering/product
- `track_id` - Optional: Grants access to a specific track within a group
- `role_id` - Optional: References `groups_roles` table, represents role-based access grants by admins
- `access_type` - How they got access (stripe_purchase, admin_grant)
- `stripe_session_id` - **Nullable** (only for Stripe purchases)
- `amount_paid` - Amount paid (0 for free grants)
- `status` - active/expired/revoked
- `granted_by_id` - Admin who granted access (for admin grants)
- `expires_at` - Optional expiration date (for group and role access, NOT for tracks)
- `metadata` - Flexible JSONB for additional info

**Access Granularity:**
Access can be granted at multiple levels:
- **Group-level**: `group_id` set - access to group content
- **Track-level**: `track_id` set - access to specific track content (tracks are one-time, no expiration tracking)
- **Role-level**: `role_id` set - access tied to a specific group role

**Important: track_id, role_id, and group_id are MUTUALLY EXCLUSIVE in terms of their triggers:**
Only ONE of these combinations will be active for a content_access record:
- `track_id` set (implies track-level access)
- `role_id` set (implies role-level access)  
- `group_id` set (implies group-level access)

**Automatic expiration mirroring:**
`content_access` writes materialize access on `user_scopes` through PostgreSQL triggers (`compute_user_scopes_from_content_access`). Track enrollment and completion live on the track space's `group_memberships`, not on `tracks_users` (that table was dropped). The old `sync_content_access_expires_at` / `clear_content_access_expires_at` functions, which updated `tracks_users`, were dropped with it.

This avoids the need for JOINs when checking expiration - you can query the respective tables directly.

## Database Triggers for Automatic Expiration Sync

### Overview
To avoid constantly joining `content_access` with membership tables, PostgreSQL triggers automatically keep `expires_at` values in sync.

### How It Works

**When content access is granted or updated:**
1. User inserts/updates a record in `content_access`
2. A trigger materializes the grant onto `user_scopes`
3. Revoking or expiring the row removes the matching scopes

Track access is a scope on the track's space. It is not a row in `tracks_users`.

**Bundle Purchases (One Product, Multiple Access Grants):**
- A single Stripe product can create multiple `content_access` records
- Example: User buys "Premium Bundle" which grants:
  - Group membership access (content_access record with no track_id)
  - Track A access (content_access record with track_id = A)
  - Track B access (content_access record with track_id = B)
- All three records reference the same `product_id`
- Each record's trigger independently updates its respective table

### Benefits

✅ **No Application Code**: Triggers run at database level  
✅ **Always Consistent**: Can't be bypassed or forgotten  
✅ **Fast Queries**: No JOINs needed to check expiration  
✅ **Atomic**: Happens in same transaction  
✅ **Automatic**: Works for all code paths (GraphQL, direct SQL, etc.)

### Example Usage

```javascript
// Check if a membership is expired (no JOIN needed!)
const membership = await GroupMembership
  .where({ user_id: userId, group_id: groupId })
  .fetch()

if (membership.get('expires_at') && membership.get('expires_at') < new Date()) {
  // Membership has expired
}

// Check access from user_scopes (no JOIN needed)
const scope = await knex('user_scopes')
  .where({ user_id: userId, group_id: groupId })
  .first()
```

### Protection Against Expiration Overwriting

**Scenario:** User has long-term group membership, buys short-term track access

```javascript
// Step 1: User buys 1-year group membership
// Creates: content_access { user_id, group_id, expires_at: '2026-01-01', track_id: NULL }
// Trigger updates: group_memberships.expires_at = '2026-01-01' ✓

// Step 2: Same user buys 1-month access to Track A (3 months later)
// Creates: content_access { user_id, group_id, track_id: 123, expires_at: '2025-05-01' }
// Trigger updates: user_scopes for the track space. group_memberships.expires_at stays '2026-01-01' ✓

// Result: User retains 1-year group membership while having separate track expiration
```

**Scenario:** User buys role-based access

```javascript
// User purchases "Moderator Role" - 6 months
// Creates: content_access { user_id, group_id, role_id: 5, track_id: NULL, expires_at: '2025-07-22' }
// Trigger updates: group_memberships.expires_at = '2025-07-22' ✅
// Trigger updates: group_memberships_group_roles.expires_at = '2025-07-22' ✅

// Result: User has both group membership AND role access until July 2025
// This makes sense because having a role requires group membership
```

**Why this matters:**
- Without this logic, buying a 1-month track would reset the group membership to expire in 1 month
- Now each access level maintains its own independent expiration
- Group membership expiration changes with group-level purchases OR role purchases (not track purchases)
- Having a role implies having group membership, so role expiration = group membership expiration

## GraphQL Mutations

### New File: `api/graphql/mutations/contentAccess.js`

#### Admin Operations:

**`grantContentAccess`** - Grant free access to content
```graphql
mutation {
  grantContentAccess(
    userId: "456"
    groupId: "123"
    productId: "789"  # or trackId: "101" or roleId: "202"
    expiresAt: "2025-12-31T23:59:59Z"
    reason: "Staff member"
  ) {
    id
    success
    message
  }
}
```

**`revokeContentAccess`** - Revoke any access (paid or free)
```graphql
mutation {
  revokeContentAccess(
    accessId: "123"
    reason: "User violated terms"
  ) {
    success
    message
  }
}
```

**`checkContentAccess`** - Check if user has access
```graphql
query {
  checkContentAccess(
    userId: "456"
    groupId: "123"
    productId: "789"
  ) {
    hasAccess
    accessType
    expiresAt
  }
}
```

**`recordStripePurchase`** - Internal mutation for webhook handler
```graphql
mutation {
  recordStripePurchase(
    userId: "456"
    groupId: "123"
    productId: "789"
    sessionId: "cs_xxx"
    paymentIntentId: "pi_xxx"
    amountPaid: 2000
    currency: "usd"
  ) {
    id
    success
  }
}
```

## Use Cases

### 1. Paid Content via Stripe
1. Admin creates product with price
2. User purchases via Stripe Checkout
3. Webhook handler calls `recordStripePurchase`
4. Access record created with `access_type: 'stripe_purchase'`

### 2. Admin-Granted Free Access
1. Admin uses `grantContentAccess` mutation
2. Access record created with `access_type: 'admin_grant'`
3. No Stripe involvement, no payment required
4. Can set expiration date if desired
5. Reason stored in metadata for audit trail

### 3. Revoking Access
1. Admin can revoke any access (paid or free)
2. Status changed to 'revoked'
3. Metadata records who revoked and why

## Implementation Status

✅ **Completed:**
- Database migration schema
- GraphQL mutation signatures and documentation
- Support for multiple access types

⚠️ **TODO STRIPE (marked in code):**
- Create frontend UI for admin grants

## Benefits of This Design

1. **Flexible**: Supports both paid and free access in same table
2. **Auditable**: Tracks who granted access and why
3. **Reversible**: Admins can revoke any access
4. **Temporal**: Supports optional expiration dates
5. **Comprehensive**: Works for both products and tracks
6. **Extensible**: JSONB metadata field for future needs

## Running the Migration

```bash
cd apps/backend
yarn knex migrate:latest
```

## Next Steps

1. Run the migration
2. Create `ContentAccess` Bookshelf model
3. Implement the TODO comments in `contentAccess.js`
4. Update Stripe webhook to record purchases
5. Add access checks before serving protected content
6. Build admin UI for granting/revoking access

