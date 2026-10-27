/**
 * License-free photos for the River City demo.
 * Place photos try Unsplash first (demo apps are capped near 50 requests/hour), then Pexels.
 * Faces and the group marks come from Pexels in batches, so one search returns many photos.
 * Results are cached so a re-run the morning of the demo does not spend the quota.
 */
const fs = require('fs')
const path = require('path')
const { cast, portraitPool } = require('./people')

const CACHE_PATH = path.join(__dirname, 'image-cache.json')

/** Search queries. Keys are referenced by groups and posts. */
const QUERIES = {
  banner: 'sacramento tree lined residential street fruit trees',
  oak: 'oak trees shaded residential street',
  midtown: 'downtown city street cafes evening',
  land: 'leafy neighborhood park lawn',
  delpaso: 'urban farm vegetable rows',
  gleaning: 'rows of harvested apples in wooden crates',
  tools: 'hand tools workshop wall',
  readysac: 'sandbags flood preparation community',
  grants: 'neighbors community potluck outdoor',
  welcome: 'front porch neighborhood house',
  lemons: 'meyer lemons in a crate',
  crates: 'wooden crates of harvested citrus',
  marmalade: 'jars of lemon marmalade',
  fridge: 'community refrigerator stocked with food',
  bunk: 'empty wooden bunk bed childrens bedroom',
  bread: 'fresh baked bread loaves',
  farm: 'kale and chard seedlings garden',
  bikes: 'bicycle repair stand workshop',
  pantry: 'little free pantry food box',
  faucet: 'close up of a dripping kitchen faucet',
  crib: 'empty pack and play portable crib',
  cuna: 'empty wooden baby crib in a bedroom',
  coats: 'winter coats hanging on a wooden rack',
  couch: 'beige fabric sofa in a living room',
  rides: 'car keys on a wooden table',
  airport: 'rolling suitcase beside a car at dawn',
  generator: 'portable gasoline generator outdoors',
  drill: 'cordless drill on a workbench',
  tiller: 'garden rototiller in vegetable soil',
  carseat: 'empty convertible car seat in a back seat',
  table: 'simple wooden dining table and chairs',
  masks: 'stack of white n95 respirator masks',
  meals: 'home cooked dinner in glass containers',
  brakes: 'car brake rotor on a mechanic workbench',
  ladder: 'aluminum extension ladder in a garage',
  truck: 'pickup truck with the tailgate down',
  canning: 'mason jars in a water bath canning pot',
  cucumbers: 'fresh cucumbers and long beans in a basket',
  english: 'classroom whiteboard and notebooks on a desk',
  radio: 'amateur ham radio transceiver on a desk',
  sandbags: 'sandbags stacked along a house foundation',
  sandbagpile: 'pile of filled flood sandbags',
  pump: 'portable sump pump with a hose',
  tarps: 'blue tarps folded in the bed of a pickup truck'
}

/** Square marks for the group and spaces. Objects and places, not faces. */
const MARKS = {
  'river-city': 'hands passing a bag of groceries',
  'oak-park': 'oak tree leaves sunlight',
  midtown: 'downtown skyline at dusk',
  'land-park': 'pink roses in a garden',
  'del-paso': 'vegetable seedling trays',
  gleaning: 'wooden crate of freshly picked apples',
  tools: 'hand tools on a workbench',
  ready: 'stacked flood sandbags',
  grants: 'coins in a glass jar',
  welcome: 'front door with a flower wreath',
  'bay-delta': 'river delta wetlands aerial'
}

/** Pexels searches for headshots. The first query that fills the pool wins. */
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
 * Load cached photo URLs, fetching any that are missing.
 * @returns {Promise<Record<string, string>>}
 */
async function loadImages () {
  const cache = readCache()
  const urls = {}
  let unsplashBlocked = false

  for (const [key, query] of Object.entries(QUERIES)) {
    if (cache[key] && cache[key].url) {
      urls[key] = cache[key].url
      continue
    }

    let found = null
    if (!unsplashBlocked && process.env.UNSPLASH_ACCESS_KEY) {
      found = await searchUnsplash(query)
      if (found && found.blocked) {
        unsplashBlocked = true
        found = null
        console.info('  unsplash rate limit reached, switching to pexels')
      }
    }
    if (!found && process.env.PEXELS_API_KEY) {
      found = await searchPexels(query)
    }
    if (!found || !found.url) {
      console.info(`  no photo for ${key} (${query})`)
      continue
    }
    if (found.url.length > 255) {
      console.info(`  skipping ${key}, url is longer than 255 characters`)
      continue
    }
    cache[key] = { url: found.url, source: found.source, query, alt: found.alt || '' }
    urls[key] = found.url
    console.info(`  photo ${key} from ${found.source}`)
  }

  urls.marks = await loadMarks(cache)
  urls.portraits = await loadPortraits(cache)
  writeCache(cache)
  return urls
}

/**
 * Read the on-disk photo cache.
 * @returns {Record<string, {url: string, source: string, query: string}>}
 */
function readCache () {
  if (!fs.existsSync(CACHE_PATH)) return {}
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  } catch (err) {
    return {}
  }
}

/**
 * Persist the photo cache.
 * @param {object} cache
 */
function writeCache (cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
}

/**
 * Search Unsplash and return a short images.unsplash.com URL.
 * @param {string} query
 * @returns {Promise<{url: string, source: string}|{blocked: true}|null>}
 */
async function searchUnsplash (query) {
  const url = new URL('https://api.unsplash.com/search/photos')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', '10')
  url.searchParams.set('orientation', 'landscape')
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` }
  })
  if (res.status === 403 || res.status === 429) return { blocked: true }
  if (!res.ok) {
    console.info(`  unsplash ${res.status} for "${query}"`)
    return null
  }
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
  return {
    source: 'unsplash',
    alt: photo.alt_description || photo.description || '',
    url: `https://images.unsplash.com/photo-${match[1]}?w=1600&h=900&fit=crop&q=80`
  }
}

