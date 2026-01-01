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

### Detailed Test Cases for Manual Testing

These test cases are designed for testers using the staging environment. Each test includes setup instructions, step-by-step actions, and expected results.

**Before You Begin:**
- You'll need access to the staging environment
- Create multiple test email accounts (e.g., using Gmail's + trick: `yourname+test1@gmail.com`, `yourname+test2@gmail.com`)
- Keep a virtual notepad open to save any join links or invitation links you create
- use different browsers and/or incognito sessions to be logged in as multiple users at the same time (for example, steward of group and non-member user)

---

#### TC-1: Join a Public Open Group with Barriers (No Special Link Needed)

**Goal:** Verify that a logged-in user can join a public open group by simply navigating to it, and must complete any agreements/questions before joining.

**Setup (as Group Admin):**
1. Log into the staging app with your admin account
2. Go to a group you manage (or create a new test group)
3. Go to **Group Settings** → **Privacy & Access**
4. Set **Visibility** to "Public" and **Accessibility** to "Open"
5. Make sure **Paywall** is turned OFF
6. Go to **Group Settings** → **Agreements** tab
7. Create at least 1 agreement (e.g., "Community Guidelines" - add some text describing the rules)
8. Go to **Group Settings** → **Join Questions** tab
9. Create at least 1 required question (e.g., "How did you hear about us?")
10. Note the group's name or URL slug (e.g., if the URL is `https://staging.hylo.com/groups/my-test-group`, the slug is `my-test-group`)

**Test Steps (as Test User):**
1. In a different browser or incognito window, log in with a test account that is NOT a member of the group
2. Navigate directly to the group's About page by typing the URL: `https://staging.hylo.com/groups/[group-slug]/about`
   - Or search for the group using the search feature
3. You should see the group's About page with the group name, description, and details
4. Look for the "Join" button
5. Click the "Join" button
6. A panel should expand showing:
   - The agreement(s) you created, each with a checkbox
   - The join question(s) you created, each with an input field
7. Notice the "Join" button is now disabled
8. Check the agreement checkbox(es)
9. Fill in an answer to the join question(s)
10. The "Join" button should now be enabled
11. Click "Join" again
12. You should now be a member and see the group's activity stream

**Expected Result:** 
- Public Open groups are discoverable and joinable without any special link
- The About page loads with full group details visible
- First click on Join reveals the barriers (agreements + questions)
- Cannot complete join until all agreements are accepted and questions answered
- After completing barriers and clicking Join, you become a member immediately

---

#### TC-2: Join Link to Hidden/Restricted Group (New User Signup)

**Goal:** Verify that a join link allows access to a normally hidden group, and new users can sign up and join directly (bypassing the normal "Request Membership" flow).

**Setup (as Group Admin):**
1. Log into the staging app with your admin account
2. Go to a group you manage (or create a new test group)
3. Go to **Group Settings** → **Privacy & Access**
4. Set **Visibility** to "Hidden" and **Accessibility** to "Restricted"
5. Make sure **Paywall** is turned OFF
6. Go to **Group Settings** → **Agreements** tab
7. Create at least 1 agreement (e.g., "Membership Agreement")
8. Go to **Group Settings** → **Join Questions** tab
9. Create at least 1 required question (e.g., "What's your goal in joining?")
10. Go to **Group Settings** → **Invite** tab
11. Copy the "Join Link"
12. Save this link in your virtual notepad

**Test Steps (as New User):**
1. Open a private/incognito browser window (to ensure you're logged out)
2. Paste the join link into the address bar and press Enter
3. You should be redirected to the signup/login page
4. Click "Sign Up" and create a new account with a fresh email address
5. Complete the signup process
6. After signup, you should be automatically taken to the group's About page
7. Verify you can see the group name, description, and details (even though it's a "Hidden" group)
8. Look for a "Join" button (NOT "Request Membership" - the join link gives you pre-approved access)
9. Click "Join"
10. A panel should expand showing agreements and join questions
11. Check the agreement checkbox(es)
12. Fill in answers to the join question(s)
13. Click "Join" again
14. You should now be a member and see the group's activity stream

**Expected Result:**
- The join link allows you to see the hidden group's details
- You see "Join" button, not "Request Membership" (join link bypasses approval)
- First click reveals barriers, second click (after completing them) joins
- After joining, you're a full member immediately (no waiting for approval)

---

#### TC-3: Email Invitation - Email Mismatch Error

**Goal:** Verify that email invitations can only be used by the person they were sent to.

**Setup (as Group Admin):**
1. Log into the staging app with your admin account
2. Go to a group you manage
3. Go to **Group Settings** → **Invite** tab
4. In the "Invite by Email" section, enter an email address: `testinvite+recipient@gmail.com`
5. Click "Send Invitation"
6. Check the inbox for `testinvite+recipient@gmail.com` (or check your email testing tool)
7. Open the invitation email and copy the invitation link
8. Save this link in your notepad
9. Log out

**Test Steps (as Wrong User):**
1. Log into the staging app with a DIFFERENT account (one that does NOT use the email `testinvite+recipient@gmail.com`)
2. Paste the invitation link into the browser address bar and press Enter
3. Look for an error message

**Expected Result:**
- You should see an error message saying the invitation is for a different email address
- The group details should NOT be visible
- You should NOT be able to join the group using this link

**Follow-up Test (as Correct User):**
1. Log out and log in (or sign up) with the correct email: `testinvite+recipient@gmail.com`
2. Paste the same invitation link
3. You should now see the group details and be able to join

---

#### TC-4: Paywall Group with Agreements and Questions

**Goal:** Verify that users must complete all requirements (agreements + questions) before purchasing access to a paywall group.

**Setup (as Group Admin):**
1. Log into the staging app with your admin account
2. Go to a group you manage that has Stripe payments enabled
3. Go to **Group Settings** → **Privacy & Access**
4. Set **Visibility** to "Public" and **Accessibility** to "Open"
5. Enable **Paywall** (toggle it ON)
6. Go to **Group Settings** → **Agreements** tab
7. Create at least 2 agreements (e.g., "Code of Conduct", "Terms of Service")
8. Go to **Group Settings** → **Join Questions** tab
9. Create at least 1 question (e.g., "Why do you want to join?")
10. Go to **Group Settings** → **Paid Content** → **Offerings** tab
11. Ensure there's at least one published offering that grants group access
12. Note the group name/URL
13. Log out

**Test Steps (as Test User):**
1. Log in with a test account that is NOT a member of the group
2. Navigate to the group (search for it, or go directly to its URL)
3. You should see the group's About page with a payment section showing available offerings
4. Click "Purchase Access" on one of the offerings
5. A section should expand showing:
   - Checkboxes for each agreement
   - Text fields for each join question
6. Notice the "Purchase Access" button is disabled (grayed out)
7. Check the FIRST agreement checkbox only
8. Notice the button is still disabled
9. Check the SECOND agreement checkbox
10. Notice the button is still disabled (if there's a required question)
11. Fill in an answer to the join question
12. The "Purchase Access" button should now be enabled (clickable)
13. Click "Purchase Access"
14. You should be redirected to Stripe's checkout page

**Expected Result:**
- Cannot proceed to payment until ALL agreements are checked
- Cannot proceed to payment until ALL required questions are answered
- Only after completing everything does the purchase button become active
- Clicking purchase takes you to Stripe checkout

---

#### TC-5: Join Link Without Login (Redirect Flow)

**Goal:** Verify that non-logged-in users are properly redirected to login and then back to the group.

**Setup:**
1. Get a join link for any group (Public or Protected)
2. Save it in your notepad

**Test Steps:**
1. Open a private/incognito browser window
2. Make sure you're completely logged out
3. Paste the join link and press Enter
4. You should be redirected to the login/signup page
5. Notice the URL - it should contain a "returnTo" or similar parameter
6. Log in with an existing test account
7. After login, you should be automatically redirected to the group's About page
8. The join link parameters should still be in effect (you should see the group details and Join button)

**Expected Result:**
- Non-logged-in users are sent to login first
- After login, they're returned to the group About page
- The join link's special access is preserved through the login flow

---

#### TC-6: Direct Group URL vs Join Link (Hidden Group with Join Questions)

**Goal:** Verify that hidden groups are only accessible via join/invite links, and that join questions work correctly.

**Setup (as Group Admin):**
1. Log into the staging app with your admin account
2. Create or find a group and go to **Group Settings** → **Privacy & Access**
3. Set **Visibility** to "Hidden"
4. Go to **Group Settings** → **Join Questions** tab
5. Create 2 required questions:
   - "What brings you to this community?"
   - "How did you find out about us?"
6. Go to **Group Settings** → **Invite** tab
7. Copy the "Join Link"
8. Note both:
   - The direct group URL (e.g., `https://staging.hylo.com/groups/hidden-group/about`)
   - The join link you just copied

**Test Steps (as Test User):**
1. In a different browser, log in with an account that is NOT a member of the hidden group
2. Try to access the group using the DIRECT URL (without join code)
3. You should see a "Group not found" or access denied message
4. Now paste the JOIN LINK into the browser
5. You should now see the group's About page with full details
6. Click the "Join" button
7. A panel should expand showing the 2 join questions
8. Fill in answers to both questions
9. Click "Join" again
10. You should now be a member

**Expected Result:**
- Direct URL to hidden group = Access denied
- Join link to same hidden group = Access granted (can see About page)
- Join questions are displayed and must be answered before joining
- After completing questions, user becomes a member


---

#### TC-7: Setting Up and Testing a Paywall Group (Full Setup)

**Goal:** Verify the complete paywall setup process and that users must pay to access a paywalled group.

**Prerequisites:**
- You need a Stripe account for testing (can use Stripe test mode)
- Have Stripe test card numbers ready: `4242 4242 4242 4242` (success), any future expiry, any CVC

**Setup Part 1 - Connect Stripe Account (as Group Admin):**
1. Log into the staging app with your admin account
2. Go to a group you manage (or create a new test group)
3. Go to **Group Settings** → **Paid Content** tab
4. You should see the "Account" sub-tab with setup instructions; setup a connected stripe account if the group hasn't already got one (this process requires Stripe verification that can delay progress)
5. Fill in the form:
   - **Email**: Your email address
   - **Business Name**: Any name (e.g., "Test Organization")
   - **Country**: Select your country
6. Click "Create Account"
7. You'll be redirected to Stripe's onboarding flow
8. Complete Stripe's onboarding (in test mode, you can use test data)
9. After completing onboarding, you'll be returned to Hylo
10. Verify that the Account tab now shows "Account Active" with green checkmarks for:
    - Accept Payments: Yes
    - Receive Payouts: Yes
    - Details Submitted: Yes

**Setup Part 2 - Create an Offering (as Group Admin):**
1. Still in **Group Settings** → **Paid Content**, click the **Offerings** sub-tab
2. Click "Create Offering"
3. Fill in the form:
   - **Offering Name**: "Group Access - Monthly" (or any name)
   - **Description**: "Access to the group for one month"
   - **Price**: 10.00 (or any amount)
   - **Currency**: USD
   - **Duration**: Select "1 Month" (for a subscription)
   - **Publish Status**: Select "Published"
4. In the **Content Access** section, click "Add Group"
5. Select your current group from the list (this makes the offering grant access to the group)
6. Click "Save"
7. Verify the offering appears in the list with a green "Published" badge

**Setup Part 3 - Enable the Paywall (as Group Admin):**
1. Still on the **Offerings** sub-tab, look at the top section
2. Find the "Group Paywall Enabled" toggle
3. You should see a green message: "This group is ready to have a paywall added"
4. Check the checkbox to enable the paywall
5. The message should change to "Paywall enabled"
6. Note the group's URL slug for the next steps

**Test Steps (as Test User - Non-Member):**
1. In a different browser or incognito window, log in with a test account that is NOT a member of the paywalled group
2. Navigate to the group's About page: `https://staging.hylo.com/groups/[group-slug]/about`
3. You should see the group details but NOT be able to access the group content
4. Look for a section showing available payment options/offerings
5. You should see the offering you created (e.g., "Group Access - Monthly" for $10.00)
6. Click "Purchase Access" on the offering
7. You should be redirected to Stripe's checkout page
8. Enter the test card number: `4242 4242 4242 4242`
9. Enter any future expiry date (e.g., 12/30) and any CVC (e.g., 123)
10. Complete the checkout
11. You should be redirected back to Hylo
12. You should now have access to the group and see the activity stream

**Expected Result:**
- Stripe account connects successfully
- Offering is created and published
- Paywall toggle becomes available once offering exists
- Non-members see the paywall with purchase options
- After successful payment, user gains immediate access to the group

**Verification (as Group Admin):**
1. Go back to your admin browser
2. Go to **Group Settings** → **Paid Content** → **Content Access** sub-tab
3. You should see a new record showing the test user's purchase
4. The record should show:
   - The user's name
   - "Purchased" badge
   - "Active" status
   - The offering name

---

#### TC-5: Exploratory Testing - Offerings and Paid Content Features

**Goal:** Explore and validate the various offering types and paid content management features.

**Prerequisites:**
- Have a group where you are an admin
- Have Stripe connected (from TC-4 or separately)

**Areas to Explore:**

**1. Different Offering Types:**
- Create a **one-time payment** offering (Duration: "Lifetime" or leave empty)
- Create a **monthly subscription** offering (Duration: "1 Month")
- Create a **seasonal/quarterly subscription** offering (Duration: "3 Months")  
- Create an **annual subscription** offering (Duration: "1 Year")
- Try different price points and currencies

**2. Offering Management:**
- Create an offering but leave it as "Unpublished" - verify it doesn't appear to users
- Edit an existing offering's name, description, or price
- Try creating an offering WITHOUT granting group access (just content access)
- Create multiple offerings and see how they display to potential members

**3. Subscriber Tracking (Admin View):**
- After a test user purchases an offering, go to **Group Settings** → **Paid Content** → **Offerings**
- Click the "View subscribed users" toggle (users icon) on an offering
- Verify you can see:
  - Number of active subscribers
  - Monthly revenue (estimated)
  - Number of lapsed subscribers
  - List of individual subscribers with their status

**4. Content Access Management:**
- Go to **Content Access** sub-tab
- Try manually granting access to a user (click "+ Grant Access")
- Try revoking access from a user
- Observe how granted vs purchased access is displayed differently

**5. Paywall Toggle Behavior:**
- With offerings created, toggle the paywall on and off
- Verify non-members see the paywall when enabled
- Verify the group is open when paywall is disabled

**6. Edge Cases to Try:**
- What happens if you delete an offering that has active subscribers?
- Can you create an offering with a $0 price?
- What if you disconnect Stripe while paywall is enabled?

**Notes for Testers:**
- Document any unexpected behavior or confusing UI
- Take screenshots of anything that seems wrong
- Note any features that feel missing or could be improved
- For Stripe testing, always use test card: `4242 4242 4242 4242`

---

## Potential Improvements to Consider

1. **Rate limiting**: No apparent rate limiting on invitation creation or use
2. **Audit logging**: Track invitation usage for security

