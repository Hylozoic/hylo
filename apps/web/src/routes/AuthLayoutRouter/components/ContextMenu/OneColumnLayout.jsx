import { cn, bgImageStyle } from 'util/index'
import { Bell, Settings, Users, Copy, ExternalLink } from 'lucide-react'
import React, { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import ContextWidgetPresenter, {
  orderContextWidgetsForContextMenu,
  allViewsWidget,
  isHiddenInContextMenuResolver,
  COMMON_VIEWS
} from '@hylo/presenters/ContextWidgetPresenter'
import { widgetUrl, groupUrl, currentUserSettingsUrl, postUrl, chatUrl, addQuerystringToPath } from '@hylo/navigation'
import { DEFAULT_BANNER, DEFAULT_AVATAR } from 'store/models/Group'
import { getContextWidgets } from 'store/selectors/contextWidgetSelectors'
import { RESP_ADMINISTRATION } from 'store/constants'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import WidgetIconResolver from 'components/WidgetIconResolver'
import fetchPosts from 'store/actions/fetchPosts'
import { fetchGroupMembers } from 'routes/Members/Members.store'
import getMe from 'store/selectors/getMe'

function useRecentPosts ({ widget, groupSlug }) {
  const dispatch = useDispatch()
  const [posts, setPosts] = useState([])
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    if (!groupSlug || !widget) return

    let params = null

    const baseParams = {
      context: 'groups',
      slug: groupSlug,
      first: 2,
      sortBy: 'created',
      order: 'desc',
      childPostInclusion: 'no'
    }

    if (widget.view === 'events') {
      params = { ...baseParams, types: ['event'], sortBy: 'start_time', order: 'asc', afterTime: new Date().toISOString() }
    } else if (widget.view && COMMON_VIEWS[widget.view]?.postTypes) {
      params = { ...baseParams, types: COMMON_VIEWS[widget.view].postTypes }
    } else if (widget.view === 'stream') {
      params = { ...baseParams }
    } else if (widget.viewChat) {
      params = { ...baseParams, topic: widget.viewChat.id, filter: 'chat', sortBy: 'id' }
    } else if (widget.customView && !widget.customView.externalLink) {
      const isCalendarView = widget.customView.postTypes?.includes('event')
      params = {
        ...baseParams,
        ...(widget.customView.collectionId ? { forCollection: widget.customView.collectionId } : {}),
        ...(widget.customView.postTypes?.length ? { types: widget.customView.postTypes } : {}),
        ...(widget.customView.topics?.length ? { topics: widget.customView.topics.map(t => t.id) } : {}),
        ...(isCalendarView
          ? { sortBy: 'start_time', order: 'asc', afterTime: new Date().toISOString() }
          : {})
      }
    }

    if (!params) return

    const isChat = !!widget.viewChat
    dispatch(fetchPosts(params)).then(result => {
      const items = result?.payload?.data?.group?.posts?.items || []
      const total = result?.payload?.data?.group?.posts?.total || 0
      // Chat posts come newest-first but should display oldest-first (bottom = newest)
      setPosts(isChat ? [...items].reverse() : items)
      setTotalCount(total)
    }).catch(() => {})
  }, [widget?.id, groupSlug])

  return { posts, totalCount }
}

function useMembers ({ widget, groupSlug, groupId }) {
  const dispatch = useDispatch()
  const me = useSelector(getMe)
  const [members, setMembers] = useState([])

  useEffect(() => {
    if (widget.type !== 'members' || !groupId) return

    dispatch(fetchGroupMembers({ slug: groupSlug, groupId, first: 5, sortBy: 'last_active_at', order: 'desc' })).then(
      response => {
        const items = response.payload?.data?.group?.members?.items || []
        setMembers(items.filter(m => m.id !== me?.id))
      }
    ).catch(() => {})
  }, [widget.type, groupId])

  return members
}

function isUserOnline (lastActiveAt) {
  if (!lastActiveAt) return false
  const minute = 1000 * 60
  return new Date(parseInt(lastActiveAt)) > new Date(Date.now() - minute * 4)
}

