/* globals bookshelf */
import { writeStringToS3 } from '../../lib/uploader/storage'

/*
 * A sitemap of what groups have chosen to make discoverable: the About pages of
 * Public, active, top-level groups listed in the Group Explorer, and the public
 * posts in those groups. Built daily by cron.js and stored next to the other
 * uploads; the web server serves it at /sitemap.xml (see
 * apps/web/src/server/sitemapRoute.js).
 *
 * When there are more URLs than fit in one file, sitemap.xml is an index that
 * points to sitemaps/sitemap-1.xml, sitemaps/sitemap-2.xml, and so on.
 */

// The sitemaps protocol allows at most 50,000 URLs in one file
const MAX_URLS_PER_FILE = 50000
const INDEX_FILE = 'sitemap.xml'
const PUBLIC_VISIBILITY = 2
// Post types that have their own public page (not chat, welcome or system notices)
const SITEMAP_POST_TYPES = ['discussion', 'request', 'offer', 'project', 'proposal', 'event', 'resource']

const origin = () => `${process.env.PROTOCOL}://${process.env.DOMAIN}`

const escapeXml = value => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const isoDate = value => value ? new Date(value).toISOString() : null

/** Listed Public, active, top-level groups. */
function listedGroupsQuery () {
  return bookshelf.knex('groups')
    .where('groups.active', true)
    .where('groups.visibility', PUBLIC_VISIBILITY)
    .where('groups.allow_in_public', true)
    .where(q => q.whereNull('groups.type').orWhere('groups.type', '<>', 'space'))
}

async function groupEntries () {
  const groups = await listedGroupsQuery()
    .select('groups.slug', 'groups.updated_at', 'groups.created_at')
    .orderBy('groups.id')
  return groups.map(g => ({
    loc: `${origin()}/groups/${encodeURIComponent(g.slug)}/about`,
    lastmod: isoDate(g.updated_at || g.created_at)
  }))
}

async function postEntries () {
  const posts = await bookshelf.knex('posts')
    .select('posts.id', 'posts.updated_at', 'posts.created_at')
    .where('posts.is_public', true)
    .where('posts.active', true)
    .whereIn('posts.type', SITEMAP_POST_TYPES)
    .whereExists(function () {
      this.select(bookshelf.knex.raw(1))
        .from('groups_posts')
        .whereRaw('groups_posts.post_id = posts.id')
        .whereIn('groups_posts.group_id', listedGroupsQuery().select('groups.id'))
    })
    .orderBy('posts.id')
  return posts.map(p => ({
    loc: `${origin()}/post/${p.id}`,
    lastmod: isoDate(p.updated_at || p.created_at)
  }))
}

function urlsetXml (entries) {
  const urls = entries.map(({ loc, lastmod }) =>
    `  <url>\n    <loc>${escapeXml(loc)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}  </url>`
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    ''
  ].join('\n')
}

function indexXml (fileNames, lastmod) {
  const sitemaps = fileNames.map(name =>
    `  <sitemap>\n    <loc>${escapeXml(`${origin()}/sitemaps/${name}`)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemaps,
    '</sitemapindex>',
    ''
  ].join('\n')
}

/**
 * Builds the sitemap files.
 * @returns {Promise<Array<{ name: string, xml: string, urlCount: number }>>} sitemap.xml first
 */
async function build ({ maxUrlsPerFile = MAX_URLS_PER_FILE, now = new Date() } = {}) {
  const entries = [...await groupEntries(), ...await postEntries()]
  if (entries.length <= maxUrlsPerFile) {
    return [{ name: INDEX_FILE, xml: urlsetXml(entries), urlCount: entries.length }]
  }

  const parts = []
  for (let i = 0; i < entries.length; i += maxUrlsPerFile) {
    const chunk = entries.slice(i, i + maxUrlsPerFile)
    parts.push({ name: `sitemap-${parts.length + 1}.xml`, xml: urlsetXml(chunk), urlCount: chunk.length })
  }
  const index = { name: INDEX_FILE, xml: indexXml(parts.map(p => p.name), now.toISOString()), urlCount: 0 }
  return [index, ...parts]
}

function storageKey (name) {
  return `${process.env.UPLOADER_PATH_PREFIX}/sitemaps/${name}`
}

/**
 * Builds the sitemap and stores it, parts first so the index never points at a missing file.
 * @returns {Promise<number>} how many URLs the sitemap lists
 */
async function generate (opts = {}) {
  const files = await build(opts)
  const [index, ...parts] = files
  for (const file of parts) {
    await writeStringToS3(file.xml, storageKey(file.name), { ContentType: 'application/xml' })
  }
  await writeStringToS3(index.xml, storageKey(index.name), { ContentType: 'application/xml' })
  return files.reduce((sum, f) => sum + f.urlCount, 0)
}

module.exports = {
  MAX_URLS_PER_FILE,
  INDEX_FILE,
  PUBLIC_VISIBILITY,
  SITEMAP_POST_TYPES,
  build,
  generate,
  groupEntries,
  indexXml,
  listedGroupsQuery,
  postEntries,
  storageKey,
  urlsetXml
}
