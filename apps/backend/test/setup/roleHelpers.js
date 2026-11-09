/**
 * Test helpers for group role assignments.
 */

async function assignAdministrator (user, group, opts = {}) {
  await GroupRole.setupSystemRoles(group.id, opts)
  await user.joinGroup(group, { assignAdministrator: true, ...opts })
}

module.exports = {
  assignAdministrator
}
