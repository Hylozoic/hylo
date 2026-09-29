import '../../setup'
import factories from '../../setup/factories'
import { createRequestHandler } from '../../../api/graphql'
import { clickSiteBanner, dismissSiteBanner, createSiteBanner, updateSiteBanner } from '../../../api/graphql/mutations/siteBanners'

describe('SiteBanner', () => {
  let admin, reader, other, oldAdmins

  const publishedBanner = attrs => SiteBanner.forge({
    title: 'New feature',
    text: '<p>Try it</p>',
    action_text: 'Take a look',
    action_url: 'https://www.hylo.com/new',
    published_at: new Date(Date.now() - 1000),
    show_to_new_users: true,
    ...attrs
  }).save()

  before(async () => {
    admin = await factories.user().save()
    reader = await factories.user().save()
    other = await factories.user().save()
    oldAdmins = process.env.HYLO_ADMINS
    process.env.HYLO_ADMINS = String(admin.id)
  })

  after(() => {
    process.env.HYLO_ADMINS = oldAdmins
  })

  describe('clicks and dismissals', () => {
    it("counts a click apart from a dismissal, and a click isn't counted as a dismissal", async () => {
      const banner = await publishedBanner()
      await clickSiteBanner(reader.id, banner.id)
      await dismissSiteBanner(other.id, banner.id)

      expect(await SiteBanner.clickedCount(banner.id)).to.equal(1)
      expect(await SiteBanner.dismissedCount(banner.id)).to.equal(1)
    })

    it('hides a clicked banner for that person only', async () => {
      const banner = await publishedBanner()
      await clickSiteBanner(reader.id, banner.id)

      const forReader = await SiteBanner.activeForUser(reader.id)
      expect(forReader.pluck('id')).not.to.include(banner.id)
      const forOther = await SiteBanner.activeForUser(other.id)
      expect(forOther.pluck('id')).to.include(banner.id)
    })

    it('records a click on a banner someone already dismissed in another tab', async () => {
      const banner = await publishedBanner()
      await dismissSiteBanner(reader.id, banner.id)
      await clickSiteBanner(reader.id, banner.id)
      await clickSiteBanner(reader.id, banner.id)

      expect(await SiteBanner.clickedCount(banner.id)).to.equal(1)
      expect(await SiteBanner.dismissedCount(banner.id)).to.equal(0)
    })

    it("won't record a click on a banner that isn't published", async () => {
      const draft = await SiteBanner.forge({ title: 'Draft', text: 'x' }).save()
      await clickSiteBanner(reader.id, draft.id)
        .then(() => expect.fail('should reject'))
        .catch(e => expect(e.message).to.match(/not found/))
      await clickSiteBanner(null, draft.id)
        .then(() => expect.fail('should reject'))
        .catch(e => expect(e.message).to.match(/logged in/))
    })
  })

  describe('translations', () => {
    it('gives the viewer their language and falls back to English per field', async () => {
      const banner = await publishedBanner({
        translations: { de: { title: 'Neue Funktion', text: '<p>Probier es aus</p>' } }
      })
      expect(banner.localized('title', 'de-DE')).to.equal('Neue Funktion')
      expect(banner.localized('text', 'de')).to.equal('<p>Probier es aus</p>')
      expect(banner.localized('action_text', 'de-DE')).to.equal('Take a look')
      expect(banner.localized('title', 'fr-FR')).to.equal('New feature')
      expect(banner.localized('title', 'en-US')).to.equal('New feature')
      expect(banner.localized('title', null)).to.equal('New feature')
    })

    it('keeps only known languages and fields when saving', async () => {
      const banner = await createSiteBanner(admin.id, {
        title: 'Hello',
        text: 'Hi',
        translations: {
          es: { title: ' Hola ', actionText: 'Ver', extra: 'no' },
          xx: { title: 'nope' },
          fr: { title: '   ' },
          en: { title: 'ignored' }
        }
      })
      expect(banner.get('translations')).to.deep.equal({ es: { title: 'Hola', action_text: 'Ver' } })

      const updated = await updateSiteBanner(admin.id, banner.id, { translations: 'not an object' })
      expect(updated.get('translations')).to.deep.equal({})
    })

    it('siteBanners answers in the viewer language; allSiteBanners keeps the English fields', async () => {
      const banner = await publishedBanner({
        title: 'Only for this test',
        translations: { pt: { title: 'Só para este teste' } }
      })
      const portugueseReader = await factories.user({ settings: { locale: 'pt-BR' } }).save()
      const handler = createRequestHandler()
      const run = async (viewer, document) => {
        const req = factories.mock.request()
        req.url = '/noo/graphql'
        req.method = 'POST'
        req.headers = { 'Content-Type': 'application/json' }
        req.session = { userId: viewer.id, destroy: () => {} }
        req.user = viewer
        const res = factories.mock.response()
        const { executionResult } = await handler.inject({ document, serverContext: { req, res } })
        return executionResult
      }

      const viewerResult = await run(portugueseReader, '{ siteBanners { id title actionText } }')
      expect(viewerResult.errors).to.equal(undefined)
      const seen = viewerResult.data.siteBanners.find(b => String(b.id) === String(banner.id))
      expect(seen.title).to.equal('Só para este teste')
      expect(seen.actionText).to.equal('Take a look')

      const adminResult = await run(admin, '{ allSiteBanners { id title translations clickedCount dismissedCount } }')
      expect(adminResult.errors).to.equal(undefined)
      const managed = adminResult.data.allSiteBanners.find(b => String(b.id) === String(banner.id))
      expect(managed.title).to.equal('Only for this test')
      expect(managed.translations).to.deep.equal({ pt: { title: 'Só para este teste' } })
      expect(managed.clickedCount).to.equal(0)
    })
  })
})
