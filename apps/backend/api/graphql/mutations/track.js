/* global Track */
import { omit } from 'lodash'
import { GraphQLError } from 'graphql'
import convertGraphqlData from './convertGraphqlData'

export async function createTrack (userId, data) {
  return bookshelf.transaction(async transacting => {
    const attrs = convertGraphqlData(omit(data, 'groupIds', 'publishedAt'))
    attrs.published_at = new Date(Number(data.publishedAt)) // XXX: because convertGraphqlData messes up dates
    const track = await Track.create(attrs, { transacting })
    await track.groups().attach(data.groupIds.map(id => ({ group_id: id, created_at: new Date() })), { transacting })
    Queue.classMethod('Group', 'doesMenuUpdate', { groupIds: data.groupIds, track })
    return track
  })
}

export async function deleteTrack (userId, id) {
  // TODO: check if user is a steward of the group
  const track = await Track.find(id)
  if (!track) {
    throw new GraphQLError('Track not found')
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