/**
 * Search Pexels and return a short images.pexels.com URL.
 * @param {string} query
 * @returns {Promise<{url: string, source: string}|null>}
 */
async function searchPexels (query) {
  const url = new URL('https://api.pexels.com/v1/search')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', '10')
  url.searchParams.set('orientation', 'landscape')
  const res = await fetch(url, {
    headers: { Authorization: process.env.PEXELS_API_KEY }
  })
  if (!res.ok) {
    console.info(`  pexels ${res.status} for "${query}"`)
    return null
  }
  const data = await res.json()
  const photo = (data.photos || []).find(item => !looksLikePerson(item.alt))
  if (!photo) return null
  return {
    source: 'pexels',
    alt: photo.alt || '',
    url: `https://images.pexels.com/photos/${photo.id}/pexels-photo-${photo.id}.jpeg?auto=compress&cs=tinysrgb&w=1600`
  }
}

/**
 * Square object photos for the group and each space.
 * @param {object} cache
 * @returns {Promise<Record<string, string>>}
 */
async function loadMarks (cache) {
  const marks = {}
  for (const [key, query] of Object.entries(MARKS)) {
    const cacheKey = `mark:${key}`
    if (cache[cacheKey] && cache[cacheKey].url) {
      marks[key] = cache[cacheKey].url
      continue
    }
    const url = await findMark(query)
    marks[key] = url || colorfulMark(key)
    if (url) cache[cacheKey] = { url, source: 'pexels', query }
    console.info(url ? `  mark ${key}` : `  illustrated mark for ${key}`)
  }
  return marks
}

/**
 * First Pexels result whose description is a place or object.
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
 * One cached headshot per neighbor. Tibet is not included.
 * @param {object} cache
 * @returns {Promise<Record<string, string>>}
 */
async function loadPortraits (cache) {
  const people = cast().filter(member => !member.existing)
  const unpooled = people.filter(member => !portraitPool(member.key)).map(member => member.key)
  if (unpooled.length) throw new Error(`No portrait pool for ${unpooled.join(', ')}`)

  const assigned = {}
  const used = new Set()
  for (const member of people) {
    const cached = cache[`face:${member.key}`]
    if (!cached || !cached.url) continue
    assigned[member.key] = cached.url
    used.add(cached.url)
  }

  const missing = people.filter(member => !assigned[member.key])
  if (missing.length && process.env.PEXELS_API_KEY) {
    const byPool = {}
    for (const member of missing) {
      const pool = portraitPool(member.key)
      if (!byPool[pool]) byPool[pool] = []
      byPool[pool].push(member)
    }
    const order = Object.keys(PORTRAIT_QUERIES).filter(pool => pool !== 'person').concat('person')
    for (const pool of order) {
      const members = (byPool[pool] || []).slice().sort((a, b) => a.key.localeCompare(b.key))
      if (!members.length) continue
      const urls = await collectPortraits(pool, members.length, used)
      members.forEach((member, index) => {
        const url = urls[index]
        if (!url) return
        assigned[member.key] = url
        used.add(url)
        cache[`face:${member.key}`] = { url, source: 'pexels', pool }
      })
      const stillMissing = members.filter(member => !assigned[member.key]).length
      if (stillMissing) console.info(`  ${pool} is short by ${stillMissing}`)
    }
  }

  for (const member of people) {
    if (assigned[member.key]) continue
    assigned[member.key] = colorfulPerson(member.key)
    console.info(`  illustrated fallback for ${member.key}`)
  }
  return assigned
}

/**
 * Headshot URLs for one pool, skipping photos already given to someone else.
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
 * One page of Pexels search results.
 * @param {string} query
 * @param {{ page: number, perPage: number, orientation?: string }} options
 * @returns {Promise<object[]>}
 */
async function searchPexelsPage (query, { page, perPage, orientation }) {
  const url = new URL('https://api.pexels.com/v1/search')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('page', String(page))
  if (orientation) url.searchParams.set('orientation', orientation)
  const res = await fetch(url, {
    headers: { Authorization: process.env.PEXELS_API_KEY }
  })
  if (res.status === 429) {
    console.info(`  pexels rate limit on "${query}"`)
    return []
  }
  if (!res.ok) {
    console.info(`  pexels ${res.status} for "${query}"`)
    return []
  }
  const data = await res.json()
  return data.photos || []
}

/**
 * Square crop on the Pexels CDN. Short enough for the avatar_url column.
 * @param {{ id: number }} photo
 * @returns {string}
 */
function pexelsSquare (photo) {
  return `https://images.pexels.com/photos/${photo.id}/pexels-photo-${photo.id}.jpeg?auto=compress&cs=tinysrgb&w=480&h=480&fit=crop`
}

/**
 * Alt text that is about a person, so group marks stay objects and places.
 * @param {string} alt
 * @returns {boolean}
 */
function looksLikePerson (alt) {
  return /\b(man|woman|person|people|portrait|face|girl|boy|child|kid|baby|guy|lady|couple|crowd|human)\b/i.test(alt || '')
}

/**
 * A headshot we can use: a color photo of an adult, not a costume shot.
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
 * Colorful illustrated fallback when a headshot search comes up short.
 * @param {string} seed
 * @returns {string}
 */
function colorfulPerson (seed) {
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}

/**
 * Colorful icon fallback for a group mark. Not a person.
 * @param {string} seed
 * @returns {string}
 */
function colorfulMark (seed) {
  return `https://api.dicebear.com/9.x/icons/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}

module.exports = { loadImages, QUERIES }
