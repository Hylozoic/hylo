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
 *       { type: 'hero', imageUrl: 'https://.../garden.jpg', title: 'Welcome', height: 'medium' },
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
// A canvas is a large surface people pan and zoom around, with regions of blocks laid out on a grid
export const DESIGNED_VIEW_CANVAS_MIN_REGIONS = 2
export const DESIGNED_VIEW_CANVAS_MAX_REGIONS = 16
export const DESIGNED_VIEW_CANVAS_MAX_BLOCKS_PER_REGION = 6
export const DESIGNED_VIEW_CANVAS_GRID_SIZE = 6
export const DESIGNED_VIEW_CANVAS_TONES = ['plain', 'accent', 'primary', 'muted']

export const DESIGNED_VIEW_POST_TYPES = ['discussion', 'event', 'offer', 'project', 'proposal', 'request', 'resource']
export const DESIGNED_VIEW_POST_LAYOUTS = ['list', 'cards']
export const DESIGNED_VIEW_CALLOUT_TONES = ['accent', 'primary', 'muted']
export const DESIGNED_VIEW_HERO_HEIGHTS = ['short', 'medium', 'tall']
export const DESIGNED_VIEW_HERO_ALIGNMENTS = ['left', 'center']
// The parts of one real post that a page can show, each drawn with Hylo's own post components:
// header (who posted it, its type and when), images, event (date, place and RSVP), body (title and
// details), reactions, comments (the thread and the box to add one), or everything in the usual order
export const DESIGNED_VIEW_POST_PARTS = ['everything', 'header', 'images', 'event', 'body', 'reactions', 'comments']
// Places inside the group a button can lead to; the web app turns each into a URL
export const DESIGNED_VIEW_DESTINATIONS = ['stream', 'events', 'members', 'about', 'discussions', 'projects', 'resources', 'map']
// A chart is drawn by Hylo from figures the steward supplied: a single series of { label, value } points
export const DESIGNED_VIEW_CHART_KINDS = ['bar', 'line', 'pie']
export const DESIGNED_VIEW_CHART_MIN_POINTS = 2
export const DESIGNED_VIEW_CHART_MAX_POINTS = 24
export const DESIGNED_VIEW_CHART_MAX_PIE_SLICES = 8
export const DESIGNED_VIEW_CHART_LABEL_MAX = 40
// Larger numbers than this are almost certainly a mistake, and would not fit on an axis
export const DESIGNED_VIEW_CHART_MAX_VALUE = 1e12

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const isPlainObject = value => !!value && typeof value === 'object' && !Array.isArray(value)

const text = (max, { required = true } = {}) => ({ kind: 'text', max, required })
const oneOf = (options, fallback) => ({ kind: 'oneOf', options, fallback })
const int = (min, max, fallback) => ({ kind: 'int', min, max, fallback })
const listOf = (options, max) => ({ kind: 'listOf', options, max })
const httpsUrl = ({ required = false } = {}) => ({ kind: 'httpsUrl', required })
const postId = () => ({ kind: 'postId' })
// A list of { label, value } points: short text labels and finite numbers
const points = (min, max, labelMax) => ({ kind: 'points', min, max, labelMax })

/**
 * Every block type and its fields. `required` text must be non-empty; fields
 * with a fallback may be left out and take the fallback.
 */
