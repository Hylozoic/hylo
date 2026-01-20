#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const {
  readJson,
  isPlainObject,
  sortLocaleDeep,
  walkLocaleEntries,
  getAtPath,
  setAtPath,
  extractPlaceholders,
  pathToString
} = require('./lib')

const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_RETRIES = 3
const DEFAULT_RATE_LIMIT_MS = 250
const PLACEHOLDER_RETRIES = 2
const DEFAULT_BATCH_SIZE = 1
const DEFAULT_TEMPERATURE = 0

function usage () {
  console.error('Usage: node scripts/i18n/auto-translate-locale.js --english <path> --target <path> [--language <name>] [--model <model>] [--temperature <value>] [--force] [--env <path>] [--dry-run] [--output <path>] [--retries <count>] [--rate-limit <ms>] [--batch-size <count>] [--limit <count>]')
  process.exit(1)
}

function parseArgs () {
  const args = process.argv.slice(2)
  const result = { flags: new Set() }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg.startsWith('--')) {
      console.error(`Unexpected argument: ${arg}`)
      usage()
    }
    if (arg === '--force' || arg === '--dry-run') {
      result.flags.add(arg.slice(2))
      continue
    }
    const key = arg.slice(2)
    const value = args[++i]
    if (!value || value.startsWith('--')) {
      console.error(`Missing value for --${key}`)
      usage()
    }
    result[key] = value
  }
  return result
}

