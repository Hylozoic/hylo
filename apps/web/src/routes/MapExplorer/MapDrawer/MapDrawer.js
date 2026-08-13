import { cn, bgImageStyle } from 'util/index'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import { isLegacyWebView } from 'util/webView'
import Tooltip from 'components/Tooltip'
import { groupDetailUrl, groupUrl, postUrl, spaceHomeUrl } from '@hylo/navigation'
import { TextHelpers, DateTimeHelpers } from '@hylo/shared'
import { formatUserDatePair } from 'util/dateFormat'
import { Calendar, Check, ChevronDown, DollarSign, FileText, Heart, LayoutGrid, Layers, MessageCircle, Network, Users, X } from 'lucide-react'

import { useLayoutFlags } from 'contexts/LayoutFlagsContext'
import ClickCatcher from 'components/ClickCatcher'
import Dropdown from 'components/Dropdown'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import Loading from 'components/Loading'
import Member from 'components/Member'
import ScrollListener from 'components/ScrollListener'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'
import { CONTEXT_MY } from 'store/constants'
import { DEFAULT_AVATAR, DEFAULT_BANNER } from 'store/models/Group'
import { POST_TYPES } from 'store/models/Post'
import { STREAM_SORT_OPTIONS } from 'util/constants'

import styles from './MapDrawer.module.scss'

/**
 * Group card per the map-list design: the banner fills the card under a dark
 * wash that lifts on hover, with a centered avatar, name, member count, and a
 * three-line blurb. The whole card is the link — no View button.
 */
function MapGroupCard ({ group, routeParams }) {
  const { t } = useTranslation()
  const to = group.memberStatus === 'member'
    ? groupUrl(group.slug)
    : groupDetailUrl(group.slug, routeParams)
  return (
    <Link
      to={to}
      className='group relative block shrink-0 rounded-[11px] overflow-hidden border border-foreground/20 shadow-[0_6px_20px_rgba(0,0,0,0.45)] bg-cover bg-center'
      style={bgImageStyle(group.bannerUrl || DEFAULT_BANNER)}
    >
      <div
        aria-hidden='true'
        className='absolute inset-0 transition-opacity duration-150 group-hover:opacity-0'
        style={{ background: 'linear-gradient(180deg, hsl(28 16% 15% / 0.58), hsl(28 18% 12% / 0.88))' }}
      />
      <div
        aria-hidden='true'
        className='absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100'
        style={{ background: 'linear-gradient(180deg, hsl(28 16% 15% / 0.44), hsl(28 18% 12% / 0.78))' }}
      />
      <div className='relative px-4 pt-[22px] pb-5 flex flex-col items-center text-center'>
        <div
          className='w-[66px] h-[66px] rounded-[13px] bg-cover bg-center shadow-[0_3px_12px_rgba(0,0,0,0.45)]'
          style={bgImageStyle(group.avatarUrl || DEFAULT_AVATAR)}
        />
        <div className='mt-[11px] text-[15px] font-bold text-white tracking-[-0.01em] [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]'>
          {group.name}
          {group.paywall && (
            <>
              <DollarSign
                className='inline-block ml-1.5 w-3.5 h-3.5'
                data-tooltip-id={`paywall-tooltip-${group.id}`}
                data-tooltip-content={t('This group requires payment to join')}
              />
              <Tooltip id={`paywall-tooltip-${group.id}`} />
            </>
          )}
        </div>
        <div className='mt-0.5 text-[11.5px] text-white/70 tabular-nums'>
          {t('{{count}} members', { count: group.memberCount })}
        </div>
        {group.description && (
          <div className='mt-[9px] text-xs leading-normal text-white/80 line-clamp-3 [text-wrap:pretty]'>
            <ClickCatcher>
              <HyloHTML element='span' html={TextHelpers.markdown(group.description)} />
            </ClickCatcher>
          </div>
        )}
      </div>
    </Link>
  )
}

/** Compact drawer row for a space with a location (distinct from child GroupCards). */
function SpaceMapCard ({ space, parentSlug }) {
  const { t } = useTranslation()
  if (!parentSlug || !space?.slug) return null
  return (
    <Link
      to={spaceHomeUrl(parentSlug, space)}
      className='flex items-center gap-3 p-3 rounded-lg bg-background border border-foreground/10 hover:border-foreground/25 transition-colors'
    >
      <div className='w-10 h-10 rounded-full bg-foreground/5 border border-foreground/15 grid place-items-center shrink-0 text-foreground/80'>
        <LucideIcon name={space.icon || 'Circle'} className='w-5 h-5' />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='text-sm font-semibold text-foreground truncate'>{space.name}</div>
        <div className='text-xs text-foreground/50'>{t('Space')}</div>
      </div>
    </Link>
  )
}