export const DESIGNED_VIEW_BLOCKS = {
  // A banner across the page: an image with a title and optional subtitle over it
  hero: {
    imageUrl: httpsUrl({ required: true }),
    title: text(120, { required: false }),
    subtitle: text(300, { required: false }),
    height: oneOf(DESIGNED_VIEW_HERO_HEIGHTS, 'medium'),
    align: oneOf(DESIGNED_VIEW_HERO_ALIGNMENTS, 'left')
  },
  heading: { text: text(120), level: oneOf([1, 2, 3], 2) },
  text: { text: text(2000) },
  image: { url: httpsUrl({ required: true }), alt: text(200, { required: false }), caption: text(200, { required: false }) },
  callout: { title: text(120, { required: false }), text: text(600), tone: oneOf(DESIGNED_VIEW_CALLOUT_TONES, 'accent') },
  posts: {
    title: text(120, { required: false }),
    // An empty list means every type
    postTypes: listOf(DESIGNED_VIEW_POST_TYPES, DESIGNED_VIEW_POST_TYPES.length),
    // Words to search the group's posts for, to gather posts on a theme
    search: text(60, { required: false }),
    limit: int(1, 12, 5),
    layout: oneOf(DESIGNED_VIEW_POST_LAYOUTS, 'list')
  },
  events: { title: text(120, { required: false }), limit: int(1, 12, 4) },
  members: { title: text(120, { required: false }), limit: int(1, 24, 8) },
  // One part of a real post from the group; several of these with the same postId make up a post's page
  postPart: { postId: postId(), part: oneOf(DESIGNED_VIEW_POST_PARTS, 'everything') },
  button: { label: text(60), destination: oneOf([...DESIGNED_VIEW_DESTINATIONS, 'url'], 'stream'), url: httpsUrl() },
  divider: {},
  // A bar, line or pie chart of figures the steward gave; a snapshot, not live data.
  // Kept to a few fields because the model's schema is close to the size structured output
  // accepts: a unit goes in the title ("Harvest by month (lbs)")
  chart: {
    kind: oneOf(DESIGNED_VIEW_CHART_KINDS, 'bar'),
    title: text(120),
    // Where the figures came from, shown under the chart so readers can check them
    source: text(160, { required: false }),
    points: points(DESIGNED_VIEW_CHART_MIN_POINTS, DESIGNED_VIEW_CHART_MAX_POINTS, DESIGNED_VIEW_CHART_LABEL_MAX)
  }
}

export const DESIGNED_VIEW_BLOCK_TYPES = [...Object.keys(DESIGNED_VIEW_BLOCKS), 'columns', 'canvas']

// The fields of one region of a canvas, besides its blocks
const CANVAS_REGION_FIELDS = {
  title: text(80),
  note: text(300, { required: false }),
  tone: oneOf(DESIGNED_VIEW_CANVAS_TONES, 'plain'),
  // Where the region sits on the canvas grid, counted from the top left
  col: int(0, DESIGNED_VIEW_CANVAS_GRID_SIZE - 1, 0),
  row: int(0, DESIGNED_VIEW_CANVAS_GRID_SIZE - 1, 0)
}

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
    case 'postId': {
      // Ids arrive as strings or numbers; they are stored as strings of digits
      const id = typeof raw === 'number' && Number.isInteger(raw) ? String(raw) : raw
      if (typeof id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(id)) return { error: 'must be the id of a post' }
      return { value: id }
    }
    case 'httpsUrl':
      if (missing || raw === '') return rule.required ? { error: 'is required' } : { value: undefined }
      return isHttpsUrl(raw) ? { value: raw } : { error: 'must be an https:// address' }
    case 'points': {
      if (!Array.isArray(raw) || raw.length < rule.min || raw.length > rule.max) return { error: `must be a list of ${rule.min} to ${rule.max} points` }
      const clean = []
      for (let i = 0; i < raw.length; i++) {
        const point = raw[i]
        if (!isPlainObject(point) || Object.keys(point).some(key => key !== 'label' && key !== 'value')) return { error: `[${i}] must be { label, value }` }
        const label = checkField(text(rule.labelMax), point.label)
        if (label.error) return { error: `[${i}].label ${label.error}` }
        if (!isChartNumber(point.value)) return { error: `[${i}].value must be a number` }
        clean.push({ label: label.value, value: point.value })
      }
      return { value: clean }
    }
    default:
      return { error: 'is not supported' }
  }
}

function isChartNumber (value) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= DESIGNED_VIEW_CHART_MAX_VALUE
}

// A pie shows parts of a whole: a few slices, none negative, adding up to something
function checkPie (block, path, errors) {
  if (block.kind !== 'pie' || !Array.isArray(block.points)) return
  if (block.points.length > DESIGNED_VIEW_CHART_MAX_PIE_SLICES) errors.push(`${path}.points: a pie chart can have at most ${DESIGNED_VIEW_CHART_MAX_PIE_SLICES} slices`)
  if (block.points.some(point => point.value < 0)) errors.push(`${path}.points: a pie chart cannot have negative values`)
  else if (!block.points.some(point => point.value > 0)) errors.push(`${path}.points: a pie chart needs a value above zero`)
}

