# Stripe Connect Integration Guide

This document provides a comprehensive guide to the Stripe Connect integration that has been added to your Hylo application.

## Overview

This integration allows groups to:
- Create Stripe Connected Accounts to receive payments
- Onboard to Stripe using Account Links
- Create products for group memberships and track content
- Display products in a public storefront
- Process payments with application fees using Hosted Checkout

## Architecture

The integration uses:
- **Stripe API Version**: `2025-09-30.clover`
- **Connection Type**: Connected Accounts with controller settings (NOT type: 'express' or type: 'standard')
- **Payment Flow**: Direct Charges with application fees
- **Checkout**: Hosted Checkout for simplicity and security
- **Account Access**: Full dashboard access for connected accounts

## Setup Instructions

### 1. Environment Variables

Add the following environment variable to your backend `.env` file:

```bash
# Stripe Secret Key
# Get this from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_your_secret_key_here

# Optional: Webhook Secret (for production)
# Get this from: https://dashboard.stripe.com/webhooks
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

**IMPORTANT**: If `STRIPE_SECRET_KEY` is not set, the application will throw a helpful error message explaining where to find it.

### 2. Install Dependencies

The Stripe package has been updated to version `^17.5.0`. Run:

```bash
cd apps/backend
yarn install
```

## Backend Components

### Services

#### `apps/backend/api/services/StripeService.js`

Core service that handles all Stripe API calls. Key methods:

- **`createConnectedAccount({ email, country, businessName })`**
  - Creates a new connected account using controller settings
  - Platform controls fee collection (connected account pays fees)
  - Stripe handles disputes and losses
  - Connected account gets full dashboard access

- **`createAccountLink({ accountId, refreshUrl, returnUrl })`**
  - Generates temporary onboarding URL for connected accounts
  - Links expire and must be regenerated if needed

- **`getAccountStatus(accountId)`**
  - Fetches current onboarding status from Stripe
  - Returns: charges_enabled, payouts_enabled, details_submitted, requirements

- **`createProduct({ accountId, name, description, priceInCents, currency })`**
  - Creates a product on the connected account (not platform account)
  - Uses `stripeAccount` header to create on connected account

- **`getProducts(accountId, { limit })`**
  - Lists all products for a connected account
  - Uses `stripeAccount` header to fetch from connected account

- **`createCheckoutSession({ accountId, priceId, quantity, applicationFeeAmount, successUrl, cancelUrl, metadata })`**
  - Creates a Stripe Checkout session for purchasing
  - Implements Direct Charge with application fee
  - Returns URL to redirect customer to

- **`getCheckoutSession(accountId, sessionId)`**
  - Retrieves checkout session after payment
  - Used to verify payment status

### Controllers

#### `apps/backend/api/controllers/StripeController.js`

REST endpoints for Stripe operations:

- `GET /noo/stripe/health` - Verify Stripe configuration
- `GET /noo/stripe/checkout/success?session_id=xxx&account_id=xxx` - Handle successful checkout
- `GET /noo/stripe/checkout/cancel` - Handle cancelled checkout
- `POST /noo/stripe/webhook` - Receive Stripe webhook events (TODO: implement signature verification)

### GraphQL Mutations

#### `apps/backend/api/graphql/mutations/stripe.js`

All operations are available via GraphQL:

**Mutations:**
- `createStripeConnectedAccount(groupId, email, businessName, country)`
- `createStripeAccountLink(groupId, accountId, returnUrl, refreshUrl)`
- `createStripeProduct(groupId, accountId, name, description, priceInCents, currency)`
- `createStripeCheckoutSession(groupId, accountId, priceId, quantity, successUrl, cancelUrl, metadata)`

**Queries:**
- `stripeAccountStatus(groupId, accountId)`
- `stripeProducts(groupId, accountId)`

### Routes

Routes are defined in `apps/backend/config/routes.js`:

```javascript
'GET  /noo/stripe/health'            -> StripeController.health
'GET  /noo/stripe/checkout/success'  -> StripeController.checkoutSuccess
'GET  /noo/stripe/checkout/cancel'   -> StripeController.checkoutCancel
'POST /noo/stripe/webhook'           -> StripeController.webhook
```

## Frontend Components

### Group Settings - Paid Content Tab

**Location**: `apps/web/src/routes/GroupSettings/PaidContentTab/`

**Features**:
- Create Stripe Connected Account
- Generate onboarding links
- View onboarding status with visual indicators
- Create products with name, description, and price
- View all products
- Display storefront link

**Access**: Group administrators only (requires `RESP_ADMINISTRATION` responsibility)

**URL**: `/groups/{groupSlug}/settings/paid-content`

### Storefront

**Location**: `apps/web/src/routes/GroupStore/`

**Features**:
- Public-facing product listing
- Product cards with images and descriptions
- Purchase buttons that redirect to Stripe Checkout
- Success page after payment
- Responsive design for mobile and desktop

**Access**: Public (no authentication required for viewing)

**URL**: `/groups/{groupSlug}/store`

**Important Note**: Currently uses account ID in implementation. In production, you should:
1. Store `stripe_account_id` in your Group model
2. Look up account ID from group slug
3. Never expose account IDs in URLs

### Store Files

- `GroupStore.js` - Main storefront component
- `GroupStore.js` exports `GroupStoreSuccess` - Success page component
- `index.js` - Exports for routing

## User Flows

### 1. Group Admin Onboards to Stripe

1. Admin navigates to Group Settings > Paid Content
2. Clicks "Create Stripe Account"
3. System creates connected account via `createStripeConnectedAccount` mutation
4. System automatically generates Account Link
5. Admin is redirected to Stripe to complete onboarding
6. Admin returns to app, status updates automatically
7. Once `chargesEnabled` and `payoutsEnabled` are true, account is ready

### 2. Group Admin Creates Products

1. In Paid Content tab, click "Add Product"
2. Fill in product name, description, price, and currency
3. Click "Create Product"
4. Product is created on the connected account (not platform)
5. Product appears in product list
6. Storefront link is displayed

### 3. Customer Purchases Product

1. Customer visits `/groups/{groupSlug}/store`
2. Browses available products
3. Clicks "Purchase" on a product
4. System creates Checkout Session with application fee
5. Customer is redirected to Stripe Hosted Checkout
6. Customer completes payment on Stripe
7. Customer returns to success page
8. (TODO: Grant access to content/membership)

## Application Fee Calculation

The application fee (platform's revenue) is currently calculated in `createStripeCheckoutSession`:

```javascript
// Example: 10% platform fee
const applicationFeePercentage = 0.10
const applicationFeeAmount = Math.round(price * applicationFeePercentage)
```

**To customize**:
- Modify percentage in `apps/backend/api/graphql/mutations/stripe.js`
- Consider making this configurable per group or product
- Store fee structure in database for flexibility


## TODO STRIPE: Production Checklist

### Critical for Production

1. **Database Integration**
   - [ ] Add `stripe_account_id` column to `groups` table
   - [ ] Update `createStripeConnectedAccount` to save account ID
   - [ ] Update `GroupStore` to load account ID from database
   - [ ] Store onboarding status in database

2. **Webhook Signature Verification**
   - [ ] Implement webhook signature verification in `StripeController.webhook`
   - [ ] Add `STRIPE_WEBHOOK_SECRET` to environment variables
   - [ ] Register webhook endpoint with Stripe: `https://yourdomain.com/noo/stripe/webhook`

