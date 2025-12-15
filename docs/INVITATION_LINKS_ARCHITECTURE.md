# Invitation Links Architecture

This document details how the complex join links (Join Link and Email Invites) work in Hylo, covering both backend generation and frontend consumption.

## Overview

There are three ways to invite users to join a group:

| Link Type | URL Pattern | Auth Required | Validation |
|-----------|-------------|---------------|------------|
| **Public Group Link** | `/groups/:groupSlug` | No | None - just goes to about page |
| **Join Link (Access Code)** | `/groups/:groupSlug/join/:accessCode` | Yes | Validates `accessCode` against group |
| **Email Invitation** | `/h/use-invitation?token=:token&email=:email` | Yes | Validates `token` against invitation record |

---

## 1. Join Link (Access Code)

### How It's Generated

**Backend: `apps/backend/api/models/Group.js`**

```javascript
// Access code is a 10-character alphanumeric string
getNewAccessCode: function () {
  const test = code => Group.where({ access_code: code }).count().then(Number)
  const loop = () => {
    const code = randomstring.generate({ length: 10, charset: 'alphanumeric' })
    return test(code).then(count => count ? loop() : code)
  }
  return loop()
}
```

- Generated when a group is created
- Stored in `groups.access_code` column
- Can be regenerated via `regenerateAccessCode` mutation

**Backend: `apps/backend/api/services/Frontend.js`**

```javascript
invitePath: function (group) {
  return `/groups/${getSlug(group)}/join/${group.get('access_code')}`
}
```

**Frontend: `packages/navigation/src/index.js`**

```javascript
export function groupInviteUrl (group) {
  return group.invitePath ? origin() + group.invitePath : ''
}
```

The `invitePath` is exposed via GraphQL on the Group type (only if user has `RESP_ADD_MEMBERS` responsibility).

### How It's Used

**Frontend Route: `apps/web/src/routes/RootRouter/RootRouter.js`**

```javascript
<Route path='/groups/:groupSlug/join/:accessCode/*' element={<JoinGroup />} />
```

**Frontend Component: `apps/web/src/routes/JoinGroup/JoinGroup.js`**

1. Extracts `accessCode` from route params
2. If user is logged in (`signupComplete`):
   - Calls `acceptInvitation({ accessCode })`
   - On success, redirects to group's chat
3. If user is NOT logged in:
   - Calls `checkInvitation({ accessCode })` to validate
   - If valid, stores return path and redirects to `/signup`
   - After signup, user returns to this path and joins

**Backend Validation: `apps/backend/api/services/InvitationService.js`**

```javascript
check: (token, accessCode) => {
  if (accessCode) {
    return Group.queryByAccessCode(accessCode)
      .count()
      .then(count => {
        return {valid: count !== '0'}
      })
  }
  // ...
}
```

```javascript
use (userId, token, accessCode) {
  if (accessCode) {
    return Group.queryByAccessCode(accessCode)
      .fetch()
      .then(group => {
        return GroupMembership.forPair(user, group, { includeInactive: true }).fetch()
          .then(existingMembership => {
            if (existingMembership) {
              // Reactivate if inactive
              return existingMembership.get('active')
                ? existingMembership
                : existingMembership.save({ active: true }, { patch: true })
            }
            // Create new membership
            return user.joinGroup(group, { role: GroupMembership.Role.DEFAULT, fromInvitation: true })
          })
      })
  }
}
```

### Key Behaviors

- **Bypasses approval process**: Users with access code join directly (for Restricted groups)
- **Still shows join form**: New members see agreements and join questions (controlled by `showJoinForm` setting)
- **Reusable**: Same code works for multiple users
- **Can be reset**: Regenerating invalidates the old code

### TODO in Code

```javascript
// TODO STRIPE: We need to think through how invite links will be impacted by paywall
```

---

## 2. Email Invitation (Token)

### How It's Generated

**Backend: `apps/backend/api/models/Invitation.js`**

