import factories from '../../setup/factories'
require('../../setup')

const model = factories.mock.model

describe('GroupViewUser', () => {
  describe('.chatRoomDisplayName', () => {
    it('returns the group name for a regular group', () => {
      const group = model({ name: 'Foo Group' })
      expect(GroupViewUser.chatRoomDisplayName(group)).to.equal('Foo Group')
    })

    it('returns parent > space for a space', () => {
      const parent = model({ name: 'Foo Group' })
      const space = model({
        name: 'Garden',
        type: 'space',
        relations: { parentGroup: parent }
      })
      expect(GroupViewUser.chatRoomDisplayName(space)).to.equal('Foo Group > Garden')
    })

    it('falls back to the space name when the parent is missing', () => {
      const space = model({ name: 'Garden', type: 'space' })
      expect(GroupViewUser.chatRoomDisplayName(space)).to.equal('Garden')
    })

    it('ignores an empty related parent model', () => {
      const space = model({
        name: 'Garden',
        type: 'space',
        relations: { parentGroup: model({}) }
      })
      expect(GroupViewUser.chatRoomDisplayName(space)).to.equal('Garden')
    })
  })

  describe('.chatRoomAvatarUrl', () => {
    it('returns the group avatar for a regular group', () => {
      const group = model({ avatar_url: 'https://example.com/group.png' })
      expect(GroupViewUser.chatRoomAvatarUrl(group)).to.equal('https://example.com/group.png')
    })

    it('falls back to the parent group avatar when a space has none', () => {
      const parent = model({ avatar_url: 'https://example.com/group.png' })
      const space = model({
        type: 'space',
        relations: { parentGroup: parent }
      })
      expect(GroupViewUser.chatRoomAvatarUrl(space)).to.equal('https://example.com/group.png')
    })

    it('uses the space avatar when it has one', () => {
      const parent = model({ avatar_url: 'https://example.com/group.png' })
      const space = model({
        type: 'space',
        avatar_url: 'https://example.com/space.png',
        relations: { parentGroup: parent }
      })
      expect(GroupViewUser.chatRoomAvatarUrl(space)).to.equal('https://example.com/space.png')
    })
  })
})