function WidgetCard ({ widget, groupSlug, groupId, navigate, t }) {
  const url = widgetUrl({ widget, groupSlug, context: 'group' })
  const title = widget.title?.startsWith('widget-') ? t(widget.title) : widget.title
  const externalLink = widget.customView?.externalLink || widget.url
  const isExternal = !!(widget.customView?.externalLink || (widget.url && widget.url.startsWith('http')))
  const [copied, setCopied] = useState(false)
  const { posts, totalCount } = useRecentPosts({ widget, groupSlug })
  const remainingCount = totalCount > 2 ? totalCount - 2 : 0
  const members = useMembers({ widget, groupSlug, groupId })
  const isMembers = widget.type === 'members'

  const handleClick = () => {
    if (isExternal && externalLink) {
      window.open(externalLink, '_blank', 'noopener,noreferrer')
    } else if (url) {
      navigate(url)
    }
  }

  const handleCopy = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(externalLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex flex-col rounded-xl border-2 border-foreground/10 bg-card/50 hover:border-foreground/30',
        'hover:shadow-md transition-all cursor-pointer p-4 gap-2',
        'w-full max-w-[300px] min-h-[100px]'
      )}
    >
      <div className='flex flex-col items-center gap-1 text-center'>
        <span className='text-foreground/60 [&>svg]:w-8 [&>svg]:h-8'>
          <WidgetIconResolver widget={widget} />
        </span>
        <h3 className='text-base font-semibold text-foreground line-clamp-2'>{title}</h3>
      </div>

      {isExternal && externalLink && (
        <div className='flex flex-col gap-2 mt-1'>
          <div className='flex items-center gap-1.5 bg-foreground/5 rounded-lg px-2 py-1.5'>
            <span className='truncate text-xs text-foreground/50 flex-1'>{copied ? t('Copied to clipboard') : externalLink}</span>
            <button
              onClick={handleCopy}
              className='shrink-0 p-1 rounded hover:bg-foreground/10 transition-colors'
              title={copied ? t('Copied!') : t('Copy link')}
            >
              <Copy className='w-3.5 h-3.5 text-foreground/40' />
            </button>
          </div>
          <button
            onClick={handleClick}
            className='w-full text-xs py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-foreground/80 transition-colors flex items-center justify-center gap-1'
          >
            <ExternalLink className='w-3 h-3' />
            {t('View {{title}}', { title })}
          </button>
        </div>
      )}

      {isMembers && members.length > 0 && (
        <div className='flex flex-col gap-1.5 mt-1'>
          {members.map(member => (
            <div
              key={member.id}
              onClick={(e) => { e.stopPropagation(); navigate(`/groups/${groupSlug}/members/${member.id}`) }}
              className='flex items-center gap-2 px-2 py-1.5 rounded-md bg-foreground/5 hover:bg-foreground/10 text-xs cursor-pointer transition-colors'
            >
              {member.avatarUrl && (
                <div className='relative shrink-0'>
                  <div
                    className='w-5 h-5 rounded-full bg-cover bg-center'
                    style={{ backgroundImage: `url(${member.avatarUrl})` }}
                  />
                  {isUserOnline(member.lastActiveAt) && (
                    <span className='absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-card' />
                  )}
                </div>
              )}
              <span className='truncate text-foreground/70 flex-1'>{member.name}</span>
            </div>
          ))}
        </div>
      )}

      {!isExternal && !isMembers && posts.length > 0 && (
        <div className='flex flex-col gap-1.5 mt-1'>
          {posts.map(post => {
            const postLink = widget.viewChat
              ? chatUrl(widget.viewChat.name, { groupSlug, context: 'group' })
              : postUrl(post.id, { groupSlug, context: 'group' })
            return (
              <div
                key={post.id}
                onClick={(e) => { e.stopPropagation(); navigate(postLink) }}
                className='flex items-center gap-2 px-2 py-1.5 rounded-md bg-foreground/5 hover:bg-foreground/10 text-xs cursor-pointer transition-colors'
              >
                {post.creator?.avatarUrl && (
                  <div
                    className='w-5 h-5 rounded-full bg-cover bg-center shrink-0'
                    style={{ backgroundImage: `url(${post.creator.avatarUrl})` }}
                  />
                )}
                <span className='truncate text-foreground/70 flex-1'>{post.title || post.details?.replace(/<[^>]*>/g, '').substring(0, 40)}</span>
              </div>
            )
          })}
          {remainingCount > 0 && (
            <button
              onClick={handleClick}
              className='text-xs text-foreground/40 hover:text-foreground/60 transition-colors py-1'
            >
              {t('{{count}} more...', { count: remainingCount })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function WidgetSection ({ widget, groupSlug, groupId, navigate, t }) {
  const title = widget.title?.startsWith('widget-') ? t(widget.title) : widget.title
  const childItems = widget.childWidgets || []

  return (
    <div className='w-full'>
      <h2 className='text-base font-semibold text-foreground/70 mb-3 px-1'>{title}</h2>
      <div className='flex flex-wrap gap-3'>
        {childItems.map(child => (
          <WidgetCard
            key={child.id}
            widget={child}
            groupSlug={groupSlug}
            groupId={groupId}
            navigate={navigate}
            t={t}
          />
        ))}
      </div>
    </div>
  )
}

export default function OneColumnLayout ({ group }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const groupSlug = group?.slug

  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))

  const rawContextWidgets = useSelector(state => getContextWidgets(state, group))

  const contextWidgets = useMemo(() => {
    return rawContextWidgets.map(widget => ContextWidgetPresenter(widget))
  }, [rawContextWidgets])

  const orderedWidgets = useMemo(() => {
    return orderContextWidgetsForContextMenu(contextWidgets)
      .filter(w => !isHiddenInContextMenuResolver(w))
  }, [contextWidgets])

  const bannerUrl = group?.bannerUrl || DEFAULT_BANNER
  const avatarUrl = group?.avatarUrl || DEFAULT_AVATAR
  const isDefaultAvatar = avatarUrl === DEFAULT_AVATAR

  return (
    <div className='OneColumnLayout w-full h-full overflow-y-auto'>
      {/* Group Banner - full width */}
      <div className='relative w-full'>
        <div className='relative h-[220px] overflow-hidden'>
          <div className='absolute inset-0 bg-cover bg-center' style={{ ...bgImageStyle(bannerUrl), opacity: 0.7 }} />
          <div className='absolute inset-0 bg-darkening/50' />

          <div className='absolute top-3 left-3 z-30'>
            <button onClick={() => navigate(currentUserSettingsUrl('notifications?group=' + group.id))}>
              <Bell className='w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' />
            </button>
          </div>

          {canAdminister && (
            <button
              onClick={() => navigate(groupUrl(groupSlug, 'settings', {}))}
              className='absolute top-3 right-3 z-30'
            >
              <Settings className='w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' />
            </button>
          )}

          <div className='absolute inset-0 z-20 flex flex-col items-center justify-center gap-1'>
            <div
              className={cn('w-16 h-16 rounded-xl shadow-lg bg-cover bg-center border-2 border-white/30 overflow-hidden relative', { 'bg-darkening': isDefaultAvatar })}
              style={!isDefaultAvatar ? bgImageStyle(avatarUrl) : {}}
            >
              {isDefaultAvatar && (
                <>
                  <div className='absolute inset-0 opacity-70' style={{ background: 'linear-gradient(to bottom right, hsl(var(--focus)), hsl(var(--selected)))' }} />
                  <span className='relative z-10 text-white text-2xl flex items-center justify-center uppercase h-full drop-shadow-md'>
                    {group.name?.split(/\s+/).length > 1
                      ? `${group.name.split(/\s+/)[0].charAt(0)}${group.name.split(/\s+/)[1].charAt(0)}`
                      : group.name?.charAt(0)}
                  </span>
                </>
              )}
            </div>
            <h1 className='text-2xl font-bold text-white drop-shadow-md m-0 leading-tight'>{group.name}</h1>
            <span className='text-sm flex items-center gap-1 text-white/80 drop-shadow-md'>
              <Users className='w-4 h-4' />
              {t('{{count}} Members', { count: group.memberCount || 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* Widget Cards Grid */}
      <div className='w-full max-w-[1000px] mx-auto px-4 py-6'>
        <div className='flex flex-col gap-6'>
          {/* Standalone cards (no children) at the top */}
          {orderedWidgets.some(w => !w.childWidgets?.length) && (
            <div className='flex flex-wrap gap-3'>
              {orderedWidgets
                .filter(w => !w.childWidgets?.length)
                .map(widget => (
                  <WidgetCard
                    key={widget.id}
                    widget={widget}
                    groupSlug={groupSlug}
                    groupId={group?.id}
                    navigate={navigate}
                    t={t}
                  />
                ))}
            </div>
          )}

          {/* Sections (widgets with children) */}
          {orderedWidgets
            .filter(w => w.childWidgets?.length > 0)
            .map(widget => (
              <WidgetSection
                key={widget.id}
                widget={widget}
                groupSlug={groupSlug}
                groupId={group?.id}
                navigate={navigate}
                t={t}
              />
            ))}

          {/* All Views card */}
          <div className='flex flex-wrap gap-3'>
            <WidgetCard
              widget={allViewsWidget}
              groupSlug={groupSlug}
              groupId={group?.id}
              navigate={navigate}
              t={t}
            />
          </div>
        </div>

        {/* Edit Menu button */}
        {canAdminister && (
          <div className='flex justify-center mt-6'>
            <button
              onClick={() => navigate(addQuerystringToPath(location.pathname, { cme: 'yes' }))}
              className='flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-foreground/20 hover:border-foreground/40 text-sm text-foreground/60 hover:text-foreground/80 transition-all'
            >
              <Settings className='w-4 h-4' />
              {t('Edit Menu')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
