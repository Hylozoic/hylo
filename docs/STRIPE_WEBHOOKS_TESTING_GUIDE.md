# Stripe Webhooks & User Scopes Testing Guide

## Overview

This guide provides comprehensive test scenarios for the new User Scopes system and Stripe webhook integration. The system centralizes user permissions using a scope-based approach and automatically maintains access based on Stripe payment events.

**Key Concepts:**
- **Scopes**: String-based permissions like `group:123`, `track:456`, `group_role:789`
- **Content Access**: Records of purchases or grants that create scopes
- **User Scopes**: Materialized table of active permissions (automatically maintained by database triggers)
- **Webhooks**: Stripe events that update access in real-time
- **Checkout Sessions**: Primary payment method for both one-time and subscription purchases
- **Subscriptions**: Recurring payments tracked via `stripe_subscription_id` column

**Supported Stripe Webhook Events:**
- `checkout.session.completed`: Creates initial access for both one-time purchases and subscriptions
- `customer.subscription.created`: Backup handler for subscription access creation
- `invoice.paid`: Extends access on subscription renewals (enforces `renewal_policy`)
- `invoice.payment_failed`: Logs payment failures (access not revoked immediately)
- `customer.subscription.deleted`: Revokes access when subscription is canceled
- `charge.refunded`: Revokes access when payment is refunded

---

## Test Environment Setup

### Prerequisites
- Access to a Stripe test account with webhook endpoints configured
- Test credit cards (Stripe provides these)
- At least one group with:
  - Stripe account connected
  - Published offerings with different access configurations
  - At least one track
  - At least one group role

### Test Users
For each scenario, you'll need:
- **Regular User**: Standard user account for purchasing
- **Admin User**: User with admin/steward permissions in the test group

---

## Test Scenarios

### 1. Initial Purchase - One-Time Payment

**Purpose**: Verify that purchasing a product creates content access records and user scopes, granting immediate access to protected content.

#### Test Steps (Regular User)

1. **Setup**:
   - Log in as a regular user
   - Navigate to a group with published offerings
   - Identify a track or group content that requires payment (has `access_controlled` or `paywall` flag)

2. **Pre-Purchase Verification**:
   - Try to access the protected track/group content
   - **Expected**: Should see "Access Required" or similar message
   - Note: GraphQL `canAccess` field should return `false`

3. **Purchase**:
   - Click "Purchase" or "Subscribe" on an offering
   - Complete Stripe Checkout using test card: `4242 4242 4242 4242`
   - Enter any future expiry date, any 3-digit CVC
   - Complete the payment

4. **Post-Purchase Verification**:
   - Wait 5-10 seconds for webhook processing
   - Refresh the page
   - Try to access the protected content again
   - **Expected**: Should now have access to all content included in the purchase
   - Verify you can view tracks, access group content, etc.

#### Test Steps (Admin User)

1. **Setup**:
   - Log in as group admin
   - Navigate to Group Settings → Paid Content → Content Access tab

2. **Verification**:
   - Locate the purchasing user in the content access list
   - **Expected**: Should see new `content_access` records with:
     - Status: `active`
     - Access Type: `stripe_purchase`
     - Appropriate `expires_at` date (if time-limited)
     - `stripe_session_id` populated
     - `stripe_subscription_id` populated (if subscription, otherwise NULL)

3. **Database Verification** (Developer):
   ```sql
   -- Check content_access records
   SELECT * FROM content_access 
   WHERE user_id = [USER_ID] 
   AND status = 'active' 
   ORDER BY created_at DESC LIMIT 5;
   
   -- Check user_scopes were created
   SELECT * FROM user_scopes 
   WHERE user_id = [USER_ID] 
   ORDER BY created_at DESC LIMIT 10;
   ```
   - **Expected**: Each `content_access` record should have a corresponding `user_scope` entry

---

### 2. Subscription Renewal

