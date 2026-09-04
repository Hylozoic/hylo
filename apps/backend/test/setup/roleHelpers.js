/**
 * Test helpers for group role assignments.
 */

async function assignCoordinator (user, group, opts = {}) {
  await GroupRole.setupSystemRoles(group.id, opts)
  await user.joinGroup(group, { assignCoordinator: true, ...opts })
}

module.exports = {
  assignCoordinator
}
