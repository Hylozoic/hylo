module.exports = {
  // post: async function (req, res) {
  //   const postId = req.param('postId')
  //   const post = Post.find(postId)
  //   if (post.isPublic()) {
  //     const postObject = {
  //       title: post.title()
  //     }
  //     return res.ok(postObject.toJSON())
  //   } else {
  //     return res.forbidden()
  //   }
  // },

  group: async function (req, res) {
    sails.log.info('MurmurationsController.group', req.param('groupId'), req.param('groupSlug'))
    const groupSlug = req.param('groupSlug')
    const group = await Group.findActive(groupSlug)
    sails.log.info('MurmurationsController.group', group)
    if (group.hasMurmurationsProfile()) {
      const groupObject = await group.toMurmurationsObject()
      sails.log.info('MurmurationsController.group', groupObject)
      return res.ok(JSON.stringify(groupObject))
    } else {
      return res.forbidden()
    }
  }
}
