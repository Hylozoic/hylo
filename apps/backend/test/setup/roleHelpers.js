/**
 * Test helpers for group role assignments.
 */

async function assignCoordinator (user, group, opts = {}) {
  await GroupRole.setupSystemRoles(group.id, opts)
  await user.joinGroup(group, { assignCoordinator: true, ...opts })
}

async function assignTrackManager (user, group, opts = {}) {
  await assignCoordinator(user, group, opts)
}

async function ensureManageTracksResponsibility () {
  let responsibility = await Responsibility.where({ title: Responsibility.constants.RESP_MANAGE_TRACKS }).fetch()
  if (!responsibility) {
    responsibility = await Responsibility.forge({
      title: Responsibility.constants.RESP_MANAGE_TRACKS,
      description: 'The ability to create, edit, and delete tracks.',
      type: 'system'
    }).save()
  }
  return responsibility
}

module.exports = {
  assignCoordinator,
  assignTrackManager,
  ensureManageTracksResponsibility
}
