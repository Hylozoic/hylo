import React, { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { filter, get } from 'lodash/fp'
import { MapPin } from 'lucide-react'
import { RESPONSES } from '@hylo/presenters/EventInvitationPresenter'
import CardImageAttachments from 'components/CardImageAttachments'
import EventTimeDisplay from 'components/EventTimeDisplay/EventTimeDisplay'
import { PostBody, PostFooter, PostHeader, EventBody } from 'components/PostCard'
import EventDate from 'components/PostCard/EventDate'
import EventRSVP from 'components/PostCard/EventRSVP'
import PeopleInfo from 'components/PostCard/PeopleInfo'
import PostContent from 'components/PostCard/PostContent'
import PostTitle from 'components/PostCard/PostTitle'
import useRouteParams from 'hooks/useRouteParams'
import Comments from 'routes/PostDetail/Comments'
import fetchPost from 'store/actions/fetchPost'
import respondToEventAction from 'store/actions/respondToEvent'
import presentPost from 'store/presenters/presentPost'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getPost from 'store/selectors/getPost'

/**
 * One part of a real post on a designed view (the postPart block). Every part
 * is drawn with the same components the post has everywhere else in Hylo, so
 * RSVPs, reactions and comments made here are real and the page never goes out
 * of date.
 *
 * The post is loaded into the store once per page however many of its parts
 * the page shows.
 */

// Which posts have been asked for and whether the answer is in, shared by every part on the page
// so several parts of one post make one request
const requests = new Map()
const listeners = new Set()
const notify = () => listeners.forEach(listener => listener())
const subscribe = listener => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function forgetRequestedPosts () {
  requests.clear()
  notify()
}

export function useDesignedPost (postId, groupSlug) {
  const dispatch = useDispatch()
  const id = String(postId)
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const rawPost = useSelector(state => getPost(state, id))
  const status = useSyncExternalStore(subscribe, () => requests.get(id) || 'idle')

  useEffect(() => {
    if (!postId || requests.has(id)) return
    requests.set(id, 'pending')
    notify()
    Promise.resolve(dispatch(fetchPost(id)))
      .then(response => { requests.set(id, response?.error ? 'failed' : 'done') })
      .catch(() => { requests.set(id, 'failed') })
      .then(notify)
  }, [dispatch, postId, id])

  const post = useMemo(() => rawPost ? presentPost(rawPost, get('id', group)) : null, [rawPost, group])
  // `settled` is true once the full post (with comments and event responses) has come back, or failed to
  return { post, settled: status === 'done' || status === 'failed' }
}

function EventPart ({ post, groupSlug, currentUser }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { startTime, endTime, timezone, eventInvitations, location } = post
  const attendees = filter(invitation => invitation.response === RESPONSES.YES, eventInvitations)
  const isPast = endTime && new Date(endTime) < new Date()

  return (
    <div className='rounded-lg border-2 border-foreground/20 bg-card text-card-foreground p-4 flex flex-col gap-3'>
      <div className='flex flex-row gap-4 items-center'>
        <EventDate startTime={startTime} />
        <div className='flex flex-col gap-1 min-w-0 text-sm'>
          <EventTimeDisplay startTime={startTime} endTime={endTime} timezone={timezone} showSecondary tooltipId={`designed-event-time-${post.id}`} />
          {location && (
            <span className='flex items-center gap-1 text-foreground/70'>
              <MapPin className='w-3.5 h-3.5 shrink-0' /><span className='min-w-0'>{location}</span>
            </span>
          )}
          {isPast && <span className='text-xs text-foreground/50'>{t('Event ended')}</span>}
        </div>
      </div>
      <div className='flex flex-wrap items-center justify-between gap-3 border-t-2 border-foreground/10 pt-3'>
        <PeopleInfo
          people={attendees}
          peopleTotal={attendees.length}
          excludePersonId={get('id', currentUser)}
          phrases={{
            emptyMessage: isPast ? t('No one attended') : t('No one is attending yet'),
            phraseSingular: isPast ? t('attended') : t('is attending'),
            mePhraseSingular: isPast ? t('attended') : t('are attending'),
            pluralPhrase: isPast ? t('attended') : t('attending')
          }}
        />
        {currentUser && !isPast && (
          <EventRSVP {...post} respondToEvent={response => dispatch(respondToEventAction(post, response))} />
        )}
      </div>
    </div>
  )
}

export default function DesignedPostPart ({ block, groupSlug }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const currentUser = useSelector(getMe)
  const { post, settled } = useDesignedPost(block.postId, groupSlug)
  const part = block.part

  if (!post) {
    return (
      <p className='text-sm text-foreground/50 m-0' data-block='postPart' data-part={part} role='status'>
        {settled ? t('This post is no longer available.') : t('Loading...')}
      </p>
    )
  }

  const isEvent = post.type === 'event'
  const hasImages = (post.attachments || []).some(attachment => attachment.type === 'image')
  const card = 'rounded-lg border-2 border-foreground/20 bg-card text-card-foreground'
  const wrap = children => <div data-block='postPart' data-part={part} data-post-id={post.id}>{children}</div>

  switch (part) {
    case 'header':
      return wrap(<PostHeader post={post} routeParams={routeParams} expanded />)
    case 'images':
      return hasImages ? wrap(<div className='rounded-lg overflow-hidden'><CardImageAttachments attachments={post.attachments} /></div>) : null
    case 'event':
      return isEvent ? wrap(<EventPart post={post} groupSlug={groupSlug} currentUser={currentUser} />) : null
    case 'body':
      return wrap(
        <div className={`${card} p-4`}>
          {isEvent
            ? <><PostTitle {...post} /><PostContent {...post} expanded slug={groupSlug} /></>
            : <PostBody currentUser={currentUser} expanded routeParams={routeParams} slug={groupSlug} flagCover={false} {...post} />}
        </div>
      )
    case 'reactions':
      return wrap(<div className={card}><PostFooter {...post} currentUser={currentUser} /></div>)
    case 'comments':
      return wrap(<Comments post={post} slug={groupSlug} />)
    default:
      // "everything": the post as Hylo normally lays it out
      return wrap(
        <div className='flex flex-col gap-2'>
          <PostHeader post={post} routeParams={routeParams} expanded hasImage={hasImages} />
          <div className={`${card} overflow-hidden`}>
            {hasImages && <CardImageAttachments attachments={post.attachments} />}
            {isEvent
              ? <EventBody expanded currentUser={currentUser} slug={groupSlug} event={post} respondToEvent={response => dispatch(respondToEventAction(post, response))} flagCover={false} />
              : <PostBody currentUser={currentUser} expanded routeParams={routeParams} slug={groupSlug} flagCover={false} {...post} />}
            <PostFooter {...post} currentUser={currentUser} />
          </div>
          <Comments post={post} slug={groupSlug} />
        </div>
      )
  }
}
