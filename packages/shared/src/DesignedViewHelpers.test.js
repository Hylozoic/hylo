import {
  designedViewImageUrls,
  removeUnlistedImages,
  DESIGNED_VIEW_BLOCKS,
  DESIGNED_VIEW_MAX_BLOCKS,
  designedViewJsonSchema,
  sanitizeDesignedView,
  validateDesignedView
} from './DesignedViewHelpers'
import * as shared from './index'

const view = {
  version: 1,
  blocks: [
    { type: 'heading', text: 'Welcome', level: 1 },
    { type: 'text', text: 'What this group is about.' },
    {
      type: 'columns',
      columns: [
        [{ type: 'posts', title: 'Latest', postTypes: ['discussion'], limit: 4, layout: 'list' }],
        [{ type: 'events', title: 'Coming up', limit: 3 }]
      ]
    },
    { type: 'button', label: 'Meet everyone', destination: 'members' }
  ]
}

describe('DesignedViewHelpers exports', () => {
  it('are available from the package index', () => {
    expect(shared.validateDesignedView).toBe(validateDesignedView)
    expect(shared.sanitizeDesignedView).toBe(sanitizeDesignedView)
  })
})

describe('validateDesignedView', () => {
  it('accepts a valid view and returns it unchanged', () => {
    expect(validateDesignedView(view)).toEqual({ view, errors: [] })
  })

  it('fills in defaults and trims text', () => {
    const result = validateDesignedView({
      blocks: [{ type: 'heading', text: '  Hello  ' }, { type: 'posts' }, { type: 'callout', text: 'Note', title: '' }]
    })
    expect(result.errors).toEqual([])
    expect(result.view).toEqual({
      version: 1,
      blocks: [
        { type: 'heading', text: 'Hello', level: 2 },
        { type: 'posts', postTypes: [], limit: 5, layout: 'list' },
        { type: 'callout', text: 'Note', tone: 'accent' }
      ]
    })
  })

  it('rejects anything that is not a known block or field', () => {
    const bad = validateDesignedView({
      blocks: [
        { type: 'html', html: '<script>alert(1)</script>' },
        { type: 'text', text: 'ok', style: 'color: red' },
        { type: 'heading', text: '' },
        { type: 'posts', postTypes: ['chat'], limit: 500, layout: 'grid' },
        { type: 'toString' }
      ],
      css: 'body { display: none }'
    })
    expect(bad.view).toBeNull()
    expect(bad.errors).toEqual(expect.arrayContaining([
      'Unknown key "css"',
      expect.stringContaining('blocks[0]: unknown block type "html"'),
      'blocks[1]: unknown field "style" for a text block',
      'blocks[2].text is required',
      expect.stringContaining('blocks[3].postTypes has unknown item "chat"'),
      'blocks[3].limit must be a whole number from 1 to 12',
      expect.stringContaining('blocks[3].layout must be one of'),
      expect.stringContaining('blocks[4]: unknown block type "toString"')
    ]))
  })

  it('only lets buttons lead inside the group or to https addresses', () => {
    const button = extra => validateDesignedView({ blocks: [{ type: 'button', label: 'Go', ...extra }] })
    expect(button({ destination: 'url', url: 'https://example.org/join' }).errors).toEqual([])
    expect(button({ destination: 'url' }).errors).toEqual(['blocks[0].url is required when the destination is "url"'])
    // eslint-disable-next-line no-script-url
    expect(button({ destination: 'url', url: 'javascript:alert(1)' }).errors[0]).toContain('must be an https:// address')
    expect(button({ destination: 'url', url: 'http://example.org' }).errors[0]).toContain('must be an https:// address')
    expect(button({ destination: 'admin' }).errors[0]).toContain('must be one of')
    // A leftover address is dropped when the button stays inside the group
    expect(button({ destination: 'events', url: 'https://example.org' }).view.blocks[0]).toEqual({ type: 'button', label: 'Go', destination: 'events' })
  })

  it('limits size and nesting', () => {
    const many = Array.from({ length: DESIGNED_VIEW_MAX_BLOCKS + 1 }, () => ({ type: 'divider' }))
    expect(validateDesignedView({ blocks: many }).errors[0]).toContain(`at most ${DESIGNED_VIEW_MAX_BLOCKS} blocks`)
    expect(validateDesignedView({ blocks: [] }).errors).toEqual(['A designed view needs at least one block'])
    expect(validateDesignedView(null).errors).toEqual(['A designed view must be an object'])

    const nested = { type: 'columns', columns: [[{ type: 'columns', columns: [[], []] }], []] }
    expect(validateDesignedView({ blocks: [nested] }).errors).toEqual(['blocks[0].columns[0][0]: columns cannot go inside columns or a canvas'])
    expect(validateDesignedView({ blocks: [{ type: 'columns', columns: [[]] }] }).errors[0]).toContain('2 to 3 columns')
  })
})

