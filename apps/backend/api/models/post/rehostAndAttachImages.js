import * as rehostRemoteMedia from '../../../lib/uploader/rehostRemoteMedia'

/**
 * Background job: download remote image URLs, store them on S3, and attach them to a post.
 * Skips positions that already have an image so kue retries do not duplicate media.
 * @param {{ postId: string|number, userId: string|number, imageUrls: string[], startPosition?: number }} args
 */
export default async function rehostAndAttachImages ({ postId, userId, imageUrls, startPosition = 0 }) {
  const post = await Post.find(postId)
  if (!post) throw new Error(`rehostAndAttachImages: post ${postId} not found`)
  if (!imageUrls || imageUrls.length === 0) return

  let attached = 0
  let firstError = null

  for (let i = 0; i < imageUrls.length; i++) {
    const position = startPosition + i
    await post.load('media')
    const existing = post.relations.media.find(m =>
      m.get('type') === 'image' && Number(m.get('position')) === position
    )
    if (existing) continue

    try {
      const hostedUrl = await rehostRemoteMedia.rehostRemoteUrl(imageUrls[i], { userId })
      await Media.createForSubject({
        subjectType: 'post',
        subjectId: post.id,
        type: 'image',
        url: hostedUrl,
        position
      })
      attached += 1
    } catch (err) {
      console.error(`rehostAndAttachImages: failed to rehost ${imageUrls[i]} for post ${postId}:`, err)
      if (!firstError) firstError = err
    }
  }

  if (attached > 0) {
    Post.afterRelatedMutation(postId, { changeContext: 'edit' })
  }

  if (firstError) throw firstError
}