**Purpose**: Verify that when a subscription renews, the access expiration date is automatically extended.

**Note**: This test requires a subscription-based offering (not a one-time payment).

#### Test Steps (Regular User)

1. **Setup**:
   - Purchase a subscription-based offering (if available)
   - Use test card: `4242 4242 4242 4242`
   - Note the initial expiration date

2. **Trigger Renewal**:
   - In Stripe Dashboard (Test Mode):
     - Go to Customers → Find the test customer
     - Locate the subscription
     - Click "..." menu → "Update subscription"
     - Advance the billing date to trigger immediate renewal
   - OR wait for the subscription cycle to complete (not recommended for testing)

3. **Verification**:
   - Check that access continues without interruption
   - **Expected**: User maintains access to content

#### Test Steps (Admin User)

1. **Pre-Renewal Check**:
   - Navigate to Group Settings → Paid Content → Content Access
   - Note the current `expires_at` date for the user's access records

2. **Trigger Renewal** (Developer):
   - In Stripe Dashboard → Webhooks
   - Manually send an `invoice.paid` event (for renewal)
   - OR advance subscription billing date to trigger automatic renewal

3. **Post-Renewal Verification**:
   - Refresh the content access list
   - **Expected**: `expires_at` date should be extended
   - Metadata should include:
     - `last_renewed_at`: timestamp
     - `subscription_period_start`: new period start
     - `subscription_period_end`: new period end

4. **Database Verification** (Developer):
   ```sql
   -- Check that expires_at was updated
   SELECT id, user_id, expires_at, metadata 
   FROM content_access 
   WHERE user_id = [USER_ID] 
   AND status = 'active';
   
   -- Check user_scopes also updated
   SELECT user_id, scope, expires_at 
   FROM user_scopes 
   WHERE user_id = [USER_ID];
   ```
   - **Expected**: Both tables should show the new expiration date

---

### 3. Subscription Cancellation / Expiration

**Purpose**: Verify that when a subscription is canceled or expires, access is revoked and user scopes are removed.

#### Test Steps (Regular User)

1. **Setup**:
   - Have an active subscription-based purchase
   - Verify current access to protected content

2. **Cancel Subscription**:
   - Navigate to your subscription management page
   - Click "Cancel Subscription"
   - Confirm cancellation
   - OR cancel via Stripe Dashboard

3. **Verification**:
   - Wait 5-10 seconds for webhook processing
   - Try to access the previously accessible content
   - **Expected**: Access should be revoked
   - Should see "Access Required" or similar message again

#### Test Steps (Admin User)

1. **Trigger Cancellation**:
   - Stripe Dashboard → Customers → Find customer
   - Locate subscription → Cancel subscription

2. **Verification**:
   - Navigate to Group Settings → Paid Content → Content Access
   - Find the user's access records
   - **Expected**: Status changed to `expired`
   - Metadata should include:
     - `subscription_canceled_at`: timestamp
     - `subscription_cancel_reason`: reason text

3. **Database Verification** (Developer):
   ```sql
   -- Check content_access status
   SELECT id, user_id, status, metadata 
   FROM content_access 
   WHERE user_id = [USER_ID];
   
   -- Verify user_scopes were removed
   SELECT COUNT(*) FROM user_scopes 
   WHERE user_id = [USER_ID];
   ```
   - **Expected**: 
     - `content_access` status = `expired`
     - Corresponding `user_scopes` entries should be deleted

---

### 4. Subscription Payment Failure

**Purpose**: Verify that when a subscription renewal payment fails, the system logs the failure appropriately.

**Note**: Access is NOT immediately revoked as Stripe retries failed payments.

#### Test Steps (Developer - Trigger Failure)

1. **Setup**:
   - Have an active subscription-based purchase
   - In Stripe Dashboard → Customers → Find customer
   - Update payment method to a test card that will fail: `4000 0000 0000 0341`

2. **Trigger Renewal**:
   - Advance the subscription billing date to trigger renewal attempt
   - The payment will fail