describe('sanitizeDesignedView', () => {
  it('keeps valid blocks and drops the rest', () => {
    expect(sanitizeDesignedView({
      blocks: [
        { type: 'heading', text: 'Kept' },
        { type: 'html', html: '<b>x</b>' },
        { type: 'columns', columns: [[{ type: 'divider' }, { type: 'nope' }], [{ type: 'text', text: 'Side' }]] }
      ]
    })).toEqual({
      version: 1,
      blocks: [
        { type: 'heading', text: 'Kept', level: 2 },
        { type: 'columns', columns: [[{ type: 'divider' }], [{ type: 'text', text: 'Side' }]] }
      ]
    })
  })

  it('unwraps columns left with a single column, and returns null when nothing is usable', () => {
    expect(sanitizeDesignedView({ blocks: [{ type: 'columns', columns: [[{ type: 'divider' }], [{ type: 'nope' }]] }] }))
      .toEqual({ version: 1, blocks: [{ type: 'divider' }] })
    expect(sanitizeDesignedView({ blocks: [{ type: 'nope' }] })).toBeNull()
    expect(sanitizeDesignedView('x')).toBeNull()
  })
})

describe('designedViewJsonSchema', () => {
  it('describes every block type with all fields required and nothing extra allowed', () => {
    const schema = designedViewJsonSchema()
    const leaf = schema.$defs.block.anyOf
    const [leafRef, columns, canvas] = schema.properties.blocks.items.anyOf
    expect(canvas.properties.regions.items.properties.blocks.items).toEqual({ $ref: '#/$defs/block' })
    expect(canvas.properties.regions.items.required).toEqual(['title', 'note', 'tone', 'col', 'row', 'blocks'])
    expect(leafRef).toEqual({ $ref: '#/$defs/block' })
    expect(columns.properties.columns.items.items).toEqual({ $ref: '#/$defs/block' })
    expect(leaf.map(option => option.properties.type.enum[0])).toEqual(Object.keys(DESIGNED_VIEW_BLOCKS))
    ;[...leaf, columns].forEach(option => {
      expect(option.additionalProperties).toBe(false)
      expect(option.required).toEqual(Object.keys(option.properties))
    })
  })

  it('accepts what a model would send for it: every field present, empty strings for unused text', () => {
    const fromModel = {
      blocks: [
        { type: 'callout', title: '', text: 'Bring a friend', tone: 'primary' },
        { type: 'button', label: 'Events', destination: 'events', url: '' },
        { type: 'members', title: '', limit: 6 }
      ]
    }
    expect(validateDesignedView(fromModel).errors).toEqual([])
  })
})

