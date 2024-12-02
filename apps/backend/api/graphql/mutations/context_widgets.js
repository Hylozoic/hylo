const { GraphQLYogaError } = require('@graphql-yoga/node')
import convertGraphqlData from './convertGraphqlData'


// What are the mutations?
// - create
// - update
// - reorder
// - remove from menu

export async function createContextWidget({ userId, groupId, data }) {
  if (!userId) throw new GraphQLYogaError('No userId passed into function')
  if (!groupId) throw new GraphQLYogaError('No groupId passed into function')
  const convertedData = convertGraphqlData(data)

  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLYogaError("You don't have permission to create context widgets for this group")
  }

  // Ensure only one view reference is set
  const viewFields = ['view_group_id', 'view_post_id', 'custom_view_id', 'view_user_id', 'view_chat_id', 'view']
  const setViewFields = viewFields.filter(field => convertedData[field] != null)
  if (setViewFields.length > 1) {
    throw new GraphQLYogaError('Only one view reference can be set')
  }

  return ContextWidget.create({
    ...convertedData,
    group_id: groupId
  })
  .catch(err => {
    throw new GraphQLYogaError(`Creation of context widget failed: ${err.message}`)
  })
}

export async function updateContextWidget({ userId, contextWidgetId, data }) {
  if (!userId) throw new GraphQLYogaError('No userId passed into function')
  if (!contextWidgetId) throw new GraphQLYogaError('No context widget id passed into function')
  const convertedData = convertGraphqlData(data)
  const widget = await ContextWidget.where({ id: contextWidgetId }).fetch()
  if (!widget) throw new GraphQLYogaError('Context widget not found')

  const groupId = widget.get('group_id')
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLYogaError("You don't have permission to update context widgets for this group")
  }
  // Ensure only one view reference is set
  const viewFields = Object.values(ContextWidget.ViewFields)
  const newViewFields = viewFields.filter(field => convertedData[field] != null)
  if (newViewFields.length > 1) {
    throw new GraphQLYogaError('Only one view reference can be set')
  }

  return ContextWidget.update({ id: contextWidgetId, data: convertedData })
    .catch(err => {
      throw new GraphQLYogaError(`Update of context widget failed: ${err.message}`)
    })
}

export async function reorderContextWidget({ userId, contextWidgetId, parentId, orderInFrontOfWidgetId, addToEnd }) {
  if (!userId) throw new GraphQLYogaError('No userId passed into function')
  if (!contextWidgetId) throw new GraphQLYogaError('No context widget id passed into function')

  const widget = await ContextWidget.where({ id: contextWidgetId }).fetch()
  if (!widget) throw new GraphQLYogaError('Context widget not found')

  const groupId = widget.get('group_id')
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLYogaError("You don't have permission to reorder context widgets for this group")
  }

  return ContextWidget.reorder({ 
    id: contextWidgetId, 
    parentId,
    orderInFrontOfWidgetId,
    addToEnd
  })
  .catch(err => {
    throw new GraphQLYogaError(`Reordering of context widget failed: ${err.message}`)
  })
}


export async function removeWidgetFromMenu({ userId, contextWidgetId, groupId }) {
  if (!userId) throw new GraphQLYogaError('No userId passed into function')
  if (!contextWidgetId) throw new GraphQLYogaError('No context widget id passed into function')

  const widget = await ContextWidget.where({ id: contextWidgetId }).fetch()
  if (!widget) throw new GraphQLYogaError('Context widget not found')

  const widgetGroupId = groupId || widget.get('group_id')
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, widgetGroupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLYogaError("You don't have permission to modify context widgets for this group")
  }

  return ContextWidget.removeFromMenu({id: contextWidgetId})
    .catch(err => {
      throw new GraphQLYogaError(`Removing widget from menu failed: ${err.message}`)
    })
}

export async function setHomeWidget({ userId, contextWidgetId, groupId }) {
  if (!userId) throw new GraphQLYogaError('No userId passed into function')
  if (!groupId) throw new GraphQLYogaError('No groupId passed into function')

  // Look up the group
  const group = await Group.where({ id: groupId }).fetch()
  if (!group) throw new GraphQLYogaError('Group not found')

  // Check if user has admin permissions
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLYogaError("You don't have permission to modify this group's menu")
  }

  return ContextWidget.setHomeWidget({ id: contextWidgetId, groupId })
    .catch(err => {
      throw new GraphQLYogaError(`Setting home widget failed: ${err.message}`)
    })
}

export async function transitionGroupToNewMenu({ userId, groupId }) {
  if (!userId) throw new GraphQLYogaError('No userId passed into function')
  if (!groupId) throw new GraphQLYogaError('No groupId passed into function')

  // Look up the group
  const group = await Group.where({ id: groupId }).fetch()
  if (!group) throw new GraphQLYogaError('Group not found')

  // Check if user has admin permissions
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLYogaError("You don't have permission to modify this group's menu")
  }

  try {
    const existingWidgets = await ContextWidget.where({ group_id: groupId }).fetch()
    
    if (!existingWidgets) {
      await group.setupContextWidgets()
    }
    
    await group.transitionToNewMenu()
    return group
  } catch (err) {
    throw new GraphQLYogaError(`Failed to transition group to new menu: ${err.message}`)
  }
}