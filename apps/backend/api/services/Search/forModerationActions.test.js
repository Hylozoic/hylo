/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { assignCoordinator } from '../../../test/setup/roleHelpers'
import forModerationActions from './forModerationActions'

describe('forModerationActions', () => {
  let parentGroup, memberSpace, otherSpace
  let member, coordinator
  let parentAction, memberSpaceAction, otherSpaceAction

  before(async function () {
    this.timeout(10000)
    parentGroup = await factories.group({ slug: 'mod-parent-group', active: true }).save()
    memberSpace = await factories.group({
      type: 'space',
      parent_id: parentGroup.id,
      slug: 'mod-parent-group-member-space',
      active: true
    }).save()
    otherSpace = await factories.group({
      type: 'space',
      parent_id: parentGroup.id,
      slug: 'mod-parent-group-other-space',
      active: true
    }).save()

    member = await factories.user().save()
    coordinator = await factories.user().save()

    await member.joinGroup(parentGroup)
    await member.joinGroup(memberSpace)
    await assignCoordinator(coordinator, parentGroup)

    const post = await factories.post().save()
    parentAction = await ModerationAction.forge({
      anonymous: false,
      post_id: post.id,
      reporter_id: member.id,
      text: 'flagged in parent',
      status: 'active',
      group_id: parentGroup.id
    }).save()
    memberSpaceAction = await ModerationAction.forge({
      anonymous: false,
      post_id: post.id,
      reporter_id: member.id,
      text: 'flagged in member space',
      status: 'active',
      group_id: memberSpace.id
    }).save()
    otherSpaceAction = await ModerationAction.forge({
      anonymous: false,
      post_id: post.id,
      reporter_id: member.id,
      text: 'flagged in other space',
      status: 'active',
      group_id: otherSpace.id
    }).save()
  })

  after(async function () {
    this.timeout(10000)
    await setup.clearDb()
  })

  /** Return moderation action ids as strings for comparison. */
  function actionIds (collection) {
    return collection.map(action => String(action.id))
  }

  it('includes the group and member spaces when viewing a group', async () => {
    const results = await forModerationActions({
      slug: parentGroup.get('slug'),
      currentUserId: member.id,
      limit: 20,
      offset: 0
    }).fetchAll()
    const ids = actionIds(results)
    expect(ids).to.include(String(parentAction.id))
    expect(ids).to.include(String(memberSpaceAction.id))
    expect(ids).to.not.include(String(otherSpaceAction.id))
  })

  it('includes all child space actions when the viewer has Manage Content', async () => {
    const results = await forModerationActions({
      slug: parentGroup.get('slug'),
      currentUserId: coordinator.id,
      limit: 20,
      offset: 0
    }).fetchAll()
    const ids = actionIds(results)
    expect(ids).to.include(String(parentAction.id))
    expect(ids).to.include(String(memberSpaceAction.id))
    expect(ids).to.include(String(otherSpaceAction.id))
  })

  it('includes only that space when viewing a space', async () => {
    const results = await forModerationActions({
      slug: memberSpace.get('slug'),
      currentUserId: coordinator.id,
      limit: 20,
      offset: 0
    }).fetchAll()
    const ids = actionIds(results)
    expect(ids).to.include(String(memberSpaceAction.id))
    expect(ids).to.not.include(String(parentAction.id))
    expect(ids).to.not.include(String(otherSpaceAction.id))
  })
})
