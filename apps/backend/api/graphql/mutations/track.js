/* global Track, Group, GroupMembership, GroupRole, Responsibility */
import { omit } from 'lodash'
import { GraphQLError } from 'graphql'
import convertGraphqlData from './convertGraphqlData'
import { EVENT_TYPES } from '../../../lib/analytics/trackActivity'
import { track as recordActivity } from '../../../lib/analytics/track'

export async function createTrack (userId, data) {
  return bookshelf.transaction(async transacting => {
    const attrs = convertGraphqlData(omit(data, 'groupId', 'publishedAt', 'name', 'description', 'bannerUrl', 'welcomeMessage'))
    await GroupRole.assertAssignableRoleIds(attrs.completion_role_id, { transacting })

    const spaceId = data.groupId
    if (spaceId) {
      attrs.group_id = spaceId
    }

    const track = await Track.create(attrs, { transacting })
    recordActivity({
      type: EVENT_TYPES.TRACK_CREATED,
      userId,
      groupIds: spaceId ? [spaceId] : [],
      object: { type: 'track', id: track.id }
    })

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
  recordActivity({
    type: EVENT_TYPES.TRACK_ENROLLED,
    userId,
    groupIds: track.get('group_id') ? [track.get('group_id')] : [],
    object: { type: 'track', id: track.id }
  })
  return track
}

export async function leaveTrack (userId, trackId) {
  const track = await Track.find(trackId)
  await Track.leave(trackId, userId)
  if (track) {
    recordActivity({
      type: EVENT_TYPES.TRACK_LEFT,
      userId,
      groupIds: track.get('group_id') ? [track.get('group_id')] : [],
      object: { type: 'track', id: track.id }
    })
  }
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

  const attrs = convertGraphqlData(omit(data, 'groupId', 'publishedAt', 'name', 'description', 'bannerUrl', 'welcomeMessage'))
  await GroupRole.assertAssignableRoleIds(attrs.completion_role_id)
  const wasPublished = track.get('published_at')
  await track.save(attrs)
  if (!wasPublished && track.get('published_at')) {
    recordActivity({
      type: EVENT_TYPES.TRACK_PUBLISHED,
      userId,
      groupIds: track.get('group_id') ? [track.get('group_id')] : [],
      object: { type: 'track', id: track.id }
    })
  }
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