3. **Content Access Control**
   - [ ] Implement logic to grant access after successful payment
   - [ ] Link products to tracks or content
   - [ ] Check purchase status before allowing content access
   - [ ] Send confirmation emails after purchase

4. **Error Handling**
   - [ ] Add comprehensive error handling and logging
   - [ ] Set up monitoring for failed payments
   - [ ] Implement retry logic for transient failures
   - [ ] Add user-friendly error messages

5. **Security**
   - [ ] Verify user permissions on all mutations
   - [ ] Implement rate limiting on checkout creation
   - [ ] Validate all input data
   - [ ] Use HTTPS in production (required by Stripe)

### Recommended for Production

6. **Testing**
   - [ ] Test with Stripe test mode thoroughly
   - [ ] Test onboarding flow end-to-end
   - [ ] Test different payment methods
   - [ ] Test webhook events
   - [ ] Test refund scenarios

7. **User Experience**
   - [ ] Add loading states throughout
   - [ ] Implement proper error boundaries
   - [ ] Add success notifications
   - [ ] Create email templates for confirmations
   - [ ] Add transaction history for users

8. **Business Logic**
   - [ ] Configure application fee percentage
   - [ ] Implement refund policies
   - [ ] Add subscription support (if needed)
   - [ ] Implement discount codes (if needed)
   - [ ] Add tax calculation (Stripe Tax)

