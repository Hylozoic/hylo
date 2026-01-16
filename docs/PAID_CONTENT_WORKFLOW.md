# Paid Content Workflow Guide

This document provides a comprehensive walkthrough of the entire paid content workflow, from admin setup to user purchase completion.

## Table of Contents

1. [Overview](#overview)
2. [Admin Setup: Connecting Group to Stripe](#admin-setup-connecting-group-to-stripe)
3. [Admin Setup: Defining Offerings](#admin-setup-defining-offerings)
4. [User Experience: Exploring and Purchasing](#user-experience-exploring-and-purchasing)
5. [Stripe Checkout Flow](#stripe-checkout-flow)
6. [Post-Purchase Verification](#post-purchase-verification)
7. [Content Access Creation](#content-access-creation)
8. [Technical Implementation Details](#technical-implementation-details)

## Overview

The paid content system enables groups to:
- Connect their group to Stripe for payment processing
- Define and manage content offerings
- Automatically grant access upon successful payment
- Manage both paid and admin-granted access

## Admin Setup: Connecting Group to Stripe

### User Steps
1. **Navigate to Group Settings**
   - Admin goes to `/groups/{groupSlug}/settings/paid-content`
   - Only group administrators can access this section

2. **Connect Stripe Account**
   - Click "Connect to Stripe" button
   - Choose connection method:
     - **Create New Account**: Fill out business information (email, business name, country)
     - **Use Existing Account**: Provide existing Stripe account ID
   - System either creates new account or connects existing one
   - Account requires completion of Stripe's onboarding process

3. **Complete Stripe Onboarding**
   - System generates Account Link URL
   - Admin is redirected to Stripe onboarding flow
   - **Required verification steps:**
     - Business verification and tax information
     - Bank account details for payouts
     - Identity verification (KYC - Know Your Customer)
     - Business type and industry classification
     - Additional documentation as required by Stripe
   - Returns to group settings page after completion

4. **Verify Account Status**
   - System checks Stripe account status
   - Displays current capabilities:
     - `charges_enabled`: Can accept payments (false until verification complete)
     - `payouts_enabled`: Can receive payouts (false until bank details added)
     - `details_submitted`: Onboarding information submitted (true when complete)
   - Shows any pending requirements or verification issues
   - **Product publishing is disabled** until account is fully verified
   - Account can be connected even if not fully verified

### Functions Invoked
```javascript
// GraphQL Mutation (supports both new and existing accounts)
createStripeConnectedAccount(groupId, email, businessName, country, existingAccountId)

// Backend Service - New Account Creation
StripeService.createConnectedAccount({ 
  email, 
  country, 
  businessName, 
  groupId
})

// Backend Service - Existing Account Connection
StripeService.connectExistingAccount({
  accountId: existingAccountId,
  groupId
})

// Account Link Creation
createStripeAccountLink(groupId, accountId, returnUrl, refreshUrl)
```

### UI Flow
```
Group Settings → Paid Content Tab → Connect to Stripe → 
Stripe Onboarding → Return to Settings → Account Status Display
```

## Admin Setup: Defining Offerings

### User Steps
1. **Access Product Management**
   - Admin navigates to product management section in paid content (group settings)
   - Views existing products (if any)

2. **Create New Product**
   - Click "Create Product" button
   - **Verification Check**: System verifies Stripe account is ready
   - If account not verified: Shows warning and disables product creation
   - If account verified: Allows product creation
   - Fill out product details:
     - **Name**: e.g., "Premium Membership"
     - **Description**: Detailed description of what's included
     - **Price**: Amount in cents (e.g., 2000 = $20.00)
     - **Currency**: Defaults to USD
     - **Content Access Definition**: selects what tracks or roles are associated with the product, if any

3. **Define Content Access**
   The `contentAccess` field uses a flexible JSON structure:
   ```json
   {
     "123": {  // Group ID
       "trackIds": [456, 789],  // Optional: specific tracks
       "roleIds": [1, 2]        // Optional: specific roles
     }
   }
   ```

4. **Handle Multiple Durations**
   - For the same offering with different durations, the admin must create separate products
   - Example: "Premium Monthly" vs "Premium Annual"
   - Use product cloning feature to easily create variations
   - Each duration = separate Stripe product with different pricing

5. **Product Cloning Workflow**
   - Select existing product
   - Click "Clone Product" 
   - Modify duration, pricing, and content access as needed
   - System creates new Stripe product automatically

### Functions Invoked
```javascript
// GraphQL Mutation
createStripeProduct(input: StripeProductInput!)

// Backend Service
StripeService.createProduct({
  accountId,
  name,
  description, 
  priceInCents,
  currency
})

// Database Operations
StripeProduct.create({
  group_id,
  stripe_product_id,
  stripe_price_id,
  name,
  description,
  price_in_cents,
  currency,
  content_access,
  renewal_policy,
  duration,
  active: true
})
```

### UI Flow
```
Product Management → Create Product → Fill Details → 
Define Content Access → Clone for Variations → Product List
```

## User Experience: Exploring and Purchasing

### User Steps
1. **Discover Offerings**
   - User visits group page or dedicated group storefront
   - Views available products/offerings
   - Reads descriptions and pricing

2. **Select Product**
   - Clicks on desired product
   - Reviews what's included in the offering
   - Sees pricing and duration information

3. **Initiate Purchase**
   - Clicks "Purchase" or "Buy Now" button
   - System creates Stripe Checkout Session
   - User is redirected to Stripe-hosted checkout page

### Functions Invoked
```javascript
// GraphQL Mutation
createStripeCheckoutSession(
  groupId,
  accountId, 
  priceId,
  quantity,
  successUrl,
  cancelUrl,
  metadata
)

// Backend Service
StripeService.createCheckoutSession({
  accountId,
  priceId,
  quantity,
  applicationFeeAmount,
  successUrl,
  cancelUrl,
  metadata
})
```

### UI Flow
```
Group Storefront → Product Details → Purchase Button → 
Stripe Checkout Session Creation → Redirect to Stripe
```

## Stripe Checkout Flow

### User Experience on Stripe
1. **Stripe Checkout Page**
   - User sees Stripe-hosted checkout form
   - Enters payment information (card details, billing info)
   - Reviews order summary and pricing
   - Completes payment

2. **Payment Processing**
   - Stripe processes the payment
   - Handles fraud detection and security
   - Applies application fees automatically

3. **Redirect Back to Platform**
   - Upon successful payment, user is redirected to `successUrl`
   - Upon cancellation, user is redirected to `cancelUrl`
   - URLs include session ID for tracking

### Technical Details
- **Checkout Session**: Created with application fee percentage
- **Metadata**: Includes groupId, userId, priceAmount, currency
- **Session ID**: Stored in payment intent metadata for webhook correlation
- **Application Fee**: Automatically calculated and applied

## Post-Purchase Verification

### User Experience
1. **Purchase Verification Page**
   - User lands on `/purchase-verification?session_id={CHECKOUT_SESSION_ID}`
   - Page displays:
     - "Purchase verification in progress..."
     - "Please wait while we confirm your payment"
     - "You will receive an email confirmation shortly"
     - "Check your email for access details"

2. **Email Confirmation**
   - User receives confirmation email
   - Email includes:
     - Purchase confirmation details
     - Links to access the content they purchased
     - Instructions for accessing their new content
     - Support contact information

### Functions Invoked
```javascript
// Webhook Handler
StripeController.webhook(event)

// Payment Intent Success Handler
handlePaymentIntentSucceeded(event)

// Content Access Creation
StripeProduct.generateContentAccessRecords({
  userId,
  sessionId,
  paymentIntentId,
  expiresAt,
  metadata
})
```

### UI Flow
```
Stripe Checkout → Payment Success → Redirect to Verification Page → 
Email Confirmation → Access Content
```

## Content Access Creation

### Automatic Process
1. **Webhook Trigger**
   - Stripe sends `payment_intent.succeeded` webhook
   - System verifies webhook signature
   - Extracts session and payment intent data

2. **Product Lookup**
   - System finds the StripeProduct by session metadata
   - Retrieves product's `content_access` definition
   - Calculates expiration date based on product duration

3. **Access Record Creation**
   - System calls `StripeProduct.generateContentAccessRecords()`
   - Creates multiple `ContentAccess` records based on product definition:
     - Group-level access (if no specific tracks/roles)
     - Track-specific access (if trackIds specified)
     - Role-based access (if roleIds specified)

4. **Database Triggers**
   - Triggers automatically update related tables:
     - `group_memberships.expires_at`
     - `tracks_users.expires_at` 
     - `group_memberships_group_roles.expires_at`

### Functions Invoked
```javascript
// Webhook Processing
StripeController.handlePaymentIntentSucceeded(event)

// Product Lookup
StripeProduct.findByStripeId(stripeProductId)

// Access Record Generation
product.generateContentAccessRecords({
  userId,
  sessionId,
  paymentIntentId,
  expiresAt,
  metadata: { source: 'webhook' }
})

// Individual Record Creation
ContentAccess.recordPurchase({
  userId,
  groupId,
  productId,
  trackId,
  roleId,
  sessionId,
  paymentIntentId,
  expiresAt,
  metadata
})
```
