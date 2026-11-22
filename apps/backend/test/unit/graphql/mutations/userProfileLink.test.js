/* eslint-disable no-unused-expressions */

import '../../../setup'
import factories from '../../../setup/factories'
import { createUserProfileLink, reorderUserProfileLinks, updateUserProfileLink } from '../../../../api/graphql/mutations/userProfileLink'

describe('createUserProfileLink', () => {
  it('leaves icon_url null and ignores a client icon', async () => {
    const user = await factories.user().save()
    const link = await createUserProfileLink(user.id, {
      url: 'example.com',
      title: 'Site',
      iconUrl: 'https://evil.example/icon.png'
    })

    expect(link.get('url')).to.equal('https://example.com')
    expect(link.get('icon_url')).to.equal(null)
  })
})

describe('updateUserProfileLink', () => {
  it('leaves icon_url null and ignores a client icon', async () => {
    const user = await factories.user().save()
    const link = await UserProfileLink.create({
      userId: user.id,
      url: 'https://a.example',
      title: 'A'
    })

    const updated = await updateUserProfileLink(user.id, link.id, {
      url: 'b.example',
      title: 'B',
      iconUrl: 'https://evil.example/icon.png'
    })

    expect(updated.get('url')).to.equal('https://b.example')
    expect(updated.get('icon_url')).to.equal(null)
  })
})

describe('reorderUserProfileLinks', () => {
  it('rejects a link the user does not own', async () => {
    const user = await factories.user().save()
    const other = await factories.user().save()
    const link = await UserProfileLink.create({
      userId: other.id,
      url: 'https://other.example',
      title: 'Other'
    })

    let err
    try {
      await reorderUserProfileLinks(user.id, [link.id])
    } catch (error) {
      err = error
    }
    expect(err.message).to.equal('Profile link not found')
  })

  it('rejects a set that is not exactly the user\'s links', async () => {
    const user = await factories.user().save()
    const first = await UserProfileLink.create({
      userId: user.id,
      url: 'https://a.example',
      title: 'A'
    })
    await UserProfileLink.create({
      userId: user.id,
      url: 'https://b.example',
      title: 'B'
    })

    let err
    try {
      await reorderUserProfileLinks(user.id, [first.id])
    } catch (error) {
      err = error
    }
    expect(err.message).to.equal('Profile link ids do not match your links')
  })

  it('persists sort_order in the given order', async () => {
    const user = await factories.user().save()
    const a = await UserProfileLink.create({ userId: user.id, url: 'https://a.example', title: 'A' })
    const b = await UserProfileLink.create({ userId: user.id, url: 'https://b.example', title: 'B' })
    const c = await UserProfileLink.create({ userId: user.id, url: 'https://c.example', title: 'C' })

    const reordered = await reorderUserProfileLinks(user.id, [c.id, a.id, b.id])
    expect(reordered.map(link => link.get('url'))).to.deep.equal([
      'https://c.example',
      'https://a.example',
      'https://b.example'
    ])

    const saved = await UserProfileLink.findByUser(user.id)
    expect(saved.map(link => link.get('sort_order'))).to.deep.equal([0, 1, 2])
    expect(saved.map(link => String(link.id))).to.deep.equal([String(c.id), String(a.id), String(b.id)])
  })
})