```javascript
create: function (opts) {
  return new Invitation({
    invited_by_id: opts.userId,
    group_id: opts.groupId,
    email: opts.email.toLowerCase(),
    tag_id: opts.tagId,
    role: GroupMembership.Role[opts.moderator ? 'MODERATOR' : 'DEFAULT'],
    token: uuidv4(),  // <-- UUID token
    created_at: new Date(),
    subject: opts.subject,
    message: opts.message
  }).save()
}
```

- Token is a UUID (v4)
- Stored in `group_invites` table
- Tied to a specific email address
- Can be marked as used (`used_by_id`) or expired (`expired_by_id`)

**Email URL: `apps/backend/api/services/Frontend.js`**

```javascript
useInvitation: function (token, email) {
  return url('/h/use-invitation?token=%s&email=%s', token, encodeURIComponent(email))
}
```

**Email Sending: `apps/backend/api/models/Invitation.js`**

```javascript
send: function () {
  return this.ensureLoad(['creator', 'group', 'tag'])
  .then(() => {
    const data = {
      // ... email template data
      invite_link: Frontend.Route.useInvitation(this.get('token'), email),
    }
    return Email.sendInvitation(email, data)
  })
}
```

### How It's Used

**Frontend Routes:**

```javascript
// Authenticated users
<Route path='h/use-invitation' element={<JoinGroup />} />

// Non-authenticated users  
<Route path='h/use-invitation' element={<JoinGroup />} />
```

Both routes use the same `JoinGroup` component.

**Frontend Component: `apps/web/src/routes/JoinGroup/JoinGroup.js`**

1. Extracts `token` from query params
2. Same flow as access code (check → signup if needed → use)

**Backend Validation: `apps/backend/api/services/InvitationService.js`**

```javascript
check: (token, accessCode) => {
  if (token) {
    return Invitation.query()
      .where({ token, used_by_id: null, expired_by_id: null })
      .count()
      .then(result => {
        return { valid: result[0].count !== '0' }
      })
  }
}
```

```javascript
use (userId, token, accessCode) {
  if (token) {
    return Invitation.where({token}).fetch()
    .then(invitation => {
      if (!invitation) throw new GraphQLError('not found')
      if (invitation.isExpired()) throw new GraphQLError('expired')
      return invitation.use(userId)
    })
  }
}
```

**Invitation.use(): `apps/backend/api/models/Invitation.js`**

```javascript
async use (userId, { transacting } = {}) {
  const user = await User.find(userId, { transacting })
  const group = await this.group().fetch({ transacting })
  const role = Number(this.get('role'))
  
  // Get existing membership or create new one
  const membership =
    await GroupMembership.forPair(user, group).fetch({ transacting }) ||
    await user.joinGroup(group, { role, fromInvitation: true, transacting })

  // Mark invitation as used
  if (!this.isUsed()) {
    await this.save({ used_by_id: userId, used_at: new Date() }, { patch: true, transacting })
  }

  return membership
}
```

### Key Behaviors

- **One-time use**: Token is marked as used after first use
- **Can be expired**: Admin can manually expire invitations
- **Can be resent**: Resending uses the same token
- **Auto-resend**: System resends after 4 and 9 days if unused
- **Email-specific**: Token is tied to the invited email (but not strictly enforced on use)
- **Role assignment**: Can invite as moderator or regular member

### Pending Invites Management

The `InviteSettingsTab` shows pending invites with options to:
- **Resend**: Sends the same invitation again
- **Expire**: Marks the invitation as expired
- **Resend All**: Resends all pending invitations

---

## Database Schema

### `groups` table (relevant columns)

| Column | Type | Description |
|--------|------|-------------|
| `access_code` | string | 10-char alphanumeric code for join links |
| `slug` | string | URL-friendly group identifier |