9. **Compliance**
   - [ ] Add Terms of Service for payments
   - [ ] Add Privacy Policy updates for payment data
   - [ ] Ensure PCI compliance (Stripe handles this)
   - [ ] Add required legal disclaimers

10. **Monitoring & Analytics**
    - [ ] Track conversion rates
    - [ ] Monitor failed payments
    - [ ] Set up alerts for issues
    - [ ] Dashboard for financial metrics

## Testing

### Test Mode Setup

1. Use Stripe test API keys (start with `sk_test_`)
2. Use test card numbers: https://stripe.com/docs/testing#cards
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - 3D Secure: `4000 0025 0000 3155`

### Testing Flow

```bash
# 1. Start backend
cd apps/backend
yarn dev

# 2. Start frontend  
cd apps/web
yarn start

# 3. Test in browser
# - Create a test group
# - Navigate to group settings > payments
# - Create Stripe account
# - Complete onboarding (test mode)
# - Create test products
# - Visit storefront
# - Test checkout with test card
```

## Troubleshooting

### "STRIPE_SECRET_KEY is not set" Error

**Solution**: Add your Stripe secret key to `apps/backend/.env`:
```bash
STRIPE_SECRET_KEY=sk_test_your_key_here
```

### Onboarding Link Expired

**Solution**: Account Links expire after a short time. Click "Complete Onboarding" again to generate a new link.

### Product Not Showing in Storefront

**Causes**:
1. Product marked as inactive
2. Account ID not loaded correctly
3. Product fetch failed

**Solution**: Check browser console for errors, verify account ID is set

### Checkout Session Creation Fails

**Causes**:
1. Invalid price ID
2. Account not fully onboarded
3. Application fee too high (must be less than total)

**Solution**: Verify account status shows charges enabled

## API Examples

### Create Connected Account

```graphql
mutation {
  createStripeConnectedAccount(
    groupId: "123"
    email: "group@example.com"
    businessName: "My Community Group"
    country: "US"
  ) {
    id
    accountId
    success
    message
  }
}
```

### Create Product

```graphql
mutation {
  createStripeProduct(
    groupId: "123"
    accountId: "acct_xxxxx"
    name: "Premium Membership"
    description: "Access to all premium content"
    priceInCents: 2000  # $20.00
    currency: "usd"
  ) {
    productId
    priceId
    success
  }
}
```

### Check Account Status

```graphql
query {
  stripeAccountStatus(
    groupId: "123"
    accountId: "acct_xxxxx"
  ) {
    chargesEnabled
    payoutsEnabled
    detailsSubmitted
    requirements {
      currently_due
      past_due
    }
  }
}
```

## Additional Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)

## Support

For questions or issues with this integration:
1. Check Stripe Dashboard for detailed error messages
2. Review server logs for backend errors
3. Check browser console for frontend errors
4. Consult Stripe documentation for API details

---

**Integration completed on**: October 20, 2025
**Stripe API Version**: 2025-09-30.clover
**Package Version**: stripe@^17.5.0

