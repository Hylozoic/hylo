/**
 * Shared rules for the Group Assistant (Axl), the private assistant for a
 * group's stewards: its settings, and the structured parts one of its
 * messages can carry.
 *
 * Both are checked here rather than trusted, because settings come from a
 * browser and message parts come from an AI model. The server stores and shows
 * only what these functions return.
 */

// The toggles on the Group assistant settings card, with their defaults.
// The assistant starts off: it reads nothing until a steward turns it on and chooses spaces.
export const GROUP_ASSISTANT_DEFAULTS = {
  enabled: false,
  // Suggest things for stewards to follow up on (unwelcomed newcomers, unanswered questions)
  followUps: true,
  // Notice when a few people carry the group
  shareLoad: true,
  // Members can ask for a summary of a busy chat
  summarize: true,
  // Members can ask questions answered from the group's posts
  answerMembers: false,
  // Ids of the group itself and of its child spaces that the assistant may read
  readableGroupIds: [],
  // Where requests run. 'hosted' is the only choice until shared compute exists
  runsOn: 'hosted'
}

export const GROUP_ASSISTANT_FLAGS = ['enabled', 'followUps', 'shareLoad', 'summarize', 'answerMembers']
export const GROUP_ASSISTANT_RUNS_ON = ['hosted']
export const MAX_ASSISTANT_READABLE_GROUPS = 100
export const MAX_ASSISTANT_MESSAGE_LENGTH = 4000

const ID_PATTERN = /^[1-9][0-9]{0,18}$/
const asId = value => {
  const id = typeof value === 'number' && Number.isInteger(value) ? String(value) : value
  return typeof id === 'string' && ID_PATTERN.test(id) ? id : null
}

/**
 * Assistant settings with every field present and of the right type. Unknown
 * fields are dropped, and anything malformed falls back to its default, so
 * this never throws: use it on stored settings before reading them.
 */
export function sanitizeGroupAssistantSettings (raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const settings = { ...GROUP_ASSISTANT_DEFAULTS }
  for (const flag of GROUP_ASSISTANT_FLAGS) {
    if (typeof input[flag] === 'boolean') settings[flag] = input[flag]
  }
  const ids = Array.isArray(input.readableGroupIds) ? input.readableGroupIds.map(asId).filter(Boolean) : []
  settings.readableGroupIds = [...new Set(ids)].slice(0, MAX_ASSISTANT_READABLE_GROUPS)
  if (GROUP_ASSISTANT_RUNS_ON.includes(input.runsOn)) settings.runsOn = input.runsOn
  return settings
}

/**
 * Checks settings a steward is saving. Returns { settings, errors }: unlike
 * sanitizeGroupAssistantSettings, a wrong value is an error, not a silent default.
 */
export function validateGroupAssistantSettings (raw) {
  const errors = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { settings: null, errors: ['settings must be an object'] }
  for (const flag of GROUP_ASSISTANT_FLAGS) {
    if (raw[flag] !== undefined && typeof raw[flag] !== 'boolean') errors.push(`${flag} must be true or false`)
  }
  if (raw.readableGroupIds !== undefined) {
    if (!Array.isArray(raw.readableGroupIds)) errors.push('readableGroupIds must be a list')
    else if (raw.readableGroupIds.length > MAX_ASSISTANT_READABLE_GROUPS) errors.push(`readableGroupIds can hold up to ${MAX_ASSISTANT_READABLE_GROUPS} spaces`)
    else if (raw.readableGroupIds.some(id => !asId(id))) errors.push('readableGroupIds must be ids')
  }
  if (raw.runsOn !== undefined && !GROUP_ASSISTANT_RUNS_ON.includes(raw.runsOn)) errors.push(`runsOn must be one of: ${GROUP_ASSISTANT_RUNS_ON.join(', ')}`)
  return errors.length > 0 ? { settings: null, errors } : { settings: sanitizeGroupAssistantSettings(raw), errors }
}

// ---------- Message parts ----------

