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
    expect(validateDesignedView({ blocks: [nested] }).errors).toEqual(['blocks[0].columns[0][0]: columns cannot go inside columns'])
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
    const [leafRef, columns] = schema.properties.blocks.items.anyOf
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