### `group_invites` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key |
| `token` | uuid | Unique invitation token |
| `email` | string | Invited email address |
| `group_id` | integer | Target group |
| `invited_by_id` | integer | User who created invite |
| `used_by_id` | integer | User who used invite (null if unused) |
| `expired_by_id` | integer | User who expired invite (null if active) |
| `role` | integer | Role to assign (0=default, 1=moderator) |
| `message` | text | Custom invitation message |
| `subject` | string | Email subject |
| `sent_count` | integer | Number of times email was sent |
| `last_sent_at` | timestamp | Last email send time |
| `created_at` | timestamp | Creation time |
| `used_at` | timestamp | When invitation was used |
| `expired_at` | timestamp | When invitation was expired |

---

## GraphQL API

### Queries

```graphql
# Check if an invitation is valid
checkInvitation(invitationToken: String, accessCode: String): CheckInvitationResult

type CheckInvitationResult {
  valid: Boolean
}
```

### Mutations

```graphql
# Use an invitation to join a group
useInvitation(invitationToken: String, accessCode: String): InvitationUseResult

type InvitationUseResult {
  membership: Membership
  error: String
}

# Create email invitations
createInvitation(groupId: ID, data: InviteInput): CreatedInvitations

input InviteInput {
  emails: [String]
  message: String
  isModerator: Boolean
}

# Regenerate group access code
regenerateAccessCode(groupId: ID): Group

# Expire an invitation
expireInvitation(invitationId: ID): GenericResult

# Resend an invitation
resendInvitation(invitationId: ID): GenericResult

# Resend all pending invitations
reinviteAll(groupId: ID): GenericResult
```

---

## Current Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        JOIN LINK FLOW                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Admin clicks "Reset Link" in Group Settings > Invite                │
│                          │                                           │
│                          ▼                                           │
│  regenerateAccessCode() → generates new 10-char code                 │
│                          │                                           │
│                          ▼                                           │
│  invitePath = /groups/:slug/join/:accessCode                         │
│                          │                                           │
│                          ▼                                           │
│  Admin copies & shares link                                          │
│                          │                                           │
│                          ▼                                           │
│  User clicks link → /groups/:slug/join/:accessCode                   │
│                          │                                           │
│              ┌───────────┴───────────┐                               │
│              │                       │                               │
│              ▼                       ▼                               │
│        [Logged In]            [Not Logged In]                        │
│              │                       │                               │
│              ▼                       ▼                               │
│     acceptInvitation()        checkInvitation()                      │
│              │                       │                               │
│              ▼                       ▼                               │
│     Creates membership         Store returnPath                      │
│              │                       │                               │
│              ▼                       ▼                               │
│     Redirect to group         Redirect to /signup                    │
│                                      │                               │
│                                      ▼                               │
│                              After signup, return                    │
│                              to stored path                          │
│                                      │                               │
│                                      ▼                               │
│                              acceptInvitation()                      │
│                                      │                               │
│                                      ▼                               │
│                              Redirect to group                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      EMAIL INVITATION FLOW                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Admin enters emails in Group Settings > Invite                      │
│                          │                                           │
│                          ▼                                           │
│  createInvitation() → creates Invitation with UUID token             │
│                          │                                           │
│                          ▼                                           │
│  Queue sends email with link:                                        │
│  /h/use-invitation?token=:uuid&email=:email                          │
│                          │                                           │
│                          ▼                                           │
│  User receives email & clicks link                                   │
│                          │                                           │
│              ┌───────────┴───────────┐                               │
│              │                       │                               │
│              ▼                       ▼                               │
│        [Logged In]            [Not Logged In]                        │
│              │                       │                               │
│              ▼                       ▼                               │
│     acceptInvitation()        checkInvitation()                      │
│              │                       │                               │
│              ▼                       ▼                               │
│     invitation.use()          Validate token exists                  │
│     marks as used                    │                               │
│              │                       ▼                               │
│              ▼               Redirect to /signup                     │
│     Redirect to group                │                               │
│                                      ▼                               │
│                              After signup, return                    │
│                                      │                               │
│                                      ▼                               │
│                              invitation.use()                        │
│                              marks as used                           │
│                                      │                               │
│                                      ▼                               │
│                              Redirect to group                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