3. **Verification**:
   - Check webhook logs for `invoice.payment_failed` event
   - **Expected**: Event processed successfully
   - Access should still be active (Stripe retries)
   - Metadata should include:
     - `last_payment_attempt_at`: timestamp
     - `payment_failure_count`: incremented
     - `last_payment_error`: error message

4. **Database Verification**:
   ```sql
   -- Check metadata was updated
   SELECT id, user_id, status, metadata 
   FROM content_access 
   WHERE stripe_subscription_id = '[SUBSCRIPTION_ID]';
   ```
   - **Expected**: Status still `active`, but metadata shows failure

5. **Monitor Stripe Retries**:
   - Stripe will automatically retry the payment
   - After final retry failure, `customer.subscription.deleted` webhook fires
   - At that point, access should be revoked

---

### 5. Manual Renewal Policy

**Purpose**: Verify that subscriptions with `renewal_policy = 'manual'` do not automatically renew.

#### Test Steps (Admin User - Setup)

1. **Create Manual Renewal Offering**:
   - Navigate to Group Settings → Paid Content → Offerings
   - Create a subscription-based offering
   - Set `renewal_policy` to `'manual'`
   - Publish the offering

#### Test Steps (Regular User - Purchase)

1. **Purchase**:
   - Complete purchase of the manual renewal offering
   - Verify initial access is granted

#### Test Steps (Developer - Test Renewal)

1. **Trigger Renewal Attempt**:
   - In Stripe Dashboard → Find the subscription
   - Advance billing date to trigger renewal invoice

2. **Verification**:
   - Check webhook logs for `invoice.paid` event
   - **Expected**: 
     - Webhook handler detects `renewal_policy = 'manual'`
     - Cancels subscription at period end via Stripe API
     - Does NOT extend `expires_at` in `content_access`
   - User's access should expire at the end of current period

3. **Database Verification**:
   ```sql
   -- Check that expires_at was NOT extended
   SELECT id, user_id, expires_at, metadata 
   FROM content_access 
   WHERE stripe_subscription_id = '[SUBSCRIPTION_ID]';
   ```
   - **Expected**: `expires_at` remains at original period end date

4. **Stripe Verification**:
   - Check subscription in Stripe Dashboard
   - **Expected**: Should show "Cancels at period end"

---

### 6. Subscription Without Initial Access (Voluntary Contribution)

**Purpose**: Verify that subscriptions without `access_grants` (voluntary contributions) don't create access records.

#### Test Steps (Admin User - Setup)

1. **Create Contribution Offering**:
   - Navigate to Group Settings → Paid Content → Offerings
   - Create a subscription-based offering
   - Leave `access_grants` empty (no tracks, roles, or group access)
   - Set price and publish

#### Test Steps (Regular User - Purchase)

1. **Purchase**:
   - Complete purchase of the voluntary contribution offering
   - Verify payment succeeds

#### Test Steps (Developer - Verification)

1. **Check Webhooks**:
   - Verify `checkout.session.completed` event processed
   - Verify `customer.subscription.created` event processed
   - **Expected**: No errors logged

2. **Database Verification**:
   ```sql
   -- Verify NO content_access records were created
   SELECT * FROM content_access 
   WHERE stripe_subscription_id = '[SUBSCRIPTION_ID]';
   ```
   - **Expected**: No records (empty result)

3. **Stripe Verification**:
   - Subscription should be active in Stripe
   - Renewals should process normally
   - `invoice.paid` handler should recognize empty `access_grants` and skip processing

---

### 7. Refund / Charge Reversal

**Purpose**: Verify that when a payment is refunded, access is immediately revoked.

#### Test Steps (Admin User - Initiating Refund)

1. **Setup**:
   - Identify a recent purchase that granted access
   - Note the Stripe payment intent ID