function checkCanvas (raw, path, errors) {
  Object.keys(raw).forEach(key => {
    if (key !== 'type' && key !== 'regions') errors.push(`${path}: unknown field "${key}"`)
  })
  if (!Array.isArray(raw.regions) || raw.regions.length < DESIGNED_VIEW_CANVAS_MIN_REGIONS || raw.regions.length > DESIGNED_VIEW_CANVAS_MAX_REGIONS) {
    errors.push(`${path}: a canvas needs ${DESIGNED_VIEW_CANVAS_MIN_REGIONS} to ${DESIGNED_VIEW_CANVAS_MAX_REGIONS} regions`)
    return null
  }
  const taken = new Set()
  const regions = raw.regions.map((rawRegion, r) => {
    const regionPath = `${path}.regions[${r}]`
    if (!isPlainObject(rawRegion)) {
      errors.push(`${regionPath} must be an object`)
      return null
    }
    const region = {}
    Object.keys(rawRegion).forEach(key => {
      if (key !== 'blocks' && !hasOwn(CANVAS_REGION_FIELDS, key)) errors.push(`${regionPath}: unknown field "${key}"`)
    })
    Object.entries(CANVAS_REGION_FIELDS).forEach(([name, rule]) => {
      const { value, error } = checkField(rule, rawRegion[name])
      if (error) errors.push(`${regionPath}.${name} ${error}`)
      else if (value !== undefined) region[name] = value
    })
    if (!Array.isArray(rawRegion.blocks) || rawRegion.blocks.length === 0 || rawRegion.blocks.length > DESIGNED_VIEW_CANVAS_MAX_BLOCKS_PER_REGION) {
      errors.push(`${regionPath}.blocks must be a list of 1 to ${DESIGNED_VIEW_CANVAS_MAX_BLOCKS_PER_REGION} blocks`)
      region.blocks = []
    } else {
      region.blocks = rawRegion.blocks.map((block, b) => checkBlock(block, `${regionPath}.blocks[${b}]`, errors, { allowColumns: false }))
    }
    // Two regions in one cell would sit on top of each other: move the later one down its column
    while (taken.has(`${region.col},${region.row}`)) region.row += 1
    taken.add(`${region.col},${region.row}`)
    return region
  })
  return { type: 'canvas', regions }
}

function checkBlock (raw, path, errors, { allowColumns }) {
  if (!isPlainObject(raw)) {
    errors.push(`${path} must be an object`)
    return null
  }
  if (raw.type === 'canvas') {
    if (!allowColumns) {
      errors.push(`${path}: a canvas cannot go inside columns or another canvas`)
      return null
    }
    return checkCanvas(raw, path, errors)
  }
  if (raw.type === 'columns') {
    if (!allowColumns) {
      errors.push(`${path}: columns cannot go inside columns or a canvas`)
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
  if (raw.type === 'chart') checkPie(block, path, errors)
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
  if (raw.blocks.filter(block => block?.type === 'canvas').length > 1) errors.push('A designed view can have one canvas')
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

  let hasCanvas = false
  const keep = (block, allowColumns) => {
    if (isPlainObject(block) && block.type === 'canvas' && allowColumns) {
      if (hasCanvas || !Array.isArray(block.regions)) return null
      // Keep the regions that are sound and the sound blocks inside them
      const regions = block.regions.slice(0, DESIGNED_VIEW_CANVAS_MAX_REGIONS).map(region => {
        if (!isPlainObject(region) || !Array.isArray(region.blocks)) return null
        const blocks = region.blocks.slice(0, DESIGNED_VIEW_CANVAS_MAX_BLOCKS_PER_REGION).map(inner => keep(inner, false)).filter(Boolean)
        return blocks.length > 0 ? { ...region, blocks } : null
      }).filter(Boolean)
      const errors = []
      const clean = regions.length >= DESIGNED_VIEW_CANVAS_MIN_REGIONS ? checkCanvas({ type: 'canvas', regions }, 'block', errors) : null
      if (!clean || errors.length > 0) return null
      hasCanvas = true
      return clean
    }
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
    // A list of objects here makes the schema too large for structured output, so the model
    // writes points as text, one "label | value" per line (see designedViewFromModel)
    case 'points': return { type: 'string' }
    default: return { type: 'string' }
  }
}

// The schema of a field in the one block shape the model writes (see designedViewJsonSchema).
// Fields that several block types share under one name lose their list of options there,
// since the options differ by block; validateDesignedView still checks them.
function flatFieldSchema (rule, shared) {
  if (rule.kind === 'oneOf' && typeof rule.options[0] === 'number') return { type: 'integer' }
  if (shared && rule.kind === 'oneOf') return { type: 'string' }
  if (shared && rule.kind === 'listOf') return { type: 'array', items: { type: 'string' } }
  return fieldSchema(rule)
}

/**
 * JSON Schema for a designed view, for asking an AI model to produce one.
 *
 * Structured output limits how large a schema can be, and one shape per block
 * type went past it. So every leaf block is written in a single shape that has
 * the fields of all block types: the model fills the ones its block type uses
 * and leaves the rest empty, and designedViewFromModel drops the extras before
 * the page is checked. Every field is required because structured output
 * needs that; optional text is sent as an empty string.
 */
export function designedViewJsonSchema () {
  const uses = {}
  for (const fields of Object.values(DESIGNED_VIEW_BLOCKS)) {
    for (const name of Object.keys(fields)) uses[name] = (uses[name] || 0) + 1
  }
  const properties = { type: { type: 'string', enum: Object.keys(DESIGNED_VIEW_BLOCKS) } }
  for (const fields of Object.values(DESIGNED_VIEW_BLOCKS)) {
    for (const [name, rule] of Object.entries(fields)) {
      if (!properties[name]) properties[name] = flatFieldSchema(rule, uses[name] > 1)
    }
  }
  const leaf = { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }
  // Leaf blocks are defined once and referenced, at the top level and inside
  // columns: listing them twice makes the schema too large for structured output
  const columns = {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['columns'] },
      columns: { type: 'array', items: { type: 'array', items: { $ref: '#/$defs/block' } } }
    },
    required: ['type', 'columns'],
    additionalProperties: false
  }
  const canvas = {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['canvas'] },
      regions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ...Object.fromEntries(Object.entries(CANVAS_REGION_FIELDS).map(([name, rule]) => [name, fieldSchema(rule)])),
            blocks: { type: 'array', items: { $ref: '#/$defs/block' } }
          },
          required: [...Object.keys(CANVAS_REGION_FIELDS), 'blocks'],
          additionalProperties: false
        }
      }
    },
    required: ['type', 'regions'],
    additionalProperties: false
  }
  return {
    type: 'object',
    properties: { blocks: { type: 'array', items: { anyOf: [{ $ref: '#/$defs/block' }, columns, canvas] } } },
    required: ['blocks'],
    additionalProperties: false,
    $defs: { block: leaf }
  }
}

