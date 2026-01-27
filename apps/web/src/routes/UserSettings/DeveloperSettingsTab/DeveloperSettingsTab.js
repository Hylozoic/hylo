/* eslint-disable multiline-ternary */
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import Icon from 'components/Icon'
import Button from 'components/ui/button'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import getMe from 'store/selectors/getMe'
import {
  createApplication,
  updateApplication,
  deleteApplication,
  regenerateClientSecret,
  createBotForApplication,
  fetchApplications
} from './DeveloperSettingsTab.store'

import classes from './DeveloperSettingsTab.module.scss'

// Full documentation as markdown for copy functionality
const FULL_DOCUMENTATION = `# Hylo Developer Documentation

## Base URLs

- Production: https://www.hylo.com
- GraphQL Endpoint: https://www.hylo.com/noo/graphql
- OAuth Authorize: https://www.hylo.com/noo/oauth/auth
- OAuth Token: https://www.hylo.com/noo/oauth/token
- User Info: https://www.hylo.com/noo/oauth/me
- OIDC Discovery: https://www.hylo.com/noo/oauth/.well-known/openid-configuration

## Authentication

All API requests must be authenticated using an OAuth 2.0 access token.

### Supported Grant Types

- \`authorization_code\` - Standard OAuth flow for web apps
- \`implicit\` - For single-page applications (less secure)
- \`refresh_token\` - For refreshing access tokens
- \`client_credentials\` - For server-to-server communication

### OAuth 2.0 Authorization Code Flow

1. Redirect users to authorize your app:
\`\`\`
GET https://www.hylo.com/noo/oauth/auth
  ?client_id=YOUR_CLIENT_ID
  &response_type=code
  &redirect_uri=YOUR_REDIRECT_URI
  &scope=openid profile email api:read
  &state=RANDOM_STATE
\`\`\`

2. User approves and is redirected to your redirect_uri with a code:
\`\`\`
https://your-app.com/callback?code=AUTH_CODE&state=RANDOM_STATE
\`\`\`

3. Exchange the code for tokens:
\`\`\`bash
curl -X POST https://www.hylo.com/noo/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "code=AUTH_CODE" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET" \\
  -d "redirect_uri=YOUR_REDIRECT_URI"
\`\`\`

Response:
\`\`\`json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2...",
  "id_token": "eyJhbGciOiJSUzI1NiIs..."
}
\`\`\`

### Get User Info
\`\`\`bash
curl https://www.hylo.com/noo/oauth/me \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
\`\`\`

## GraphQL API

### Making Requests

\`\`\`bash
curl -X POST https://www.hylo.com/noo/graphql \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "{ me { id name email } }"}'
\`\`\`

### Example Queries

**Get Current User:**
\`\`\`graphql
query {
  me {
    id
    name
    email
    avatarUrl
    memberships {
      items {
        group {
          id
          name
          slug
        }
        role
      }
    }
  }
}
\`\`\`

**Get Group Posts:**
\`\`\`graphql
query GetGroupPosts($slug: String!, $first: Int) {
  group(slug: $slug) {
    id
    name
    posts(first: $first) {
      items {
        id
        title
        details
        type
        creator {
          id
          name
        }
        createdAt
      }
    }
  }
}
\`\`\`

**Create a Post:**
\`\`\`graphql
mutation CreatePost($input: PostInput!) {
  createPost(input: $input) {
    id
    title
    details
    type
  }
}
\`\`\`

Variables:
\`\`\`json
{
  "input": {
    "title": "My Post Title",
    "details": "Post content here...",
    "type": "discussion",
    "groupIds": ["123"]
  }
}
\`\`\`

## Available Scopes

| Scope | Description |
|-------|-------------|
| openid | Required for OIDC compliance - returns user sub (ID) |
| profile | Read user profile (name, picture, website, updated_at) |
| email | Read user email address and verification status |
| address | Read user address information |
| phone | Read user phone number |
| offline_access | Request refresh tokens for long-lived access |
| api:read | Read access to Hylo GraphQL API |
| api:write | Write access to Hylo GraphQL API (requires super role) |
| bot | Enable bot functionality for the application |

## Authorization & Security

**Group-Level Access Control:**
- Users can only access groups they are members of
- API requests automatically filter to authorized groups
- Attempting to access unauthorized groups returns an error

**Bot Permissions:**
Bots have specific granular permissions within groups:
- \`read_posts\` - Read posts in groups
- \`create_posts\` - Create new posts
- \`create_comments\` - Add comments to posts
- \`read_members\` - View group member list
- \`send_messages\` - Send direct messages
- \`manage_events\` - Create and manage events
- \`read_announcements\` - View announcements
- \`create_announcements\` - Create announcements

Access must be granted by group moderators.

## Zapier Integration

Hylo supports Zapier triggers for automation. Available triggers:
- New post created in a group
- New comment on a post
- New member joined

Configure through your Zapier account at https://zapier.com/apps/hylo

Note: Direct webhook endpoints are not currently available. For real-time event notifications, use the Zapier integration or poll the GraphQL API.

## Error Handling

**HTTP Status Codes:**
| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid/expired token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 500 | Server Error |

**GraphQL Errors:**
\`\`\`json
{
  "errors": [{
    "message": "Not authorized to access this group",
    "extensions": {
      "code": "FORBIDDEN"
    }
  }],
  "data": null
}
\`\`\`

## Security Best Practices

1. Store client secrets securely (environment variables, secret managers)
2. Always use HTTPS
3. Request minimal scopes needed
4. Implement token refresh before expiration
5. Never expose tokens in client-side code
6. Validate the state parameter to prevent CSRF attacks
`

