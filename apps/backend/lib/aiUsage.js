/**
 * What the Hylo Pro AI features (theme import, designed views, the Group
 * Assistant) share about talking to Claude: whether a key is set, the prices
 * used for the cost shown to stewards, and the usage summary each answer
 * carries.
 */

export function isClaudeConfigured () {
  return !!process.env.CLAUDE_API_KEY
}

// US dollars per million tokens, for the cost estimate shown to stewards.
// Standard Anthropic API rates as of 2026-11; update when prices change.
export const MODEL_PRICING = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 }
}
const CACHE_WRITE_MULTIPLIER = 1.25

/**
 * Token counts and an estimated cost for one model response. The cost is null
 * for a model this file has no prices for.
 */
export function summarizeUsage (model, usage = {}) {
  const inputTokens = usage.input_tokens || 0
  const outputTokens = usage.output_tokens || 0
  const cacheReadInputTokens = usage.cache_read_input_tokens || 0
  const cacheCreationInputTokens = usage.cache_creation_input_tokens || 0
  const pricing = MODEL_PRICING[model] || null
  const estimatedCostUsd = pricing
    ? (inputTokens * pricing.input +
        outputTokens * pricing.output +
        cacheReadInputTokens * pricing.cacheRead +
        cacheCreationInputTokens * pricing.input * CACHE_WRITE_MULTIPLIER) / 1e6
    : null
  return {
    model,
    inputTokens,
    outputTokens,
    cacheReadInputTokens,
    cacheCreationInputTokens,
    estimatedCostUsd,
    pricePerMillionTokens: pricing ? { input: pricing.input, output: pricing.output } : null
  }
}
