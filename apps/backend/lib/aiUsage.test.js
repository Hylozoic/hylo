import { isClaudeConfigured, summarizeUsage } from './aiUsage'

describe('aiUsage', () => {
  describe('isClaudeConfigured', () => {
    const saved = process.env.CLAUDE_API_KEY
    afterEach(() => {
      if (saved === undefined) delete process.env.CLAUDE_API_KEY
      else process.env.CLAUDE_API_KEY = saved
    })

    it('is true only when a key is set', () => {
      delete process.env.CLAUDE_API_KEY
      expect(isClaudeConfigured()).to.equal(false)
      process.env.CLAUDE_API_KEY = 'sk-test'
      expect(isClaudeConfigured()).to.equal(true)
    })
  })

  describe('summarizeUsage', () => {
    it('estimates the cost from token counts', () => {
      const usage = summarizeUsage('claude-opus-5-5', { input_tokens: 3000, output_tokens: 1000 })
      expect(usage.inputTokens).to.equal(3000)
      expect(usage.outputTokens).to.equal(1000)
      // 3000 * $4/M + 1000 * $20/M
      expect(usage.estimatedCostUsd).to.be.closeTo(0.032, 1e-9)
      expect(usage.pricePerMillionTokens).to.deep.equal({ input: 4, output: 20 })
    })

    it('counts cache reads at the cache rate and cache writes at a premium', () => {
      const usage = summarizeUsage('claude-opus-5-5', { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1e6, cache_creation_input_tokens: 1e6 })
      expect(usage.cacheReadInputTokens).to.equal(1e6)
      expect(usage.cacheCreationInputTokens).to.equal(1e6)
      // $0.20 for the reads + $4 * 1.25 for the writes
      expect(usage.estimatedCostUsd).to.be.closeTo(5.2, 1e-9)
    })

    it('gives no cost for a model without known prices', () => {
      const usage = summarizeUsage('some-other-model', { input_tokens: 10, output_tokens: 10 })
      expect(usage.estimatedCostUsd).to.equal(null)
      expect(usage.pricePerMillionTokens).to.equal(null)
    })
  })
})
