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
    const groupSlug = req.param('groupSlug')
    const group = await Group.findActive(groupSlug)
    if (group.hasMurmurationsProfile()) {
      const groupObject = await group.toMurmurationsObject()
      return res.ok(groupObject)
    } else {
      return res.forbidden()
    }
  }
}
