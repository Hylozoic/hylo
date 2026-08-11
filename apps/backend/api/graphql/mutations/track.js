/* global Track, Group, GroupMembership, Responsibility */
import { omit } from 'lodash'
import { GraphQLError } from 'graphql'
import convertGraphqlData from './convertGraphqlData'

export async function createTrack (userId, data) {
  return bookshelf.transaction(async transacting => {
    const attrs = convertGraphqlData(omit(data, 'groupId', 'publishedAt'))
    if (data.publishedAt) {
      attrs.published_at = new Date(Number(data.publishedAt)) // XXX: because convertGraphqlData messes up dates
    }

    const spaceId = data.groupId
    if (spaceId) {
      attrs.group_id = spaceId
    }

    const track = await Track.create(attrs, { transacting })

    if (spaceId) {
      const group = await Group.find(spaceId, { transacting })
      if (group && group.get('type') === 'space' && !group.get('track_id')) {
        await group.save({ track_id: track.id }, { patch: true, transacting })
      }
    }

    return track
  })
}

export async function deleteTrack (userId, id) {
  const track = await Track.find(id)
  if (!track) {
    throw new GraphQLError('Track not found')
  }

  if (!(await canEdit(track, userId))) {
    throw new GraphQLError('You do not have permission to delete this track')
  }

  await bookshelf.transaction(async transacting => {
    await Track.deactivate({ trackId: id, transacting })
    await track.destroy({ transacting })
  })
  return true
}

export async function duplicateTrack (userId, trackId) {
  const track = await Track.find(trackId)
  if (!track) {
    throw new GraphQLError('Track not found')
  }

  if (!(await canEdit(track, userId))) {
    throw new GraphQLError('You do not have permission to duplicate this track')
  }

  const newTrack = await track.duplicate()
  return newTrack
}

export async function enrollInTrack (userId, trackId) {
  const track = await Track.find(trackId)
  if (!track) {
    throw new GraphQLError('Track not found')
  }

  // Check if track is access-controlled and user has access
  if (track.get('access_controlled')) {
    const hasAccess = await track.canAccess(userId)
    if (!hasAccess) {
      throw new GraphQLError('You do not have access to this track. Please purchase access to enroll.')
    }
  }

  await Track.enroll(trackId, userId)
  return track
}

export async function leaveTrack (userId, trackId) {
  await Track.leave(trackId, userId)
  return Track.find(trackId)
}

export async function updateTrack (userId, id, data) {
  const track = await Track.find(id)
  if (!track) {
    throw new GraphQLError('Track not found')
  }

  if (!(await canEdit(track, userId))) {
    throw new GraphQLError('You do not have permission to edit this track')
  }

  const attrs = convertGraphqlData(omit(data, 'groupId', 'publishedAt'))
  attrs.published_at = data.publishedAt ? new Date(Number(data.publishedAt)) : null
  await track.save(attrs)
  return track
}

/** True if user can manage tracks on the space (inherited roles) or parent group. */
async function canEdit (track, userId) {
  const space = await track.group().fetch()
  if (!space) return false
  if (await GroupMembership.hasResponsibility(userId, space.id, Responsibility.constants.RESP_ADMINISTRATION)) {
    return true
  }
  // Allow parent Administration without space membership (stewards managing from parent menu)
  const parentId = space.get('parent_id')
  if (!parentId) return false
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, parentId)
  return responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)
}
