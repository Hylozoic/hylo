import {
  importThemeFromUrl,
  isAllowedBrowserRequest,
  normalizeSuggestion,
  requestThemeSuggestion,
  summarizeUsage
} from './groupThemeImport'

const roles = {
  background: '#F4EFE6', card: '#ffffff', text: '#1b1b1b', primary: '#0a7f5a', accent: '#e0a030', selected: '#cfe8dc'
}
const suggestion = {
  light: roles,
  dark: { ...roles, background: '#141a17', card: '#1d2622', text: '#f2f2f2' },
  radius: 'xl',
  borderWidth: 'thin',
  fontHeading: 'Playfair Display',
  fontBody: 'Inter',
  summary: 'Warm and editorial.'
}

describe('groupThemeImport', () => {
  describe('summarizeUsage', () => {
    it('estimates the cost from token counts', () => {
      const usage = summarizeUsage('claude-opus-5-5', { input_tokens: 3000, output_tokens: 1000 })
      expect(usage.inputTokens).to.equal(3000)
      expect(usage.outputTokens).to.equal(1000)
      // 3000 * $4/M + 1000 * $20/M
      expect(usage.estimatedCostUsd).to.be.closeTo(0.032, 1e-9)
      expect(usage.pricePerMillionTokens).to.deep.equal({ input: 4, output: 20 })
    })

    it('gives no cost for a model without known prices', () => {
      const usage = summarizeUsage('some-other-model', { input_tokens: 10, output_tokens: 10 })
      expect(usage.estimatedCostUsd).to.equal(null)
      expect(usage.pricePerMillionTokens).to.equal(null)
    })
  })

  describe('normalizeSuggestion', () => {
    it('keeps valid roles, radius, border width and fonts', () => {
      const result = normalizeSuggestion(suggestion)
      expect(result.roles.light.background).to.equal('#f4efe6')
      expect(result.roles.dark.text).to.equal('#f2f2f2')
      expect(result.radius).to.equal('xl')
      expect(result.borderWidth).to.equal('thin')
      expect(result.fontHeading).to.equal('Playfair Display')
      expect(result.summary).to.equal('Warm and editorial.')
    })

    it('drops anything that is not a known option or a plain font name', () => {
      const result = normalizeSuggestion({
        ...suggestion, radius: '9999px', borderWidth: 'toString', fontBody: "Inter'; color: red", fontHeading: ''
      })
      expect(result.radius).to.equal(null)
      expect(result.borderWidth).to.equal(null)
      expect(result.fontBody).to.equal(null)
      expect(result.fontHeading).to.equal(null)
    })

    it('rejects a missing or malformed color', () => {
      expect(() => normalizeSuggestion({ ...suggestion, light: { ...roles, accent: 'red' } })).to.throw(/light accent/)
      expect(() => normalizeSuggestion({ ...suggestion, dark: undefined })).to.throw(/dark background/)
      expect(() => normalizeSuggestion(null)).to.throw()
    })
  })

  describe('isAllowedBrowserRequest', () => {
    it('refuses private addresses and non-web protocols', async () => {
      expect(await isAllowedBrowserRequest('http://127.0.0.1:3001/noo/graphql')).to.equal(false)
      expect(await isAllowedBrowserRequest('http://169.254.169.254/latest/meta-data')).to.equal(false)
      expect(await isAllowedBrowserRequest('http://[::1]/')).to.equal(false)
      expect(await isAllowedBrowserRequest('http://localhost:3000/')).to.equal(false)
      expect(await isAllowedBrowserRequest('file:///etc/passwd')).to.equal(false)
      expect(await isAllowedBrowserRequest('not a url')).to.equal(false)
    })

    it('allows inline data', async () => {
      expect(await isAllowedBrowserRequest('data:image/png;base64,AAAA')).to.equal(true)
    })
  })

  describe('requestThemeSuggestion', () => {
    const site = { url: 'https://example.org/', facts: { title: 'Example' }, screenshot: 'AAAA' }
    const clientReturning = response => {
      const calls = []
      return { calls, beta: { messages: { create: async params => { calls.push(params); return response } } } }
    }

    it('sends the screenshot and facts and returns the parsed suggestion with usage', async () => {
      const client = clientReturning({
        model: 'claude-opus-5-5',
        stop_reason: 'end_turn',
        content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(suggestion) }],
        usage: { input_tokens: 2000, output_tokens: 500 }
      })
      const result = await requestThemeSuggestion(site, { client })
      expect(result.suggestion).to.deep.equal(suggestion)
      expect(result.usage.inputTokens).to.equal(2000)

      const params = client.calls[0]
      expect(params.model).to.equal('claude-opus-5-5')
      expect(params.output_config.format.type).to.equal('json_schema')
      expect(params.messages[0].content[0]).to.deep.equal({
        type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' }
      })
      expect(params.messages[0].content[1].text).to.contain('https://example.org/')
    })

    it('fails clearly when the model declines', async () => {
      const client = clientReturning({ stop_reason: 'refusal', content: [], usage: {} })
      await expect(requestThemeSuggestion(site, { client })).to.be.rejectedWith(/declined/)
    })
  })

  describe('importThemeFromUrl', () => {
    it('captures, asks the model, and drops fonts Google Fonts does not have', async () => {
      const usage = summarizeUsage('claude-opus-5-5', { input_tokens: 1, output_tokens: 1 })
      const result = await importThemeFromUrl('https://example.org', {
        capture: async url => ({ url: 'https://example.org/', facts: {}, screenshot: 'AAAA' }),
        suggest: async () => ({ suggestion, usage }),
        fontExists: async family => family === 'Inter'
      })
      expect(result.fontBody).to.equal('Inter')
      expect(result.fontHeading).to.equal(null)
      expect(result.sourceUrl).to.equal('https://example.org/')
      expect(result.usage).to.deep.equal(usage)
      expect(result.roles.light.primary).to.equal('#0a7f5a')
    })
  })
})
