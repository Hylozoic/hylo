import { reduce } from 'lodash'

export const convertChildrenToProjectRequests = (parentPostId, trx) => {
  return Post.query().where('parent_post_id', parentPostId)
    .update({ is_project_request: true }).transacting(trx)
}

export const convertPostsForTagToChildren = (tagId, parentPostId, trxOpt) => {
  return Post.query(qb => {
    qb.join('posts_tags', 'posts_tags.post_id', '=', 'posts.id')
    qb.where('posts_tags.tag_id', '=', tagId)
    qb.where(function () {
      this.where('type', '!=', 'project')
        .orWhere('type', null)
    })
  })
    .fetchAll()
    .then(({ models }) => reduce(models, (promise, post) => promise
      .then(() => post.save('parent_post_id', parentPostId, trxOpt))
      .then(() => PostMembership.query(qb => qb.where('post_id', post.id)).destroy(trxOpt)), // it will rely on the parent posts community membership
    Promise.resolve())
    )
}
