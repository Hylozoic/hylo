module.exports = async function checkAndSetMembership (req, res, next) {
  const groupId = req.param('groupId')

  // if no group id is specified, continue.
  // this is for routes that can be limited to a specific group
  // or performed across all groups a user can access, e.g. search and
  // getting a user's list of followed tags.
  if (!groupId || groupId === 'all') return next()

  const group = await Group.findActive(groupId)
  if (!group) return res.notFound()
  res.locals.group = group

  if (Admin.isSignedIn(req)) return next()
  if (res.locals.publicAccessAllowed) return next()

  const { userId } = req.session
  const membership = await GroupMembership.forPair(userId, group).fetch()
  if (membership) return next()

  sails.log.debug(`policy: checkAndSetMembership: fail. user ${req.session.userId}, group ${group.id}`)
  res.forbidden()
}
