export default function deleteComment (comment, userId) {
  return bookshelf.transaction(async (trx) => {
    const post = await Post.find(comment.get('post_id'), { transacting: trx })

    await Activity.removeForComment(comment.id, trx)

    await comment.save({
      deactivated_by_id: userId,
      deactivated_at: new Date(),
      active: false,
      recent: false
    }, { patch: true, transaction: trx })

    await post.save({
      num_comments: post.get('num_comments') - 1,
      num_commenters: await post.getCommentersTotal()
    }, { transaction: trx })

    await Tag.updateForPost(post, null, null, null, trx)
  })
}