function readEnvFile (envPath) {
  if (!fs.existsSync(envPath)) return {}
  const content = fs.readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function shouldRetry (error) {
  if (!error) return false
  const retryStatuses = new Set([408, 429, 500, 502, 503, 504])
  if (error.status && retryStatuses.has(error.status)) return true
  if (error.name === 'FetchError') return true
  if (error.cause && error.cause.code === 'ECONNRESET') return true
  return false
}

async function callOpenAI ({ apiKey, model, messages, rateLimitMs, retries, temperature }) {
  let attempt = 0
  let lastError
  while (attempt <= retries) {
    if (attempt > 0) {
      const delay = Math.min(rateLimitMs * Math.pow(2, attempt - 1), 5000)
      console.warn(`Retrying translation attempt ${attempt + 1}/${retries + 1} after ${delay}ms...`)
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
        body: JSON.stringify(Object.assign(
          {
            model,
            messages
          },
          temperature === null || temperature === undefined ? {} : { temperature }
        ))
      })

      if (!response.ok) {
        const err = new Error(`OpenAI request failed (${response.status})`)
        err.status = response.status
        err.body = await response.text()
        throw err
      }

      const data = await response.json()
      const translation = data.choices?.[0]?.message?.content
      if (!translation) throw new Error('No translation returned by OpenAI')
      return translation.trim()
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

async function translateWithPlaceholders ({ apiKey, model, language, sourceText, englishPlaceholders, rateLimitMs, retries, temperature }) {
  let prompt = [
    {
      role: 'system',
      content: `You translate English UI copy to ${language}. Preserve placeholders like {{variable}}, %{placeholder}, %s, emoji, Markdown, and HTML tags. Return only the translated text without additional commentary.`
    },
    {
      role: 'user',
      content: sourceText
    }
  ]

  for (let attempt = 0; attempt < PLACEHOLDER_RETRIES; attempt += 1) {
    const translation = await callOpenAI({ apiKey, model, messages: prompt, rateLimitMs, retries, temperature })
    const translatedPlaceholders = extractPlaceholders(translation)
    const missing = [...englishPlaceholders].filter(ph => !translatedPlaceholders.has(ph))

    if (missing.length === 0) return translation

    if (attempt === PLACEHOLDER_RETRIES - 1) {
      const error = new Error(`Translation missing placeholders: ${missing.join(', ')}`)
      error.missingPlaceholders = missing
      throw error
    }

    prompt = [
      {
        role: 'system',
        content: `You translate English UI copy to ${language}. It is critical that you include the placeholders ${[...englishPlaceholders].join(', ')} exactly as provided. Return only the translated text.`
      },
      {
        role: 'user',
        content: sourceText
      }
    ]
  }
}

function stripJsonMarkdownFence (text) {
  if (!text) return text
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.replace(/^```json\s*/i, '').replace(/```$/g, '').trim()
}

function chunkEntries (entries, size) {
  const chunks = []
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(entries.slice(i, i + size))
  }
  return chunks
}

async function translateBatch ({ apiKey, model, language, batchEntries, rateLimitMs, retries, temperature }) {
  const payload = batchEntries.map(entry => ({
    id: pathToString(entry.path),
    english: entry.value,
    placeholders: [...extractPlaceholders(entry.value)]
  }))

  const systemMessage = {
    role: 'system',
    content: `You translate English UI copy to ${language}. Preserve placeholders like {{variable}}, %{placeholder}, %s, emoji, Markdown, and HTML tags. Output must be valid JSON.`
  }

  const userMessage = {
    role: 'user',
    content: `Translate each "english" value below into ${language}.
Return JSON that is either:
1. An array of objects, each with "id" and "translation" keys.
2. A JSON object whose keys are the provided ids and values are the translated strings.

Ensure every placeholder listed must appear exactly in the corresponding translation.
Input:
${JSON.stringify(payload, null, 2)}`
  }

  const raw = await callOpenAI({ apiKey, model, messages: [systemMessage, userMessage], rateLimitMs, retries, temperature })
  const cleaned = stripJsonMarkdownFence(raw)

  let data
  try {
    data = JSON.parse(cleaned)
  } catch (err) {
    throw new Error('Batch translation returned non-JSON output')
  }

  const result = new Map()
  if (Array.isArray(data)) {
    for (const item of data) {
      if (!item || typeof item !== 'object') continue
      if (typeof item.id !== 'string' || typeof item.translation !== 'string') continue
      result.set(item.id, item.translation)
    }
  } else if (isPlainObject(data)) {
    for (const [id, translation] of Object.entries(data)) {
      if (typeof translation === 'string') result.set(id, translation)
    }
  } else {
    throw new Error('Batch translation returned unsupported JSON structure')
  }

  return result
}

async function main () {
  const args = parseArgs()
  const englishPathRaw = args.english
  const targetPathRaw = args.target
  if (!englishPathRaw || !targetPathRaw) usage()

  const englishPath = path.resolve(process.cwd(), englishPathRaw)
  const targetPath = path.resolve(process.cwd(), targetPathRaw)
  const outputPath = args.output ? path.resolve(process.cwd(), args.output) : targetPath

  if (!fs.existsSync(englishPath)) {
    console.error(`English locale not found: ${englishPath}`)
    process.exit(1)
  }

  let english
  try {
    english = readJson(englishPath)
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }

  if (!isPlainObject(english)) {
    console.error('English locale must be a JSON object.')
    process.exit(1)
  }

  let translations = {}
  if (fs.existsSync(targetPath)) {
    try {
      translations = readJson(targetPath)
    } catch (err) {
      console.error(err.message)
      process.exit(1)
    }
    if (!isPlainObject(translations)) {
      console.error('Target locale must be a JSON object.')
      process.exit(1)
    }
  }

  const language = args.language || path.basename(targetPath).replace(/\.json$/i, '') || 'target language'
  const model = args.model || DEFAULT_MODEL
  const force = args.flags.has('force')
  const dryRun = args.flags.has('dry-run')
  const retries = args.retries ? Number(args.retries) : DEFAULT_RETRIES
  const rateLimitMs = args['rate-limit'] ? Number(args['rate-limit']) : DEFAULT_RATE_LIMIT_MS
  const batchSize = args['batch-size'] ? Number(args['batch-size']) : DEFAULT_BATCH_SIZE
  const limit = args.limit ? Number(args.limit) : null
  let temperature = DEFAULT_TEMPERATURE
  if (Object.prototype.hasOwnProperty.call(args, 'temperature')) {
    if (String(args.temperature).toLowerCase() === 'default') {
      temperature = null
    } else {
      temperature = Number(args.temperature)
    }
  }

  if (Number.isNaN(retries) || retries < 0) {
    console.error('--retries must be a non-negative number')
    process.exit(1)
  }
  if (Number.isNaN(rateLimitMs) || rateLimitMs < 0) {
    console.error('--rate-limit must be a non-negative number')
    process.exit(1)
  }
  if (Number.isNaN(batchSize) || batchSize <= 0) {
    console.error('--batch-size must be a positive number')
    process.exit(1)
  }
  if (limit !== null && (Number.isNaN(limit) || limit <= 0)) {
    console.error('--limit must be a positive number')
    process.exit(1)
  }
  if (temperature !== null && (Number.isNaN(temperature) || temperature < 0 || temperature > 2)) {
    console.error('--temperature must be a number between 0 and 2, or "default"')
    process.exit(1)
  }

  const envPath = args.env ? path.resolve(process.cwd(), args.env) : path.resolve(process.cwd(), 'apps/backend/.env')
  const apiKey = process.env.OPENAI_API_KEY || readEnvFile(envPath).OPENAI_API_KEY
  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in environment or backend .env')
    process.exit(1)
  }

  const pending = []
  walkLocaleEntries(english, entry => {
    if (entry.type !== 'string') return
    const existing = getAtPath(translations, entry.path)
    const needsTranslation = force || existing === undefined || existing === ''
    if (!needsTranslation) return
    pending.push(entry)
  })

  if (pending.length === 0) {
    console.log('Nothing to translate.')
    return
  }

  const workList = limit ? pending.slice(0, limit) : pending
  if (limit && pending.length > limit) {
    console.log(`Limiting run to the first ${workList.length} keys (of ${pending.length} pending).`)
  }

  const updates = []
  let encounteredError = false

  if (batchSize === 1) {
    for (const entry of workList) {
      const englishPlaceholders = extractPlaceholders(entry.value)
      console.log(`Translating ${pathToString(entry.path)}...`)
      try {
        const translation = await translateWithPlaceholders({
          apiKey,
          model,
          language,
          sourceText: entry.value,
          englishPlaceholders,
          rateLimitMs,
          retries,
          temperature
        })
        updates.push({ path: entry.path, english: entry.value, translation })
        if (!dryRun) setAtPath(translations, entry.path, translation)
      } catch (error) {
        encounteredError = true
        console.error(`  Failed: ${error.message}`)
        continue
      }
    }
  } else {
    const chunks = chunkEntries(workList, batchSize)
    for (const chunk of chunks) {
      console.log(`Translating batch (${chunk.length} keys)...`)
      let batchResult
      try {
        batchResult = await translateBatch({ apiKey, model, language, batchEntries: chunk, rateLimitMs, retries, temperature })
      } catch (error) {
        encounteredError = true
        console.error(`  Batch failed: ${error.message}`)
        continue
      }

      for (const entry of chunk) {
        const id = pathToString(entry.path)
        const translation = batchResult.get(id)
        if (typeof translation !== 'string') {
          console.error(`  Missing translation for ${id} in batch retrying individually.`)
          try {
            const fallback = await translateWithPlaceholders({
              apiKey,
              model,
              language,
              sourceText: entry.value,
              englishPlaceholders: extractPlaceholders(entry.value),
              rateLimitMs,
              retries,
              temperature
            })
            updates.push({ path: entry.path, english: entry.value, translation: fallback })
            if (!dryRun) setAtPath(translations, entry.path, fallback)
          } catch (error) {
            encounteredError = true
            console.error(`    Failed: ${error.message}`)
          }
          continue
        }

        const englishPlaceholders = extractPlaceholders(entry.value)
        const translationPlaceholders = extractPlaceholders(translation)
        const missing = [...englishPlaceholders].filter(ph => !translationPlaceholders.has(ph))
        if (missing.length) {
          console.error(`  Placeholder mismatch for ${id} retrying individually.`)
          try {
            const fallback = await translateWithPlaceholders({
              apiKey,
              model,
              language,
              sourceText: entry.value,
              englishPlaceholders,
              rateLimitMs,
              retries,
              temperature
            })
            updates.push({ path: entry.path, english: entry.value, translation: fallback })
            if (!dryRun) setAtPath(translations, entry.path, fallback)
          } catch (error) {
            encounteredError = true
            console.error(`    Failed: ${error.message}`)
          }
          continue
        }

        updates.push({ path: entry.path, english: entry.value, translation })
        if (!dryRun) setAtPath(translations, entry.path, translation)
      }
    }
  }

  if (updates.length === 0) {
    console.log('No translations were produced.')
    process.exit(encounteredError ? 1 : 0)
  }

  console.log('--- Proposed translations ---')
  for (const entry of updates) {
    console.log(`  ${pathToString(entry.path)}\n    EN: ${entry.english}\n    TX: ${entry.translation}`)
  }

  if (dryRun) {
    console.log('Dry run complete. Translations not written.')
    process.exit(encounteredError ? 1 : 0)
  }

  const sorted = sortLocaleDeep(translations)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`Updated translations written to ${outputPath}`)

  if (encounteredError) process.exit(1)
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
