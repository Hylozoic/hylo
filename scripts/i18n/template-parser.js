#!/usr/bin/env node

/**
 * This only needed to be done once, so leaving it here for reference.
 * Wraps hardcoded strings in SendWithUs trans blocks using OpenAI
 * Preserves Liquid template syntax and variables
 * IMPORTANT: Only wraps actual text content, NOT Liquid control structures
 */

const { getEnvVar } = require('./lib')

const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_RETRIES = 3
const DEFAULT_RATE_LIMIT_MS = 250

/**
 * Checks if a string is already wrapped in a trans block
 * @param {string} str - String to check
 * @returns {boolean} True if already wrapped
 */
function isWrappedInTrans (str) {
  return /{%\s*trans\s*%}/.test(str) && /{%\s*endtrans\s*%}/.test(str)
}

/**
 * Sleep helper for rate limiting
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after ms milliseconds
 */
function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Checks if an error should be retried
 * @param {Error} error - Error to check
 * @returns {boolean} True if should retry
 */
function shouldRetry (error) {
  if (!error) return false
  const retryStatuses = new Set([408, 429, 500, 502, 503, 504])
  if (error.status && retryStatuses.has(error.status)) return true
  if (error.name === 'FetchError') return true
  if (error.cause && error.cause.code === 'ECONNRESET') return true
  return false
}

/**
 * Calls OpenAI API with retry logic
 * @param {Object} options - Options object
 * @param {string} options.apiKey - OpenAI API key
 * @param {string} options.model - Model to use
 * @param {Array} options.messages - Messages array
 * @param {number} options.rateLimitMs - Rate limit delay in ms
 * @param {number} options.retries - Number of retries
 * @returns {Promise<string>} Response content
 */
async function callOpenAI ({ apiKey, model, messages, rateLimitMs, retries }) {
  let attempt = 0
  let lastError
  while (attempt <= retries) {
    if (attempt > 0) {
      const delay = Math.min(rateLimitMs * Math.pow(2, attempt - 1), 5000)
      console.warn(`Retrying OpenAI request (attempt ${attempt + 1}/${retries + 1}) after ${delay}ms...`)
      await sleep(delay)
    } else if (rateLimitMs > 0) {
      await sleep(rateLimitMs)
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages
        })
      })

      if (!response.ok) {
        const err = new Error(`OpenAI request failed (${response.status})`)
        err.status = response.status
        err.body = await response.text()
        throw err
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error('No content returned by OpenAI')
      return content.trim()
    } catch (error) {
      lastError = error
      const canRetry = shouldRetry(error) && attempt < retries
      console.error(`OpenAI error (attempt ${attempt + 1}/${retries + 1}): ${error.message}`)
      if (error.body) console.error(`  Response body: ${error.body}`)
      if (!canRetry) throw error
    }

    attempt += 1
  }
  throw lastError
}

/**
 * Uses OpenAI to wrap translatable strings in trans blocks
 * @param {string} content - Template content (HTML/text)
 * @param {Object} options - Options
 * @param {string} [options.model] - OpenAI model to use
 * @param {string} [options.apiKey] - OpenAI API key
 * @param {number} [options.retries] - Number of retries
 * @param {number} [options.rateLimitMs] - Rate limit delay
 * @returns {Promise<string>} Content with trans blocks
 */