### Backend

| File | Purpose |
|------|---------|
| `apps/backend/api/models/Group.js` | `getNewAccessCode()`, `queryByAccessCode()` |
| `apps/backend/api/models/Invitation.js` | Invitation model, `create()`, `use()`, `send()` |
| `apps/backend/api/services/InvitationService.js` | `check()`, `use()`, `create()` |
| `apps/backend/api/services/Frontend.js` | URL generation: `invitePath()`, `useInvitation()` |
| `apps/backend/api/graphql/mutations/invitation.js` | GraphQL mutations |
| `apps/backend/api/graphql/mutations/group.js` | `regenerateAccessCode()` |

### Frontend

| File | Purpose |
|------|---------|
| `apps/web/src/routes/JoinGroup/JoinGroup.js` | Handles both invitation types |
| `apps/web/src/routes/GroupSettings/InviteSettingsTab/` | Admin UI for invitations |
| `apps/web/src/store/actions/acceptInvitation.js` | `useInvitation` mutation |
| `apps/web/src/store/actions/checkInvitation.js` | `checkInvitation` query |
| `packages/navigation/src/index.js` | `groupInviteUrl()` |

---

## Known Issues / TODOs

1. **Paywall Integration**: Both invitation flows have TODO comments about paywall:
   ```javascript
   // TODO STRIPE: We need to think through how invite links will be impacted by paywall
   ```

2. **Email Enforcement**: Email invitations store the invited email but don't strictly enforce that the user signing up uses that email.

3. **Join Form Display**: After using an invitation, users are still shown the join form (`showJoinForm: true`) for agreements and questions, but this happens after membership is already created.

---

## Planned Refactoring: New Invitation Flow

The current flow auto-joins users when they click invitation links, before they can review group details, agreements, or offerings. This section documents the planned changes to fix this.

### New Flow Summary

1. **Invitation links redirect to `/about` page** (not auto-join)
2. **Hash/token grants visibility** to restricted/hidden groups + "pre-approval" for joining
3. **User reviews group info**, accepts agreements, answers questions
4. **THEN clicks join** (or pay for paywall groups)
5. **Email invites validate** that logged-in user's email matches invitation email

### New Architecture: JoinSection Component

```
PaywallOfferingsSection (for paywall groups)
├── Offering cards with details
└── JoinSection ← NEW: nested inside for paywall groups
    ├── Agreements checkboxes (required)
    ├── Join questions (optional or required based on settings)
    └── Action button (Join / Purchase)

JoinSection (standalone for non-paywall groups)  
├── Suggested skills
├── Prerequisites check
├── Agreements checkboxes (required)
├── Join questions (optional or required based on settings)
└── Action button (Join / Request to Join)
```

### Button Behavior

The join/purchase button operates in two modes:

1. **No blocking conditions** → Button directly triggers join/purchase
2. **Has blocking conditions** → Button acts as toggle to reveal barriers UI:
   - Shows agreements that must be accepted
   - Shows join questions (optional or required)
   - Once all required items completed, action buttons become enabled

