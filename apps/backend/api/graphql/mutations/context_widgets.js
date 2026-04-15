import { GraphQLError } from 'graphql'
import convertGraphqlData from './convertGraphqlData'
import {
  publishGroupUpdate
} from '../../../lib/groupSubscriptionPublisher'
import { publishAsync } from '../../../lib/subscriptionUtils'
import { groupRoom, pushToSockets } from '../../services/Websockets'

// Notify all clients (web/mobile WebView via Socket.io + GraphQL subscription clients) that a group's context widgets changed
function notifyGroupUpdated (context, group, groupId) {
  pushToSockets(groupRoom(groupId), 'groupUpdated', { groupId })
  publishAsync(publishGroupUpdate, context, group, group)
}

export async function createContextWidget ({ userId, groupId, data, context }) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!groupId) throw new GraphQLError('No groupId passed into function')
  const convertedData = convertGraphqlData(data)

  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLError("You don't have permission to create context widgets for this group")
  }

  // Ensure only one view reference is set
  const viewFields = ['view_group_id', 'view_post_id', 'custom_view_id', 'view_user_id', 'view_chat_id', 'view_track_id', 'view', 'view_funding_round_id']
  const setViewFields = viewFields.filter(field => convertedData[field] != null)
  if (setViewFields.length > 1) {
    throw new GraphQLError('Only one view reference can be set')
  }

  const widget = await ContextWidget.create({
    ...convertedData,
    group_id: groupId
  })
    .catch(err => {
      throw new GraphQLError(`Creation of context widget failed: ${err.message}`)
    })

  const group = await Group.find(groupId)
  notifyGroupUpdated(context, group, groupId)

  return widget
}

export async function deleteContextWidget (userId, contextWidgetId, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!contextWidgetId) throw new GraphQLError('No context widget id passed into function')
  const widget = await ContextWidget.where({ id: contextWidgetId }).fetch()
  if (!widget) throw new GraphQLError('Context widget not found')

  const groupId = widget.get('group_id')
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLError("You don't have permission to delete context widgets for this group")
  }

  if (widget.isSystemWidget()) {
    throw new GraphQLError('Cannot delete a system widget')
  }

  const group = await Group.find(groupId)

  return widget.destroy()
    .then(() => {
      notifyGroupUpdated(context, group, groupId)
      return { success: true }
    })
    .catch(err => {
      throw new GraphQLError(`Deletion of context widget failed: ${err.message}`)
    })
}

export async function updateContextWidget ({ userId, contextWidgetId, data, context }) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!contextWidgetId) throw new GraphQLError('No context widget id passed into function')
  const convertedData = convertGraphqlData(data)
  const widget = await ContextWidget.where({ id: contextWidgetId }).fetch()
  if (!widget) throw new GraphQLError('Context widget not found')

  const groupId = widget.get('group_id')
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLError("You don't have permission to update context widgets for this group")
  }
  // Ensure only one view reference is set
  const viewFields = Object.values(ContextWidget.ViewFields)
  const newViewFields = viewFields.filter(field => convertedData[field] != null)
  if (newViewFields.length > 1) {
    throw new GraphQLError('Only one view reference can be set')
  }

  const updatedWidget = await ContextWidget.update({ id: contextWidgetId, data: convertedData })
    .catch(err => {
      throw new GraphQLError(`Update of context widget failed: ${err.message}`)
    })

  const group = await Group.find(groupId)
  notifyGroupUpdated(context, group, groupId)

  return updatedWidget
}

export async function reorderContextWidget ({ userId, contextWidgetId, parentId, orderInFrontOfWidgetId, addToEnd, context }) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!contextWidgetId) throw new GraphQLError('No context widget id passed into function')

  const widget = await ContextWidget.where({ id: contextWidgetId }).fetch()
  if (!widget) throw new GraphQLError('Context widget not found')

  const groupId = widget.get('group_id')
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLError("You don't have permission to reorder context widgets for this group")
  }

  const result = await ContextWidget.reorder({
    id: contextWidgetId,
    parentId,
    orderInFrontOfWidgetId,
    addToEnd
  })
    .catch(err => {
      throw new GraphQLError(`Reordering of context widget failed: ${err.message}`)
    })

  const group = await Group.find(groupId)
  notifyGroupUpdated(context, group, groupId)

  return result
}

export async function removeWidgetFromMenu ({ userId, contextWidgetId, groupId, context }) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!contextWidgetId) throw new GraphQLError('No context widget id passed into function')

  const widget = await ContextWidget.where({ id: contextWidgetId }).fetch()
  if (!widget) throw new GraphQLError('Context widget not found')

  const widgetGroupId = groupId || widget.get('group_id')
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, widgetGroupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLError("You don't have permission to modify context widgets for this group")
  }

  const result = await ContextWidget.removeFromMenu({ id: contextWidgetId })
    .catch(err => {
      throw new GraphQLError(`Removing widget from menu failed: ${err.message}`)
    })

  const group = await Group.find(widgetGroupId)
  notifyGroupUpdated(context, group, widgetGroupId)

  return result
}

export async function setHomeWidget ({ userId, contextWidgetId, groupId, context }) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!groupId) throw new GraphQLError('No groupId passed into function')

  // Look up the group
  const group = await Group.where({ id: groupId }).fetch()
  if (!group) throw new GraphQLError('Group not found')

  // Check if user has admin permissions
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLError("You don't have permission to modify this group's menu")
  }

  const result = await ContextWidget.setHomeWidget({ id: contextWidgetId, groupId })
    .catch(err => {
      throw new GraphQLError(`Setting home widget failed: ${err.message}`)
    })

  notifyGroupUpdated(context, group, groupId)

  return result
}
