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
    // The index drops a profile when its URL returns 404, so unpublished groups must 404 too
    if (!group || !group.hasMurmurationsProfile()) return res.notFound()
    return res.ok(await group.toMurmurationsObject())
  }
}
