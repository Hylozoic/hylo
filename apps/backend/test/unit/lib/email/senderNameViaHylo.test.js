import factories from '../../../setup/factories'
import {
  groupDisplayNameWithParent,
  senderNameForGroup,
  senderNameViaHylo
} from '../../../../lib/email/senderNameViaHylo'
require('../../../setup')

const model = factories.mock.model

describe('senderNameViaHylo', () => {
  it('appends the via Hylo suffix', () => {
    expect(senderNameViaHylo('Garden', 'en-US')).to.equal('Garden (via Hylo)')
  })

  it('does not double the suffix', () => {
    expect(senderNameViaHylo('Garden (via Hylo)', 'en-US')).to.equal('Garden (via Hylo)')
  })
})

describe('groupDisplayNameWithParent', () => {
  it('returns the group name for a regular group', () => {
    const group = model({ name: 'Foo Group' })
    expect(groupDisplayNameWithParent(group)).to.equal('Foo Group')
  })

  it('returns parent > space for a space', () => {
    const parent = model({ name: 'Foo Group' })
    const space = model({
      name: 'Garden',
      type: 'space',
      relations: { parentGroup: parent }
    })
    expect(groupDisplayNameWithParent(space)).to.equal('Foo Group > Garden')
  })

  it('falls back to the space name when the parent is missing', () => {
    const space = model({ name: 'Garden', type: 'space' })
    expect(groupDisplayNameWithParent(space)).to.equal('Garden')
  })

  it('ignores an empty related parent model', () => {
    const space = model({
      name: 'Garden',
      type: 'space',
      relations: { parentGroup: model({}) }
    })
    expect(groupDisplayNameWithParent(space)).to.equal('Garden')
  })
})

describe('senderNameForGroup', () => {
  it('uses parent > space (via Hylo) for a space', async () => {
    const parent = model({ name: 'Foo Group' })
    const space = model({
      name: 'Garden',
      type: 'space',
      relations: { parentGroup: parent }
    })
    expect(await senderNameForGroup(space, 'en-US')).to.equal('Foo Group > Garden (via Hylo)')
  })

  it('uses the group name (via Hylo) for a regular group', async () => {
    const group = model({ name: 'Foo Group' })
    expect(await senderNameForGroup(group, 'en-US')).to.equal('Foo Group (via Hylo)')
  })
})
