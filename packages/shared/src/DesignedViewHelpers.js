/**
 * Designed views: a group page made of building blocks, stored as data.
 *
 * A steward describes the page they want in a chat and an AI model arranges
 * the blocks; the same format can be written by hand. Only this data is
 * stored and rendered, never HTML, CSS or code, so a design can only do what
 * the blocks allow. The web app renders each block with Hylo's own components
 * and the group's theme.
 *
 *   {
 *     version: 1,
 *     blocks: [
 *       { type: 'heading', text: 'Welcome', level: 1 },
 *       { type: 'text', text: 'What this group is about.' },
 *       { type: 'columns', columns: [
 *         [{ type: 'posts', title: 'Latest', postTypes: ['discussion'], limit: 4, layout: 'list' }],
 *         [{ type: 'events', title: 'Coming up', limit: 3 }]
 *       ] }
 *     ]
 *   }
 *
 * The backend validates on write with validateDesignedView and the web app
 * sanitizes on read with sanitizeDesignedView, the same split as group themes.
 */

export const DESIGNED_VIEW_VERSION = 1

export const DESIGNED_VIEW_MAX_BLOCKS = 30
export const DESIGNED_VIEW_MAX_COLUMNS = 3
export const DESIGNED_VIEW_MAX_BLOCKS_PER_COLUMN = 8

export const DESIGNED_VIEW_POST_TYPES = ['discussion', 'event', 'offer', 'project', 'proposal', 'request', 'resource']
export const DESIGNED_VIEW_POST_LAYOUTS = ['list', 'cards']
export const DESIGNED_VIEW_CALLOUT_TONES = ['accent', 'primary', 'muted']
// Places inside the group a button can lead to; the web app turns each into a URL
export const DESIGNED_VIEW_DESTINATIONS = ['stream', 'events', 'members', 'about', 'discussions', 'projects', 'resources', 'map']

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const isPlainObject = value => !!value && typeof value === 'object' && !Array.isArray(value)

const text = (max, { required = true } = {}) => ({ kind: 'text', max, required })
const oneOf = (options, fallback) => ({ kind: 'oneOf', options, fallback })
const int = (min, max, fallback) => ({ kind: 'int', min, max, fallback })
const listOf = (options, max) => ({ kind: 'listOf', options, max })
const httpsUrl = () => ({ kind: 'httpsUrl' })

/**
 * Every block type and its fields. `required` text must be non-empty; fields
 * with a fallback may be left out and take the fallback.
 */
export const DESIGNED_VIEW_BLOCKS = {
  heading: { text: text(120), level: oneOf([1, 2, 3], 2) },
  text: { text: text(2000) },
  callout: { title: text(120, { required: false }), text: text(600), tone: oneOf(DESIGNED_VIEW_CALLOUT_TONES, 'accent') },
  posts: {
    title: text(120, { required: false }),
    // An empty list means every type
    postTypes: listOf(DESIGNED_VIEW_POST_TYPES, DESIGNED_VIEW_POST_TYPES.length),
    limit: int(1, 12, 5),
    layout: oneOf(DESIGNED_VIEW_POST_LAYOUTS, 'list')
  },
  events: { title: text(120, { required: false }), limit: int(1, 12, 4) },
  members: { title: text(120, { required: false }), limit: int(1, 24, 8) },
  button: { label: text(60), destination: oneOf([...DESIGNED_VIEW_DESTINATIONS, 'url'], 'stream'), url: httpsUrl() },
  divider: {}
}

export const DESIGNED_VIEW_BLOCK_TYPES = [...Object.keys(DESIGNED_VIEW_BLOCKS), 'columns']

function isHttpsUrl (value) {
  if (typeof value !== 'string' || value.length > 500) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !!parsed.hostname
  } catch (e) {
    return false
  }
}

/**
 * Checks one field. Returns { value } with the value to store, or { error }.
 */
