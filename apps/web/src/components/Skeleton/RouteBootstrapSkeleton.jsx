import React from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { StreamSkeleton } from 'components/PostCard/PostCardSkeleton'
import PostDetailSkeleton from 'routes/PostDetail/PostDetailSkeleton'
import {
  EventsBootstrapSkeleton,
  GroupAboutBootstrapSkeleton,
  GroupSettingsBootstrapSkeleton,
  GroupSubgroupsBootstrapSkeleton,
  GroupWelcomeBootstrapSkeleton,
  MapExplorerBootstrapSkeleton,
  MembersBootstrapSkeleton,
  ModerationBootstrapSkeleton
} from './RouteBootstrapPlaceholders'

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

const MAP_BOOTSTRAP_PATTERNS = [
  '/all/map/*',
  '/all/map',
  '/public/map/*',
  '/public/map',
  '/groups/:groupSlug/map/*',
  '/groups/:groupSlug/map'
]

const GROUP_SETTINGS_BOOTSTRAP_PATTERNS = [
  '/groups/:groupSlug/settings/*',
  '/groups/:groupSlug/settings'
]

const GROUP_SUBGROUPS_BOOTSTRAP_PATTERNS = [
  '/groups/:groupSlug/groups/*',
  '/groups/:groupSlug/groups'
]

const MEMBERS_BOOTSTRAP_PATTERNS = [
  '/groups/:groupSlug/members/*',
  '/groups/:groupSlug/members'
]

const GROUP_ABOUT_BOOTSTRAP_PATTERNS = [
  '/groups/:groupSlug/about/*',
  '/groups/:groupSlug/about'
]

const GROUP_WELCOME_BOOTSTRAP_PATTERNS = [
  '/groups/:groupSlug/welcome/*',
  '/groups/:groupSlug/welcome'
]

const EVENTS_BOOTSTRAP_PATTERNS = [
  '/groups/:groupSlug/events/*',
  '/groups/:groupSlug/events',
  '/all/events/*',
  '/all/events',
  '/public/events/*',
  '/public/events'
]

const MODERATION_BOOTSTRAP_PATTERNS = [
  '/groups/:groupSlug/moderation/*',
  '/groups/:groupSlug/moderation'
]

function matchesAnyPattern (patterns, pathname) {
  return patterns.some(p =>
    matchPath({ path: p, end: false }, pathname)
  )
}

function isPostDetailBootstrapPath (pathname) {
  return matchesAnyPattern(POST_DETAIL_PATH_PATTERNS, pathname)
}

function isChatRoomBootstrapPath (pathname) {
  return matchesAnyPattern(CHAT_ROOM_PATH_PATTERNS, pathname)
}

function isMapBootstrapPath (pathname) {
  return matchesAnyPattern(MAP_BOOTSTRAP_PATTERNS, pathname)
}

function isGroupSettingsBootstrapPath (pathname) {
  return matchesAnyPattern(GROUP_SETTINGS_BOOTSTRAP_PATTERNS, pathname)
}

function isGroupSubgroupsBootstrapPath (pathname) {
  return matchesAnyPattern(GROUP_SUBGROUPS_BOOTSTRAP_PATTERNS, pathname)
}

function isMembersBootstrapPath (pathname) {
  return matchesAnyPattern(MEMBERS_BOOTSTRAP_PATTERNS, pathname)
}

function isGroupAboutBootstrapPath (pathname) {
  return matchesAnyPattern(GROUP_ABOUT_BOOTSTRAP_PATTERNS, pathname)
}

function isGroupWelcomeBootstrapPath (pathname) {
  return matchesAnyPattern(GROUP_WELCOME_BOOTSTRAP_PATTERNS, pathname)
}

function isEventsBootstrapPath (pathname) {
  return matchesAnyPattern(EVENTS_BOOTSTRAP_PATTERNS, pathname)
}

function isModerationBootstrapPath (pathname) {
  return matchesAnyPattern(MODERATION_BOOTSTRAP_PATTERNS, pathname)
}

/**
 * Route-shaped loading content for the center column while parents block real routes
 * (session check, fetchForCurrentUser, fetchForGroup). `RouteBootstrapSkeleton` sits under
 * `HistoryRouter`, so `useLocation()` is always valid; `pathname` prop overrides for tests.
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

  if (isMapBootstrapPath(pathname)) {
    return <MapExplorerBootstrapSkeleton />
  }

  if (isGroupSettingsBootstrapPath(pathname)) {
    return <GroupSettingsBootstrapSkeleton />
  }

  if (isGroupSubgroupsBootstrapPath(pathname)) {
    return <GroupSubgroupsBootstrapSkeleton />
  }

  if (isMembersBootstrapPath(pathname)) {
    return <MembersBootstrapSkeleton />
  }

  if (isGroupAboutBootstrapPath(pathname)) {
    return <GroupAboutBootstrapSkeleton />
  }

  if (isGroupWelcomeBootstrapPath(pathname)) {
    return <GroupWelcomeBootstrapSkeleton />
  }

  if (isEventsBootstrapPath(pathname)) {
    return <EventsBootstrapSkeleton />
  }

  if (isModerationBootstrapPath(pathname)) {
    return <ModerationBootstrapSkeleton />
  }

  return <StreamSkeleton />
}
