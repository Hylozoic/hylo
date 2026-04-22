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
    await track.groups().attach(data.groupIds, { transacting })
    Queue.classMethod('Group', 'doesMenuUpdate', { groupIds: data.groupIds, track })
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
    await track.groups().detach(null, { transacting })
    await track.posts().detach(null, { transacting })
    await track.users().detach(null, { transacting })
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
  // TODO: check if the user can see the track?
  await Track.enroll(trackId, userId)
  return Track.find(trackId)
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

  const attrs = convertGraphqlData(omit(data, 'groupIds', 'publishedAt'))
  attrs.published_at = data.publishedAt ? new Date(Number(data.publishedAt)) : null
  await track.save(attrs)
  const groups = await track.groups().fetch()
  Queue.classMethod('Group', 'doesMenuUpdate', { groupIds: groups.pluck('id'), track })
  return track
}

export async function updateTrackActionOrder (userId, trackId, postId, newOrderIndex) {
  const track = await Track.find(trackId)
  if (!track) {
    throw new GraphQLError('Track not found')
  }

  const trackPost = await TrackPost.where({ track_id: trackId, post_id: postId }).fetch()
  if (!trackPost) {
    throw new GraphQLError('Track post not found')
  }

  if (!(await canEdit(track, userId))) {
    throw new GraphQLError('You do not have permission to edit this track')
  }

  const oldOrder = trackPost.get('sort_order')

  await bookshelf.transaction(async transacting => {
    if (oldOrder > newOrderIndex) {
      await TrackPost.query()
        .select("max('sort_order') as max_order")
        .where({ track_id: trackId })
        .andWhere('sort_order', '>=', newOrderIndex)
        .andWhere('sort_order', '<', oldOrder)
        .update({ sort_order: bookshelf.knex.raw('?? + 1', ['sort_order']) })
        .transacting(transacting)
    } else if (oldOrder < newOrderIndex) {
      await TrackPost.query()
        .select("max('sort_order') as max_order")
        .where({ track_id: trackId })
        .andWhere('sort_order', '<=', newOrderIndex)
        .andWhere('sort_order', '>', oldOrder)
        .update({ sort_order: bookshelf.knex.raw('?? - 1', ['sort_order']) })
        .transacting(transacting)
    }

    await trackPost.save({ sort_order: newOrderIndex }, { transacting })
  })

  return trackPost
}

// Utility function to check if user can edit the track
async function canEdit (track, userId) {
  const groups = await track.groups().fetch()
  const groupIds = groups.pluck('id')
  let canEdit = false
  for (const groupId of groupIds) {
    const canManageTracks = await GroupMembership.hasResponsibility(userId, groupId, Responsibility.constants.RESP_MANAGE_TRACKS)
    if (canManageTracks) {
      canEdit = true
      break
    }
  }
  return canEdit
}