describe('image and hero blocks', () => {
  const garden = 'https://uploads.example.org/garden.jpg'
  const tools = 'https://uploads.example.org/tools.jpg'

  it('accepts an image and a hero, with defaults', () => {
    const result = validateDesignedView({
      blocks: [{ type: 'hero', imageUrl: garden, title: 'Welcome' }, { type: 'image', url: tools, alt: 'Tools', caption: '' }]
    })
    expect(result.errors).toEqual([])
    expect(result.view.blocks).toEqual([
      { type: 'hero', imageUrl: garden, title: 'Welcome', height: 'medium', align: 'left' },
      { type: 'image', url: tools, alt: 'Tools' }
    ])
  })

  it('needs an https image address', () => {
    expect(validateDesignedView({ blocks: [{ type: 'hero', title: 'Welcome' }] }).errors).toEqual(['blocks[0].imageUrl is required'])
    expect(validateDesignedView({ blocks: [{ type: 'image', url: 'http://example.org/a.jpg' }] }).errors[0]).toContain('must be an https:// address')
    // eslint-disable-next-line no-script-url
    expect(validateDesignedView({ blocks: [{ type: 'image', url: 'javascript:alert(1)' }] }).errors[0]).toContain('must be an https:// address')
    expect(validateDesignedView({ blocks: [{ type: 'image', url: 'data:image/png;base64,AAAA' }] }).errors[0]).toContain('must be an https:// address')
  })

  it('lists the images a view uses', () => {
    expect(designedViewImageUrls({
      blocks: [
        { type: 'hero', imageUrl: garden },
        { type: 'columns', columns: [[{ type: 'image', url: tools }], [{ type: 'image', url: garden }]] },
        { type: 'text', text: 'x' }
      ]
    })).toEqual([garden, tools])
    expect(designedViewImageUrls(null)).toEqual([])
  })

  it('removes image blocks whose image was not provided', () => {
    const view = {
      version: 1,
      blocks: [
        { type: 'hero', imageUrl: 'https://elsewhere.example.com/made-up.jpg', title: 'Welcome' },
        { type: 'heading', text: 'Hello', level: 1 },
        { type: 'columns', columns: [[{ type: 'image', url: tools }], [{ type: 'image', url: 'https://elsewhere.example.com/x.png' }]] }
      ]
    }
    expect(removeUnlistedImages(view, [tools])).toEqual({
      removed: 2,
      view: {
        version: 1,
        blocks: [
          { type: 'heading', text: 'Hello', level: 1 },
          { type: 'columns', columns: [[{ type: 'image', url: tools }], []] }
        ]
      }
    })
    expect(removeUnlistedImages(view, [tools, 'https://elsewhere.example.com/made-up.jpg', 'https://elsewhere.example.com/x.png']).removed).toEqual(0)
  })
})

describe('canvas block', () => {
  const region = (extra = {}) => ({ title: 'Requests', col: 0, row: 0, blocks: [{ type: 'posts', postTypes: ['request'], limit: 4 }], ...extra })

  it('accepts regions of blocks placed on a grid, with defaults', () => {
    const result = validateDesignedView({
      blocks: [
        { type: 'heading', text: 'Everything at a glance', level: 1 },
        { type: 'canvas', regions: [region(), region({ title: 'Offers', note: 'What people can spare', tone: 'accent', col: 1 })] }
      ]
    })
    expect(result.errors).toEqual([])
    expect(result.view.blocks[1]).toEqual({
      type: 'canvas',
      regions: [
        { title: 'Requests', tone: 'plain', col: 0, row: 0, blocks: [{ type: 'posts', postTypes: ['request'], limit: 4, layout: 'list' }] },
        { title: 'Offers', note: 'What people can spare', tone: 'accent', col: 1, row: 0, blocks: [{ type: 'posts', postTypes: ['request'], limit: 4, layout: 'list' }] }
      ]
    })
  })

  it('moves a region out of a cell that is already taken', () => {
    const { view } = validateDesignedView({ blocks: [{ type: 'canvas', regions: [region(), region({ title: 'Also here' }), region({ title: 'And here' })] }] })
    expect(view.blocks[0].regions.map(r => [r.col, r.row])).toEqual([[0, 0], [0, 1], [0, 2]])
  })

  it('rejects a canvas that is too small, nested, repeated or holds bad blocks', () => {
    const errorsFor = blocks => validateDesignedView({ blocks }).errors
    expect(errorsFor([{ type: 'canvas', regions: [region()] }])[0]).toContain('needs 2 to 16 regions')
    expect(errorsFor([{ type: 'columns', columns: [[{ type: 'canvas', regions: [region(), region()] }], []] }])[0]).toContain('cannot go inside columns')
    expect(errorsFor([{ type: 'canvas', regions: [region(), region({ col: 1 })] }, { type: 'canvas', regions: [region(), region({ col: 1 })] }]))
      .toEqual(['A designed view can have one canvas'])
    expect(errorsFor([{ type: 'canvas', regions: [region({ title: '' }), region({ col: 9 })] }])).toEqual([
      'blocks[0].regions[0].title is required',
      'blocks[0].regions[1].col must be a whole number from 0 to 5'
    ])
    expect(errorsFor([{ type: 'canvas', regions: [region({ blocks: [{ type: 'html' }] }), region({ col: 1, blocks: [] })] }])).toEqual(expect.arrayContaining([
      expect.stringContaining('blocks[0].regions[0].blocks[0]: unknown block type "html"'),
      'blocks[0].regions[1].blocks must be a list of 1 to 6 blocks'
    ]))
    expect(errorsFor([{ type: 'canvas', regions: [region({ blocks: [{ type: 'columns', columns: [[], []] }] }), region({ col: 1 })] }])[0]).toContain('columns cannot go inside columns or a canvas')
  })

  it('is kept when shown if at least two regions are sound, and dropped otherwise', () => {
    const good = sanitizeDesignedView({
      blocks: [{ type: 'canvas', regions: [region(), region({ col: 1, blocks: [{ type: 'nope' }, { type: 'divider' }] }), { title: 'Broken' }] }]
    })
    expect(good.blocks[0].regions.map(r => r.blocks.map(b => b.type))).toEqual([['posts'], ['divider']])
    expect(sanitizeDesignedView({ blocks: [{ type: 'canvas', regions: [region(), { title: 'Broken' }] }, { type: 'divider' }] }))
      .toEqual({ version: 1, blocks: [{ type: 'divider' }] })
  })

  it('counts and filters images inside regions', () => {
    const pic = 'https://uploads.example.org/a.jpg'
    const view = { version: 1, blocks: [{ type: 'canvas', regions: [region({ blocks: [{ type: 'image', url: pic }, { type: 'divider' }] }), region({ col: 1 })] }] }
    expect(designedViewImageUrls(view)).toEqual([pic])
    const filtered = removeUnlistedImages(view, [])
    expect(filtered.removed).toEqual(1)
    expect(filtered.view.blocks[0].regions[0].blocks).toEqual([{ type: 'divider' }])
  })
})

