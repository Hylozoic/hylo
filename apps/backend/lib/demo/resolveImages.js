/**
 * Fill missing photo URLs in a demo spec. Run locally, where the API keys live.
 * Place photos try Unsplash, then Pexels. Faces and marks come from Pexels.
 */
const fs = require('fs')

const PORTRAIT_QUERIES = {
  latina: ['latina woman headshot', 'hispanic woman portrait'],
  latino: ['latino man headshot', 'hispanic man portrait'],
  'black-woman': ['black woman headshot smiling'],
  'black-man': ['black man headshot smiling'],
  'east-asian-woman': ['east asian woman headshot', 'asian woman headshot'],
  'east-asian-man': ['east asian man headshot', 'asian man headshot'],
  'south-asian-woman': ['south asian woman headshot', 'indian woman headshot'],
  'south-asian-man': ['indian man headshot'],
  'middle-eastern-woman': ['middle eastern woman headshot', 'arab woman portrait'],
  'middle-eastern-man': ['middle eastern man headshot', 'arab man portrait'],
  'southeast-asian-woman': ['southeast asian woman headshot', 'asian woman headshot'],
  'southeast-asian-man': ['southeast asian man headshot', 'asian man headshot'],
  'older-woman': ['elderly woman smiling portrait'],
  'older-man': ['elderly man smiling portrait'],
  'older-east-asian-woman': ['elderly asian woman portrait', 'older asian woman smiling'],
  'older-east-asian-man': ['elderly asian man portrait', 'older asian man smiling'],
  'indigenous-man': ['indigenous man portrait', 'native american man portrait'],
  woman: ['smiling woman headshot outdoor'],
  man: ['smiling man headshot outdoor'],
  person: ['young adult headshot', 'person colorful headshot']
}

/**
 * Write resolved URLs back into the spec file.
 * @param {string} file
 * @param {object} spec
 * @returns {Promise<object>}
 */
async function resolveImages (file, spec) {
  if (!spec.images) spec.images = { marks: {} }
  if (!spec.images.marks) spec.images.marks = {}
  const queries = (spec.imageQueries && spec.imageQueries.photos) || {}
  let unsplashBlocked = false

  for (const [key, query] of Object.entries(queries)) {
    if (isUrl(spec.images[key])) continue
    let found = null
    if (!unsplashBlocked && process.env.UNSPLASH_ACCESS_KEY) {
      found = await searchUnsplash(query)
      if (found && found.blocked) {
        unsplashBlocked = true
        found = null
        console.info('  unsplash rate limit reached, switching to pexels')
      }
    }
    if (!found && process.env.PEXELS_API_KEY) found = await searchPexels(query)
    if (!found || !found.url || found.url.length > 255) {
      console.info(`  no photo for ${key}`)
      continue
    }
    spec.images[key] = found.url
    console.info(`  photo ${key} from ${found.source}`)
  }

  const marks = (spec.imageQueries && spec.imageQueries.marks) || {}
  for (const [key, query] of Object.entries(marks)) {
    if (isUrl(spec.images.marks[key])) continue
    const url = await findMark(query)
    spec.images.marks[key] = url || colorfulMark(key)
    console.info(url ? `  mark ${key}` : `  illustrated mark for ${key}`)
  }

  await resolvePortraits(spec)
  fs.writeFileSync(file, JSON.stringify(spec, null, 2) + '\n')
  return spec
}

/**
 * One cached headshot per neighbor who is not the real user.
 * @param {object} spec
 */
async function resolvePortraits (spec) {
  const missing = (spec.people || []).filter(person => !person.realUser && !isUrl(person.portraitUrl))
  if (!missing.length || !process.env.PEXELS_API_KEY) {
    missing.forEach(person => {
      if (!person.portraitUrl) person.portraitUrl = colorfulPerson(person.key)
    })
    return
  }
  const used = new Set((spec.people || []).map(person => person.portraitUrl).filter(isUrl))
  const byPool = {}
  missing.forEach(person => {
    const pool = person.portraitPool || 'person'
    if (!byPool[pool]) byPool[pool] = []
    byPool[pool].push(person)
  })
  const order = Object.keys(PORTRAIT_QUERIES).filter(pool => pool !== 'person').concat('person')
  for (const pool of order) {
    const members = (byPool[pool] || []).slice().sort((a, b) => a.key.localeCompare(b.key))
    if (!members.length) continue
    const urls = await collectPortraits(pool, members.length, used)
    members.forEach((member, index) => {
      const url = urls[index]
      if (!url) return
      member.portraitUrl = url
      used.add(url)
    })
  }
  missing.forEach(person => {
    if (isUrl(person.portraitUrl)) return
    person.portraitUrl = colorfulPerson(person.key)
    console.info(`  illustrated fallback for ${person.key}`)
  })
}

