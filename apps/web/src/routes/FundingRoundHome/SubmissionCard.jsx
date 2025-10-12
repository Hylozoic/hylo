import { filter, isFunction } from 'lodash'
import { EllipsisVertical, Flag, Pencil, Link as LinkIcon, Trash } from 'lucide-react'
import React, { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ReactDOM from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import useRouteParams from 'hooks/useRouteParams'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import deletePost from 'store/actions/deletePost'
import removePost from 'store/actions/removePost'
import { editPostUrl, groupUrl, personUrl, postUrl, trackUrl } from '@hylo/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'
import { Tooltip, TooltipTrigger, TooltipContent } from 'components/ui/tooltip'
import Avatar from 'components/Avatar'
import FlagGroupContent from 'components/FlagGroupContent'
import PostFooter from 'components/PostCard/PostFooter'
import getMe from 'store/selectors/getMe'
import { cn } from 'util/index'

function SubmissionCard ({ currentPhase, post, canManageRound, submissionDescriptor }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const routeParams = useRouteParams()
  const querystringParams = getQuerystringParam(['tab'], location)
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)

  const [voteAmount, setVoteAmount] = useState(0)
  const [flaggingVisible, setFlaggingVisible] = useState(false)

  const isFlagged = useMemo(() => post.flaggedGroups?.length > 0, [post.flaggedGroups])
  const flagPostData = useMemo(() => ({
    slug: routeParams.groupSlug,
    id: post.id,
    type: 'post'
  }), [routeParams.groupSlug, post.id])

  const deletePostWithConfirm = useCallback(() => {
    if (window.confirm(t('Are you sure you want to delete this {{submissionDescriptor}}? You cannot undo this.', { submissionDescriptor }))) {
      dispatch(deletePost(post.id, null, routeParams.fundingRoundId))
    }
  }, [post.id, routeParams.fundingRoundId, t])

  const removePostWithConfirm = useCallback(() => {
    if (window.confirm(t('Are you sure you want to remove this {{submissionDescriptor}}? You cannot undo this.', { submissionDescriptor }))) {
      dispatch(removePost(post.id, null, routeParams.fundingRoundId))
    }
  }, [post.id, routeParams.fundingRoundId, t])

  const flagPostFunc = useCallback(() => post.creatorId !== currentUser.id ? () => { setFlaggingVisible(true) } : undefined, [post.creatorId, currentUser.id])
  const moderationActionsGroupUrl = groupUrl(routeParams.groupSlug, 'moderation')

  const dropdownItems = useMemo(() => filter([
    { icon: <Pencil />, label: t('Edit'), onClick: currentUser?.id === post.creatorId ? () => navigate(editPostUrl(post.id, routeParams, querystringParams)) : undefined },
    { icon: <LinkIcon />, label: t('Copy Link'), onClick: () => navigator.clipboard.writeText(`${window.location.protocol}//${window.location.host}${trackUrl(routeParams.trackId, { groupSlug: routeParams.groupSlug })}funding-rounds/${routeParams.fundingRoundId}/submissions/${post.id}`) },
    { icon: <Flag />, label: t('Flag'), onClick: flagPostFunc() },
    { icon: <Trash />, label: t('Delete'), onClick: currentUser?.id === post.creator.id ? deletePostWithConfirm : undefined, red: true },
    { icon: <Trash />, label: t('Remove from Round'), onClick: canManageRound && currentUser?.id !== post.creator.id ? removePostWithConfirm : undefined, red: true }
  ], item => isFunction(item.onClick)), [post.id, post.creatorId, post.creator.id, routeParams, querystringParams, flagPostFunc, currentUser?.id, deletePostWithConfirm, canManageRound, removePostWithConfirm, navigate, t])

  const { createdTimestamp, creator, exactCreatedTimestamp } = post
  const creatorUrl = useMemo(() => personUrl(creator.id, routeParams.groupSlug), [creator.id, routeParams.groupSlug])

  const handleVoteAmountChange = useCallback((e) => {
    setVoteAmount(e.target.value)
  }, [])

  const openPostDetails = useCallback(() => navigate(postUrl(post.id, routeParams, querystringParams)), [post.id, routeParams, querystringParams])

  return (
    <div
      className='SubmissionCard flex flex-row gap-2 bg-card/50 rounded-lg border-2 border-card/30 shadow-xl mb-4 relative duration-400 cursor-pointer'
    >
      <div className='flex flex-col flex-1 gap-2 py-2 px-4'>
        <div className='flex flex-row gap-2 items-center'>
          <Avatar avatarUrl={creator.avatarUrl} url={creatorUrl} className={cn('mr-3')} medium />
          <div
            className='flex flex-wrap justify-between flex-1 text-foreground truncate xs:truncate-none overflow-hidden xs:overflow-visible mr-2 xs:max-w-auto'
            onClick={openPostDetails}
          >
            <Link
              to={creatorUrl}
              className={cn('flex whitespace-nowrap items-center text-card-foreground font-bold font-md text-base')}
              onClick={e => e.stopPropagation()}
            >
              {creator.name}
            </Link>
          </div>
          {isFlagged && <Link to={moderationActionsGroupUrl} className='text-decoration-none' data-tooltip-content={t('See why this post was flagged')} data-tooltip-id='post-header-flag-tt'><Flag className='top-1 mr-3 text-xl text-accent font-bold' /></Link>}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className='text-foreground/50 text-2xs whitespace-nowrap' onClick={openPostDetails}>
                {createdTimestamp}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {exactCreatedTimestamp}
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger className='outline-none' onClick={e => e.stopPropagation()}><EllipsisVertical /></DropdownMenuTrigger>
            <DropdownMenuContent sideOffset={-30} alignOffset={30} align='end'>
              {dropdownItems.map(item => (
                <DropdownMenuItem key={item.label} onClick={item.onClick}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <h1 onClick={openPostDetails}>{post.title}</h1>
        <PostFooter
          {...post}
          currentUser={currentUser}
          onClick={openPostDetails}
          postId={post.id}
          className='p-0'
        />
      </div>
      {currentPhase === 'voting' && (
        <div className='flex flex-col justify-center gap-2 bg-foreground/10 p-2 rounded-r-lg'>
          <input type='number' value={voteAmount} onChange={handleVoteAmountChange} />
        </div>
      )}
      {flaggingVisible &&
        ReactDOM.createPortal(
          <FlagGroupContent
            type='post'
            linkData={flagPostData}
            onClose={() => setFlaggingVisible(false)}
          />,
          document.body
        )}
    </div>
  )
}

export default SubmissionCard