/**
 * Radically simplified drawer card, per the design: one author line with a
 * type pill and time, a bold title, then either an event-date chip or a quiet
 * comments / reactions / topic row. The whole card links to the post.
 */
function MapPostRow ({ post, routeParams }) {
  const { t } = useTranslation()
  const type = POST_TYPES[post.type] || {}
  const [red, green, blue] = type.primaryColor || [128, 128, 128]
  const typeColor = `rgb(${red} ${green} ${blue})`
  const firstImage = (post.attachments || []).find(a => a.type === 'image')
  const reactionsTotal = post.peopleReactedTotal ?? (post.postReactions || []).length
  const topicName = post.topics?.[0]?.name
  let eventDates = null
  if (post.type === 'event' && post.startTime) {
    const { from, to } = formatUserDatePair({ start: post.startTime, end: post.endTime, timezone: post.timezone, returnAsObj: true })
    eventDates = to ? `${from} — ${to}` : from
  }

  return (
    <Link
      to={postUrl(post.id, { ...routeParams, view: 'map' })}
      className='block rounded-[10px] bg-card border border-foreground/10 hover:border-foreground/30 shadow-sm px-3 py-2.5 transition-colors'
      data-testid='map-post-row'
    >
      <div className='flex items-center gap-1.5 mb-1.5 min-w-0'>
        <div className='w-[18px] h-[18px] rounded-full bg-cover bg-center shrink-0' style={bgImageStyle(post.creator?.avatarUrl)} />
        <span className='text-[11px] font-semibold text-foreground truncate flex-1'>{post.creator?.name}</span>
        <span
          className='inline-flex items-center px-1.5 py-px rounded text-[8px] font-bold uppercase tracking-wider shrink-0'
          style={{ color: typeColor, background: `rgb(${red} ${green} ${blue} / 0.14)`, border: `1px solid rgb(${red} ${green} ${blue} / 0.4)` }}
        >
          {t(type.label || post.type)}
        </span>
        <span className='text-[10px] text-foreground/50 shrink-0'>{DateTimeHelpers.humanDate(post.createdAt, true)}</span>
      </div>
      <div className='text-base font-bold text-foreground leading-tight'>{post.title}</div>
      {firstImage && (
        <div className='mt-2 rounded-lg overflow-hidden aspect-video bg-cover bg-center' style={bgImageStyle(firstImage.url)} />
      )}
      {eventDates
        ? (
          <div
            className='inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded text-[10px] font-semibold'
            style={{ color: typeColor, background: `rgb(${red} ${green} ${blue} / 0.14)`, border: `1px solid rgb(${red} ${green} ${blue} / 0.4)` }}
          >
            <Calendar className='w-2.5 h-2.5 shrink-0' />
            {eventDates}
          </div>
          )
        : (
          <div className='flex items-center gap-3 mt-1.5 text-[10px] font-semibold text-foreground/50 empty:hidden'>
            {post.commentersTotal > 0 && (
              <span className='inline-flex items-center gap-1'><MessageCircle className='w-3 h-3' />{post.commentersTotal}</span>
            )}
            {reactionsTotal > 0 && (
              <span className='inline-flex items-center gap-1'><Heart className='w-3 h-3' />{reactionsTotal}</span>
            )}
            {topicName && <span className='text-focus'>#{topicName}</span>}
          </div>
          )}
    </Link>
  )
}

function MapDrawer ({
  changeChildPostInclusion,
  childPostInclusion,
  context,
  currentUser,
  fetchPostsForDrawer,
  filters,
  group,
  groups = [],
  members = [],
  numFetchedPosts,
  numTotalPosts,
  onClose,
  onUpdateFilters = (opts) => console.log('Updating filters with:') + ' ' + opts,
  pendingPostsDrawer,
  posts = [],
  queryParams = {},
  routeParams = {},
  topics = []
}) {
  const { sortBy } = filters
  const { t } = useTranslation()
  const searchText = filters.search

  const { hideNavLayout } = useLayoutFlags()
  const withoutNav = isLegacyWebView() || hideNavLayout
  const [search, setSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [lens, setLens] = useState('all')

  const spaces = groups.filter(g => g.type === 'space')
  const properGroups = groups.filter(g => g.type !== 'space')
  const showPeople = context !== 'public'

  // Result-type tabs collapsed into one lens dropdown, per the design
  const lenses = [
    { id: 'all', label: t('All'), icon: Layers, count: numTotalPosts + groups.length + (showPeople ? members.length : 0) },
    { id: 'posts', label: t('Posts'), icon: FileText, count: numTotalPosts },
    { id: 'spaces', label: t('Spaces'), icon: LayoutGrid, count: spaces.length },
    { id: 'groups', label: t('Groups'), icon: Network, count: properGroups.length },
    ...(showPeople ? [{ id: 'people', label: t('People'), icon: Users, count: members.length }] : [])
  ]
  const currentLens = lenses.find(l => l.id === lens) || lenses[0]
  const showPosts = lens === 'all' || lens === 'posts'

  const filterByTopic = (topic) => {
    const newFilterTopics = filters.topics.concat(topic)
    onUpdateFilters({ topics: newFilterTopics })
  }

  const removeTopicFilter = (topic) => (e) => {
    const newFilterTopics = filters.topics.filter(t => t.name !== topic.name)
    onUpdateFilters({ topics: newFilterTopics })
  }

  // Don't show topics we are already filtering by in searches
  const searchTopics = topics.filter(topic => !filters.topics.find(t => t.name === topic.name))

  const handleChildPostInclusion = () => {
    const updatedValue = childPostInclusion === 'yes' ? 'no' : 'yes'
    changeChildPostInclusion(updatedValue)
  }

  return (
    <div className={cn('h-full flex flex-col overflow-x-visible overflow-y-hidden min-w-[330px] w-[40%] max-w-[400px] z-20 bg-background', styles.container, { [styles.noUser]: !currentUser, [styles.withoutNav]: withoutNav })} data-testid='map-drawer' id='map-drawer'>
      <div className='relative shrink-0 flex flex-col gap-2 p-3 pb-2.5'>
        <div className='flex items-center gap-2'>
          {/* Plain X — the one obvious way out of the drawer */}
          <button
            type='button'
            onClick={onClose}
            aria-label={t('Close Drawer')}
            data-testid='map-drawer-close'
            className='w-9 h-9 rounded-md bg-background border-2 border-foreground/20 text-foreground/70 hover:text-foreground hover:border-foreground/50 grid place-items-center shrink-0 transition-all'
          >
            <X className='w-3.5 h-3.5' />
          </button>
          <input
            className='bg-input rounded-md text-base h-9 text-foreground placeholder-foreground/40 flex-1 min-w-0 px-2 py-0 mb-0 transition-all outline-none border-2 border-foreground/20 hover:border-foreground/50 focus:border-focus'
            type='text'
            onChange={e => setSearch(e.target.value)}
            onFocus={e => setIsSearching(true)}
            onBlur={e => setIsSearching(false)}
            onKeyUp={e => {
              if (e.keyCode === 13) {
                setSearch('')
                setIsSearching(false)
                onUpdateFilters({ search: e.target.value })
                e.target.blur()
              }
            }}
            placeholder={t('Filter by topics and keywords')}
            value={search}
          />
        </div>

        {isSearching && (
          <div className={styles.searchFilters}>
            {searchTopics.slice(0, 10).map(topic => (
              <span
                key={'choose_topic_' + topic.name}
                onMouseDown={(e) => { filterByTopic(topic) }}
                className={styles.topicButton}
              >
                <span className={styles.topicCount}>{topic.count}</span> {topic.name}
              </span>
            ))}
          </div>
        )}

        {(searchText || filters.topics.length > 0) && (
          <div className='flex flex-wrap items-center gap-1.5'>
            {searchText && (
              <div
                className={styles.currentSearchText}
                onClick={() => onUpdateFilters({ search: '' })}
              >
                &quot;{searchText}&quot; <Icon name='Ex' className={styles.textEx} />
              </div>
            )}
            {filters.topics.map(topic => (
              <span
                key={'filter_topic_' + topic.name}
                onClick={removeTopicFilter(topic)}
                className={styles.topicButton}
              >
                <span className={styles.topicCount}>{topic.count}</span> #{topic.name} <Icon name='Ex' className={styles.filterEx} />
              </span>
            ))}
          </div>
        )}

        <div className='flex items-center gap-2'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type='button'
                className='inline-flex items-center gap-1.5 h-7 pl-2 pr-1.5 rounded-md bg-background border-2 border-foreground/20 text-foreground/90 hover:text-foreground hover:border-foreground/50 transition-all'
                data-testid='map-lens-dropdown'
              >
                <currentLens.icon className='w-3.5 h-3.5' />
                <span className='text-[11.5px] font-bold'>{currentLens.label}</span>
                <span className='text-[11px] font-bold text-foreground/50 tabular-nums'>{currentLens.count}</span>
                <ChevronDown className='w-3 h-3 text-foreground/50' />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='min-w-[184px]'>
              <DropdownMenuLabel className='text-[9.5px] font-bold uppercase tracking-widest text-foreground/50'>{t('Show on map')}</DropdownMenuLabel>
              {lenses.map(l => (
                <DropdownMenuItem key={l.id} onClick={() => setLens(l.id)} className='flex items-center gap-2.5'>
                  <l.icon className='w-4 h-4 text-foreground/60' />
                  <span className='flex-1 text-sm font-semibold'>{l.label}</span>
                  <span className='text-xs font-bold text-foreground/50 tabular-nums'>{l.count}</span>
                  <span className='w-3.5 flex justify-center'>{l.id === lens && <Check className='w-3.5 h-3.5' />}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className='ml-auto flex items-center gap-1.5'>
            {![CONTEXT_MY, 'all', 'public'].includes(context) && (
              <>
                <button
                  type='button'
                  onClick={handleChildPostInclusion}
                  data-tooltip-content={childPostInclusion === 'yes' ? t('Hide posts from child groups and spaces') : t('Show posts from child groups and spaces')}
                  data-tooltip-id='childgroup-toggle-tt'
                  className={cn(
                    'w-7 h-7 rounded-md border-2 grid place-items-center transition-all',
                    childPostInclusion === 'yes'
                      ? 'bg-selected/20 border-selected text-foreground'
                      : 'bg-background border-foreground/20 text-foreground/50 hover:text-foreground hover:border-foreground/50'
                  )}
                >
                  <Icon name='Subgroup' />
                </button>
                <Tooltip delay={250} id='childgroup-toggle-tt' position='bottom' />
              </>
            )}
            <Dropdown
              id='map-drawer-sort-dropdown'
              alignRight
              toggleChildren={
                <span className='inline-flex items-center gap-1 h-7 px-2 rounded-md bg-background border-2 border-foreground/20 text-[11.5px] font-semibold text-foreground/80 hover:text-foreground hover:border-foreground/50 transition-all whitespace-nowrap'>
                  {t(STREAM_SORT_OPTIONS.find(o => o.id === sortBy).label)}
                  <ChevronDown className='w-3 h-3 text-foreground/50' />
                </span>
              }
              items={STREAM_SORT_OPTIONS.map(({ id, label }) => ({
                label: t(label),
                onClick: () => onUpdateFilters({ sortBy: id })
              }))}
            />
          </div>
        </div>
      </div>

      <div id='mapDrawerWrapper' className='flex-1 min-h-0 w-full bg-midground overflow-y-auto overflow-x-visible'>
        <div className='flex flex-col gap-2.5 p-3 pb-10' id='contentList'>
          {pendingPostsDrawer && showPosts && <Loading size={24} />}
          {showPosts && posts.map(p => (
            <MapPostRow key={p.id} post={p} routeParams={routeParams} />
          ))}
          {(lens === 'all' || lens === 'spaces') && spaces.map(s => (
            <SpaceMapCard
              key={s.id}
              space={s}
              parentSlug={s.parentGroup?.slug || (s.parentId === group?.id ? group?.slug : null)}
            />
          ))}
          {(lens === 'all' || lens === 'groups') && properGroups.map(g => (
            <MapGroupCard key={g.id} group={g} routeParams={routeParams} />
          ))}
          {showPeople && (lens === 'all' || lens === 'people') && members.length > 0 && (
            <div className='flex flex-col rounded-xl bg-card overflow-hidden'>
              {members.map(m => (
                <Member layout='row' member={m} key={m.id} group={group} context={context} />
              ))}
            </div>
          )}
        </div>
        {showPosts && <ScrollListener onBottom={() => fetchPostsForDrawer(numFetchedPosts, false)} elementId='mapDrawerWrapper' />}
      </div>
    </div>
  )
}

MapDrawer.propTypes = {
  groups: PropTypes.array,
  members: PropTypes.array,
  posts: PropTypes.array,
  queryParams: PropTypes.object,
  routeParams: PropTypes.object,
  onClose: PropTypes.func,
  onUpdateFilters: PropTypes.func
}

export default MapDrawer
