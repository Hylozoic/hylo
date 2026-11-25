import { validateDesignedView } from '@hylo/shared'
import { MAX_DESIGN_MESSAGE_LENGTH, normalizeDesignDocuments, normalizeDesignImages } from './designedViewDesign'

/**
 * What is stored for a "Design your own view" session (decision Q-27 on #1784): the chat with
 * Axl, and the page not saved yet. There is one session per designed view, shared by every
 * steward of the group (decision V-05). See the group_view_design_sessions migration.
 *
 * Both come from the browser, so only known fields of the expected shape are kept. A stored
 * session is only ever shown back to the group's stewards, in the designer, where the page is
 * drawn with the same lenient display rules as a saved designed view.
 */

// The model is only sent the newest MAX_DESIGN_MESSAGES of these with each turn
export const MAX_STORED_DESIGN_MESSAGES = 200
export const MAX_DESIGN_SESSION_BYTES = 512 * 1024
const MAX_PICKED_POSTS = 6
const MAX_SUGGESTIONS = 5

const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : ''
const count = value => Number.isFinite(value) && value > 0 ? value : 0

const isId = value => (typeof value === 'string' || Number.isInteger(value)) && /^\d+$/.test(String(value))

/**
 * The conversation to store: [{ role: 'user', text, userId } | { role: 'assistant', text }],
 * newest last. Anything else is dropped rather than refused, so one odd message never loses the rest.
 *
 * userId says which steward asked. The browser sends the whole conversation back, so a user
 * message keeps the userId it comes with only if that steward already appears in the stored
 * conversation (knownUserIds); otherwise it is the steward storing it now (userId), who just sent it.
 */
export function normalizeStoredDesignMessages (messages, { userId, knownUserIds = [] } = {}) {
  if (!Array.isArray(messages)) return []
  const known = new Set(knownUserIds.map(String))
  return messages
    .filter(message => ['user', 'assistant'].includes(message?.role) && typeof message.text === 'string' && message.text.trim())
    .map(message => {
      const stored = { role: message.role, text: message.text.slice(0, MAX_DESIGN_MESSAGE_LENGTH * 2) }
      if (message.role !== 'user') return stored
      const author = isId(message.userId) && known.has(String(message.userId)) ? message.userId : userId
      return isId(author) ? { ...stored, userId: String(author) } : stored
    })
    .slice(-MAX_STORED_DESIGN_MESSAGES)
}

/** The stewards who asked something in a stored conversation, as id strings. */
export function designMessageAuthorIds (messages) {
  return [...new Set((messages || []).map(message => message?.userId).filter(isId).map(String))]
}

function listOrEmpty (normalize, list) {
  try {
    return normalize(list)
  } catch (err) {
    return []
  }
}

/**
 * The unsaved page to store, or null when there is nothing to keep.
 */
export function normalizeDesignSessionDraft (draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null
  let design = null
  if (draft.design) {
    const { view, errors } = validateDesignedView(draft.design)
    if (errors.length === 0) design = view
  }
  const suggestions = draft.suggestions && Array.isArray(draft.suggestions.items)
    ? {
        reply: text(draft.suggestions.reply, MAX_DESIGN_MESSAGE_LENGTH),
        items: draft.suggestions.items.slice(0, MAX_SUGGESTIONS)
          .filter(item => typeof item?.name === 'string' && typeof item?.prompt === 'string')
          .map(item => ({ name: text(item.name, 100), why: text(item.why, 500), prompt: text(item.prompt, MAX_DESIGN_MESSAGE_LENGTH) }))
      }
    : null
  const usage = draft.usageTotal || {}
  return {
    design,
    name: text(draft.name, 255),
    nameEdited: draft.nameEdited === true,
    // The page differs from the saved view (always true for a page not saved yet)
    dirty: draft.dirty === true,
    images: listOrEmpty(normalizeDesignImages, draft.images).map(({ url, name }) => ({ url, name })),
    documents: listOrEmpty(normalizeDesignDocuments, draft.documents),
    posts: (Array.isArray(draft.posts) ? draft.posts : []).slice(0, MAX_PICKED_POSTS)
      .filter(post => post?.id != null && /^\d+$/.test(String(post.id)))
      .map(post => ({ id: String(post.id), title: text(post.title, 300), type: text(post.type, 30) })),
    suggestions,
    usageTotal: {
      count: count(usage.count),
      tokens: count(usage.tokens),
      costUsd: count(usage.costUsd),
      costKnown: usage.costKnown !== false
    }
  }
}

/**
 * What the designer gets back: { messages, draft, version, updatedAt, updatedById, authors }.
 * version is sent back with the next change (see saveGroupViewDesignSession); authors are the
 * stewards who asked something, [{ id, name, avatarUrl }], so the chat can show who asked.
 */
export function presentDesignSession (row, authors = []) {
  if (!row) return null
  return {
    messages: row.messages || [],
    draft: row.draft || null,
    version: row.version,
    updatedAt: row.updated_at,
    updatedById: row.updated_by_id == null ? null : String(row.updated_by_id),
    authors
  }
}