/**
 * @param {string} pool
 * @param {number} count
 * @param {Set<string>} used
 * @returns {Promise<string[]>}
 */
async function collectPortraits (pool, count, used) {
  const queries = PORTRAIT_QUERIES[pool] || PORTRAIT_QUERIES.person
  const found = []
  const seen = new Set()
  for (const query of queries) {
    if (found.length >= count) break
    for (let page = 1; page <= 3 && found.length < count; page++) {
      const photos = await searchPexelsPage(query, { page, perPage: 40, orientation: 'portrait' })
      if (!photos.length) break
      for (const photo of photos) {
        if (!usablePortrait(photo)) continue
        const url = pexelsSquare(photo)
        if (!url || url.length > 255 || used.has(url) || seen.has(url)) continue
        seen.add(url)
        found.push(url)
        if (found.length >= count) break
      }
    }
  }
  console.info(`  portraits ${pool}: ${found.length}`)
  return found
}

/**
 * @param {string} query
 * @returns {Promise<{url: string, source: string}|{blocked: true}|null>}
 */
async function searchUnsplash (query) {
  const url = new URL('https://api.unsplash.com/search/photos')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', '10')
  url.searchParams.set('orientation', 'landscape')
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } })
  if (res.status === 403 || res.status === 429) return { blocked: true }
  if (!res.ok) return null
  const data = await res.json()
  const photo = (data.results || []).find(item => !looksLikePerson(item.alt_description || item.description))
  if (!photo) return null
  if (photo.links && photo.links.download_location) {
    await fetch(photo.links.download_location, {
      headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` }
    }).catch(() => {})
  }
  const raw = (photo.urls && (photo.urls.raw || photo.urls.regular)) || ''
  const match = raw.match(/photo-([A-Za-z0-9_-]+)/)
  if (!match) return null
  return { source: 'unsplash', url: `https://images.unsplash.com/photo-${match[1]}?w=1600&h=900&fit=crop&q=80` }
}

/**
 * @param {string} query
 * @returns {Promise<{url: string, source: string}|null>}
 */
async function searchPexels (query) {
  const photos = await searchPexelsPage(query, { page: 1, perPage: 10, orientation: 'landscape' })
  const photo = photos.find(item => !looksLikePerson(item.alt))
  if (!photo) return null
  return { source: 'pexels', url: `https://images.pexels.com/photos/${photo.id}/pexels-photo-${photo.id}.jpeg?auto=compress&cs=tinysrgb&w=1600` }
}

/**
 * @param {string} query
 * @returns {Promise<string|null>}
 */
async function findMark (query) {
  if (!process.env.PEXELS_API_KEY) return null
  const photos = await searchPexelsPage(query, { page: 1, perPage: 15, orientation: 'landscape' })
  const photo = photos.find(item => !looksLikePerson(item.alt))
  if (!photo) return null
  const url = pexelsSquare(photo)
  if (!url || url.length > 255) return null
  return url
}

/**
 * @param {string} query
 * @param {{ page: number, perPage: number, orientation?: string }} options
 * @returns {Promise<object[]>}
 */
async function searchPexelsPage (query, { page, perPage, orientation }) {
  if (!process.env.PEXELS_API_KEY) return []
  const url = new URL('https://api.pexels.com/v1/search')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('page', String(page))
  if (orientation) url.searchParams.set('orientation', orientation)
  const res = await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY } })
  if (!res.ok) return []
  const data = await res.json()
  return data.photos || []
}

/**
 * @param {{ id: number }} photo
 * @returns {string}
 */
function pexelsSquare (photo) {
  return `https://images.pexels.com/photos/${photo.id}/pexels-photo-${photo.id}.jpeg?auto=compress&cs=tinysrgb&w=480&h=480&fit=crop`
}

/**
 * @param {string} alt
 * @returns {boolean}
 */
function looksLikePerson (alt) {
  return /\b(man|woman|person|people|portrait|face|girl|boy|child|kid|baby|guy|lady|couple|crowd|human)\b/i.test(alt || '')
}

/**
 * @param {{ alt?: string }} photo
 * @returns {boolean}
 */
function usablePortrait (photo) {
  const alt = photo.alt || ''
  if (/\b(child|children|kid|kids|baby|toddler|boy|girl|teen)\b/i.test(alt)) return false
  if (/black and white|black & white|monochrome|grayscale|greyscale/i.test(alt)) return false
  if (/\b(headdress|face paint|tribal costume)\b/i.test(alt)) return false
  return true
}

/**
 * @param {string} seed
 * @returns {string}
 */
function colorfulPerson (seed) {
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}

/**
 * @param {string} seed
 * @returns {string}
 */
function colorfulMark (seed) {
  return `https://api.dicebear.com/9.x/icons/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isUrl (value) {
  return typeof value === 'string' && /^https?:\/\//.test(value)
}

module.exports = { resolveImages }