### New Flow Diagrams

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NEW JOIN LINK FLOW                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User clicks link → /groups/:slug/join/:accessCode                   │
│                          │                                           │
│              ┌───────────┴───────────┐                               │
│              │                       │                               │
│              ▼                       ▼                               │
│        [Logged In]            [Not Logged In]                        │
│              │                       │                               │
│              ▼                       ▼                               │
│     checkInvitation()         checkInvitation()                      │
│     (validate code)           (validate code)                        │
│              │                       │                               │
│              ▼                       ▼                               │
│     Redirect to:              Store returnPath as:                   │
│     /groups/:slug/about       /groups/:slug/about?accessCode=x       │
│     ?accessCode=x                    │                               │
│              │                       ▼                               │
│              │               Redirect to /signup                     │
│              │                       │                               │
│              │                       ▼                               │
│              │               After signup, return                    │
│              │               to stored path                          │
│              │                       │                               │
│              └───────────┬───────────┘                               │
│                          │                                           │
│                          ▼                                           │
│              /groups/:slug/about?accessCode=x                        │
│                          │                                           │
│                          ▼                                           │
│              accessCode grants visibility                            │
│              (even for restricted/hidden groups)                     │
│                          │                                           │
│                          ▼                                           │
│              User sees full group details:                           │
│              - Purpose, description                                  │
│              - Stewards                                              │
│              - Privacy settings                                      │
│              - Agreements                                            │
│              - Offerings (if paywall)                                │
│                          │                                           │
│                          ▼                                           │
│              JoinSection with barriers:                              │
│              [✓] Accept Agreement 1                                  │
│              [✓] Accept Agreement 2                                  │
│              [Answer join question...]                               │
│                          │                                           │
│                          ▼                                           │
│              ┌───────────┴───────────┐                               │
│              │                       │                               │
│              ▼                       ▼                               │
│        [Non-Paywall]           [Paywall]                             │
│              │                       │                               │
│              ▼                       ▼                               │
│     [Join Group] button      [Purchase] button                       │
│     (enabled after           (enabled after                          │
│      barriers complete)       barriers complete)                     │
│              │                       │                               │
│              ▼                       ▼                               │
│     useInvitation()          Stripe checkout                         │
│     with accessCode          (webhook creates membership)            │
│              │                       │                               │
│              ▼                       ▼                               │
│     Redirect to group        Return to group after payment           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    NEW EMAIL INVITATION FLOW                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User clicks link → /h/use-invitation?token=x&email=y                │
│                          │                                           │
│              ┌───────────┴───────────┐                               │
│              │                       │                               │
│              ▼                       ▼                               │
│        [Logged In]            [Not Logged In]                        │
│              │                       │                               │
│              ▼                       ▼                               │
│     Check: does user         checkInvitation()                       │
│     email match invite?      (validate token)                        │
│              │                       │                               │
│      ┌───────┴───────┐               ▼                               │
│      │               │       Store returnPath as:                    │
│      ▼               ▼       /groups/:slug/about?token=x&email=y     │
│   [Match]      [No Match]            │                               │
│      │               │               ▼                               │
│      │               ▼       Redirect to /signup                     │
│      │        Show error:            │                               │
│      │        "This invite           ▼                               │
│      │         is not for     After signup, return                   │
│      │         your account"  to stored path                         │
│      │        (hide group            │                               │
│      │         details)              │                               │
│      │                               │                               │
│      └───────────┬───────────────────┘                               │
│                  │                                                   │
│                  ▼                                                   │
│      Redirect to:                                                    │
│      /groups/:slug/about?token=x&email=y                             │
│                  │                                                   │
│                  ▼                                                   │
│      Validate email match again                                      │
│      (user may have logged into different account)                   │
│                  │                                                   │
│          ┌───────┴───────┐                                           │
│          │               │                                           │
│          ▼               ▼                                           │
│       [Match]      [No Match]                                        │
│          │               │                                           │
│          │               ▼                                           │
│          │        Show error message                                 │
│          │        Hide group details                                 │
│          │                                                           │
│          ▼                                                           │
│      token grants visibility                                         │
│      (even for restricted/hidden groups)                             │
│          │                                                           │
│          ▼                                                           │
│      [Same as Join Link flow from here...]                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation TODO List

### Phase 1: Redirect Flow Changes

| # | Task | Description | Files |
|---|------|-------------|-------|
| 1 | **Redirect to /about** | Change `JoinGroup` component to redirect to `/groups/:slug/about` instead of auto-joining | `apps/web/src/routes/JoinGroup/JoinGroup.js` |
| 2 | **URL params** | Pass `accessCode` or `token`+`email` as query params to `/about` page | `apps/web/src/routes/JoinGroup/JoinGroup.js` |

### Phase 2: Visibility for Restricted/Hidden Groups

