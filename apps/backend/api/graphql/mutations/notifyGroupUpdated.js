import {
  publishGroupUpdate
} from '../../../lib/groupSubscriptionPublisher'
import { publishAsync } from '../../../lib/subscriptionUtils'
import { groupRoom, pushToSockets } from '../../services/Websockets'

/** Notify clients that a group's menu changed (context widgets or group views). */
export function notifyGroupUpdated (context, group, groupId) {
  const payload = {
    groupId,
    updatedByUserId: context?.currentUserId || null
  }
  pushToSockets(groupRoom(groupId), 'groupUpdated', payload, context?.socket)
  publishAsync(publishGroupUpdate, context, group, group)
}
