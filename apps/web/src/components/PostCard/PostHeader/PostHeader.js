import { createSelector } from 'reselect'
import { filter, isFunction } from 'lodash'
import { Check, Play, CircleDashed, BookmarkCheck, Bookmark, Pencil, Link2, Flag, Copy, Trash2, Library, LibraryBig } from 'lucide-react'
import { DateTime } from 'luxon'
import React, { useCallback, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { push } from 'redux-first-history'
import { Link } from 'react-router-dom'
import { TextHelpers } from '@hylo/shared'
import { formatUserDatePair } from 'util/dateFormat'
import Avatar from 'components/Avatar'
import Dropdown from 'components/Dropdown'
import Highlight from 'components/Highlight'
import FlagContent from 'components/FlagContent'
import FlagGroupContent from 'components/FlagGroupContent'
import Icon from 'components/Icon'
import Tooltip from 'components/Tooltip'
import PostCompletion from '../PostCompletion'
import { getPostTypeIcon, PROPOSAL_STATUS_CASUAL, PROPOSAL_STATUS_COMPLETED } from 'store/models/Post'
import { RESP_ADMINISTRATION, RESP_MANAGE_CONTENT } from 'store/constants'
import { removePostFromUrl, editPostUrl, duplicatePostUrl, postUrl, groupUrl, personUrl, topicUrl, spaceUrl } from '@hylo/navigation'
import getMe from 'store/selectors/getMe'
import deletePostAction from 'store/actions/deletePost'
import removePostAction from 'store/actions/removePost'
import { addPostToView, fetchViewPosts, removePostFromView } from 'store/actions/groupViews'
import { getResponsibilityTitlesForGroup } from 'store/selectors/getResponsibilitiesForGroup'
import { getGroupViewById } from 'store/selectors/getGroupViews'
import getRolesForGroup from 'store/selectors/getRolesForGroup'
import useGroupViews from 'hooks/useGroupViews'
import { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import { useEffectiveGroupSlug, useGroupRouteOpts } from 'contexts/SpaceGroupContext'
import { cn } from 'util/index'
import {
  unfulfillPost as unfulfillPostAction,
  fulfillPost as fulfillPostAction,
  savePost as savePostAction,
  unsavePost as unsavePostAction,
  getGroup,
  updateProposalOutcome as updateProposalOutcomeAction
} from './PostHeader.store'

const selectGroup = (state, props) => getGroup(state, props)
const selectPostId = (_, props) => props.post?.id
const selectRouteParams = (_, props) => props.routeParams

const selectPostHeaderStateProps = createSelector(
  [
    selectGroup,
    getMe,
    (state, props) => getResponsibilityTitlesForGroup(state, { groupId: getGroup(state, props)?.id }),
    (state, props) => {
      const group = getGroup(state, props)
      const creatorId = props.post?.creator?.id
      if (!group?.id || !creatorId) return undefined
      return getRolesForGroup(state, { groupId: group.id, person: creatorId })
    },
    (_, props) => props.routeParams?.context,
    selectPostId,
    selectRouteParams
  ],
  (group, currentUser, responsibilities, roles, context, postId, routeParams) => ({
    context,
    currentUser,
    group,
    moderationActionsGroupUrl: group && groupUrl(group.slug, 'moderation'),
    postUrl: postUrl(postId, routeParams),
    responsibilities,
    roles
  })
)

function PostHeader (props) {
  const {
    chat,
    childGroupLabel,
    routeParams = {},
    post,
    expanded,
    isCurrentAction,
    actionDescriptor,
    isFlagged,
    close,
    className,
    constrained,
    highlightProps,
    onRemovePost,
    editPost: editPostProp,
    duplicatePost: duplicatePostProp,
    deletePost: deletePostProp,
    fulfillPost: fulfillPostProp,
    unfulfillPost: unfulfillPostProp,
    savePost: savePostProp,
    unsavePost: unsavePostProp
  } = props

  const {
    announcement,
    creator,
    createdTimestamp,
    exactCreatedTimestamp,
    proposalOutcome,
    proposalStatus,
    type,
    id,
    endTime,
    startTime,
    timezone,
    fulfilledAt,
    savedAt,
    groups: postGroups = []
  } = post

  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [flaggingVisible, setFlaggingVisible] = useState(false)
  const effectiveGroupSlug = useEffectiveGroupSlug()
  const groupSlug = effectiveGroupSlug || routeParams.groupSlug
  const { parentGroupSlug, spaceSlug } = useGroupRouteOpts()

  const {
    currentUser,
    group,
    moderationActionsGroupUrl: groupModerationUrl = '',
    postUrl,
    responsibilities
  } = useSelector(state => selectPostHeaderStateProps(state, { ...props, groupSlug, routeParams }))

  const moderationActionsGroupUrl = spaceSlug && parentGroupSlug
    ? spaceUrl(parentGroupSlug, spaceSlug, '/moderation')
    : groupModerationUrl
  const isCreator = currentUser && creator && currentUser.id === creator.id
  const canEdit = isCreator
  const canFlag = !isCreator
  const canModerate = !isCreator && responsibilities.includes(RESP_MANAGE_CONTENT)
  const canCurateCollections = responsibilities.includes(RESP_ADMINISTRATION) ||
    responsibilities.includes(RESP_MANAGE_CONTENT)

  const hasModeratorResponsibilitiesInAnyPostGroup = useSelector(state =>
    postGroups.some(g => {
      const groupResponsibilities = getResponsibilityTitlesForGroup(state, { groupId: g.id })
      return groupResponsibilities.includes(RESP_ADMINISTRATION) ||
        groupResponsibilities.includes(RESP_MANAGE_CONTENT)
    })
  )
  const canCompleteAsModerator = !isCreator && hasModeratorResponsibilitiesInAnyPostGroup
  const canCompletePost = isCreator || canCompleteAsModerator

  const groupViews = useGroupViews(group)
  const collectionViews = useMemo(
    () => (groupViews || []).filter(view => view.type === 'collection'),
    [groupViews]
  )
  const currentCollectionView = useSelector(state => {
    const viewId = routeParams?.customViewId
    if (!viewId || !group) return null
    const view = getGroupViewById(state, group, viewId)
    return view?.type === 'collection' ? view : null
  })
  const isChatPost = type === 'chat'

  const closeUrl = useMemo(
    () => removePostFromUrl(`${window.location.pathname}${window.location.search}`),
    []
  )

  const editPost = useCallback(() => {
    if (!canEdit) return
    if (editPostProp) {
      editPostProp(id)
    } else {
      dispatch(push(editPostUrl(id, routeParams)))
    }
  }, [canEdit, editPostProp, id, routeParams, dispatch])

  const duplicatePost = useCallback(() => {
    if (duplicatePostProp) {
      duplicatePostProp(id)
    } else {
      dispatch(push(duplicatePostUrl(id, routeParams)))
    }
  }, [duplicatePostProp, id, routeParams, dispatch])

  const deletePost = useCallback((text) => {
    if (!isCreator || !window.confirm(text)) return
    if (deletePostProp) {
      deletePostProp(id)
    } else {
      dispatch(deletePostAction(id, group ? group.id : null))
      dispatch(push(closeUrl))
      onRemovePost?.(id)
    }
  }, [isCreator, deletePostProp, id, group, dispatch, closeUrl, onRemovePost])

  const removePost = useCallback((text) => {
    if (!canModerate || !window.confirm(text)) return
    dispatch(removePostAction(id, groupSlug))
    dispatch(push(closeUrl))
    onRemovePost?.(id)
  }, [canModerate, id, groupSlug, dispatch, closeUrl, onRemovePost])

  const fulfillPost = useCallback(() => {
    if (!canCompletePost) return
    if (fulfillPostProp) {
      fulfillPostProp(id)
    } else {
      dispatch(fulfillPostAction(id))
    }
  }, [canCompletePost, fulfillPostProp, id, dispatch])

  const unfulfillPost = useCallback(() => {
    if (!canCompletePost) return
    if (unfulfillPostProp) {
      unfulfillPostProp(id)
    } else {
      dispatch(unfulfillPostAction(id))
    }
  }, [canCompletePost, unfulfillPostProp, id, dispatch])

  const savePost = useCallback(() => {
    if (savePostProp) {
      savePostProp(id)
    } else {
      dispatch(savePostAction(id))
    }
  }, [savePostProp, id, dispatch])

  const unsavePost = useCallback(() => {
    if (unsavePostProp) {
      unsavePostProp(id)
    } else {
      dispatch(unsavePostAction(id))
    }
  }, [unsavePostProp, id, dispatch])

  const updateProposalOutcome = useCallback((proposalOutcome) => {
    if (!isCreator) return
    dispatch(updateProposalOutcomeAction(id, proposalOutcome))
  }, [isCreator, id, dispatch])

  const flagPostFunc = () =>
    canFlag ? () => { setFlaggingVisible(true) } : undefined

  const handleOpenCollectionsSubmenu = useCallback(() => {
    if (!group?.id) return
    dispatch(fetchViewPosts(group.id, collectionViews[0]?.id))
  }, [collectionViews, dispatch, group?.id])

  const handleAddToCollection = useCallback((collectionView) => {
    if (!group?.id || !collectionView?.id || !id) return
    const alreadyIn = (collectionView.collectionPosts || []).some(p => String(p.id) === String(id))
    if (alreadyIn) return
    dispatch(addPostToView({
      groupId: group.id,
      viewId: collectionView.id,
      postId: id,
      post
    }))
  }, [dispatch, group?.id, id, post])

  const handleRemoveFromCollection = useCallback(() => {
    if (!group?.id || !currentCollectionView?.id || !id) return
    if (!window.confirm(t('Remove this post from the collection?'))) return
    dispatch(removePostFromView({
      groupId: group.id,
      viewId: currentCollectionView.id,
      postId: id
    }))
  }, [currentCollectionView?.id, dispatch, group?.id, id, t])

  if (type === 'action') {
    return <ActionHeader post={post} isCurrentAction={isCurrentAction} actionDescriptor={actionDescriptor} />
  }

  if (!creator) return null

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.protocol}//${window.location.host}${postUrl}`)
  }

  const creatorUrl = personUrl(creator.id, routeParams.groupSlug)
  const flagPostData = {
    slug: groupSlug,
    id,
    type: 'post'
  }

  const addToCollectionItem = canCurateCollections && !isChatPost && collectionViews.length > 0
    ? {
        icon: <Library className='w-4 h-4 text-foreground' />,
        label: t('Add to Collection'),
        onOpen: handleOpenCollectionsSubmenu,
        items: collectionViews.map(collectionView => {
          const alreadyIn = (collectionView.collectionPosts || []).some(p => String(p.id) === String(id))
          return {
            key: collectionView.id,
            label: alreadyIn
              ? t('{{name}} (already added)', { name: displayNameForView(collectionView, t) })
              : displayNameForView(collectionView, t),
            disabled: alreadyIn,
            onClick: () => handleAddToCollection(collectionView)
          }
        })
      }
    : null

  const removeFromCollectionItem = canCurateCollections && currentCollectionView
    ? {
        icon: <LibraryBig className='w-4 h-4 text-foreground' />,
        label: t('Remove from Collection'),
        onClick: handleRemoveFromCollection
      }
    : null

  const dropdownItems = filter([
    { icon: <Pencil className='w-4 h-4 text-foreground' />, label: t('Edit'), onClick: canEdit ? editPost : undefined },
    { icon: <Link2 className='w-4 h-4 text-foreground' />, label: t('Copy Link'), onClick: copyLink },
    { icon: savedAt ? <BookmarkCheck className='w-4 h-4 text-foreground' /> : <Bookmark className='w-4 h-4 text-foreground' />, label: savedAt ? t('Unsave Post') : t('Save Post'), onClick: savedAt ? unsavePost : savePost },
    { icon: <Flag className='w-4 h-4 text-foreground' />, label: t('Flag'), onClick: flagPostFunc() },
    { icon: <Copy className='w-4 h-4 text-foreground' />, label: t('Duplicate'), onClick: duplicatePost },
    addToCollectionItem,
    removeFromCollectionItem,
    { icon: <Trash2 className='w-4 h-4 text-destructive' />, label: t('Delete'), onClick: isCreator ? () => deletePost(t('Are you sure you want to delete this post? You cannot undo this.')) : undefined, red: true },
    { icon: <Trash2 className='w-4 h-4 text-destructive' />, label: t('Remove From Group'), onClick: canModerate ? () => removePost(t('Are you sure you want to remove this post? You cannot undo this.')) : undefined, red: true }
  ], item => item && (isFunction(item.onClick) || item.items?.length))

  const typesWithTimes = ['action', 'offer', 'request', 'resource', 'project', 'proposal']
  const canHaveTimes = typesWithTimes.includes(type)

  const typesWithCompletion = ['offer', 'request', 'resource', 'project', 'proposal']
  const canBeCompleted = typesWithCompletion.includes(type) && (type !== 'proposal' || (proposalStatus === PROPOSAL_STATUS_COMPLETED || proposalStatus === PROPOSAL_STATUS_CASUAL))
  const actualEndTime = fulfilledAt && fulfilledAt < endTime ? fulfilledAt : endTime

  const { from, to } = formatUserDatePair({
    start: startTime,
    end: actualEndTime,
    timezone,
    returnAsObj: true
  })

  const startString = fulfilledAt
    ? false
    : TextHelpers.isDateInTheFuture(startTime)
      ? t('Starts: {{from}}', { from })
      : TextHelpers.isDateInTheFuture(endTime)
        ? t('Started: {{from}}', { from })
        : false

  let endString = false
  if (fulfilledAt && fulfilledAt <= endTime) {
    endString = t('Completed: {{endTime}}', { endTime: to })
  } else {
    endString = TextHelpers.isDateInTheFuture(endTime) ? t('Ends: {{endTime}}', { endTime: to }) : actualEndTime ? t('Ended: {{endTime}}', { endTime: to }) : false
  }

  let timeWindow = ''

  if (startString && endString) {
    timeWindow = `${startString} / ${endString}`
  } else if (endString) {
    timeWindow = endString
  } else if (startString) {
    timeWindow = startString
  }

  if (chat) {
    return null
  }

  return (
    <div className={cn('PostHeader relative !bg-transparent', { 'mb-0 px-2': constrained }, className)}>
      <div className='w-full rounded-t-lg'>
        <div className='flex justify-start items-center p-2'>
          <Avatar avatarUrl={creator.avatarUrl} url={creatorUrl} className={cn('mr-3', { 'mr-2': constrained })} medium />
          <div className='flex flex-wrap justify-between flex-1 text-foreground truncate xs:truncate-none overflow-hidden xs:overflow-visible mr-2 xs:max-w-auto'>
            <Highlight {...highlightProps}>
              <div className='flex flex-col min-w-0'>
                <Link to={creatorUrl} className={cn('flex whitespace-nowrap items-center text-card-foreground font-bold font-md text-base leading-tight', { 'text-sm': constrained })} data-tooltip-content={creator.tagline} data-tooltip-id={`announcement-tt-${id}`}>
                  {creator.name}
                </Link>
                {/* Where a child post lives, under the author — replaces the tab that floated above the card */}
                {childGroupLabel && (
                  <span className='text-xs text-foreground/50 truncate leading-tight'>{childGroupLabel}</span>
                )}
              </div>
            </Highlight>
            <div className='flex items-center ml-2'>
              <span className='text-foreground/50 text-2xs whitespace-nowrap mr-3' data-tooltip-id={`dateTip-${id}`} data-tooltip-content={exactCreatedTimestamp}>
                {createdTimestamp}
              </span>
              {type !== 'submission' && (
                // h-7 (and rounded-md) so the pill and the three-dot toggle read as one control family.
                // The old py1 was a dead class — the pill never actually had vertical padding.
                <div className='flex items-center gap-1 border-2 border-foreground/20 rounded-md text-xs capitalize px-1.5 h-7 text-foreground/70'>
                  <Icon name={getPostTypeIcon(type)} className='text-sm' dataTestId={'post-type-' + type.charAt(0).toUpperCase() + type.slice(1)} />
                  {t(type)}
                </div>)}
              {announcement && (
                <span className='mt-[-2px]'>
                  <span className='text-2xs mx-3 relative top-[-6px]'>•</span>
                  <span data-tooltip-content='Announcement' data-tooltip-id={`announcement-tt-${id}`}>
                    <Icon name='Announcement' className='top-[1px] mr-[-3px] ml-[-4px] text-lg text-accent' dataTestId='post-header-announcement-icon' />
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className={cn('flex items-center justify-end ml-auto', { hidden: constrained })}>
            {isFlagged && <Link to={moderationActionsGroupUrl} className='text-decoration-none' data-tooltip-content={t('See why this post was flagged')} data-tooltip-id='post-header-flag-tt'><Icon name='Flag' className='top-1 mr-3 text-xl text-accent font-bold' /></Link>}
            <Tooltip
              delay={250}
              id='post-header-flag-tt'
            />
            {/* !top-0 on the More icon: the global .icon-More style nudges the glyph down
                1px for optical centering in inline contexts — here the icon IS the bordered
                box, so the nudge shifted the whole button 1px below the pill beside it */}
            {dropdownItems.length > 0 &&
              <Dropdown id='post-header-more-dropdown' toggleChildren={<Icon name='More' dataTestId='post-header-more-icon' className='cursor-pointer border-2 border-foreground/30 rounded-md h-7 w-7 flex items-center justify-center !top-0' />} items={dropdownItems} alignRight noOverflow />}
            {close &&
              <a className={cn('inline-block cursor-pointer relative px-3 text-xl')} data-testid='post-detail-close' onClick={close}>
                <Icon name='Ex' className='align-middle' />
              </a>}
          </div>
        </div>
      </div>

      <div className={cn('flex flex-col xs:flex-row justify-between')}>
        {canHaveTimes && timeWindow.length > 0 && (
          <div className={cn('ml-2 mb-1 bg-selected/10 p-1 rounded-lg text-selected text-xs font-bold flex items-center justify-center inline-block px-2', { hidden: constrained })}>
            {timeWindow}
          </div>
        )}
      </div>
      {canBeCompleted && canCompletePost && expanded && (
        <PostCompletion
          type={type}
          startTime={startTime}
          endTime={endTime}
          isFulfilled={!!fulfilledAt}
          isModerator={canCompleteAsModerator}
          fulfillPost={fulfillPost}
          unfulfillPost={unfulfillPost}
        />
      )}
      {
        canEdit && expanded && fulfilledAt && type === 'proposal' && (
          <div className='bg-muted text-muted-foreground text-sm flex flex-col gap-2 justify-between m-2 p-2 border border-dashed rounded'>
            <input
              type='text'
              className='pl-3 h-9 w-full outline-none border-none rounded disabled:text-gray-400 placeholder:text-gray-300'
              placeholder='Summarize the outcome'
              value={proposalOutcome || ''}
              onChange={e => updateProposalOutcome(e.target.value)}
            />
          </div>
        )
      }

      {flaggingVisible && !group &&
        ReactDOM.createPortal(
          <FlagContent
            type='post'
            linkData={flagPostData}
            onClose={() => setFlaggingVisible(false)}
          />,
          document.body
        )}

      {flaggingVisible && group &&
        ReactDOM.createPortal(
          <FlagGroupContent
            type='post'
            linkData={flagPostData}
            onClose={() => setFlaggingVisible(false)}
          />,
          document.body
        )}

      <Tooltip
        className='bg-background'
        delayShow={0}
        id={`announcement-tt-${id}`}
        position='top'
      />
      <Tooltip
        delay={550}
        id={`dateTip-${id}`}
        position='left'
      />
    </div>
  )
}

export function TopicsLine ({ topics, slug, newLine }) {
  return (
    <div className={cn('text-xs flex overflow-hidden truncate whitespace-nowrap w-full pb-0 xs:pb-2;', { 'overflow-visible text-clip ml-2.5 mt-2.5 w-[450px]': newLine })}>
      {topics.slice(0, 3).map(t =>
        <Link
          className='py:2 px-3 xs:px-2 flex items-center border rounded-md mt-2 ml-2 bg-white text-xs mr-3'
          to={topicUrl(t.name, { groupSlug: slug })}
          key={t.name}
        >
          #{t.name}
        </Link>)}
    </div>
  )
}

function ActionHeader ({ post, isCurrentAction, actionDescriptor }) {
  const { t } = useTranslation()
  const actionTerm = actionDescriptor || 'Action'

  return (
    <div className='flex p-2 mb-2 items-center'>
      <div className='flex-1'>
        {post.completedAt
          ? <span className='border-2 border-secondary rounded-md px-2 py-1 inline-flex flex-row items-center gap-2 flex-1 text-sm'><Check className='w-4 h-4 inline' /> {t('Completed')}</span>
          : isCurrentAction
            ? <span className='border-2 border-accent rounded-md px-2 py-1 inline-flex flex-row items-center gap-2 flex-1 text-sm'><Play className='w-4 h-4 inline' /> {t('Next {{actionDescriptor}}', { actionDescriptor: actionTerm })}</span>
            : <span className='border-2 border-foreground/20 text-foreground/70 rounded-md px-2 py-1 inline-flex flex-row items-center gap-2 flex-1 text-sm'><CircleDashed className='w-4 h-4 inline' /> {t('Not Completed')}</span>}
      </div>

      {post.completedAt && <span className='text-xs text-selected/70'>{t('Completed {{date}}', { date: DateTime.fromISO(post.completedAt).toFormat('DD') })}</span>}
    </div>
  )
}

export default PostHeader
