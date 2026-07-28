/**
 * Test helpers for group role assignments.
 */

async function assignCoordinator (user, group, opts = {}) {
  await GroupRole.setupSystemRoles(group.id, opts)
  await user.joinGroup(group, { assignCoordinator: true, ...opts })
}

/** @deprecated use assignCoordinator — coordinators have Manage Spaces */
async function assignTrackManager (user, group, opts = {}) {
  await assignCoordinator(user, group, opts)
}

async function ensureManageSpacesResponsibility () {
  let responsibility = await Responsibility.where({ title: Responsibility.constants.RESP_MANAGE_SPACES }).fetch()
  if (!responsibility) {
    responsibility = await Responsibility.forge({
      title: Responsibility.constants.RESP_MANAGE_SPACES,
      description: 'The ability to create and manage spaces (including tracks and funding rounds) within this group.',
      type: 'system'
    }).save()
  }
  return responsibility
}

module.exports = {
  assignCoordinator,
  assignTrackManager,
  ensureManageSpacesResponsibility,
  // Back-compat alias used by older tests
  ensureManageTracksResponsibility: ensureManageSpacesResponsibility
}
