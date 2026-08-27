import { COMPLETE_POST_PENDING, CREATE_POST } from 'store/constants'
import { CREATE_TRACK, ENROLL_IN_TRACK_PENDING, LEAVE_TRACK_PENDING, UPDATE_TRACK_PENDING } from 'store/actions/trackActions'
import clearCacheFor from 'store/reducers/ormReducer/clearCacheFor'
import { updateTrackActionCompletionInMenus } from 'routes/TrackActionsView/TrackActionsView.store'

function appendCompletionRoleToMe ({ Me, Group, Track, meta }) {
  const { completionRoleId, completionRole, groupId, parentGroupId, trackId } = meta
  const roleGroupId = parentGroupId || groupId
  if (!completionRoleId || !roleGroupId) return

  const me = Me.first()
  if (!me) return

  let roleToAdd = completionRole

  if (!roleToAdd) {
    const group = Group.withId(roleGroupId)
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
        groupId: roleGroupId,
        active: true
      }
    }
  }

  if (!roleToAdd) return

  const roleWithGroup = roleToAdd.groupId ? roleToAdd : { ...roleToAdd, groupId: roleGroupId }
  const existingItems = me.groupRoles?.items || []
  const alreadyHasRole = existingItems.some(
    role => String(role.id) === String(roleWithGroup.id) && String(role.groupId) === String(roleGroupId)
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
      const completedAt = new Date().toISOString()
      const post = Post.safeGet({ id: meta.postId })
      if (post) {
        post.update({ completedAt, completionResponse: meta.completionResponse })
      }

      updateTrackActionCompletionInMenus({
        Group,
        postId: meta.postId,
        completedAt,
        completionResponse: meta.completionResponse,
        groupIds: meta.groupId
      })

      if (meta.trackCompleted && meta.trackId) {
        const track = Track.safeGet({ id: meta.trackId })
        if (track) {
          track.update({ didComplete: true })
        }
        appendCompletionRoleToMe({ Me, Group, Track, meta })
      }
      break
    }

    case CREATE_TRACK: {
      const createdTrack = payload?.data?.createTrack
      const groupId = meta.groupId
      if (!createdTrack?.id || !groupId) break
      const group = Group.withId(groupId)
      if (!group) break
      group.update({
        track: {
          id: createdTrack.id,
          name: createdTrack.name,
          actionDescriptor: createdTrack.actionDescriptor,
          actionDescriptorPlural: createdTrack.actionDescriptorPlural,
          bannerUrl: createdTrack.bannerUrl,
          completionMessage: createdTrack.completionMessage,
          completionRole: createdTrack.completionRole,
          description: createdTrack.description,
          welcomeMessage: createdTrack.welcomeMessage
        }
      })
      break
    }

    case CREATE_POST: {
      if (!meta.trackId || !payload.data.createPost) return
      const track = Track.safeGet({ id: meta.trackId })
      if (!track) return
      track.update({
        numActions: track.numActions + 1
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
      if (Object.prototype.hasOwnProperty.call(data, 'completionRole')) {
        if (data.completionRole) {
          let role = Role.withId(data.completionRole?.id)
          if (!role) {
            role = Role.create(data.completionRole)
          }
          data.completionRole = role
        } else {
          data.completionRole = null
        }
      }
      return track.update(data)
    }
  }
}