2. **Process Refund**:
   - Stripe Dashboard → Payments
   - Find the payment → Click "Refund"
   - Process full or partial refund
   - Confirm refund

3. **Verification**:
   - Navigate to Group Settings → Paid Content → Content Access
   - Find the user's access records
   - **Expected**: Status changed to `revoked`
   - Metadata should include:
     - `refunded_at`: timestamp
     - `refund_amount`: amount in cents
     - `refund_reason`: reason text

#### Test Steps (Regular User - Post-Refund)

1. **Verification**:
   - Wait 5-10 seconds after refund
   - Try to access the previously purchased content
   - **Expected**: Access should be immediately revoked
   - Should see "Access Required" message

2. **Database Verification** (Developer):
   ```sql
   -- Check content_access was revoked
   SELECT id, user_id, status, metadata 
   FROM content_access 
   WHERE stripe_session_id = '[SESSION_ID]';
   
   -- Verify user_scopes were removed
   SELECT * FROM user_scopes 
   WHERE user_id = [USER_ID] 
   AND source_kind = 'grant';
   ```
   - **Expected**: 
     - `content_access` status = `revoked`
     - Related scopes removed from `user_scopes`

---

### 8. Access Control - Track Level

**Purpose**: Verify that tracks with `access_controlled = true` properly restrict access to users without appropriate scopes.

#### Test Steps (Admin User - Setup)

1. **Configure Track**:
   - Navigate to Group Settings → Tracks
   - Create or select a track
   - Enable "Access Controlled" toggle
   - Add this track to a paid offering

2. **Create Test Offering**:
   - Navigate to Group Settings → Paid Content → Offerings
   - Create a new offering
   - In the "Access Grants" section, add the track
   - Set a price and publish the offering

#### Test Steps (Regular User - Without Purchase)

1. **Attempt Access**:
   - Navigate to the access-controlled track
   - **Expected**: Should see restricted access message
   - Track content should not be visible

2. **GraphQL Query** (Developer):
   ```graphql
   query {
     track(id: "[TRACK_ID]") {
       id
       name
       accessControlled
       canAccess
     }
   }
   ```
   - **Expected**: `canAccess` should return `false`

#### Test Steps (Regular User - After Purchase)

1. **Purchase Offering**:
   - Complete purchase of the offering containing the track

2. **Verify Access**:
   - Navigate to the track again
   - **Expected**: Full access to track content
   - `canAccess` should now return `true`

---

### 9. Access Control - Group Level (Paywall)

**Purpose**: Verify that groups with `paywall = true` properly restrict access to non-members.

#### Test Steps (Admin User - Setup)

1. **Enable Group Paywall**:
   - Navigate to Group Settings → Paid Content → Offerings
   - Toggle "Group Paywall Enabled" to ON
   - Create an offering that grants basic group access
   - Publish the offering

#### Test Steps (Regular User - Without Purchase)

1. **Attempt Access**:
   - Try to view the group's content stream
   - Try to create a post in the group
   - **Expected**: Should see "Membership Required" or similar
   - Limited or no access to group features

2. **GraphQL Query** (Developer):
   ```graphql
   query {
     group(id: "[GROUP_ID]") {
       id
       name
       paywall
       canAccess
     }
   }
   ```
   - **Expected**: `canAccess` should return `false`

#### Test Steps (Regular User - After Purchase)

1. **Purchase Membership**:
   - Complete purchase of the group membership offering

2. **Verify Access**:
   - Navigate to group content
   - **Expected**: Full member access
   - Can view posts, create content, etc.
   - `canAccess` should return `true`

---

### 10. Role-Based Access (Group Roles)

**Purpose**: Verify that group roles can grant scopes and that role assignment properly creates user scopes.

#### Test Steps (Admin User - Setup)

1. **Configure Group Role**:
   - Navigate to Group Settings → Roles
   - Create or select a role
   - In the `scopes` field (if exposed in UI), add scope strings:
     - Example: `["track:123", "group:456"]`
   - Save the role