function checkField (rule, raw) {
  const missing = raw === undefined || raw === null
  switch (rule.kind) {
    case 'text': {
      if (missing || raw === '') return rule.required ? { error: 'is required' } : { value: undefined }
      if (typeof raw !== 'string') return { error: 'must be text' }
      const trimmed = raw.trim()
      if (!trimmed) return rule.required ? { error: 'is required' } : { value: undefined }
      if (trimmed.length > rule.max) return { error: `must be at most ${rule.max} characters` }
      return { value: trimmed }
    }
    case 'oneOf':
      if (missing) return { value: rule.fallback }
      return rule.options.includes(raw) ? { value: raw } : { error: `must be one of ${rule.options.join(', ')}` }
    case 'int':
      if (missing) return { value: rule.fallback }
      if (!Number.isInteger(raw) || raw < rule.min || raw > rule.max) return { error: `must be a whole number from ${rule.min} to ${rule.max}` }
      return { value: raw }
    case 'listOf': {
      if (missing) return { value: [] }
      if (!Array.isArray(raw) || raw.length > rule.max) return { error: `must be a list of up to ${rule.max} items` }
      const unknown = raw.find(item => !rule.options.includes(item))
      if (unknown !== undefined) return { error: `has unknown item ${JSON.stringify(unknown)}; use ${rule.options.join(', ')}` }
      return { value: [...new Set(raw)] }
    }
    case 'httpsUrl':
      if (missing || raw === '') return { value: undefined }
      return isHttpsUrl(raw) ? { value: raw } : { error: 'must be an https:// address' }
    default:
      return { error: 'is not supported' }
  }
}

function checkBlock (raw, path, errors, { allowColumns }) {
  if (!isPlainObject(raw)) {
    errors.push(`${path} must be an object`)
    return null
  }
  if (raw.type === 'columns') {
    if (!allowColumns) {
      errors.push(`${path}: columns cannot go inside columns`)
      return null
    }
    Object.keys(raw).forEach(key => {
      if (key !== 'type' && key !== 'columns') errors.push(`${path}: unknown field "${key}"`)
    })
    if (!Array.isArray(raw.columns) || raw.columns.length < 2 || raw.columns.length > DESIGNED_VIEW_MAX_COLUMNS) {
      errors.push(`${path}: columns must be a list of 2 to ${DESIGNED_VIEW_MAX_COLUMNS} columns`)
      return null
    }
    const columns = raw.columns.map((column, c) => {
      if (!Array.isArray(column) || column.length > DESIGNED_VIEW_MAX_BLOCKS_PER_COLUMN) {
        errors.push(`${path}.columns[${c}] must be a list of up to ${DESIGNED_VIEW_MAX_BLOCKS_PER_COLUMN} blocks`)
        return []
      }
      return column.map((block, b) => checkBlock(block, `${path}.columns[${c}][${b}]`, errors, { allowColumns: false }))
    })
    return { type: 'columns', columns }
  }

  if (typeof raw.type !== 'string' || !hasOwn(DESIGNED_VIEW_BLOCKS, raw.type)) {
    errors.push(`${path}: unknown block type ${JSON.stringify(raw.type)}; use ${DESIGNED_VIEW_BLOCK_TYPES.join(', ')}`)
    return null
  }
  const fields = DESIGNED_VIEW_BLOCKS[raw.type]
  const block = { type: raw.type }
  Object.keys(raw).forEach(key => {
    if (key !== 'type' && !hasOwn(fields, key)) errors.push(`${path}: unknown field "${key}" for a ${raw.type} block`)
  })
  Object.entries(fields).forEach(([name, rule]) => {
    const { value, error } = checkField(rule, raw[name])
    if (error) errors.push(`${path}.${name} ${error}`)
    else if (value !== undefined) block[name] = value
  })
  if (raw.type === 'button' && block.destination === 'url' && !block.url) {
    errors.push(`${path}.url is required when the destination is "url"`)
  }
  if (raw.type === 'button' && block.destination !== 'url') delete block.url
  return block
}

/**
 * Strict check for saving a designed view. Returns { view, errors }: `errors`
 * lists every problem (empty when the view is acceptable) and `view` is the
 * clean view to store, with defaults filled in, or null when there are errors.
 */
