import { cn } from 'util/index'
import { filter, isFunction } from 'lodash'
import React, { PureComponent } from 'react'
import ReactDOM from 'react-dom'
import { withTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { TextHelpers } from '@hylo/shared'
import Avatar from 'components/Avatar'
import Dropdown from 'components/Dropdown'
import Highlight from 'components/Highlight'
import FlagContent from 'components/FlagContent'
import FlagGroupContent from 'components/FlagGroupContent/FlagGroupContent'
import Icon from 'components/Icon'
import Tooltip from 'components/Tooltip'
import PostCompletion from '../PostCompletion'
import { PROPOSAL_STATUS_CASUAL, PROPOSAL_STATUS_COMPLETED } from 'store/models/Post'
import { personUrl, topicUrl } from 'util/navigation'

class PostHeader extends PureComponent {
  static defaultProps = {
    routeParams: {}
  }

  state = {
    flaggingVisible: false
  }

  flagPostFunc = () =>
    this.props.canFlag ? () => { this.setState({ flaggingVisible: true }) } : undefined

  render () {
    const {
      routeParams,
      post,
      canEdit,
      expanded,
      isFlagged,
      hasImage,
      group,
      proposalOutcome,
      proposalStatus,
      pinned,
      close,
      className,
      constrained,
      editPost,
      deletePost,
      duplicatePost,
      removePost,
      pinPost,
      highlightProps,
      moderationActionsGroupUrl = '',
      fulfillPost,
      unfulfillPost,
      updateProposalOutcome,
      postUrl,
      t
    } = this.props

    const {
      announcement,
      creator,
      createdTimestamp,
      exactCreatedTimestamp,
      type,
      id,
      endTime,
      startTime,
      fulfilledAt,
      topics
    } = post

    if (!creator) return null

    const copyLink = () => {
      navigator.clipboard.writeText(`${window.location.protocol}//${window.location.host}${postUrl}`)
    }

    const creatorUrl = personUrl(creator.id, routeParams.groupSlug)
    const { flaggingVisible } = this.state
    // Used to generate a link to this post from the backend.
    const flagPostData = {
      slug: routeParams.groupSlug,
      id,
      type: 'post'
    }

    const dropdownItems = filter([
      { icon: 'Pin', label: pinned ? t('Unpin') : t('Pin'), onClick: pinPost },
      { icon: 'Edit', label: t('Edit'), onClick: editPost },
      { icon: 'CopyLink', label: t('Copy Link'), onClick: copyLink },
      { icon: 'Flag', label: t('Flag'), onClick: this.flagPostFunc() },
      { icon: 'Duplicate', label: t('Duplicate'), onClick: duplicatePost },
      { icon: 'Trash', label: t('Delete'), onClick: deletePost ? () => deletePost(t('Are you sure you want to delete this post?')) : undefined, red: true },
      { icon: 'Trash', label: t('Remove From Group'), onClick: removePost, red: true }
    ], item => isFunction(item.onClick))

    const typesWithTimes = ['offer', 'request', 'resource', 'project', 'proposal']
    const canHaveTimes = typesWithTimes.includes(type)

    const typesWithCompletion = ['offer', 'request', 'resource', 'project', 'proposal']
    const canBeCompleted = typesWithCompletion.includes(type) && (!proposalStatus || proposalStatus === PROPOSAL_STATUS_COMPLETED || proposalStatus === PROPOSAL_STATUS_CASUAL)

    // If it was completed/fulfilled before it ended, then use that as the end datetime
    const actualEndTime = fulfilledAt && fulfilledAt < endTime ? fulfilledAt : endTime

    const { from, to } = TextHelpers.formatDatePair(startTime, actualEndTime, true)

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

    const showNormal = ((canBeCompleted && canEdit && expanded) && (topics?.length > 0 || (canHaveTimes && timeWindow.length > 0))) || false
    return (
      <div className={cn('relative', { 'mb-0 h-12 px-2': constrained }, className)}>
        <div className='w-full bg-transparent rounded-t-lg'>
          <div className='flex justify-start items-center p-2'>
            <Avatar avatarUrl={creator.avatarUrl} url={creatorUrl} className={cn('mr-3', { 'mr-2': constrained })} medium />
            <div className='flex flex-wrap justify-between flex-1 text-foreground truncate xs:truncate-none overflow-hidden xs:overflow-visible mr-2 xs:max-w-auto'>
              <Highlight {...highlightProps}>
                <Link to={creatorUrl} className={cn('flex whitespace-nowrap items-center text-card-foreground font-bold font-md', { 'text-sm': constrained })} data-tooltip-content={creator.tagline} data-tooltip-id={`announcement-tt-${id}`}>
                  {creator.name}
                </Link>
              </Highlight>
              {/* <div className='flex ml-2 mr-4 gap-2'>
                {roles.map(role => (
                  <BadgeEmoji key={role.id + role.common} expanded {...role} responsibilities={role.responsibilities} id={id} />
                ))}
              </div> */}
              <div className='flex items-center ml-2'>
                <span className='text-foreground/50 text-2xs whitespace-nowrap' data-tooltip-id={`dateTip-${id}`} data-tooltip-content={exactCreatedTimestamp}>
                  {createdTimestamp}
                </span>
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
              {isFlagged && <Link to={moderationActionsGroupUrl} className='text-decoration-none'><Icon name='Flag' className='top-1 mr-3 text-xl text-accent font-bold' dataTip={t('See why this post was flagged')} data-tooltip-id='flag-tt' /></Link>}
              <Tooltip
                delay={250}
                id='flag-tt'
              />
              {pinned && <Icon name='Pin' className='top-1 mr-3 text-xl text-accent font-bold' />}
              {dropdownItems.length > 0 &&
                <Dropdown toggleChildren={<Icon name='More' dataTestId='post-header-more-icon' />} items={dropdownItems} alignRight />}
              {close &&
                <a className={cn('inline-block cursor-pointer relative px-3 text-xl')} onClick={close}>
                  <Icon name='Ex' className='align-middle' />
                </a>}
            </div>
          </div>
        </div>

        <div className={cn('flex flex-col xs:flex-row justify-between', { 'absolute z-11 w-full': hasImage, relative: showNormal })}>
          {/* {topics?.length > 0 && <TopicsLine topics={topics} slug={routeParams.groupSlug} />} */}
          {canHaveTimes && timeWindow.length > 0 && (
            <div className={cn('text-xs font-bold text-secondary w-auto text-center border border-border rounded-md bg-card p-2 m-4 xs:m-3', { hidden: constrained })}>
              {timeWindow}
            </div>
          )}
        </div>
        {canBeCompleted && canEdit && expanded && (
          <PostCompletion
            type={type}
            startTime={startTime}
            endTime={endTime}
            isFulfilled={!!fulfilledAt}
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
                onChange={(value) => updateProposalOutcome(value.target.value)}
                ref={this.titleInputRef}
              />
            </div>
          )
        }

        {flaggingVisible && !group &&
          ReactDOM.createPortal(
            <FlagContent
              type='post'
              linkData={flagPostData}
              onClose={() => this.setState({ flaggingVisible: false })}
            />,
            document.body
          )}

        {flaggingVisible && group &&
          ReactDOM.createPortal(
            <FlagGroupContent
              type='post'
              linkData={flagPostData}
              onClose={() => this.setState({ flaggingVisible: false })}
            />,
            document.body
          )}

        <Tooltip
          className='bg-background z-1000'
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

export default withTranslation()(PostHeader)