// A plain number as people write it: 1200, 1,200, -3.5. No units, words or exponents
const CHART_NUMBER = /^[-+]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/

/**
 * Reads chart points written as text, one "label | value" per line, which is
 * how the model writes them. Returns { points } or { error }; the points still
 * go through validateDesignedView.
 */
export function parseChartPoints (text) {
  if (typeof text !== 'string') return { error: 'must be text, one "label | value" per line' }
  const points = []
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
  for (let i = 0; i < lines.length; i++) {
    const bar = lines[i].lastIndexOf('|')
    if (bar < 0) return { error: `line ${i + 1} needs a label and a value separated by "|"` }
    const raw = lines[i].slice(bar + 1).trim()
    if (!CHART_NUMBER.test(raw)) return { error: `line ${i + 1}: ${JSON.stringify(raw.slice(0, 20))} is not a plain number` }
    points.push({ label: lines[i].slice(0, bar).trim(), value: Number(raw.replace(/,/g, '')) })
  }
  return { points }
}

/**
 * Chart points written as text, the way the model reads and writes them.
 */
export function formatChartPoints (points) {
  return (Array.isArray(points) ? points : []).map(point => `${point?.label} | ${point?.value}`).join('\n')
}

function mapLeafBlocks (view, change) {
  if (!isPlainObject(view) || !Array.isArray(view.blocks)) return view
  const each = list => Array.isArray(list) ? list.map(change) : list
  return {
    ...view,
    blocks: view.blocks.map(block => {
      if (block?.type === 'columns') return { ...block, columns: Array.isArray(block.columns) ? block.columns.map(each) : block.columns }
      if (block?.type === 'canvas') {
        const regions = Array.isArray(block.regions) ? block.regions.map(region => isPlainObject(region) ? { ...region, blocks: each(region.blocks) } : region) : block.regions
        return { ...block, regions }
      }
      return change(block)
    })
  }
}

/**
 * A designed view as the model is shown it: the same, with chart points as text.
 */
