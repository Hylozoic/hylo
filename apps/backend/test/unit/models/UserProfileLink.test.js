/* eslint-disable no-unused-expressions */

import '../../setup'
import factories from '../../setup/factories'

describe('UserProfileLink', () => {
  describe('.create', () => {
    it('sets sort_order to 0 for the first link and max + 1 after that', async () => {
      const user = await factories.user().save()
      const first = await UserProfileLink.create({
        userId: user.id,
        url: 'https://first.example',
        title: 'First'
      })
      const second = await UserProfileLink.create({
        userId: user.id,
        url: 'https://second.example',
        title: 'Second'
      })

      expect(first.get('sort_order')).to.equal(0)
      expect(second.get('sort_order')).to.equal(1)
    })
  })

  describe('.findByUser', () => {
    it('returns links ordered by sort_order', async () => {
      const user = await factories.user().save()
      const first = await UserProfileLink.create({
        userId: user.id,
        url: 'https://first.example',
        title: 'First'
      })
      const second = await UserProfileLink.create({
        userId: user.id,
        url: 'https://second.example',
        title: 'Second'
      })
      await second.save({ sort_order: 0 }, { patch: true })
      await first.save({ sort_order: 1 }, { patch: true })

      const links = await UserProfileLink.findByUser(user.id)
      expect(links.map(link => link.get('url'))).to.deep.equal([
        'https://second.example',
        'https://first.example'
      ])
    })
  })
})