2. **Assign Role to User**:
   - Navigate to Members
   - Select a test user
   - Assign the configured role

#### Test Steps (Regular User - Verification)

1. **Check Access**:
   - Verify access to content specified in role scopes
   - **Expected**: Access granted based on role's scopes

2. **Database Verification** (Developer):
   ```sql
   -- Check role assignment
   SELECT * FROM group_memberships_group_roles 
   WHERE user_id = [USER_ID] 
   AND active = true;
   
   -- Check scopes on the role
   SELECT id, name, scopes FROM groups_roles 
   WHERE id = [ROLE_ID];
   
   -- Verify user_scopes created
   SELECT * FROM user_scopes 
   WHERE user_id = [USER_ID] 
   AND source_kind = 'role';
   ```
   - **Expected**: 
     - Role has scopes defined
     - `user_scopes` entries created with `source_kind = 'role'`
     - `expires_at` should be NULL (roles don't expire unless reassigned)

#### Test Steps (Admin User - Role Removal)

1. **Remove Role**:
   - Navigate to Members → Select user
   - Remove the role assignment

2. **Verification**:
   - User should lose access to role-scoped content
   - Database check should show `user_scopes` entries removed

---

### 11. Multiple Access Sources

**Purpose**: Verify that when a user has access from multiple sources (purchase + role), the system handles it correctly.

#### Test Steps (Admin User - Setup)

1. **Grant Multiple Access**:
   - Assign a role that grants access to Track A
   - Create an offering that also grants access to Track A
   - Have the user purchase the offering

#### Test Steps (Developer - Verification)

1. **Database Check**:
   ```sql
   -- Check multiple sources for same scope
   SELECT user_id, scope, expires_at, source_kind, source_id 
   FROM user_scopes 
   WHERE user_id = [USER_ID] 
   AND scope = 'track:[TRACK_ID]';
   ```
   - **Expected**: May see one entry (the system consolidates)
   - The `expires_at` should be the latest expiration (or NULL if role-based)

2. **Remove One Source**:
   - Remove the role assignment
   - **Expected**: Access continues (still has purchase-based access)
   - Refund the purchase
   - **Expected**: Access should now be fully revoked

---

### 12. Expiration Handling

**Purpose**: Verify that expired access is properly cleaned up and users lose access after expiration.

#### Test Steps (Admin User - Setup)

1. **Create Short-Duration Offering**:
   - Create an offering with 1-day or 1-month duration
   - Have a user purchase it

2. **Simulate Expiration**:
   - Directly update the database to set `expires_at` to the past:
   ```sql
   UPDATE content_access 
   SET expires_at = NOW() - INTERVAL '1 day' 
   WHERE user_id = [USER_ID];
   ```
   - OR wait for natural expiration (not recommended for testing)

#### Test Steps (Regular User - Verification)

1. **Check Access**:
   - Try to access the content
   - **Expected**: Access denied
   - `canAccess` query should return `false`

2. **Database Verification**:
   ```sql
   -- Check that user_scopes query filters out expired
   SELECT * FROM user_scopes 
   WHERE user_id = [USER_ID] 
   AND (expires_at IS NULL OR expires_at > NOW());
   ```
   - **Expected**: Expired entries should not appear in active scope queries

---

### 13. Admin-Granted Access

**Purpose**: Verify that admins can manually grant access without payment.

#### Test Steps (Admin User)

1. **Grant Access**:
   - Navigate to Group Settings → Paid Content → Content Access
   - Click "Grant Access" (if available in UI)
   - Select user, select content (track/role/group)
   - Optionally set expiration date
   - Add reason (e.g., "Scholarship", "Beta tester")
   - Confirm

2. **Verification**:
   - Check that the access record was created
   - **Expected**: 
     - Status: `active`
     - Access Type: `admin_grant`
     - Reason in metadata

#### Test Steps (Regular User - Verification)

1. **Check Access**:
   - Navigate to the granted content
   - **Expected**: Immediate access
   - `canAccess` returns `true`

2. **Database Verification**:
   ```sql
   SELECT * FROM content_access 
   WHERE user_id = [USER_ID] 
   AND access_type = 'admin_grant';
   ```
   - **Expected**: Record exists with appropriate metadata

---

## Common Issues & Troubleshooting

### Webhook Not Processing

**Symptoms**: Purchase completes but user doesn't get access

**Checks**:
1. Verify Stripe webhook endpoint is configured correctly
2. Check webhook logs in Stripe Dashboard
3. Check application logs for webhook processing errors
4. Verify `STRIPE_WEBHOOK_SECRET` environment variable is set

**Resolution**: Manually trigger the webhook from Stripe Dashboard

---

### Database Trigger Not Firing

**Symptoms**: `content_access` record created but `user_scopes` table not updated

**Checks**:
```sql
-- Verify trigger exists
SELECT * FROM pg_trigger 
WHERE tgname LIKE '%user_scopes%';

-- Check trigger function
SELECT prosrc FROM pg_proc 
WHERE proname = 'compute_user_scopes_from_content_access';
```

**Resolution**: Re-run the migration to recreate triggers

---

### Access Check Returns Incorrect Result

**Symptoms**: User has scope but `canAccess` returns false (or vice versa)

**Checks**:
1. Verify `paywall` flag on groups
2. Verify `access_controlled` flag on tracks
3. Check expiration dates in `user_scopes`
4. Verify scope string format matches exactly

**Resolution**: Check model logic in `Track.canAccess` and `Group.canAccess`

---

## Testing Checklist

Use this checklist to ensure all scenarios are tested:

- [ ] **Purchase Flow**
  - [ ] One-time payment creates access
  - [ ] Multiple items in bundle purchase
  - [ ] Access grants appear immediately

- [ ] **Subscription Management**
  - [ ] Renewal extends access
  - [ ] Cancellation revokes access
  - [ ] Expiration removes scopes

- [ ] **Refunds**
  - [ ] Full refund revokes access
  - [ ] Partial refund (behavior TBD)

- [ ] **Access Control**
  - [ ] Track-level restrictions work
  - [ ] Group-level paywall works
  - [ ] Free content remains accessible

- [ ] **Role-Based Access**
  - [ ] Role assignment creates scopes
  - [ ] Role removal deletes scopes
  - [ ] Role scopes don't expire

- [ ] **Admin Functions**
  - [ ] Manual access grants work
  - [ ] Manual access revocation works
  - [ ] Content access list shows all records

- [ ] **Edge Cases**
  - [ ] Multiple access sources
  - [ ] Expiration handling
  - [ ] Webhook retry/replay

---

## Test Data Cleanup

After testing, clean up test data:

```sql
-- Remove test content_access records
DELETE FROM content_access 
WHERE user_id IN ([TEST_USER_IDS]);

-- user_scopes will be cleaned automatically by trigger

-- Cancel test subscriptions in Stripe Dashboard
```

---

## Reporting Issues

When reporting issues found during testing, please include:

1. **Scenario**: Which test scenario failed
2. **Expected Result**: What should have happened
3. **Actual Result**: What actually happened
4. **User Info**: Regular user or admin, user ID
5. **Timestamps**: When the action was performed
6. **Stripe IDs**: Session ID, Payment Intent ID, Subscription ID (if applicable)
7. **Database State**: Output of relevant SQL queries
8. **Logs**: Any error messages from application or Stripe logs

---

## Notes

- All Stripe webhook events are processed asynchronously, so allow 5-10 seconds for changes to propagate
- Database triggers handle scope updates automatically - no manual intervention should be needed
- The `user_scopes` table is a materialized view of permissions - changes to `content_access` or roles automatically sync
- For production testing, use Stripe's test mode with test credit cards
- Never use real payment information in testing environments

