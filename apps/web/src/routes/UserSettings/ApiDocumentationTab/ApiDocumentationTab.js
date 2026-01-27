import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import Icon from 'components/Icon'
import Button from 'components/ui/button'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { useEffect } from 'react'

import classes from './ApiDocumentationTab.module.scss'

function ApiDocumentationTab () {
  const { t } = useTranslation()
  const [copiedCode, setCopiedCode] = useState(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const contentRef = useRef(null)

  const { setHeaderDetails } = useViewHeader()

  useEffect(() => {
    setHeaderDetails({
      title: t('API Documentation'),
      icon: 'Code',
      info: '',
      search: false
    })
  }, [])

  const handleCopy = (id) => {
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleCopyAll = () => {
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 3000)
  }

  // Full documentation as plain text for copying
  const fullDocumentation = `# Hylo API Documentation

## Base URLs

- Production: https://www.hylo.com
- GraphQL Endpoint: https://www.hylo.com/noo/graphql
- OAuth Authorize: https://www.hylo.com/noo/oidc/auth
- OAuth Token: https://www.hylo.com/noo/oidc/token

## Authentication

All API requests must be authenticated using an OAuth 2.0 access token.

Authorization: Bearer YOUR_ACCESS_TOKEN

### Token Types
- Access Token: 1 hour lifetime, used for API requests
- Refresh Token: 30 days lifetime, used to obtain new access tokens
- ID Token: 1 hour lifetime, contains user identity claims (OpenID Connect)

### Refreshing Tokens

curl -X POST https://www.hylo.com/noo/oidc/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=refresh_token" \\
  -d "refresh_token=YOUR_REFRESH_TOKEN" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"

## OAuth 2.0 Authorization Flow

### Step 1: Redirect to Authorization

https://www.hylo.com/noo/oidc/auth?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=YOUR_REDIRECT_URI&scope=openid profile groups&state=RANDOM_STATE_VALUE

### Step 2: User Authorizes

User logs in and approves. Hylo redirects back:
https://your-app.com/callback?code=AUTH_CODE&state=RANDOM_STATE_VALUE

### Step 3: Exchange Code for Tokens

curl -X POST https://www.hylo.com/noo/oidc/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "code=AUTH_CODE" \\
  -d "redirect_uri=YOUR_REDIRECT_URI" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"

### Step 4: Response

{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "v1.refresh.abc123...",
  "id_token": "eyJhbGciOiJSUzI1NiIs...",
  "scope": "openid profile groups"
}

## GraphQL API

### Making Requests

curl -X POST https://www.hylo.com/noo/graphql \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "query { me { id name email } }"}'

### Get Current User

query {
  me {
    id
    name
    email
    avatarUrl
    memberships {
      items {
        group { id name slug }
        role
      }
    }
  }
}

### Get Group Posts

query GetGroupPosts($groupId: ID!, $first: Int) {
  group(id: $groupId) {
    id
    name
    posts(first: $first) {
      items {
        id
        title
        details
        createdAt
        creator { id name }
      }
    }
  }
}

### Create a Post

mutation CreatePost($data: PostInput!) {
  createPost(data: $data) {
    id
    title
    details
    createdAt
  }
}

Variables:
{
  "data": {
    "title": "My Post Title",
    "details": "Post content here...",
    "groupIds": ["123"],
    "type": "discussion"
  }
}

## Available Scopes

- openid: Required for OpenID Connect (User ID)
- profile: Basic profile information (Name, avatar, bio)
- email: User email address
- groups: Group memberships
- offline_access: Refresh tokens (allows token refresh without re-auth)

## Authorization Rules

IMPORTANT:
- Users can only access groups they are members of
- API requests are scoped to the authenticated user's permissions
- Attempting to access unauthorized resources returns an error
- Bots must be explicitly invited to groups by moderators

### Permission Levels
- Member: Read posts, create posts/comments, view members
- Moderator: Member abilities + manage posts, invite members, manage bots
- Admin: Moderator abilities + manage group settings, roles, delete group

## Bot Permissions

Bots can only access groups where they have been explicitly invited by a moderator.

Available permissions:
- read_posts: Read posts and comments in the group
- create_posts: Create new posts in the group
- create_comments: Comment on posts in the group
- read_members: View group member list
- send_messages: Send direct messages to members
- manage_events: Create and manage events
- read_announcements: Read group announcements
- create_announcements: Create group announcements

Bots CANNOT:
- Access groups they haven't been invited to
- Perform actions beyond their granted permissions
- Invite themselves to groups
- Modify their own permissions

## Webhooks

### Available Events
- post.created: A new post was created
- comment.created: A new comment was added
- mention.created: Your bot was mentioned

### Webhook Payload Example

{
  "event": "post.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "post": {
      "id": "123",
      "title": "New Discussion",
      "creator": { "id": "456", "name": "Jane Doe" },
      "group": { "id": "789", "name": "My Community" }
    }
  },
  "signature": "sha256=abc123..."
}

### Verifying Webhooks

const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

## Rate Limits

- GraphQL Queries: 100 requests per minute
- GraphQL Mutations: 30 requests per minute
- OAuth Token: 10 requests per minute

## Error Codes

- UNAUTHENTICATED: Invalid or expired access token
- FORBIDDEN: User lacks permission for this action
- NOT_FOUND: Requested resource does not exist
- RATE_LIMITED: Too many requests - slow down
- VALIDATION_ERROR: Invalid input data

## Security Best Practices

✓ Store client secrets securely (never in client-side code)
✓ Use HTTPS for all API communications
✓ Validate OAuth state parameter to prevent CSRF
✓ Verify webhook signatures before processing
✓ Request only the scopes your application needs
✓ Implement proper token refresh logic
✓ Handle rate limit errors gracefully with exponential backoff
`

  const CodeBlock = ({ code, id, language = 'bash' }) => (
    <div className={classes.codeBlock}>
      <div className={classes.codeHeader}>
        <span className={classes.codeLanguage}>{language}</span>
        <CopyToClipboard text={code} onCopy={() => handleCopy(id)}>
          <button className={classes.copyButton}>
            {copiedCode === id ? t('Copied!') : t('Copy')}
          </button>
        </CopyToClipboard>
      </div>
      <pre className={classes.codeContent}><code>{code}</code></pre>
    </div>
  )

  return (
    <div className={classes.container} ref={contentRef}>
      <div className={classes.topBar}>
        <h1>{t('Hylo API Documentation')}</h1>
        <div className={classes.topActions}>
          <a href='/noo/graphql' target='_blank' rel='noopener noreferrer' className={classes.playgroundLink}>
            <Icon name='Code' /> {t('GraphQL Playground')}
          </a>
          <CopyToClipboard text={fullDocumentation} onCopy={handleCopyAll}>
            <Button variant={copiedAll ? 'secondary' : 'primary'}>
              <Icon name={copiedAll ? 'Checkmark' : 'Copy'} />
              {copiedAll ? t('Copied All!') : t('Copy All Documentation')}
            </Button>
          </CopyToClipboard>
        </div>
      </div>

      <div className={classes.content}>
        {/* Overview */}
        <section className={classes.section} id='overview'>
          <h2>{t('Overview')}</h2>
          <p className={classes.intro}>
            {t('The Hylo API allows you to build integrations and applications that interact with Hylo communities. The API uses GraphQL and OAuth 2.0 for authentication.')}
          </p>

          <h3>{t('Base URLs')}</h3>
          <table className={classes.table}>
            <thead>
              <tr>
                <th>{t('Environment')}</th>
                <th>{t('URL')}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Production</td><td><code>https://www.hylo.com</code></td></tr>
              <tr><td>GraphQL Endpoint</td><td><code>https://www.hylo.com/noo/graphql</code></td></tr>
              <tr><td>OAuth Authorize</td><td><code>https://www.hylo.com/noo/oidc/auth</code></td></tr>
              <tr><td>OAuth Token</td><td><code>https://www.hylo.com/noo/oidc/token</code></td></tr>
            </tbody>
          </table>
        </section>

        {/* Authentication */}
        <section className={classes.section} id='auth'>
          <h2>{t('Authentication')}</h2>
          <p>{t('All API requests must be authenticated using an OAuth 2.0 access token:')}</p>
          <CodeBlock id='auth-header' language='http' code='Authorization: Bearer YOUR_ACCESS_TOKEN' />

          <h3>{t('Token Types')}</h3>
          <table className={classes.table}>
            <thead><tr><th>{t('Token')}</th><th>{t('Lifetime')}</th><th>{t('Usage')}</th></tr></thead>
            <tbody>
              <tr><td><strong>Access Token</strong></td><td>1 hour</td><td>{t('Used for API requests')}</td></tr>
              <tr><td><strong>Refresh Token</strong></td><td>30 days</td><td>{t('Used to obtain new access tokens')}</td></tr>
              <tr><td><strong>ID Token</strong></td><td>1 hour</td><td>{t('Contains user identity claims')}</td></tr>
            </tbody>
          </table>

          <h3>{t('Refreshing Tokens')}</h3>
          <CodeBlock
            id='refresh'
            language='bash'
            code={`curl -X POST https://www.hylo.com/noo/oidc/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=refresh_token" \\
  -d "refresh_token=YOUR_REFRESH_TOKEN" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"`}
          />
        </section>

        {/* OAuth Flow */}
        <section className={classes.section} id='oauth'>
          <h2>{t('OAuth 2.0 Authorization Flow')}</h2>

          <div className={classes.step}>
            <span className={classes.stepNum}>1</span>
            <div>
              <h4>{t('Redirect to Authorization')}</h4>
              <CodeBlock
                id='oauth1'
                language='url'
                code={`https://www.hylo.com/noo/oidc/auth?
  client_id=YOUR_CLIENT_ID
  &response_type=code
  &redirect_uri=YOUR_REDIRECT_URI
  &scope=openid profile groups
  &state=RANDOM_STATE_VALUE`}
              />
            </div>
          </div>

          <div className={classes.step}>
            <span className={classes.stepNum}>2</span>
            <div>
              <h4>{t('User Authorizes')}</h4>
              <p>{t('User logs in and approves. Hylo redirects back:')}</p>
              <CodeBlock id='oauth2' language='url' code='https://your-app.com/callback?code=AUTH_CODE&state=RANDOM_STATE_VALUE' />
            </div>
          </div>

          <div className={classes.step}>
            <span className={classes.stepNum}>3</span>
            <div>
              <h4>{t('Exchange Code for Tokens')}</h4>
              <CodeBlock
                id='oauth3'
                language='bash'
                code={`curl -X POST https://www.hylo.com/noo/oidc/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "code=AUTH_CODE" \\
  -d "redirect_uri=YOUR_REDIRECT_URI" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"`}
              />
            </div>
          </div>

          <div className={classes.step}>
            <span className={classes.stepNum}>4</span>
            <div>
              <h4>{t('Response')}</h4>
              <CodeBlock
                id='oauth4'
                language='json'
                code={`{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "v1.refresh.abc123...",
  "id_token": "eyJhbGciOiJSUzI1NiIs...",
  "scope": "openid profile groups"
}`}
              />
            </div>
          </div>
        </section>

        {/* GraphQL API */}
        <section className={classes.section} id='graphql'>
          <h2>{t('GraphQL API')}</h2>

          <h3>{t('Making Requests')}</h3>
          <CodeBlock
            id='gql-req'
            language='bash'
            code={`curl -X POST https://www.hylo.com/noo/graphql \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "query { me { id name email } }"}'`}
          />

          <h3>{t('Get Current User')}</h3>
          <CodeBlock
            id='gql-me'
            language='graphql'
            code={`query {
  me {
    id
    name
    email
    avatarUrl
    memberships {
      items {
        group { id name slug }
        role
      }
    }
  }
}`}
          />

          <h3>{t('Get Group Posts')}</h3>
          <CodeBlock
            id='gql-posts'
            language='graphql'
            code={`query GetGroupPosts($groupId: ID!, $first: Int) {
  group(id: $groupId) {
    id
    name
    posts(first: $first) {
      items {
        id
        title
        details
        createdAt
        creator { id name }
      }
    }
  }
}`}
          />

          <h3>{t('Create a Post')}</h3>
          <CodeBlock
            id='gql-create'
            language='graphql'
            code={`mutation CreatePost($data: PostInput!) {
  createPost(data: $data) {
    id
    title
    details
    createdAt
  }
}

# Variables:
{
  "data": {
    "title": "My Post Title",
    "details": "Post content here...",
    "groupIds": ["123"],
    "type": "discussion"
  }
}`}
          />
        </section>

        {/* Scopes & Permissions */}
        <section className={classes.section} id='scopes'>
          <h2>{t('Scopes & Permissions')}</h2>

          <h3>{t('Available Scopes')}</h3>
          <table className={classes.table}>
            <thead><tr><th>{t('Scope')}</th><th>{t('Description')}</th></tr></thead>
            <tbody>
              <tr><td><code>openid</code></td><td>{t('Required for OpenID Connect - User ID')}</td></tr>
              <tr><td><code>profile</code></td><td>{t('Basic profile info - Name, avatar, bio')}</td></tr>
              <tr><td><code>email</code></td><td>{t('User email address')}</td></tr>
              <tr><td><code>groups</code></td><td>{t('Group memberships')}</td></tr>
              <tr><td><code>offline_access</code></td><td>{t('Refresh tokens for offline access')}</td></tr>
            </tbody>
          </table>

          <div className={classes.warning}>
            <strong>⚠️ {t('Authorization Rules')}</strong>
            <ul>
              <li>{t('Users can only access groups they are members of')}</li>
              <li>{t('API requests are scoped to the authenticated user\'s permissions')}</li>
              <li>{t('Attempting to access unauthorized resources returns an error')}</li>
              <li>{t('Bots must be explicitly invited to groups by moderators')}</li>
            </ul>
          </div>

          <h3>{t('Permission Levels')}</h3>
          <table className={classes.table}>
            <thead><tr><th>{t('Role')}</th><th>{t('Capabilities')}</th></tr></thead>
            <tbody>
              <tr><td><strong>Member</strong></td><td>{t('Read posts, create posts/comments, view members')}</td></tr>
              <tr><td><strong>Moderator</strong></td><td>{t('Member abilities + manage posts, invite members, manage bots')}</td></tr>
              <tr><td><strong>Admin</strong></td><td>{t('Moderator abilities + manage group settings, roles, delete group')}</td></tr>
            </tbody>
          </table>
        </section>

        {/* Bot Integration */}
        <section className={classes.section} id='bots'>
          <h2>{t('Bot Integration')}</h2>

          <h3>{t('Bot Permissions')}</h3>
          <table className={classes.table}>
            <thead><tr><th>{t('Permission')}</th><th>{t('Description')}</th></tr></thead>
            <tbody>
              <tr><td><code>read_posts</code></td><td>{t('Read posts and comments')}</td></tr>
              <tr><td><code>create_posts</code></td><td>{t('Create new posts')}</td></tr>
              <tr><td><code>create_comments</code></td><td>{t('Comment on posts')}</td></tr>
              <tr><td><code>read_members</code></td><td>{t('View group member list')}</td></tr>
              <tr><td><code>send_messages</code></td><td>{t('Send direct messages')}</td></tr>
              <tr><td><code>manage_events</code></td><td>{t('Create and manage events')}</td></tr>
              <tr><td><code>read_announcements</code></td><td>{t('Read announcements')}</td></tr>
              <tr><td><code>create_announcements</code></td><td>{t('Create announcements')}</td></tr>
            </tbody>
          </table>

          <div className={classes.warning}>
            <strong>🔒 {t('Bot Access Control')}</strong>
            <p>{t('Bots can ONLY access groups where they have been explicitly invited. They cannot:')}</p>
            <ul>
              <li>{t('Access groups they haven\'t been invited to')}</li>
              <li>{t('Perform actions beyond their granted permissions')}</li>
              <li>{t('Invite themselves to groups')}</li>
              <li>{t('Modify their own permissions')}</li>
            </ul>
          </div>
        </section>

        {/* Webhooks */}
        <section className={classes.section} id='webhooks'>
          <h2>{t('Webhooks')}</h2>

          <h3>{t('Available Events')}</h3>
          <table className={classes.table}>
            <thead><tr><th>{t('Event')}</th><th>{t('Description')}</th></tr></thead>
            <tbody>
              <tr><td><code>post.created</code></td><td>{t('A new post was created')}</td></tr>
              <tr><td><code>comment.created</code></td><td>{t('A new comment was added')}</td></tr>
              <tr><td><code>mention.created</code></td><td>{t('Your bot was mentioned')}</td></tr>
            </tbody>
          </table>

          <h3>{t('Webhook Payload')}</h3>
          <CodeBlock
            id='webhook'
            language='json'
            code={`{
  "event": "post.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "post": {
      "id": "123",
      "title": "New Discussion",
      "creator": { "id": "456", "name": "Jane Doe" },
      "group": { "id": "789", "name": "My Community" }
    }
  },
  "signature": "sha256=abc123..."
}`}
          />

          <h3>{t('Verifying Webhooks')}</h3>
          <CodeBlock
            id='webhook-verify'
            language='javascript'
            code={`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}
          />
        </section>

        {/* Rate Limits & Security */}
        <section className={classes.section} id='security'>
          <h2>{t('Rate Limits & Security')}</h2>

          <h3>{t('Rate Limits')}</h3>
          <table className={classes.table}>
            <thead><tr><th>{t('Endpoint')}</th><th>{t('Limit')}</th></tr></thead>
            <tbody>
              <tr><td>GraphQL Queries</td><td>100 requests/minute</td></tr>
              <tr><td>GraphQL Mutations</td><td>30 requests/minute</td></tr>
              <tr><td>OAuth Token</td><td>10 requests/minute</td></tr>
            </tbody>
          </table>

          <h3>{t('Error Codes')}</h3>
          <table className={classes.table}>
            <thead><tr><th>{t('Code')}</th><th>{t('Description')}</th></tr></thead>
            <tbody>
              <tr><td><code>UNAUTHENTICATED</code></td><td>{t('Invalid or expired access token')}</td></tr>
              <tr><td><code>FORBIDDEN</code></td><td>{t('User lacks permission for this action')}</td></tr>
              <tr><td><code>NOT_FOUND</code></td><td>{t('Requested resource does not exist')}</td></tr>
              <tr><td><code>RATE_LIMITED</code></td><td>{t('Too many requests')}</td></tr>
              <tr><td><code>VALIDATION_ERROR</code></td><td>{t('Invalid input data')}</td></tr>
            </tbody>
          </table>

          <h3>{t('Security Best Practices')}</h3>
          <div className={classes.checklist}>
            <div className={classes.checkItem}>✓ {t('Store client secrets securely (never in client-side code)')}</div>
            <div className={classes.checkItem}>✓ {t('Use HTTPS for all API communications')}</div>
            <div className={classes.checkItem}>✓ {t('Validate OAuth state parameter to prevent CSRF')}</div>
            <div className={classes.checkItem}>✓ {t('Verify webhook signatures before processing')}</div>
            <div className={classes.checkItem}>✓ {t('Request only the scopes your application needs')}</div>
            <div className={classes.checkItem}>✓ {t('Implement proper token refresh logic')}</div>
            <div className={classes.checkItem}>✓ {t('Handle rate limit errors with exponential backoff')}</div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default ApiDocumentationTab
