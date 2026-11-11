const root = require('root-path')
require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const MurmurationsController = require(root('api/controllers/MurmurationsController'))

describe('MurmurationsController', () => {
  let req, res

  beforeEach(() => {
    req = factories.mock.request()
    res = factories.mock.response()
  })

  describe('.group', () => {
    it('returns the profile of a public group that publishes one', async () => {
      const group = await factories.group({
        visibility: Group.Visibility.PUBLIC,
        settings: { publish_murmurations_profile: true }
      }).save()
      req.params = { groupSlug: group.get('slug') }

      await MurmurationsController.group(req, res)

      expect(res.ok).to.have.been.called()
      expect(res.body.unique_id).to.equal('hylo-group-' + group.id)
    })

    it('returns not found for an unknown group', async () => {
      req.params = { groupSlug: 'no-such-group-for-murmurations' }

      await MurmurationsController.group(req, res)

      expect(res.notFound).to.have.been.called()
      expect(res.ok).not.to.have.been.called()
    })

    it('returns not found for a group that does not publish a profile', async () => {
      const group = await factories.group({
        visibility: Group.Visibility.PUBLIC,
        settings: { publish_murmurations_profile: false }
      }).save()
      req.params = { groupSlug: group.get('slug') }

      await MurmurationsController.group(req, res)

      expect(res.notFound).to.have.been.called()
      expect(res.ok).not.to.have.been.called()
    })

    it('returns not found for a deactivated group', async () => {
      const group = await factories.group({
        active: false,
        visibility: Group.Visibility.PUBLIC,
        settings: { publish_murmurations_profile: true }
      }).save()
      req.params = { groupSlug: group.get('slug') }

      await MurmurationsController.group(req, res)

      expect(res.notFound).to.have.been.called()
    })
  })
})