export function designedViewForModel (view) {
  return mapLeafBlocks(view, block => block?.type === 'chart' && Array.isArray(block.points) ? { ...block, points: formatChartPoints(block.points) } : block)
}

/**
 * Turns what the model returned back into the stored format: each block keeps
 * only the fields of its own type (the model writes every block in one shape,
 * see designedViewJsonSchema), and chart points written as text become a list.
 * Returns { view, errors }; check the view with validateDesignedView.
 */
export function designedViewFromModel (view) {
  const errors = []
  const converted = mapLeafBlocks(view, raw => {
    const fields = isPlainObject(raw) && hasOwn(DESIGNED_VIEW_BLOCKS, raw.type) ? DESIGNED_VIEW_BLOCKS[raw.type] : null
    const block = fields
      ? Object.fromEntries(Object.entries(raw).filter(([name]) => name === 'type' || hasOwn(fields, name)))
      : raw
    if (block?.type !== 'chart' || typeof block.points !== 'string') return block
    const { points, error } = parseChartPoints(block.points)
    if (error) errors.push(`chart "${String(block.title || '').slice(0, 40)}" points ${error}`)
    return { ...block, points: points || [] }
  })
  return { view: converted, errors }
}

// The fields that hold an image address, by block type
const IMAGE_FIELDS = { hero: 'imageUrl', image: 'url' }

function eachLeafBlock (view, visit) {
  ;(view?.blocks || []).forEach(block => {
    if (block?.type === 'columns') (block.columns || []).forEach(column => (column || []).forEach(visit))
    else if (block?.type === 'canvas') (block.regions || []).forEach(region => (region?.blocks || []).forEach(visit))
    else visit(block)
  })
}

/**
 * The image addresses a designed view uses, in page order, without repeats.
 */
export function designedViewImageUrls (view) {
  const urls = []
  eachLeafBlock(view, block => {
    const field = IMAGE_FIELDS[block?.type]
    if (field && typeof block[field] === 'string' && !urls.includes(block[field])) urls.push(block[field])
  })
  return urls
}

/**
 * A copy of a view without the image and hero blocks whose image is not in
 * `allowedUrls`, and how many were removed. Used on what an AI model returns,
 * so a page can only show images its steward provided.
 */
export function removeUnlistedImages (view, allowedUrls) {
  const allowed = new Set(allowedUrls || [])
  let removed = 0
  const keep = block => {
    const field = IMAGE_FIELDS[block?.type]
    if (!field || allowed.has(block[field])) return true
    removed += 1
    return false
  }
  const isContainer = block => block?.type === 'columns' || block?.type === 'canvas'
  const blocks = (view?.blocks || [])
    .map(block => {
      if (block?.type === 'columns') return { ...block, columns: (block.columns || []).map(column => (column || []).filter(keep)) }
      if (block?.type === 'canvas') {
        return { ...block, regions: (block.regions || []).map(region => ({ ...region, blocks: (region?.blocks || []).filter(keep) })) }
      }
      return block
    })
    .filter(block => isContainer(block) ? true : keep(block))
  return { view: { ...view, blocks }, removed }
}

/**
 * The ids of the posts a designed view shows parts of, in page order, without repeats.
 */
export function designedViewPostIds (view) {
  const ids = []
  eachLeafBlock(view, block => {
    if (block?.type === 'postPart' && block.postId !== undefined && !ids.includes(String(block.postId))) ids.push(String(block.postId))
  })
  return ids
}

/**
 * A copy of a view without the post parts whose post is not in `allowedIds`,
 * and how many were removed. Used on what an AI model returns, and before
 * saving, so a page can only show posts from its own group.
 */
export function removeUnlistedPosts (view, allowedIds) {
  const allowed = new Set((allowedIds || []).map(String))
  let removed = 0
  const keep = block => {
    if (block?.type !== 'postPart' || allowed.has(String(block.postId))) return true
    removed += 1
    return false
  }
  const blocks = (view?.blocks || [])
    .map(block => {
      if (block?.type === 'columns') return { ...block, columns: (block.columns || []).map(column => (column || []).filter(keep)) }
      if (block?.type === 'canvas') {
        return { ...block, regions: (block.regions || []).map(region => ({ ...region, blocks: (region?.blocks || []).filter(keep) })) }
      }
      return block
    })
    .filter(block => block?.type === 'columns' || block?.type === 'canvas' ? true : keep(block))
  return { view: { ...view, blocks }, removed }
}
