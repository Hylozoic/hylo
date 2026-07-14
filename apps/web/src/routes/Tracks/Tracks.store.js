import { COMPLETE_POST_PENDING, CREATE_POST } from 'store/constants'
import { ENROLL_IN_TRACK_PENDING, LEAVE_TRACK_PENDING, UPDATE_TRACK_PENDING, UPDATE_TRACK_ACTION_ORDER_PENDING } from 'store/actions/trackActions'
import clearCacheFor from 'store/reducers/ormReducer/clearCacheFor'

function appendCompletionRoleToMe ({ Me, Group, Track, meta }) {
  const { completionRoleId, completionRole, groupId, trackId } = meta
  if (!completionRoleId || !groupId) return

  const me = Me.first()
  if (!me) return

  let roleToAdd = completionRole

  if (!roleToAdd) {
    const group = Group.withId(groupId)
    roleToAdd = group?.groupRoles?.items?.find(
      role => String(role.id) === String(completionRoleId)
    )
  }

  if (!roleToAdd && trackId) {
    const track = Track.withId(trackId)
    const trackCompletionRole = track?.completionRole
    if (trackCompletionRole && String(trackCompletionRole.id) === String(completionRoleId)) {
      roleToAdd = {
        ...trackCompletionRole.ref,
        groupId,
        active: true
      }
    }
  }

  if (!roleToAdd) return

  const roleWithGroup = roleToAdd.groupId ? roleToAdd : { ...roleToAdd, groupId }
  const existingItems = me.groupRoles?.items || []
  const alreadyHasRole = existingItems.some(
    role => String(role.id) === String(roleWithGroup.id) && String(role.groupId) === String(groupId)
  )
  if (alreadyHasRole) return

  me.update({
    groupRoles: {
      ...me.groupRoles,
      items: [...existingItems, { ...roleWithGroup, active: true }]
    }
  })
  clearCacheFor(Me, me.id)
}

export function ormSessionReducer (
  { Post, Track, Role, Me, Group },
  { type, meta, payload }
) {
  switch (type) {
    case COMPLETE_POST_PENDING: {
      const post = Post.safeGet({ id: meta.postId })
      if (!post) return
      post.update({ completedAt: new Date().toISOString(), completionResponse: meta.completionResponse })

      if (meta.trackCompleted && meta.trackId) {
        const track = Track.safeGet({ id: meta.trackId })
        if (track) {
          track.update({ didComplete: true })
        }
        appendCompletionRoleToMe({ Me, Group, Track, meta })
      }
      break
    }

    case CREATE_POST: {
      if (!meta.trackId || !payload.data.createPost) return
      const track = Track.safeGet({ id: meta.trackId })
      if (!track) return
      track.update({
        numActions: track.numActions + 1
      })
      track.updateAppending({
        posts: [payload.data.createPost.id]
      })
      return track
    }

    case ENROLL_IN_TRACK_PENDING: {
      const track = Track.safeGet({ id: meta.trackId })
      if (!track) return
      return track.update({ isEnrolled: true })
    }

    case LEAVE_TRACK_PENDING: {
      const track = Track.safeGet({ id: meta.trackId })
      if (!track) return
      return track.update({ isEnrolled: false })
    }

    case UPDATE_TRACK_PENDING: {
      const track = Track.safeGet({ id: meta.trackId })
      if (!track) return
      const data = meta.data
      if (data.completionRole) {
        let role = Role.withId(meta.data.completionRole?.id)
        if (!role) {
          role = Role.create(meta.data.completionRole)
        }
        data.completionRole = role
      }
      return track.update(data)
    }

    case UPDATE_TRACK_ACTION_ORDER_PENDING: {
      const { trackId, postId, newOrderIndex } = meta
      const track = Track.safeGet({ id: trackId })
      if (!track) return

      const posts = track.posts.toModelArray().sort((a, b) => a.sortOrder - b.sortOrder)
      const postToMove = posts.find(p => p.id === postId)
      if (!postToMove) return

      // Remove the post to move and reinsert it at the new position
      const filteredPosts = posts.filter(p => p.id !== postId)
      filteredPosts.splice(newOrderIndex, 0, postToMove)

      // Update the sortOrder for all posts
      filteredPosts.forEach((post, index) => {
        post.update({ sortOrder: index })
      })
    }
  }
}