| # | Task | Description | Files |
|---|------|-------------|-------|
| 3 | **Backend bypass** | Modify backend to allow fetching group details for restricted/hidden groups when valid hash/token is provided | `apps/backend/api/graphql/` |
| 4 | **Frontend visibility** | Update `PublicGroupDetail` and `GroupDetail` to pass hash/token when fetching group data | `apps/web/src/routes/PublicLayoutRouter/PublicGroupDetail.jsx`, `apps/web/src/routes/GroupDetail/GroupDetail.js` |

### Phase 3: JoinSection Refactoring

| # | Task | Description | Files |
|---|------|-------------|-------|
| 5 | **Agreements in JoinSection** | Move agreements display inline into `JoinSection` with checkboxes for acceptance | `apps/web/src/routes/GroupDetail/JoinSection.jsx` |
| 6 | **Toggle behavior** | Add toggle behavior: if blocking conditions exist, first button click reveals barriers UI | `apps/web/src/routes/GroupDetail/JoinSection.jsx` |
| 7 | **Button gating** | Disable join/purchase buttons until required agreements are accepted and required questions answered | `apps/web/src/routes/GroupDetail/JoinSection.jsx` |
| 8 | **Nest in PaywallOfferingsSection** | Render `JoinSection` as a child of `PaywallOfferingsSection` for paywall groups | `apps/web/src/routes/GroupDetail/PaywallOfferingsSection.jsx`, `apps/web/src/routes/GroupDetail/JoinSection.jsx` |

### Phase 4: Pre-approval & Validation

| # | Task | Description | Files |
|---|------|-------------|-------|
| 9 | **Pre-approval flow** | Update `JoinSection` to detect accessCode/token in URL and use it for pre-approved join (bypasses request flow for Restricted groups) | `apps/web/src/routes/GroupDetail/JoinSection.jsx` |
| 10 | **Email mismatch** | For email invites, validate logged-in user's email matches invitation email; if not, show error and hide group details | `apps/web/src/routes/GroupDetail/GroupDetail.js` |
| 11 | **Signup return** | Non-auth users redirected to signup with `returnTo=/groups/:slug/about?accessCode=x` or `?token=x&email=y` | `apps/web/src/routes/JoinGroup/JoinGroup.js` |
| 12 | **Mutation review** | Review `useInvitation` mutation - may need to accept agreements consent timestamp | `apps/backend/api/graphql/mutations/invitation.js`, `apps/web/src/store/actions/acceptInvitation.js` |

---

## Component Props Changes

### JoinSection (updated)

```javascript
// Current props
{ addSkill, currentUser, fullPage, group, groupsWithPendingRequests, 
  joinGroup, requestToJoinGroup, removeSkill, routeParams, t }

// New props needed
{ 
  // Existing
  addSkill, currentUser, fullPage, group, groupsWithPendingRequests, 
  joinGroup, requestToJoinGroup, removeSkill, routeParams, t,
  
  // New
  accessCode,           // From URL params - enables pre-approved join
  invitationToken,      // From URL params - enables pre-approved join
  isNestedInPaywall,    // If true, renders differently (no wrapper styling)
  onPurchase,           // Callback for purchase action (passed from PaywallOfferingsSection)
  selectedOffering,     // Which offering is being purchased (if paywall)
}
```

### PaywallOfferingsSection (updated)

```javascript
// Current props
{ group }

// New props needed
{
  group,
  accessCode,           // Pass through to JoinSection
  invitationToken,      // Pass through to JoinSection
  currentUser,          // Needed for JoinSection
}
```

---

## State Management for Barriers

```javascript
// In JoinSection component
const [barriersExpanded, setBarriersExpanded] = useState(false)
const [agreementsAccepted, setAgreementsAccepted] = useState({})  // { agreementId: boolean }
const [questionAnswers, setQuestionAnswers] = useState([])

// Computed values
const hasAgreements = group.agreements?.length > 0
const hasRequiredQuestions = group.settings.askJoinQuestions && group.joinQuestions?.length > 0
const hasBarriers = hasAgreements || hasRequiredQuestions

const allAgreementsAccepted = !hasAgreements || 
  group.agreements.every(a => agreementsAccepted[a.id])
  
const allRequiredQuestionsAnswered = !hasRequiredQuestions ||
  questionAnswers.every(q => q.answer?.trim())

const canProceed = allAgreementsAccepted && allRequiredQuestionsAnswered
```

