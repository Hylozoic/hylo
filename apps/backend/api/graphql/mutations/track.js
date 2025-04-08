/* global Track */
import { omit } from 'lodash'
import { GraphQLError } from 'graphql'
import convertGraphqlData from './convertGraphqlData'

export async function createTrack (userId, data) {
  return bookshelf.transaction(async transacting => {
    const attrs = convertGraphqlData(omit(data, 'groupIds', 'publishedAt'))
    if (data.publishedAt) {
      attrs.published_at = new Date(Number(data.publishedAt)) // XXX: because convertGraphqlData messes up dates
    }
    const track = await Track.create(attrs, { transacting })
    await track.groups().attach(data.groupIds.map(id => ({ group_id: id, created_at: new Date() })), { transacting })
    Queue.classMethod('Group', 'doesMenuUpdate', { groupIds: data.groupIds, track })
    return track
  })
}

export async function deleteTrack (userId, id) {
  const track = await Track.find(id)
  if (!track) {
    throw new GraphQLError('Track not found')
  }

  if (!canEdit(track, userId)) {
    throw new GraphQLError('You do not have permission to delete this track')
  }

  await track.destroy()
  return true
}

export async function enrollInTrack (userId, trackId) {
  // TODO: check if the user can see the track?
  return Track.enroll(trackId, userId)
}

export async function leaveTrack (userId, trackId) {
  return Track.leave(trackId, userId)
}

export async function updateTrack (userId, id, data) {
  const track = await Track.find(id)
  if (!track) {
    throw new GraphQLError('Track not found')
  }

  if (!canEdit(track, userId)) {
    throw new GraphQLError('You do not have permission to edit this track')
  }

  const attrs = convertGraphqlData(omit(data, 'groupIds', 'publishedAt'))
  attrs.published_at = data.publishedAt ? new Date(Number(data.publishedAt)) : null
  await track.save(attrs)
  Queue.classMethod('Group', 'doesMenuUpdate', { groupIds: data.groupIds, track })
  return track
}

// Utility function to check if user can edit the track
async function canEdit (track, userId) {
  const groupIds = await track.groups().pluck('id')
  let canEdit = false
  for (const groupId of groupIds) {
    const canManage = await GroupMembership.hasResponsibility(userId, groupId, Responsibility.constants.RESP_MANAGE_TRACKS)
    if (canManage) {
      canEdit = true
      break
    }
  }
  return canEdit
}
