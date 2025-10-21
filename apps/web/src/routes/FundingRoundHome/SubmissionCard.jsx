import { filter, isFunction } from 'lodash'
import { EllipsisVertical, Flag, Pencil, Link as LinkIcon, Trash } from 'lucide-react'
import React, { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ReactDOM from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import useRouteParams from 'hooks/useRouteParams'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import deletePost from 'store/actions/deletePost'
import removePost from 'store/actions/removePost'
import { allocateTokensToSubmission } from 'routes/FundingRounds/FundingRounds.store'
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

function SubmissionCard ({ currentPhase, post, canManageRound, canVote, round, localVoteAmount, setLocalVoteAmount, currentTokensRemaining }) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const routeParams = useRouteParams()
  const querystringParams = getQuerystringParam(['tab'], location)
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)

  const [flaggingVisible, setFlaggingVisible] = useState(false)
  const [validationError, setValidationError] = useState('')

  const isFlagged = useMemo(() => post.flaggedGroups?.length > 0, [post.flaggedGroups])
  const flagPostData = useMemo(() => ({
    slug: routeParams.groupSlug,
    id: post.id,
    type: 'post'
  }), [routeParams.groupSlug, post.id])

  // Calculate available tokens including currently allocated tokens for this submission
  const availableTokens = useMemo(() => {
    return (currentTokensRemaining || 0) + (localVoteAmount || 0)
  }, [currentTokensRemaining, localVoteAmount])

  const deletePostWithConfirm = useCallback(() => {
    if (window.confirm(t('Are you sure you want to delete this {{submissionDescriptor}}? You cannot undo this.', { submissionDescriptor: round?.submissionDescriptor }))) {
      dispatch(deletePost(post.id, null, routeParams.fundingRoundId))
    }
  }, [post.id, routeParams.fundingRoundId, t])

  const removePostWithConfirm = useCallback(() => {
    if (window.confirm(t('Are you sure you want to remove this {{submissionDescriptor}}? You cannot undo this.', { submissionDescriptor: round?.submissionDescriptor }))) {
      dispatch(removePost(post.id, null, routeParams.fundingRoundId))
    }
  }, [post.id, routeParams.fundingRoundId, t])

  const flagPostFunc = useCallback(() => { setFlaggingVisible(true) })
  const moderationActionsGroupUrl = groupUrl(routeParams.groupSlug, 'moderation')

  const dropdownItems = useMemo(() => filter([
    { icon: <Pencil />, label: t('Edit'), onClick: currentUser?.id === post.creator.id ? () => navigate(editPostUrl(post.id, routeParams, querystringParams)) : undefined },
    { icon: <LinkIcon />, label: t('Copy Link'), onClick: () => navigator.clipboard.writeText(`${window.location.protocol}//${window.location.host}${trackUrl(routeParams.trackId, { groupSlug: routeParams.groupSlug })}funding-rounds/${routeParams.fundingRoundId}/submissions/${post.id}`) },
    { icon: <Flag />, label: t('Flag'), onClick: currentUser?.id === post.creator.id ? undefined : flagPostFunc },
    { icon: <Trash />, label: t('Delete'), onClick: currentUser?.id === post.creator.id ? deletePostWithConfirm : undefined, red: true },
    { icon: <Trash />, label: t('Remove from Round'), onClick: canManageRound && currentUser?.id !== post.creator.id ? removePostWithConfirm : undefined, red: true }
  ], item => isFunction(item.onClick)), [post.id, post.creator.id, routeParams, querystringParams, flagPostFunc, currentUser?.id, deletePostWithConfirm, canManageRound, removePostWithConfirm, navigate, t])

  const { createdTimestamp, creator, exactCreatedTimestamp } = post
  const creatorUrl = useMemo(() => personUrl(creator.id, routeParams.groupSlug), [creator.id, routeParams.groupSlug])

  const validateVoteAmount = useCallback((value) => {
    // Check if exceeds available tokens
    if (value > availableTokens) {
      return t('Not enough tokens available')
    }

    // Check if exceeds max allocation per submission
    if (round.maxTokenAllocation && value > round.maxTokenAllocation) {
      return t('Cannot allocate more than {{max}} tokens per submission', { max: round.maxTokenAllocation })
    }

    // Check if below minimum allocation (when value > 0)
    if (value > 0 && round.minTokenAllocation && value < round.minTokenAllocation) {
      return t('Must allocate at least {{min}} tokens or 0', { min: round.minTokenAllocation })
    }

    return ''
  }, [availableTokens, round.maxTokenAllocation, round.minTokenAllocation, t])

  const handleVoteAmountChange = useCallback((e) => {
    let newValue = parseInt(e.target.value) || 0
    if (newValue < 0) newValue = 0

    // Enforce maximum constraints
    if (round.maxTokenAllocation && newValue > round.maxTokenAllocation) {
      newValue = round.maxTokenAllocation
    }
    if (newValue > availableTokens) {
      newValue = availableTokens
    }

    setLocalVoteAmount(newValue)

    // Validate and set error message
    const error = validateVoteAmount(newValue)
    setValidationError(error)
  }, [availableTokens, round.maxTokenAllocation, validateVoteAmount, setLocalVoteAmount])

  const handleVoteAmountBlur = useCallback(async () => {
    // Only submit if there's no validation error and the value changed
    if (!validationError && localVoteAmount !== post.tokensAllocated) {
      try {
        await dispatch(allocateTokensToSubmission(post.id, localVoteAmount, routeParams.fundingRoundId))
      } catch (error) {
        console.error('Failed to allocate tokens:', error)
        // Reset to previous value on error
        setLocalVoteAmount(post.tokensAllocated || 0)
      }
    }
  }, [validationError, localVoteAmount, post.tokensAllocated, post.id, routeParams.fundingRoundId, dispatch, setLocalVoteAmount])

  const handleVoteAmountFocus = useCallback((e) => {
    // Select all text when focusing to avoid the "01" issue
    e.target.select()
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
        {post.budget && (
          <div className='text-sm text-foreground/70 mb-2'>
            <span className='font-semibold'>{t('Budget')}: </span>
            {post.budget}
          </div>
        )}
        <PostFooter
          {...post}
          currentUser={currentUser}
          onClick={openPostDetails}
          postId={post.id}
          className='p-0'
        />
      </div>
      {currentPhase === 'voting' && canVote && (
        <div className='flex flex-col justify-center items-center gap-2 bg-foreground/5 p-4 rounded-r-lg min-w-[120px]'>
          <label className='text-xs font-bold text-foreground/60 uppercase'>
            {t('Your {{tokenType}}', { tokenType: round?.tokenType || t('Votes') })}
          </label>
          <input
            type='number'
            min='0'
            value={localVoteAmount}
            onChange={handleVoteAmountChange}
            onBlur={handleVoteAmountBlur}
            onFocus={handleVoteAmountFocus}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-20 h-12 text-center text-2xl font-bold bg-input border-2 rounded-md focus:outline-none',
              validationError ? 'border-red-500 focus:border-red-500' : 'border-foreground/20 focus:border-selected'
            )}
          />
          {validationError && (
            <span className='text-xs text-red-500 text-center max-w-[120px] leading-tight'>
              {validationError}
            </span>
          )}
        </div>
      )}
      {currentPhase === 'completed' && (
        <div className='flex flex-col justify-center items-end gap-1 bg-foreground/5 p-4 rounded-r-lg min-w-[160px]'>
          <label className='text-xs font-semibold text-foreground/60 uppercase tracking-wide'>
            {t('Total {{tokenType}}', { tokenType: round?.tokenType || t('Votes') })}
          </label>
          <div
            className={cn(
              'text-5xl font-bold',
              (post.tokensAllocated || 0) > 0 ? 'text-green-500' : 'text-foreground'
            )}
          >
            {post.totalTokensAllocated || 0}
          </div>
          <div className='text-sm font-semibold text-foreground/80 mt-1'>
            {t('You: {{tokens}}', { tokens: post.tokensAllocated || 0 })}
          </div>
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