async function wrapWithTransBlocks (content, options = {}) {
  if (!content || !content.trim()) return content
  if (isWrappedInTrans(content)) return content

  const model = options.model || DEFAULT_MODEL
  const apiKey = options.apiKey || getEnvVar('OPENAI_API_KEY')
  const retries = options.retries !== undefined ? options.retries : DEFAULT_RETRIES
  const rateLimitMs = options.rateLimitMs !== undefined ? options.rateLimitMs : DEFAULT_RATE_LIMIT_MS

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment or .env files')
  }

  const systemMessage = {
    role: 'system',
    content: `You are a template processor for SendWithUs email templates. Your task is to wrap translatable text content in Jinja2-style trans blocks: {% trans %}text{% endtrans %}.

CRITICAL RULES:
1. ONLY wrap actual text content (words, sentences, phrases) - NEVER wrap Liquid control structures
2. NEVER wrap: {% if %}, {% for %}, {% endif %}, {% endfor %}, {% snippet %}, {% else %}, {% elsif %}, or any other Liquid tags
3. NEVER wrap HTML tags like <p>, <a>, <strong>, etc.
4. DO wrap text content that should be translated, including text that contains Liquid variables like {{ variable }}
5. When text contains Liquid variables, wrap the entire phrase: {% trans %}Hello {{ name }}{% endtrans %}
6. Preserve all whitespace and formatting
7. Keep Liquid variables and expressions exactly as they are inside trans blocks
8. Wrap complete sentences or phrases, not individual words
9. If content is already wrapped in trans blocks, leave it unchanged

Examples:
- "Hello World" → "{% trans %}Hello World{% endtrans %}"
- "Hi {{ name }}, welcome!" → "{% trans %}Hi {{ name }}, welcome!{% endtrans %}"
- "{% if condition %}Text{% endif %}" → "{% if condition %}{% trans %}Text{% endtrans %}{% endif %}"
- "<p>Hello</p>" → "<p>{% trans %}Hello{% endtrans %}</p>"
- "{% snippet 'header' %}" → "{% snippet 'header' %}" (unchanged)

Return ONLY the processed template content, no explanations or commentary.`
  }

  const userMessage = {
    role: 'user',
    content: `Process this template content and wrap translatable strings in trans blocks:\n\n${content}`
  }

  try {
    const result = await callOpenAI({ apiKey, model, messages: [systemMessage, userMessage], rateLimitMs, retries })
    return result
  } catch (error) {
    console.error(`Failed to process template with OpenAI: ${error.message}`)
    throw error
  }
}

/**
 * Processes HTML content and wraps text nodes in trans blocks using OpenAI
 * @param {string} html - HTML content
 * @param {Object} options - Processing options
 * @returns {Promise<string>} Processed HTML with trans blocks
 */
async function processHtmlContent (html, options = {}) {
  if (!html) return html
  if (isWrappedInTrans(html)) return html

  return wrapWithTransBlocks(html, options)
}

/**
 * Processes a subject line and wraps it in trans blocks using OpenAI
 * @param {string} subject - Subject line
 * @param {Object} options - Processing options
 * @returns {Promise<string>} Processed subject with trans blocks
 */
async function processSubject (subject, options = {}) {
  if (!subject || isWrappedInTrans(subject)) return subject
  return wrapWithTransBlocks(subject, options)
}

/**
 * Processes template content (HTML, text, subject) and adds trans blocks using OpenAI
 * @param {Object} template - Template object with html, text, subject
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Template object with trans blocks added
 */
async function processTemplate (template, options = {}) {
  const processed = { ...template }

  if (processed.html) {
    processed.html = await processHtmlContent(processed.html, options)
  }

  if (processed.text) {
    processed.text = await wrapWithTransBlocks(processed.text, options)
  }

  if (processed.subject) {
    processed.subject = await processSubject(processed.subject, options)
  }

  if (processed.preheader) {
    processed.preheader = await processSubject(processed.preheader, options)
  }

  return processed
}

/**
 * Extracts all translatable strings from a template
 * @param {Object} template - Template object
 * @returns {Array<string>} Array of translatable strings
 */
function extractTranslatableStrings (template) {
  const strings = []

  const extractFromText = (text) => {
    if (!text) return

    // Extract trans blocks
    const transMatches = text.match(/{%\s*trans\s*%}(.*?){%\s*endtrans\s*%}/gs)
    if (transMatches) {
      transMatches.forEach(match => {
        const content = match.replace(/{%\s*trans\s*%}/g, '').replace(/{%\s*endtrans\s*%}/g, '').trim()
        if (content) strings.push(content)
      })
    }
  }

  if (template.html) extractFromText(template.html)
  if (template.text) extractFromText(template.text)
  if (template.subject) extractFromText(template.subject)
  if (template.preheader) extractFromText(template.preheader)

  return [...new Set(strings)] // Remove duplicates
}

module.exports = {
  isWrappedInTrans,
  wrapWithTransBlocks,
  processHtmlContent,
  processSubject,
  processTemplate,
  extractTranslatableStrings
}