---

---

## Future Work

| # | Task | Description |
|---|------|-------------|
| 13 | **Invite links with roles** | Figure out product needs for adding invite links that also bestow group roles. This will likely require its own detailed TODO list covering: role selection UI in invite settings, storing role assignment in invitation/access code, applying roles on join, etc. |

---

## Manual Testing Checklist

This section provides test scenarios to verify the invitation link flows work correctly across different group configurations.

### Legend

- **Accessibility**: Open (O), Restricted (R), Closed (C)
- **Visibility**: Public (Pub), Protected (Pro), Hidden (Hid)
- **Invitation Type**: Join Link (JL), Email Invite (EI), None (-)
- **Auth State**: Logged In (LI), Not Logged In (NLI)
- **Paywall**: Yes (PW), No (-)

---

### Test Matrix: Non-Paywall Groups

| # | Visibility | Accessibility | Invitation | Auth | Expected Behavior |
|---|------------|---------------|------------|------|-------------------|
| **Public Groups** |
| 1 | Pub | O | - | LI | See about page, "Join" button works directly |
| 2 | Pub | O | - | NLI | See about page, prompted to login/signup to join |
| 3 | Pub | O | JL | LI | Redirect to about page with `?accessCode=x`, "Join" button works |
| 4 | Pub | O | JL | NLI | Redirect to signup, return to about page, "Join" button works |
| 5 | Pub | R | - | LI | See about page, "Request Membership" button |
| 6 | Pub | R | - | NLI | See about page, prompted to login/signup, then "Request Membership" |
| 7 | Pub | R | JL | LI | Redirect to about page, **"Join" button** (pre-approved) |
| 8 | Pub | R | JL | NLI | Redirect to signup, return to about page, **"Join" button** (pre-approved) |
| 9 | Pub | R | EI | LI | Redirect to about page, validate email matches, **"Join" button** |
| 10 | Pub | R | EI | LI (wrong email) | Show error "This invite is not for your account" |
| **Protected/Hidden Groups** |
| 11 | Pro/Hid | O | - | LI | Cannot see group (404 or access denied) |
| 12 | Pro/Hid | O | - | NLI | Cannot see group, redirected to login |
| 13 | Pro/Hid | O | JL | LI | **Can see about page** (accessCode grants visibility), "Join" works |
| 14 | Pro/Hid | O | JL | NLI | Redirect to signup, return to about page, "Join" works |
| 15 | Pro/Hid | R | JL | LI | **Can see about page**, **"Join" button** (pre-approved) |
| 16 | Pro/Hid | R | EI | LI | **Can see about page** (if email matches), **"Join" button** |
| 17 | Pro/Hid | R | EI | LI (wrong email) | Show error, **hide group details** |

---

### Test Matrix: Paywall Groups

| # | Visibility | Accessibility | Invitation | Auth | Expected Behavior |
|---|------------|---------------|------------|------|-------------------|
| 18 | Pub | O | - | LI | See about page, PaywallOfferingsSection with offerings |
| 19 | Pub | O | - | NLI | See about page, prompted to login before purchase |
| 20 | Pub | O | JL | LI | Redirect to about page, see offerings, purchase flow works |
| 21 | Pub | R | JL | LI | Redirect to about page, see offerings (pre-approved visibility) |
| 22 | Pro/Hid | O | JL | LI | **Can see about page + offerings** (accessCode grants visibility) |
| 23 | Pro/Hid | R | JL | LI | **Can see about page + offerings** (pre-approved) |

---

### Test Matrix: Barriers (Agreements & Questions)