function CodeBlock ({ code, language = 'bash', onCopy, copied }) {
  return (
    <div className={classes.codeBlock}>
      <div className={classes.codeHeader}>
        <span className={classes.codeLanguage}>{language}</span>
        <CopyToClipboard text={code} onCopy={onCopy}>
          <button className={classes.copyButton}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </CopyToClipboard>
      </div>
      <pre className={classes.codeContent}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

function DeveloperSettingsTab () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)

  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newAppName, setNewAppName] = useState('')
  const [newAppDescription, setNewAppDescription] = useState('')
  const [newClientSecret, setNewClientSecret] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [visibleClientIds, setVisibleClientIds] = useState({})
  const [editingRedirectUris, setEditingRedirectUris] = useState(null)
  const [newRedirectUri, setNewRedirectUri] = useState('')

  const { setHeaderDetails } = useViewHeader()

  const toggleClientIdVisibility = (appId) => {
    setVisibleClientIds(prev => ({
      ...prev,
      [appId]: !prev[appId]
    }))
  }

  const maskClientId = (clientId) => {
    if (!clientId) return ''
    const prefix = clientId.substring(0, 8)
    return prefix + '••••••••••••••••••••'
  }

  useEffect(() => {
    setHeaderDetails({
      title: t('Developer'),
      icon: 'Code',
      info: '',
      search: false
    })
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadApplications()
    }
  }, [currentUser])

  const loadApplications = async () => {
    setLoading(true)
    try {
      const result = await dispatch(fetchApplications())
      if (result?.payload?.data?.me?.applications) {
        setApplications(result.payload.data.me.applications)
      }
    } catch (e) {
      console.error('Error loading applications:', e)
    }
    setLoading(false)
  }

  const handleCreateApplication = async () => {
    if (!newAppName.trim()) return

    try {
      const result = await dispatch(createApplication({
        name: newAppName.trim(),
        description: newAppDescription.trim() || null
      }))

      if (result?.payload?.data?.createApplication) {
        const { application, clientSecret } = result.payload.data.createApplication
        setNewClientSecret(clientSecret)
        setApplications([...applications, application])
        setNewAppName('')
        setNewAppDescription('')
        setShowCreateModal(false)
      }
    } catch (e) {
      console.error('Error creating application:', e)
    }
  }

  const handleDeleteApplication = async (appId) => {
    if (!window.confirm(t('Are you sure you want to delete this application? This cannot be undone.'))) {
      return
    }

    try {
      await dispatch(deleteApplication(appId))
      setApplications(applications.filter(a => a.id !== appId))
    } catch (e) {
      console.error('Error deleting application:', e)
    }
  }

  const handleRegenerateSecret = async (appId) => {
    if (!window.confirm(t('Are you sure? The old secret will stop working immediately.'))) {
      return
    }

    try {
      const result = await dispatch(regenerateClientSecret(appId))
      if (result?.payload?.data?.regenerateClientSecret) {
        setNewClientSecret(result.payload.data.regenerateClientSecret)
      }
    } catch (e) {
      console.error('Error regenerating secret:', e)
    }
  }

  const handleAddRedirectUri = async (appId, currentUris) => {
    if (!newRedirectUri.trim()) return

    try {
      const updatedUris = [...(currentUris || []), newRedirectUri.trim()]
      const app = applications.find(a => a.id === appId)
      const result = await dispatch(updateApplication(appId, {
        name: app.name,
        redirectUris: updatedUris
      }))
      if (result?.payload?.data?.updateApplication) {
        setApplications(applications.map(a =>
          a.id === appId ? { ...a, redirectUris: updatedUris } : a
        ))
        setNewRedirectUri('')
      }
    } catch (e) {
      console.error('Error adding redirect URI:', e)
    }
  }

  const handleRemoveRedirectUri = async (appId, uriToRemove) => {
    try {
      const app = applications.find(a => a.id === appId)
      const updatedUris = (app.redirectUris || []).filter(uri => uri !== uriToRemove)
      const result = await dispatch(updateApplication(appId, {
        name: app.name,
        redirectUris: updatedUris
      }))
      if (result?.payload?.data?.updateApplication) {
        setApplications(applications.map(a =>
          a.id === appId ? { ...a, redirectUris: updatedUris } : a
        ))
      }
    } catch (e) {
      console.error('Error removing redirect URI:', e)
    }
  }

  const handleCreateBot = async (appId) => {
    if (!window.confirm(t('Create a bot for this application? The bot will have its own profile and can be invited to groups.'))) {
      return
    }

    try {
      const result = await dispatch(createBotForApplication(appId))
      if (result?.payload?.data?.createBotForApplication) {
        const bot = result.payload.data.createBotForApplication
        setApplications(applications.map(a =>
          a.id === appId ? { ...a, hasBot: true, bot } : a
        ))
      }
    } catch (e) {
      console.error('Error creating bot:', e)
      alert(t('Failed to create bot. Please try again.'))
    }
  }

  const handleCopy = (id) => {
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCopyAll = () => {
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 3000)
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className={classes.container}>
      {/* Copy All Documentation Button */}
      <div className={classes.copyAllSection}>
        <CopyToClipboard text={FULL_DOCUMENTATION} onCopy={handleCopyAll}>
          <Button variant={copiedAll ? 'secondary' : 'primary'}>
            <Icon name={copiedAll ? 'Checkmark' : 'Copy'} />
            {copiedAll ? t('Copied All Documentation!') : t('Copy All Documentation')}
          </Button>
        </CopyToClipboard>
        <span className={classes.copyHint}>{t('Copy entire documentation as markdown')}</span>
      </div>

      {/* My Applications Section */}
      <section className={classes.section}>
        <div className={classes.sectionHeader}>
          <h2>{t('My Applications')}</h2>
          <Button
            onClick={() => setShowCreateModal(true)}
            variant='primary'
            small
          >
            <Icon name='Plus' /> {t('Create Application')}
          </Button>
        </div>

        {applications.length === 0 ? (
          <p className={classes.emptyState}>
            {t('You haven\'t created any applications yet. Create one to get started with the API.')}
          </p>
        ) : (
          <div className={classes.applicationList}>
            {applications.map(app => (
              <div key={app.id} className={classes.applicationCard}>
                <div className={classes.cardHeader}>
                  <h4>{app.name}</h4>
                  <div className={classes.cardActions}>
                    <Button
                      onClick={() => handleRegenerateSecret(app.id)}
                      variant='secondary'
                      small
                    >
                      {t('Regenerate Secret')}
                    </Button>
                    <Button
                      onClick={() => handleDeleteApplication(app.id)}
                      variant='danger'
                      small
                    >
                      {t('Delete')}
                    </Button>
                  </div>
                </div>
                {app.description && (
                  <p className={classes.appDescription}>{app.description}</p>
                )}
                <div className={classes.credentialRow}>
                  <span className={classes.credentialLabel}>{t('Client ID')}</span>
                  <div className={classes.credentialValue}>
                    <code className={classes.clientIdCode}>
                      {visibleClientIds[app.id] ? app.clientId : maskClientId(app.clientId)}
                    </code>
                    <div className={classes.credentialActions}>
                      <button
                        className={classes.textButton}
                        onClick={() => toggleClientIdVisibility(app.id)}
                      >
                        {visibleClientIds[app.id] ? t('Hide') : t('Show')}
                      </button>
                      <CopyToClipboard text={app.clientId} onCopy={() => handleCopy(app.id)}>
                        <button className={classes.textButton}>
                          {copiedId === app.id ? t('Copied!') : t('Copy')}
                        </button>
                      </CopyToClipboard>
                    </div>
                  </div>
                </div>
                <div className={classes.metaRow}>
                  <span className={classes.metaLabel}>{t('Scopes')}:</span>
                  <span className={classes.metaValue}>{app.scopes?.join(', ') || 'openid, profile'}</span>
                </div>

                {/* Redirect URIs Section */}
                <div className={classes.credentialRow}>
                  <span className={classes.credentialLabel}>{t('Redirect URIs (Callback URLs)')}</span>
                  {(app.redirectUris && app.redirectUris.length > 0) ? (
                    <div className={classes.redirectUriList}>
                      {app.redirectUris.map((uri, idx) => (
                        <div key={idx} className={classes.redirectUriItem}>
                          <code className={classes.redirectUriCode}>{uri}</code>
                          {editingRedirectUris === app.id && (
                            <button
                              className={classes.removeUriButton}
                              onClick={() => handleRemoveRedirectUri(app.id, uri)}
                              title={t('Remove')}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={classes.noUris}>{t('No redirect URIs configured')}</p>
                  )}
                  {editingRedirectUris === app.id ? (
                    <div className={classes.addUriForm}>
                      <input
                        type='text'
                        value={newRedirectUri}
                        onChange={(e) => setNewRedirectUri(e.target.value)}
                        placeholder='https://your-app.com/auth/callback'
                        className={classes.uriInput}
                      />
                      <Button
                        onClick={() => handleAddRedirectUri(app.id, app.redirectUris)}
                        variant='secondary'
                        small
                      >
                        {t('Add')}
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingRedirectUris(null)
                          setNewRedirectUri('')
                        }}
                        variant='secondary'
                        small
                      >
                        {t('Done')}
                      </Button>
                    </div>
                  ) : (
                    <button
                      className={classes.textButton}
                      onClick={() => setEditingRedirectUris(app.id)}
                    >
                      {t('Manage Redirect URIs')}
                    </button>
                  )}
                </div>

                {/* Bot Section */}
                <div className={classes.botSection}>
                  {app.hasBot ? (
                    <div className={classes.botInfo}>
                      <div className={classes.botBadge}>
                        <Icon name='Robot' /> {t('Bot enabled')}
                      </div>
                      {app.bot && (
                        <div className={classes.botDetails}>
                          <span className={classes.botName}>{app.bot.name}</span>
                          {app.bot.avatarUrl && (
                            <img src={app.bot.avatarUrl} alt={app.bot.name} className={classes.botAvatar} />
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleCreateBot(app.id)}
                      variant='secondary'
                      small
                    >
                      <Icon name='Robot' /> {t('Create Bot')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Application Modal */}
      {showCreateModal && createPortal(
        <div className={classes.modal}>
          <div className={classes.modalContent}>
            <h3>{t('Create New Application')}</h3>
            <div className={classes.formGroup}>
              <label>{t('Application Name')}</label>
              <input
                type='text'
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
                placeholder={t('My Awesome App')}
              />
            </div>
            <div className={classes.formGroup}>
              <label>{t('Description')} ({t('optional')})</label>
              <textarea
                value={newAppDescription}
                onChange={(e) => setNewAppDescription(e.target.value)}
                placeholder={t('What does your application do?')}
              />
            </div>
            <div className={classes.modalActions}>
              <Button onClick={() => setShowCreateModal(false)} variant='secondary'>
                {t('Cancel')}
              </Button>
              <Button onClick={handleCreateApplication} variant='primary'>
                {t('Create')}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Client Secret Display Modal */}
      {newClientSecret && createPortal(
        <div className={classes.modal}>
          <div className={classes.modalContent}>
            <h3>{t('Client Secret')}</h3>
            <div className={classes.secretWarning}>
              <Icon name='AlertTriangle' />
              <p>{t('This secret will only be shown once. Copy it now and store it securely.')}</p>
            </div>
            <div className={classes.secretDisplay}>
              <code>{newClientSecret}</code>
              <CopyToClipboard text={newClientSecret} onCopy={() => handleCopy('secret')}>
                <Button variant='secondary' small>
                  <Icon name={copiedId === 'secret' ? 'Checkmark' : 'Copy'} />
                  {copiedId === 'secret' ? t('Copied!') : t('Copy')}
                </Button>
              </CopyToClipboard>
            </div>
            <div className={classes.modalActions}>
              <Button onClick={() => setNewClientSecret(null)} variant='primary'>
                {t('I\'ve copied the secret')}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* API Documentation Section */}
      <section className={classes.section}>
        <h2>{t('API Documentation')}</h2>
        <p className={classes.intro}>
          {t('Hylo provides a GraphQL API for building integrations and applications. This documentation covers authentication, available endpoints, and best practices.')}
        </p>

        <h3>{t('Base URLs')}</h3>
        <table className={classes.table}>
          <thead>
            <tr>
              <th>{t('Endpoint')}</th>
              <th>{t('URL')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t('Production')}</td>
              <td><code>https://www.hylo.com</code></td>
            </tr>
            <tr>
              <td>{t('GraphQL')}</td>
              <td><code>https://www.hylo.com/noo/graphql</code></td>
            </tr>
            <tr>
              <td>{t('OAuth Authorize')}</td>
              <td><code>https://www.hylo.com/noo/oauth/auth</code></td>
            </tr>
            <tr>
              <td>{t('OAuth Token')}</td>
              <td><code>https://www.hylo.com/noo/oauth/token</code></td>
            </tr>
            <tr>
              <td>{t('User Info')}</td>
              <td><code>https://www.hylo.com/noo/oauth/me</code></td>
            </tr>
            <tr>
              <td>{t('OIDC Discovery')}</td>
              <td><code>https://www.hylo.com/noo/oauth/.well-known/openid-configuration</code></td>
            </tr>
          </tbody>
        </table>

        <h3>{t('OAuth 2.0 Authentication')}</h3>
        <p>{t('All API requests require authentication using OAuth 2.0 access tokens.')}</p>

        <h4>{t('Step 1: Redirect to Authorization')}</h4>
        <CodeBlock
          language='http'
          code={`GET https://www.hylo.com/noo/oauth/auth
  ?client_id=YOUR_CLIENT_ID
  &response_type=code
  &redirect_uri=YOUR_REDIRECT_URI
  &scope=openid profile email api:read
  &state=RANDOM_STATE`}
          onCopy={() => handleCopy('auth-url')}
          copied={copiedId === 'auth-url'}
        />

        <h4>{t('Step 2: Exchange Code for Token')}</h4>
        <CodeBlock
          language='bash'
          code={`curl -X POST https://www.hylo.com/noo/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "code=AUTH_CODE" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET" \\
  -d "redirect_uri=YOUR_REDIRECT_URI"`}
          onCopy={() => handleCopy('token-exchange')}
          copied={copiedId === 'token-exchange'}
        />

        <h4>{t('Token Response')}</h4>
        <CodeBlock
          language='json'
          code={`{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2..."
}`}
          onCopy={() => handleCopy('token-response')}
          copied={copiedId === 'token-response'}
        />

        <h3>{t('GraphQL API')}</h3>
        <h4>{t('Making Requests')}</h4>
        <CodeBlock
          language='bash'
          code={`curl -X POST https://www.hylo.com/noo/graphql \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "{ me { id name email } }"}'`}
          onCopy={() => handleCopy('graphql-request')}
          copied={copiedId === 'graphql-request'}
        />

        <h4>{t('Get Current User')}</h4>
        <CodeBlock
          language='graphql'
          code={`query {
  me {
    id
    name
    email
    avatarUrl
    memberships {
      items {
        group {
          id
          name
          slug
        }
        role
      }
    }
  }
}`}
          onCopy={() => handleCopy('get-me')}
          copied={copiedId === 'get-me'}
        />

        <h4>{t('Get Group Posts')}</h4>
        <CodeBlock
          language='graphql'
          code={`query GetGroupPosts($slug: String!, $first: Int) {
  group(slug: $slug) {
    id
    name
    posts(first: $first) {
      items {
        id
        title
        details
        type
        creator {
          id
          name
        }
        createdAt
      }
    }
  }
}`}
          onCopy={() => handleCopy('get-posts')}
          copied={copiedId === 'get-posts'}
        />

        <h4>{t('Create a Post')}</h4>
        <CodeBlock
          language='graphql'
          code={`mutation CreatePost($input: PostInput!) {
  createPost(input: $input) {
    id
    title
    details
    type
  }
}

# Variables:
{
  "input": {
    "title": "My Post Title",
    "details": "Post content here...",
    "type": "discussion",
    "groupIds": ["123"]
  }
}`}
          onCopy={() => handleCopy('create-post')}
          copied={copiedId === 'create-post'}
        />

        <h3>{t('Available Scopes')}</h3>
        <table className={classes.table}>
          <thead>
            <tr>
              <th>{t('Scope')}</th>
              <th>{t('Description')}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>openid</code></td><td>{t('Required for OIDC compliance - returns user sub (ID)')}</td></tr>
            <tr><td><code>profile</code></td><td>{t('Read user profile (name, picture, website, updated_at)')}</td></tr>
            <tr><td><code>email</code></td><td>{t('Read user email address and verification status')}</td></tr>
            <tr><td><code>address</code></td><td>{t('Read user address information')}</td></tr>
            <tr><td><code>phone</code></td><td>{t('Read user phone number')}</td></tr>
            <tr><td><code>offline_access</code></td><td>{t('Request refresh tokens for long-lived access')}</td></tr>
            <tr><td><code>api:read</code></td><td>{t('Read access to Hylo GraphQL API')}</td></tr>
            <tr><td><code>api:write</code></td><td>{t('Write access to Hylo GraphQL API (requires super role)')}</td></tr>
            <tr><td><code>bot</code></td><td>{t('Enable bot functionality for the application')}</td></tr>
          </tbody>
        </table>

        <h3>{t('Authorization & Security')}</h3>
        <div className={classes.warning}>
          <Icon name='AlertTriangle' />
          <div>
            <strong>{t('Group-Level Access Control')}</strong>
            <p>{t('Users can only access groups they are members of. API requests automatically filter to authorized groups. Attempting to access unauthorized groups returns a 403 Forbidden error.')}</p>
          </div>
        </div>

        <h4>{t('Bot Permissions')}</h4>
        <p>{t('Bots have specific granular permissions within groups:')}</p>
        <table className={classes.table}>
          <thead>
            <tr>
              <th>{t('Permission')}</th>
              <th>{t('Description')}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>read_posts</code></td><td>{t('Read posts in groups')}</td></tr>
            <tr><td><code>create_posts</code></td><td>{t('Create new posts')}</td></tr>
            <tr><td><code>create_comments</code></td><td>{t('Add comments to posts')}</td></tr>
            <tr><td><code>read_members</code></td><td>{t('View group member list')}</td></tr>
            <tr><td><code>send_messages</code></td><td>{t('Send direct messages')}</td></tr>
            <tr><td><code>manage_events</code></td><td>{t('Create and manage events')}</td></tr>
            <tr><td><code>read_announcements</code></td><td>{t('View announcements')}</td></tr>
            <tr><td><code>create_announcements</code></td><td>{t('Create announcements')}</td></tr>
          </tbody>
        </table>
        <p>{t('Access must be granted by group moderators.')}</p>

        <h3>{t('Zapier Integration')}</h3>
        <p>{t('Hylo supports Zapier triggers for automation workflows:')}</p>
        <ul className={classes.featureList}>
          <li>{t('New post created in a group')}</li>
          <li>{t('New comment on a post')}</li>
          <li>{t('New member joined')}</li>
        </ul>
        <div className={classes.warning}>
          <Icon name='Info' />
          <div>
            <p>{t('Direct webhook endpoints are not currently available. For real-time event notifications, use the Zapier integration or poll the GraphQL API.')}</p>
          </div>
        </div>
        <div className={classes.docLinks}>
          <a href='https://zapier.com/apps/hylo' target='_blank' rel='noopener noreferrer'>
            <Icon name='Link' /> {t('Configure Hylo on Zapier')}
          </a>
        </div>

        <h3>{t('Error Handling')}</h3>
        <table className={classes.table}>
          <thead>
            <tr>
              <th>{t('Status')}</th>
              <th>{t('Meaning')}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>200</code></td><td>{t('Success')}</td></tr>
            <tr><td><code>400</code></td><td>{t('Bad Request - Invalid parameters')}</td></tr>
            <tr><td><code>401</code></td><td>{t('Unauthorized - Invalid/expired token')}</td></tr>
            <tr><td><code>403</code></td><td>{t('Forbidden - Insufficient permissions')}</td></tr>
            <tr><td><code>404</code></td><td>{t('Not Found')}</td></tr>
            <tr><td><code>500</code></td><td>{t('Server Error')}</td></tr>
          </tbody>
        </table>

        <h3>{t('Security Best Practices')}</h3>
        <div className={classes.checklist}>
          <div className={classes.checkItem}>
            <Icon name='Checkmark' />
            <span>{t('Store client secrets securely (environment variables, secret managers)')}</span>
          </div>
          <div className={classes.checkItem}>
            <Icon name='Checkmark' />
            <span>{t('Always use HTTPS for all API requests')}</span>
          </div>
          <div className={classes.checkItem}>
            <Icon name='Checkmark' />
            <span>{t('Request only the minimal scopes needed')}</span>
          </div>
          <div className={classes.checkItem}>
            <Icon name='Checkmark' />
            <span>{t('Implement token refresh before expiration')}</span>
          </div>
          <div className={classes.checkItem}>
            <Icon name='Checkmark' />
            <span>{t('Never expose tokens in client-side code')}</span>
          </div>
          <div className={classes.checkItem}>
            <Icon name='Checkmark' />
            <span>{t('Validate the state parameter to prevent CSRF attacks')}</span>
          </div>
        </div>

        <h3>{t('Interactive Playground')}</h3>
        <p>{t('Explore the full API with our interactive GraphQL Playground:')}</p>
        <div className={classes.docLinks}>
          <a href='/noo/graphql' target='_blank' rel='noopener noreferrer'>
            <Icon name='Code' /> {t('Open GraphQL Playground')}
          </a>
        </div>
      </section>
    </div>
  )
}

export default DeveloperSettingsTab
