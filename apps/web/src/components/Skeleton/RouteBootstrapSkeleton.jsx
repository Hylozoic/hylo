import React from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { StreamSkeleton } from 'components/PostCard/PostCardSkeleton'
import PostDetailSkeleton from 'routes/PostDetail/PostDetailSkeleton'

/** Group chat room — same column width as ChatRoom message list. */
const CHAT_ROOM_PATH_PATTERNS = [
  '/groups/:groupSlug/chat/:topicName/*',
  '/groups/:groupSlug/chat/:topicName'
]

/** Path patterns whose primary content is the expanded post view (matches PostDetail routes). */
const POST_DETAIL_PATH_PATTERNS = [
  '/post/:postId/*',
  '/post/:postId',
  '/groups/:groupSlug/post/:postId/*',
  '/groups/:groupSlug/post/:postId',
  '/groups/:groupSlug/stream/post/:postId',
  '/groups/:groupSlug/stream/post/:postId/*',
  '/groups/:groupSlug/topics/:topicName/post/:postId',
  '/groups/:groupSlug/topics/:topicName/post/:postId/*'
]

function isPostDetailBootstrapPath (pathname) {
  return POST_DETAIL_PATH_PATTERNS.some(p =>
    matchPath({ path: p, end: false }, pathname)
  )
}

function isChatRoomBootstrapPath (pathname) {
  return CHAT_ROOM_PATH_PATTERNS.some(p =>
    matchPath({ path: p, end: false }, pathname)
  )
}

/**
 * Stream vs post-detail skeleton for the current (or given) URL — used while parent
 * routers block real route components (session check, fetchForCurrentUser, fetchForGroup).
 */
export default function RouteBootstrapSkeleton ({ pathname: pathnameProp }) {
  const { pathname: fromLocation } = useLocation()
  const pathname = pathnameProp ?? fromLocation

  if (isPostDetailBootstrapPath(pathname)) {
    return <PostDetailSkeleton />
  }

  if (isChatRoomBootstrapPath(pathname)) {
    return <StreamSkeleton columnVariant='chat' />
  }

  return <StreamSkeleton />
}