| # | Has Agreements | Has Questions | Expected Behavior |
|---|----------------|---------------|-------------------|
| 24 | No | No | Join button works immediately |
| 25 | Yes | No | First click reveals agreements, must check all, then join enabled |
| 26 | No | Yes | First click reveals questions, must answer all, then join enabled |
| 27 | Yes | Yes | First click reveals both, must complete all, then join enabled |

---

### Test Matrix: Paywall + Barriers

| # | Has Agreements | Has Questions | Expected Behavior |
|---|----------------|---------------|-------------------|
| 28 | No | No | Purchase button works immediately → Stripe checkout |
| 29 | Yes | No | First purchase click reveals agreements, must check all, then enabled |
| 30 | No | Yes | First purchase click reveals questions, must answer all, then enabled |
| 31 | Yes | Yes | First click reveals both, must complete all, then purchase enabled |

---

### Detailed Test Cases

#### TC-1: Join Link to Public Open Group (Logged In)

**Preconditions:**
- Group: Public visibility, Open accessibility, no paywall
- User: Logged in, not a member

**Steps:**
1. Navigate to `/groups/:slug/join/:accessCode`
2. Observe redirect to `/groups/:slug/about?accessCode=:accessCode`
3. Verify group details are visible
4. Click "Join" button
5. If group has barriers, verify they expand
6. Complete barriers and click again
7. Verify membership created and redirected to group

**Expected:** User joins group successfully

---

#### TC-2: Join Link to Protected Restricted Group (Not Logged In)

**Preconditions:**
- Group: Protected visibility, Restricted accessibility, no paywall
- User: Not logged in

**Steps:**
1. Navigate to `/groups/:slug/join/:accessCode`
2. Observe redirect to `/signup` with returnTo set
3. Complete signup/login
4. Observe redirect to `/groups/:slug/about?accessCode=:accessCode`
5. Verify group details are visible (despite Protected visibility)
6. Verify "Join" button shown (not "Request Membership" - pre-approved)
7. Complete barriers if any
8. Click "Join" button
9. Verify membership created

**Expected:** User joins directly without approval wait

---

#### TC-3: Email Invite - Email Mismatch

**Preconditions:**
- Email invitation sent to `invited@example.com`
- User logged in as `different@example.com`

**Steps:**
1. Navigate to `/h/use-invitation?token=:token&email=invited@example.com`
2. Observe redirect to `/groups/:slug/about?token=:token&email=invited@example.com`
3. Verify error message shown about email mismatch
4. Verify group details are hidden

**Expected:** Access denied with clear error message

---

#### TC-4: Paywall Group with Barriers

**Preconditions:**
- Group: Public, Open, has paywall, has some agreements, has some join questions
- User: Logged in, not a member

**Steps:**
1. Navigate to group about page
2. Verify PaywallOfferingsSection is shown with offerings
3. Click "Purchase Access" on an offering
4. Verify barriers (agreements + question) are revealed
5. Verify purchase button is disabled
6. Check first agreement checkbox
7. Verify purchase button still disabled
8. Check second agreement checkbox
9. Verify purchase button still disabled
10. Fill in the join question answer
11. Verify purchase button becomes enabled
12. Click "Purchase Access"
13. Verify redirect to Stripe checkout

**Expected:** Cannot purchase until all barriers completed

---

### Edge Cases to Test

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| E1 | Invalid/non-existent access code | Show error, don't reveal group |
| E2 | Access code for different group than URL slug | Should fail validation |
| E3 | User already a member clicks join link | Should redirect to group (no re-join) |
| E4 | Join link to Closed group | Should not allow join (Closed = invite by admin only) |

---

## Potential Improvements to Consider

1. **Consolidate flows**: Both link types end up at the same `JoinGroup` component
2. **Better paywall integration**: Define clear behavior for paid groups
3. **Expiration for access codes**: Currently access codes never expire unless regenerated
4. **Rate limiting**: No apparent rate limiting on invitation creation or use
5. **Audit logging**: Track invitation usage for security

