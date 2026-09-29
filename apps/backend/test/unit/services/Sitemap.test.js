/* eslint-disable no-unused-expressions */
/* global Sitemap */
import setup from '../../setup'
import factories from '../../setup/factories'

const storage = require('../../../lib/uploader/storage')

const PUBLIC = 2
const PROTECTED = 1

async function addPost (group, user, attrs = {}) {
  const post = await factories.post({ user_id: user.id, type: 'discussion', is_public: true, ...attrs }).save()
  await bookshelf.knex('groups_posts').insert({ group_id: group.id, post_id: post.id })
  return post
}

describe('Sitemap', () => {
  let listed, unlisted, listedProtected, listedSpace, inactive
  let publicPost, privatePost, chatPost, removedPost, unlistedPost, protectedPost
  let oldProtocol, oldDomain

  before(async () => {
    oldProtocol = process.env.PROTOCOL
    oldDomain = process.env.DOMAIN
    process.env.PROTOCOL = 'https'
    process.env.DOMAIN = 'hylo.example'

    await setup.clearDb()
    const author = await factories.user().save()
    listed = await factories.group({ slug: 'listed-garden', visibility: PUBLIC, allow_in_public: true }).save()
    unlisted = await factories.group({ slug: 'unlisted-garden', visibility: PUBLIC, allow_in_public: false }).save()
    listedProtected = await factories.group({ slug: 'protected-garden', visibility: PROTECTED, allow_in_public: true }).save()
    listedSpace = await factories.group({ slug: 'garden-space', visibility: PUBLIC, allow_in_public: true, type: 'space' }).save()
    inactive = await factories.group({ slug: 'closed-garden', visibility: PUBLIC, allow_in_public: true, active: false }).save()

    publicPost = await addPost(listed, author)
    privatePost = await addPost(listed, author, { is_public: false })
    chatPost = await addPost(listed, author, { type: 'chat' })
    removedPost = await addPost(listed, author, { active: false })
    unlistedPost = await addPost(unlisted, author)
    protectedPost = await addPost(listedProtected, author)
  })

  after(() => {
    process.env.PROTOCOL = oldProtocol
    process.env.DOMAIN = oldDomain
  })

  it('lists only listed Public, active, top-level groups and their public posts', async () => {
    const [file] = await Sitemap.build()
    expect(file.name).to.equal('sitemap.xml')
    expect(file.xml).to.contain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(file.xml).to.contain('<loc>https://hylo.example/groups/listed-garden/about</loc>')
    expect(file.xml).to.contain(`<loc>https://hylo.example/post/${publicPost.id}</loc>`)
    expect(file.xml).to.contain('<lastmod>')
    expect(file.urlCount).to.equal(2)

    for (const group of [unlisted, listedProtected, listedSpace, inactive]) {
      expect(file.xml).not.to.contain(`/groups/${group.get('slug')}/`)
    }
    for (const post of [privatePost, chatPost, removedPost, unlistedPost, protectedPost]) {
      expect(file.xml).not.to.contain(`/post/${post.id}<`)
    }
  })

  it('splits into an index and numbered files when there are more URLs than fit in one file', async () => {
    const files = await Sitemap.build({ maxUrlsPerFile: 1, now: new Date('2026-10-01T00:00:00Z') })
    expect(files.map(f => f.name)).to.deep.equal(['sitemap.xml', 'sitemap-1.xml', 'sitemap-2.xml'])
    const [index, first, second] = files
    expect(index.xml).to.contain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(index.xml).to.contain('<loc>https://hylo.example/sitemaps/sitemap-1.xml</loc>')
    expect(index.xml).to.contain('<loc>https://hylo.example/sitemaps/sitemap-2.xml</loc>')
    expect(index.xml).to.contain('<lastmod>2026-10-01T00:00:00.000Z</lastmod>')
    expect(first.xml).to.contain('/groups/listed-garden/about')
    expect(second.xml).to.contain(`/post/${publicPost.id}`)
  })

  it('escapes URLs for XML', () => {
    const xml = Sitemap.urlsetXml([{ loc: 'https://hylo.example/a?b=1&c=2', lastmod: null }])
    expect(xml).to.contain('<loc>https://hylo.example/a?b=1&amp;c=2</loc>')
    expect(xml).not.to.contain('<lastmod>')
  })

  describe('.generate', () => {
    let originalWrite, writes

    beforeEach(() => {
      writes = []
      originalWrite = storage.writeStringToS3
      storage.writeStringToS3 = async (content, key, options) => { writes.push({ key, options }) }
    })

    afterEach(() => {
      storage.writeStringToS3 = originalWrite
    })

    it('stores the parts before the index, as XML', async () => {
      const count = await Sitemap.generate({ maxUrlsPerFile: 1 })
      expect(count).to.equal(2)
      expect(writes.map(w => w.key)).to.deep.equal([
        Sitemap.storageKey('sitemap-1.xml'),
        Sitemap.storageKey('sitemap-2.xml'),
        Sitemap.storageKey('sitemap.xml')
      ])
      expect(writes[0].options).to.deep.equal({ ContentType: 'application/xml' })
      expect(Sitemap.storageKey('sitemap.xml')).to.match(/\/sitemaps\/sitemap\.xml$/)
    })
  })
})