export const ASSISTANT_PART_TYPES = ['counsel', 'bullets', 'quotedPost', 'draft']
const MAX_PARTS = 6
const MAX_STEPS = 5
const MAX_BULLETS = 8
const MAX_DRAFT_LENGTH = 3000

const clean = (value, max) => typeof value === 'string' ? value.replace(/\s+\n/g, '\n').trim().slice(0, max) : ''

/**
 * The parts of an assistant message that are safe to store and show, from
 * what an AI model returned. Anything that is not a known part, or that
 * points outside what the assistant was allowed to read, is dropped:
 *
 * - a quoted post must be one of `postIds` (the posts the model was given)
 * - a draft replies to one of `postIds`, or is a new post in one of `groupIds`
 *   (the spaces the assistant may read); a draft aimed anywhere else is dropped
 *
 * Returns { parts, dropped }.
 */
export function sanitizeAssistantParts (raw, { postIds = [], groupIds = [] } = {}) {
  const posts = new Set(postIds.map(String))
  const groups = new Set(groupIds.map(String))
  const parts = []
  let dropped = 0

  for (const part of Array.isArray(raw) ? raw : []) {
    let kept = null
    switch (part?.type) {
      case 'counsel': {
        const steps = (Array.isArray(part.steps) ? part.steps : [])
          .map(step => ({ title: clean(step?.title, 80), line: clean(step?.line, 300) }))
          .filter(step => step.title)
          .slice(0, MAX_STEPS)
        if (steps.length > 0) kept = { type: 'counsel', steps }
        break
      }
      case 'bullets': {
        const items = (Array.isArray(part.items) ? part.items : []).map(item => clean(item, 300)).filter(Boolean).slice(0, MAX_BULLETS)
        if (items.length > 0) kept = { type: 'bullets', items }
        break
      }
      case 'quotedPost': {
        const postId = asId(part.postId)
        if (postId && posts.has(postId)) kept = { type: 'quotedPost', postId }
        break
      }
      case 'draft': {
        const text = clean(part.text, MAX_DRAFT_LENGTH)
        const replyToPostId = asId(part.replyToPostId)
        const groupId = asId(part.groupId)
        if (!text) break
        if (replyToPostId) {
          if (posts.has(replyToPostId)) kept = { type: 'draft', text, replyToPostId }
        } else if (groupId && groups.has(groupId)) {
          kept = { type: 'draft', text, title: clean(part.title, 120), groupId }
        }
        break
      }
    }
    if (kept && parts.length < MAX_PARTS) parts.push(kept)
    else dropped += 1
  }
  return { parts, dropped }
}

/**
 * The JSON schema an AI model is asked to answer in: a line of text and a
 * list of parts. Ids are strings; an empty string means "none".
 */
export function groupAssistantJsonSchema () {
  const text = description => ({ type: 'string', description })
  const part = {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ASSISTANT_PART_TYPES },
      steps: {
        type: 'array',
        description: 'counsel only: numbered steps',
        items: {
          type: 'object',
          properties: { title: text('A few words'), line: text('One sentence') },
          required: ['title', 'line'],
          additionalProperties: false
        }
      },
      items: { type: 'array', description: 'bullets only', items: { type: 'string' } },
      postId: text('quotedPost only: the id of a post you were given, digits only'),
      text: text('draft only: the words the steward would post, in their voice'),
      title: text('draft only, for a new post: its title. Empty for a reply'),
      groupId: text('draft only, for a new post: the id of the space it would be posted in. Empty for a reply'),
      replyToPostId: text('draft only, for a reply: the id of the post it replies to. Empty for a new post')
    },
    required: ['type', 'steps', 'items', 'postId', 'text', 'title', 'groupId', 'replyToPostId'],
    additionalProperties: false
  }
  return {
    type: 'object',
    properties: {
      text: text('What you say to the stewards, in plain sentences'),
      parts: { type: 'array', items: part }
    },
    required: ['text', 'parts'],
    additionalProperties: false
  }
}
