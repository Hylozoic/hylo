import { connect } from 'react-redux'
import { push } from 'redux-first-history'
import { RESP_MANAGE_CONTENT } from 'store/constants'
import { removePostFromUrl, editPostUrl, duplicatePostUrl, postUrl, groupUrl } from '@hylo/navigation'
import getMe from 'store/selectors/getMe'
import deletePost from 'store/actions/deletePost'
import removePost from 'store/actions/removePost'
import {
  unfulfillPost,
  fulfillPost,
  savePost,
  unsavePost,
  getGroup,
  updateProposalOutcome
} from './PostHeader.store'
import getResponsibilitiesForGroup from 'store/selectors/getResponsibilitiesForGroup'
import getRolesForGroup from 'store/selectors/getRolesForGroup'

export function mapStateToProps (state, props) {
  const group = getGroup(state, props)
  const url = postUrl(props.post.id, props.routeParams)
  const context = props.routeParams.context
  const currentUser = getMe(state, props)
  const responsibilities = getResponsibilitiesForGroup(state, { groupId: group?.id }).map(r => r.title)
  const moderationActionsGroupUrl = group && groupUrl(group.slug, 'moderation')

  return {
    context,
    currentUser,
    group,
    moderationActionsGroupUrl,
    postUrl: url,
    responsibilities,
    connectorGetRolesForGroup: (creatorId) => getRolesForGroup(state, { groupId: group?.id, person: creatorId })
  }
}

export function mapDispatchToProps (dispatch, props) {
  const { groupSlug } = props.routeParams
  const closeUrl = removePostFromUrl(`${location.pathname}${location.search}`)

  const deletePostWithConfirm = (postId, groupId, text) => {
    if (window.confirm((text))) {
      dispatch(deletePost(postId, groupId))
      dispatch(push(closeUrl))
      props.onRemovePost?.(postId)
    }
  }

  const removePostWithConfirm = (postId, text) => {
    if (window.confirm((text))) {
      dispatch(removePost(postId, groupSlug))
      dispatch(push(closeUrl))
      props.onRemovePost?.(postId)
    }
  }

  return {
    editPost: postId => props.editPost
      ? props.editPost(postId)
      : dispatch(push(editPostUrl(postId, props.routeParams))),
    duplicatePost: postId => props.duplicatePost
      ? props.duplicatePost(postId)
      : dispatch(push(duplicatePostUrl(postId, props.routeParams))),
    deletePost: (postId, groupId, text) => props.deletePost
      ? props.deletePost(postId)
      : deletePostWithConfirm(postId, groupId, text),
    fulfillPost: postId => props.fulfillPost
      ? props.fulfillPost(postId)
      : dispatch(fulfillPost(postId)),
    unfulfillPost: postId => props.unfulfillPost
      ? props.unfulfillPost(postId)
      : dispatch(unfulfillPost(postId)),
    savePost: postId => props.savePost
      ? props.savePost(postId)
      : dispatch(savePost(postId)),
    unsavePost: postId => props.unsavePost
      ? props.unsavePost(postId)
      : dispatch(unsavePost(postId)),
    removePost: (postId, text) => {
      removePostWithConfirm(postId, text)
    },
    updateProposalOutcome: (postId, proposalOutcome) => dispatch(updateProposalOutcome(postId, proposalOutcome))
  }
}

export function mergeProps (stateProps, dispatchProps, ownProps) {
  const { currentUser, group, responsibilities, connectorGetRolesForGroup } = stateProps
  const { id, creator } = ownProps.post
  const { deletePost, editPost, duplicatePost, fulfillPost, unfulfillPost, savePost, unsavePost, removePost, updateProposalOutcome } = dispatchProps
  const isCreator = currentUser && creator && currentUser.id === creator.id
  const canEdit = isCreator
  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    deletePost: isCreator ? (text) => deletePost(id, group ? group.id : null, text) : undefined,
    editPost: canEdit ? () => editPost(id) : undefined,
    duplicatePost: () => duplicatePost(id),
    fulfillPost: isCreator ? () => fulfillPost(id) : undefined,
    unfulfillPost: isCreator ? () => unfulfillPost(id) : undefined,
    savePost: () => savePost(id),
    unsavePost: () => unsavePost(id),
    canFlag: !isCreator,
    removePost: !isCreator && (responsibilities.includes(RESP_MANAGE_CONTENT)) ? (text) => removePost(id, text) : undefined,
    roles: creator && connectorGetRolesForGroup(creator.id),
    updateProposalOutcome: isCreator ? (proposalOutcome) => updateProposalOutcome(id, proposalOutcome) : undefined,
    canEdit
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)
