module.exports = async function checkAndSetMembership (req, res, next) {
  if (Admin.isSignedIn(req)) return next()
  if (res.locals.publicAccessAllowed) return next()

  const groupId = req.param('groupId')

  // if no group id is specified, continue.
  // this is for routes that can be limited to a specific group
  // or performed across all groups a user can access, e.g. search and
  // getting a user's list of followed tags.
  if (!groupId || groupId === 'all') return next()

  const group = await Group.findActive(groupId)
  if (!group) return res.notFound()
  res.locals.group = group

  const { userId } = req.session
  const membership = await GroupMembership.forPair(userId, group).fetch()
  if (!membership) {
    sails.log.debug(`policy: checkAndSetMembership: no membership. user ${userId}, group ${group.id}`)
    return res.forbidden()
  }

  // For paywalled groups, also check that user has proper scope access
  // (membership alone is not enough - they need active content access)
  const hasAccess = await group.canAccess(userId)
  if (!hasAccess) {
    sails.log.debug(`policy: checkAndSetMembership: paywall access denied. user ${userId}, group ${group.id}`)
    return res.forbidden()
  }

  return next()
}