export function validateDesignedView (raw) {
  if (!isPlainObject(raw)) return { view: null, errors: ['A designed view must be an object'] }

  const errors = []
  Object.keys(raw).forEach(key => {
    if (key !== 'version' && key !== 'blocks') errors.push(`Unknown key "${key}"`)
  })
  if (raw.version !== undefined && raw.version !== DESIGNED_VIEW_VERSION) {
    errors.push(`Unknown version ${JSON.stringify(raw.version)}`)
  }
  if (!Array.isArray(raw.blocks) || raw.blocks.length === 0) {
    errors.push('A designed view needs at least one block')
    return { view: null, errors }
  }
  if (raw.blocks.length > DESIGNED_VIEW_MAX_BLOCKS) {
    errors.push(`A designed view can have at most ${DESIGNED_VIEW_MAX_BLOCKS} blocks`)
    return { view: null, errors }
  }

  const blocks = raw.blocks.map((block, i) => checkBlock(block, `blocks[${i}]`, errors, { allowColumns: true }))
  if (errors.length > 0) return { view: null, errors }
  return { view: { version: DESIGNED_VIEW_VERSION, blocks }, errors }
}

/**
 * Lenient reader for showing a stored view: keeps every block that is valid
 * and drops the rest, so one bad block cannot blank a page. Returns null when
 * nothing usable is left.
 */
export function sanitizeDesignedView (raw) {
  if (!isPlainObject(raw) || !Array.isArray(raw.blocks)) return null

  const keep = (block, allowColumns) => {
    if (isPlainObject(block) && block.type === 'columns' && allowColumns) {
      if (!Array.isArray(block.columns)) return null
      const columns = block.columns
        .slice(0, DESIGNED_VIEW_MAX_COLUMNS)
        .map(column => Array.isArray(column)
          ? column.slice(0, DESIGNED_VIEW_MAX_BLOCKS_PER_COLUMN).map(inner => keep(inner, false)).filter(Boolean)
          : [])
        .filter(column => column.length > 0)
      if (columns.length === 0) return null
      return columns.length === 1 ? columns[0] : { type: 'columns', columns }
    }
    const errors = []
    const clean = checkBlock(block, 'block', errors, { allowColumns: false })
    return errors.length === 0 ? clean : null
  }

  const blocks = raw.blocks.slice(0, DESIGNED_VIEW_MAX_BLOCKS).map(block => keep(block, true)).filter(Boolean).flat()
  return blocks.length > 0 ? { version: DESIGNED_VIEW_VERSION, blocks } : null
}

function fieldSchema (rule) {
  switch (rule.kind) {
    case 'text': return { type: 'string' }
    case 'oneOf': return typeof rule.options[0] === 'number' ? { type: 'integer', enum: rule.options } : { type: 'string', enum: rule.options }
    case 'int': return { type: 'integer' }
    case 'listOf': return { type: 'array', items: { type: 'string', enum: rule.options } }
    default: return { type: 'string' }
  }
}

/**
 * JSON Schema for a designed view, for asking an AI model to produce one. Every
 * field is listed as required because structured output needs that; optional
 * text is sent as an empty string, which validateDesignedView accepts.
 */
export function designedViewJsonSchema () {
  const leaf = Object.entries(DESIGNED_VIEW_BLOCKS).map(([type, fields]) => ({
    type: 'object',
    properties: {
      type: { type: 'string', enum: [type] },
      ...Object.fromEntries(Object.entries(fields).map(([name, rule]) => [name, fieldSchema(rule)]))
    },
    required: ['type', ...Object.keys(fields)],
    additionalProperties: false
  }))
  const columns = {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['columns'] },
      columns: { type: 'array', items: { type: 'array', items: { anyOf: leaf } } }
    },
    required: ['type', 'columns'],
    additionalProperties: false
  }
  return {
    type: 'object',
    properties: { blocks: { type: 'array', items: { anyOf: [...leaf, columns] } } },
    required: ['blocks'],
    additionalProperties: false
  }
}