describe('posts block search', () => {
  it('keeps search words and drops an empty search', () => {
    const { view, errors } = validateDesignedView({
      blocks: [{ type: 'posts', search: ' compost ', limit: 3 }, { type: 'posts', search: '', limit: 3 }]
    })
    expect(errors).toEqual([])
    expect(view.blocks[0].search).toEqual('compost')
    expect(view.blocks[1]).toEqual({ type: 'posts', postTypes: [], limit: 3, layout: 'list' })
  })
})

describe('chart block', () => {
  const harvest = [
    { label: 'June', value: 120 },
    { label: 'July', value: 310 },
    { label: 'August', value: 455.5 },
    { label: 'September', value: 0 }
  ]
  const chart = (extra = {}) => ({ type: 'chart', kind: 'bar', title: 'Harvest by month', points: harvest, ...extra })
  const errorsFor = extra => validateDesignedView({ blocks: [chart(extra)] }).errors

  it('accepts a chart of labelled numbers, with defaults and trimmed text', () => {
    const result = validateDesignedView({
      blocks: [{ type: 'chart', title: ' Harvest ', yLabel: 'Harvest', unit: 'lbs', source: 'Harvest log, page 2', xLabel: '', points: [{ label: ' June ', value: -4 }, { label: 'July', value: 1e6 }] }]
    })
    expect(result.errors).toEqual([])
    expect(result.view.blocks[0]).toEqual({
      type: 'chart',
      kind: 'bar',
      title: 'Harvest',
      yLabel: 'Harvest',
      unit: 'lbs',
      source: 'Harvest log, page 2',
      points: [{ label: 'June', value: -4 }, { label: 'July', value: 1e6 }]
    })
  })

  it('is allowed at the top level, inside columns and inside canvas regions', () => {
    const region = col => ({ title: 'Figures', col, row: 0, blocks: [chart({ kind: 'line' })] })
    expect(validateDesignedView({
      blocks: [
        chart(),
        { type: 'columns', columns: [[chart({ kind: 'pie' })], [{ type: 'divider' }]] },
        { type: 'canvas', regions: [region(0), region(1)] }
      ]
    }).errors).toEqual([])
  })

  it('needs a title, a known kind and 2 to 24 points', () => {
    expect(errorsFor({ title: '' })).toEqual(['blocks[0].title is required'])
    expect(errorsFor({ kind: 'scatter' })[0]).toContain('blocks[0].kind must be one of bar, line, pie')
    expect(errorsFor({ points: undefined })).toEqual(['blocks[0].points must be a list of 2 to 24 points'])
    expect(errorsFor({ points: [{ label: 'Only', value: 1 }] })).toEqual(['blocks[0].points must be a list of 2 to 24 points'])
    const many = Array.from({ length: 25 }, (_, i) => ({ label: `Day ${i + 1}`, value: i }))
    expect(errorsFor({ points: many })).toEqual(['blocks[0].points must be a list of 2 to 24 points'])
    expect(errorsFor({ points: many.slice(0, 24) })).toEqual([])
  })

  it('takes only finite numbers and short labels, and nothing else in a point', () => {
    const withPoint = point => errorsFor({ points: [{ label: 'June', value: 1 }, point] })
    expect(withPoint({ label: 'July', value: NaN })).toEqual(['blocks[0].points [1].value must be a number'])
    expect(withPoint({ label: 'July', value: Infinity })).toEqual(['blocks[0].points [1].value must be a number'])
    expect(withPoint({ label: 'July', value: '310' })).toEqual(['blocks[0].points [1].value must be a number'])
    expect(withPoint({ label: 'July', value: null })).toEqual(['blocks[0].points [1].value must be a number'])
    expect(withPoint({ label: 'July', value: 1e13 })).toEqual(['blocks[0].points [1].value must be a number'])
    expect(withPoint({ label: '', value: 3 })).toEqual(['blocks[0].points [1].label is required'])
    expect(withPoint({ label: 'x'.repeat(41), value: 3 })).toEqual(['blocks[0].points [1].label must be at most 40 characters'])
    expect(withPoint({ label: 'July', value: 3, color: 'red' })).toEqual(['blocks[0].points [1] must be { label, value }'])
    expect(withPoint('July: 3')).toEqual(['blocks[0].points [1] must be { label, value }'])
    expect(errorsFor({ svg: '<svg/>' })).toEqual(['blocks[0]: unknown field "svg" for a chart block'])
  })

  it('keeps a pie to a few slices that add up to something', () => {
    const slices = n => Array.from({ length: n }, (_, i) => ({ label: `Part ${i + 1}`, value: 1 }))
    expect(errorsFor({ kind: 'pie', points: slices(8) })).toEqual([])
    expect(errorsFor({ kind: 'pie', points: slices(9) })).toEqual(['blocks[0].points: a pie chart can have at most 8 slices'])
    expect(errorsFor({ kind: 'pie', points: [{ label: 'A', value: 3 }, { label: 'B', value: -1 }] })).toEqual(['blocks[0].points: a pie chart cannot have negative values'])
    expect(errorsFor({ kind: 'pie', points: [{ label: 'A', value: 0 }, { label: 'B', value: 0 }] })).toEqual(['blocks[0].points: a pie chart needs a value above zero'])
    // The same figures are fine as bars
    expect(errorsFor({ kind: 'bar', points: slices(9) })).toEqual([])
  })

  it('drops a bad chart when shown and keeps the rest of the page', () => {
    expect(sanitizeDesignedView({
      blocks: [
        chart({ points: [{ label: 'June', value: 1 }, { label: 'July', value: 'lots' }] }),
        chart({ title: 'Kept' }),
        { type: 'columns', columns: [[chart({ kind: 'pie', points: [{ label: 'A', value: -1 }, { label: 'B', value: 2 }] })], [{ type: 'divider' }]] }
      ]
    })).toEqual({
      version: 1,
      blocks: [
        { type: 'chart', kind: 'bar', title: 'Kept', points: harvest },
        { type: 'divider' }
      ]
    })
  })

  it('is in the JSON Schema as a list of label and number pairs, and accepts what a model would send', () => {
    const option = designedViewJsonSchema().$defs.block.anyOf.find(o => o.properties.type.enum[0] === 'chart')
    expect(option.properties.points).toEqual({
      type: 'array',
      items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'number' } }, required: ['label', 'value'], additionalProperties: false }
    })
    expect(option.properties.kind).toEqual({ type: 'string', enum: ['bar', 'line', 'pie'] })
    expect(validateDesignedView({
      blocks: [{ type: 'chart', kind: 'line', title: 'Members', xLabel: '', yLabel: '', unit: '', source: '', points: [{ label: '2023', value: 40 }, { label: '2024', value: 52 }] }]
    }).errors).toEqual([])
  })
})
