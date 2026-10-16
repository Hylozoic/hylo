import { GraphQLError } from 'graphql'
import { trim } from 'lodash'

// A group's request to be added to "the commons" (allow_in_public) lives in
// groups.settings.public_listing_request, so it needs no table of its own:
//   { status, message, requested_at, requested_by_id, reviewed_at, reviewed_by_id, review_message }
export const SETTING_KEY = 'public_listing_request'

export const STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied'
}

const MAX_MESSAGE_LENGTH = 2000

function cleanMessage (message) {
  const cleaned = trim(message || '').slice(0, MAX_MESSAGE_LENGTH)
  return cleaned || null
}

// Replace the whole request object: addSetting deep-merges, which would carry a
// previous review's fields into a new request.
function saveRequest (group, request, attrs = {}) {
  const settings = { ...(group.get('settings') || {}), [SETTING_KEY]: request }
  return group.save({ ...attrs, settings }, { patch: true })
}

/**
 * A group steward asks the Hylo team to add their public group to the commons.
 */
export async function requestPublicListing (userId, groupId, message) {
  const group = await Group.find(groupId)
  if (!group) throw new GraphQLError('Group not found')

  const canAdminister = await GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_ADMINISTRATION)
  if (!canAdminister) throw new GraphQLError("You don't have the right responsibilities for this group")

  if (group.get('visibility') !== Group.Visibility.PUBLIC) {
    throw new GraphQLError('Only public groups can be added to the commons')
  }
  if (group.get('allow_in_public')) {
    throw new GraphQLError('This group is already in the commons')
  }
  if (group.getSetting(`${SETTING_KEY}.status`) === STATUS.PENDING) {
    throw new GraphQLError('This group already has a pending request')
  }

  await saveRequest(group, {
    status: STATUS.PENDING,
    message: cleanMessage(message),
    requested_at: new Date().toISOString(),
    requested_by_id: String(userId)
  })

  await Queue.classMethod('Group', 'notifyAboutPublicListingRequest', { groupId: group.id })
  return group
}

/**
 * A Hylo admin approves or denies a pending request. Approving turns on
 * allow_in_public; either way the requester is emailed the decision.
 */
export async function reviewPublicListingRequest (userId, groupId, approved, message) {
  if (!(await Admin.isSuperAdmin(userId))) {
    throw new GraphQLError('Unauthorized: Admin access required')
  }

  const group = await Group.find(groupId)
  if (!group) throw new GraphQLError('Group not found')

  const request = group.getSetting(SETTING_KEY)
  if (!request || request.status !== STATUS.PENDING) {
    throw new GraphQLError('This group has no pending request')
  }

  await saveRequest(group, {
    ...request,
    status: approved ? STATUS.APPROVED : STATUS.DENIED,
    reviewed_at: new Date().toISOString(),
    reviewed_by_id: String(userId),
    review_message: cleanMessage(message)
  }, approved ? { allow_in_public: true } : {})

  await Queue.classMethod('Group', 'sendPublicListingDecision', { groupId: group.id })
  return group
}

/**
 * Groups with a request in the given status (all requests when status is empty),
 * newest first. Admin only.
 */
export async function publicListingRequests (userId, status) {
  if (!(await Admin.isSuperAdmin(userId))) {
    throw new GraphQLError('Unauthorized: Admin access required')
  }
  if (status && !Object.values(STATUS).includes(status)) {
    throw new GraphQLError('Invalid status')
  }

  const groups = await Group.query(q => {
    q.where('groups.active', true)
    if (status) {
      q.whereRaw('groups.settings->\'public_listing_request\'->>\'status\' = ?', [status])
    } else {
      q.whereRaw('groups.settings->\'public_listing_request\' IS NOT NULL')
    }
    q.orderByRaw('groups.settings->\'public_listing_request\'->>\'requested_at\' DESC')
  }).fetchAll()
  return groups.models
}
