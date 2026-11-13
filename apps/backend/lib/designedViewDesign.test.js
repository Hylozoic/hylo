import { designViewTurn, normalizeDesignImages, normalizeDesignMessages, MAX_DESIGN_MESSAGES } from './designedViewDesign'

const view = {
  blocks: [
    { type: 'heading', text: 'Welcome', level: 1 },
    { type: 'events', title: '', limit: 3 }
  ]
}

const clientReturning = response => {
  const calls = []
  return { calls, beta: { messages: { create: async params => { calls.push(params); return response } } } }
}

const modelResponse = output => ({
  model: 'claude-opus-5-5',
  stop_reason: 'end_turn',
  content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(output) }],
  usage: { input_tokens: 4000, output_tokens: 500 }
})

describe('designedViewDesign', () => {
  describe('normalizeDesignMessages', () => {
    it('trims messages and keeps their order', () => {
      expect(normalizeDesignMessages([{ role: 'user', text: '  A welcome page  ' }]))
        .to.deep.equal([{ role: 'user', text: 'A welcome page' }])
    })

    it('rejects an empty, overlong or malformed conversation', () => {
      expect(() => normalizeDesignMessages([])).to.throw(/what the page should be for/)
      expect(() => normalizeDesignMessages(null)).to.throw()
      expect(() => normalizeDesignMessages([{ role: 'system', text: 'x' }])).to.throw(/role/)
      expect(() => normalizeDesignMessages([{ role: 'user', text: ' ' }])).to.throw(/text/)
      expect(() => normalizeDesignMessages([{ role: 'user', text: 'x'.repeat(2001) }])).to.throw(/2000/)
      expect(() => normalizeDesignMessages([{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }])).to.throw(/last message/)
      const long = Array.from({ length: MAX_DESIGN_MESSAGES + 1 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: 'x' }))
      expect(() => normalizeDesignMessages(long)).to.throw(/too long/)
    })
  })

  describe('normalizeDesignImages', () => {
    it('accepts https images and names unnamed ones by position', () => {
      expect(normalizeDesignImages([{ url: 'https://a.example.org/1.jpg' }, { url: 'https://a.example.org/2.jpg', name: ' Garden ' }]))
        .to.deep.equal([{ url: 'https://a.example.org/1.jpg', name: 'Image 1' }, { url: 'https://a.example.org/2.jpg', name: 'Garden' }])
      expect(normalizeDesignImages(undefined)).to.deep.equal([])
    })

    it('rejects other addresses and too many images', () => {
      expect(() => normalizeDesignImages([{ url: 'http://a.example.org/1.jpg' }])).to.throw(/https/)
      expect(() => normalizeDesignImages([{ url: 'data:image/png;base64,AAAA' }])).to.throw(/https/)
      expect(() => normalizeDesignImages([{}])).to.throw(/https/)
      expect(() => normalizeDesignImages(Array.from({ length: 21 }, () => ({ url: 'https://a.example.org/1.jpg' })))).to.throw(/up to 20/)
      expect(() => normalizeDesignImages('x')).to.throw()
    })
  })

  describe('designViewTurn', () => {
    const request = {
      group: { name: 'Riverside Garden', description: 'Neighbors growing food.' },
      messages: [
        { role: 'user', text: 'A welcome page' },
        { role: 'assistant', text: 'Here is a first version.' },
        { role: 'user', text: 'Add upcoming events' }
      ],
      currentView: { version: 1, blocks: [{ type: 'heading', text: 'Welcome', level: 1 }] }
    }

    it('sends the conversation, the group and the current design, and returns a validated view with usage', async () => {
      const client = clientReturning(modelResponse({ reply: 'Added events.', view }))
      const result = await designViewTurn(request, { client })

      expect(result.reply).to.equal('Added events.')
      expect(result.view).to.deep.equal({
        version: 1,
        blocks: [{ type: 'heading', text: 'Welcome', level: 1 }, { type: 'events', limit: 3 }]
      })
      expect(result.usage.inputTokens).to.equal(4000)
      expect(result.usage.estimatedCostUsd).to.be.closeTo(0.026, 1e-9)

      const params = client.calls[0]
      expect(params.output_config.format.type).to.equal('json_schema')
      expect(params.messages.map(m => m.role)).to.deep.equal(['user', 'assistant', 'user'])
      expect(params.messages[0].content).to.equal('A welcome page')
      const last = params.messages[2].content
      expect(last).to.contain('Group name: Riverside Garden')
      expect(last).to.contain('Neighbors growing food.')
      expect(last).to.contain('"text":"Welcome"')
      expect(last).to.contain("Steward's message:\nAdd upcoming events")
    })

    it('says there is no design yet on the first turn', async () => {
      const client = clientReturning(modelResponse({ reply: 'Done.', view }))
      await designViewTurn({ group: {}, messages: [{ role: 'user', text: 'A welcome page' }] }, { client })
      expect(client.calls[0].messages[0].content).to.contain('There is no design yet')
    })

    it('offers the steward\'s images to the model and drops any image it was not given', async () => {
      const garden = 'https://uploads.example.org/garden.jpg'
      const madeUp = 'https://elsewhere.example.com/stock.jpg'
      const client = clientReturning(modelResponse({
        reply: 'Added a banner.',
        view: {
          blocks: [
            { type: 'hero', imageUrl: garden, title: 'Welcome', subtitle: '', height: 'medium', align: 'left' },
            { type: 'image', url: madeUp, alt: '', caption: '' },
            { type: 'text', text: 'Hello' }
          ]
        }
      }))
      const result = await designViewTurn({ ...request, images: [{ url: garden, name: 'Image 1' }] }, { client })

      expect(client.calls[0].messages[2].content).to.contain(`Available images:\n1. Image 1: ${garden}`)
      expect(result.view.blocks.map(block => block.type)).to.deep.equal(['hero', 'text'])
      expect(result.reply).to.equal('Added a banner. (I left out an image that had not been added to this design.)')
    })

    it('keeps images that are already on the page, and says when none are available', async () => {
      const onPage = 'https://uploads.example.org/already.jpg'
      const current = { version: 1, blocks: [{ type: 'image', url: onPage }] }
      const client = clientReturning(modelResponse({ reply: 'Kept it.', view: { blocks: [{ type: 'image', url: onPage, alt: '', caption: '' }] } }))
      const result = await designViewTurn({ ...request, currentView: current }, { client })
      expect(result.view.blocks).to.deep.equal([{ type: 'image', url: onPage }])
      expect(client.calls[0].messages[2].content).to.contain('Available images: none')
    })

    it('rejects a page the blocks cannot show, and a refusal', async () => {
      const bad = clientReturning(modelResponse({ reply: 'x', view: { blocks: [{ type: 'html', html: '<b>hi</b>' }] } }))
      await expect(designViewTurn(request, { client: bad })).to.be.rejectedWith(/cannot show/)

      const refused = clientReturning({ stop_reason: 'refusal', content: [], usage: {} })
      await expect(designViewTurn(request, { client: refused })).to.be.rejectedWith(/declined/)
    })
  })
})
