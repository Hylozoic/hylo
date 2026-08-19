import { MessageCircle, Search, Users, X } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import Avatar from 'components/Avatar'
import CurrentlyActivePills, { DEFAULT_ACTIVE_MAX, isRecentlyActive } from 'components/CurrentlyActiveMembers/CurrentlyActivePills'
import { getPeopleTyping } from 'components/PeopleTyping/PeopleTyping.store'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import useRouteParams from 'hooks/useRouteParams'
import { isMobileDevice } from 'util/mobile'
import { cn } from 'util/index'
import {
  FETCH_MEMBERS,
  fetchMembers,
  fetchRecentlyActiveMembers,
  getHasMoreMembers,
  getMemberQueryProps,
  getMembers,
  getRecentlyActiveMembers
} from 'routes/Members/Members.store'
import { messagePersonUrl, personUrl } from '@hylo/navigation'
import getMe from 'store/selectors/getMe'
import { getRoomPresence } from './RoomPresence.store'

/**
 * The chat room's member affordance, from the prototype's BDChatScreen: a pill in
 * the top right (member icon, count, and a green dot when anyone is recently
 * active) opening a panel that slides in over the chat — search on top, rows
 * ordered by name, each opening the member's profile, with a DM shortcut.
 * Mounts inside the chat's relative container; the overlay and panel are
 * absolute within it, so the chat pane is covered but the sidebar is not.
 */
export default function ChatMembersPanel ({ group, latestPost }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const routeParams = useRouteParams()

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchInputRef = useRef(null)

  const slug = group?.slug

  // Debounce typed search into the fetch term
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const fetchParams = useMemo(
    () => getMemberQueryProps({ slug, search: debouncedSearch || undefined, sortBy: 'name', groupRoleId: null }),
    [slug, debouncedSearch]
  )
  const members = useSelector(state => getMembers(state, fetchParams))
  const hasMore = useSelector(state => getHasMoreMembers(state, fetchParams))
  const pending = useSelector(state => state.pending[FETCH_MEMBERS])

  const fetchPage = useCallback((offset = 0) => {
    if (!slug || !group?.id) return
    dispatch(fetchMembers({ slug, groupId: group.id, sortBy: 'name', offset, search: debouncedSearch || undefined, groupRoleId: null }))
  }, [dispatch, slug, group?.id, debouncedSearch])

  // Directory page for the drawer; the presence strip uses a separate lean fetch.
  // Refetched when the search term settles.
  useEffect(() => { fetchPage(0) }, [fetchPage])

  // ─── Currently-active strip ────────────────────────────────────────────────
  // Seeded from the most recently active members, then reordered live: someone
  // typing or posting jumps to the front and the last avatar falls off.

  const activityMembers = useSelector(state => getRecentlyActiveMembers(state, { slug, first: DEFAULT_ACTIVE_MAX }))

  useEffect(() => {
    if (slug) {
      dispatch(fetchRecentlyActiveMembers({ slug, first: DEFAULT_ACTIVE_MAX }))
    }
  }, [dispatch, slug])

  const [activeIds, setActiveIds] = useState([])
  // Names/avatars learned from live events for people outside the fetched pages
  const extraInfoRef = useRef({})

  // A new room starts its strip from scratch
  useEffect(() => { setActiveIds([]) }, [slug])

  const promote = useCallback((entries) => {
    const valid = entries.filter(e => e?.id)
    if (!valid.length) return
    valid.forEach(e => {
      const key = String(e.id)
      extraInfoRef.current[key] = { ...extraInfoRef.current[key], ...e }
    })
    setActiveIds(prev => {
      const ids = valid.map(e => String(e.id))
      const rest = prev.filter(id => !ids.includes(id))
      const next = [...ids, ...rest].slice(0, DEFAULT_ACTIVE_MAX)
      return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next
    })
  }, [])

  // One clock reading per render pass, not per row
  const now = Date.now()

  // Seed from the last-active fetch. Merge with anyone already promoted by
  // typing/presence so a live roster that arrives first cannot block the pills.
  const seedIdsKey = useMemo(
    () => activityMembers.slice(0, DEFAULT_ACTIVE_MAX).map(m => String(m.id)).join(','),
    [activityMembers]
  )
  useEffect(() => {
    if (!seedIdsKey) return
    const seeded = seedIdsKey.split(',')
    setActiveIds(prev => {
      if (prev.length === 0) return seeded
      const have = new Set(prev)
      const rest = seeded.filter(id => !have.has(id))
      if (!rest.length) return prev
      return [...prev, ...rest].slice(0, DEFAULT_ACTIVE_MAX)
    })
  }, [seedIdsKey])

  // Typing promotes to the front — and marks the avatar with the pulse
  const peopleTyping = useSelector(getPeopleTyping)
  const typingIds = useMemo(() => Object.keys(peopleTyping || {}).map(String), [peopleTyping])
  useEffect(() => {
    const entries = Object.entries(peopleTyping || {}).map(([id, v]) => ({ id, name: v?.name }))
    if (entries.length) promote(entries)
  }, [typingIds.join(','), promote])

  // So does a message arriving
  useEffect(() => {
    const creator = latestPost?.creator
    if (creator?.id) promote([{ id: creator.id, name: creator.name, avatarUrl: creator.avatarUrl }])
  }, [latestPost?.id])

  // Parent roster stands in for the space: anyone in the parent group sees
  // this space's posts live, so they count as present here too.
  const presenceMap = useSelector(state => getRoomPresence(state, group?.id, group?.parentId))
  const presentIdsKey = useMemo(() => Object.keys(presenceMap).sort().join(','), [presenceMap])
  const prevPresentRef = useRef([])
  useEffect(() => {
    const present = Object.keys(presenceMap)
    const prev = prevPresentRef.current
    prevPresentRef.current = present
    const arrivals = present.filter(id => !prev.includes(id))
    if (arrivals.length) promote(arrivals.map(id => ({ id, ...presenceMap[id] })))
    const departures = prev.filter(id => !present.includes(id))
    if (departures.length) setActiveIds(cur => cur.filter(id => !departures.includes(id)))
  }, [presentIdsKey])

  const memberIndex = useMemo(() => {
    const map = {}
    ;[...activityMembers, ...members].forEach(m => { map[String(m.id)] = m })
    return map
  }, [activityMembers, members])

  const currentUser = useSelector(getMe)

  // Same people as the menu strip (most recently active). Typing and presence
  // decorate the avatars; they are not a gate. Requiring the socket roster
  // hid the pills when you were alone or presence had not arrived yet.
  const activeMembers = useMemo(
    () => activeIds
      .map(id => memberIndex[id] || extraInfoRef.current[id] || presenceMap[String(id)])
      .filter(Boolean),
    [activeIds, memberIndex, presenceMap]
  )

  // Green dot on the count pill: someone else is on the live roster
  const anyOnline = useMemo(
    () => Object.keys(presenceMap).some(id => String(id) !== String(currentUser?.id)),
    [presentIdsKey, currentUser?.id]
  )

  const handleScroll = useCallback((e) => {
    if (!hasMore || pending) return
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 120) fetchPage(members.length)
  }, [hasMore, pending, fetchPage, members.length])

  const close = useCallback(() => {
    setOpen(false)
    setSearch('')
  }, [])

  const openProfile = useCallback((person) => {
    close()
    navigate(personUrl(person.id, routeParams.groupSlug))
  }, [close, navigate, routeParams.groupSlug])

  const openDM = useCallback((e, person) => {
    e.stopPropagation()
    close()
    navigate(messagePersonUrl(person))
  }, [close, navigate])

  // Close on Escape while open
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  // Focus search as the panel arrives — desktop only: on a phone autofocus
  // throws the keyboard over the list you just asked to see
  useEffect(() => {
    if (open && !isMobileDevice()) searchInputRef.current?.focus()
  }, [open])

  if (!group) return null

  return (
    <>
      <div className='absolute top-2 right-2 z-30 flex items-center gap-2'>
        {/* Currently active — newest activity on the left, typer pulses and takes the top */}
        {activeMembers.length > 0 && (
          <CurrentlyActivePills
            members={activeMembers}
            max={DEFAULT_ACTIVE_MAX}
            onPersonClick={openProfile}
            typingIds={typingIds}
            presenceMap={presenceMap}
          />
        )}

        {/* The pill */}
        <button
          type='button'
          onClick={() => setOpen(true)}
          className='inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-md bg-card/90 backdrop-blur-sm border border-foreground/20 text-foreground text-xs font-semibold cursor-pointer transition-all hover:border-foreground/40 hover:scale-105'
          aria-label={t('Members')}
        >
          <Users className='w-3.5 h-3.5' />
          {group.memberCount != null && <span>{group.memberCount}</span>}
          {anyOnline && <span className='w-[7px] h-[7px] rounded-full bg-green-500' aria-hidden='true' />}
        </button>
      </div>

      {/* Cover over the chat */}
      <div
        onClick={close}
        aria-hidden='true'
        className={cn(
          'absolute inset-0 z-40 bg-black/35 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      />

      {/* The panel */}
      <div
        role='dialog'
        aria-label={t('Members')}
        className={cn(
          'absolute top-0 right-0 bottom-0 z-40 w-[300px] max-w-[85%] bg-background border-l-2 border-foreground/10 flex flex-col overflow-hidden shadow-2xl',
          // Visibility rides the transition: iOS Safari lets a composited transform
          // escape the ancestor's overflow clip, so a merely-translated panel could
          // be swiped into view — hidden after the slide-out, it cannot be.
          'transition-[transform,visibility] duration-300 ease-out',
          open
            ? 'translate-x-0 visible'
            : 'translate-x-full invisible [transition-delay:0s,300ms]'
        )}
      >
        <div className='flex items-center justify-between px-4 pt-3.5 pb-2.5'>
          <span className='text-sm font-bold text-foreground'>{t('Members')}</span>
          <button
            type='button'
            onClick={close}
            className='w-7 h-7 grid place-items-center rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-colors'
            aria-label={t('Close')}
          >
            <X className='w-4 h-4' />
          </button>
        </div>

        <div className='px-4 pb-3'>
          <div className='flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-input border border-foreground/20 focus-within:border-foreground/40 transition-colors'>
            <Search className='w-3.5 h-3.5 shrink-0 text-foreground/50' />
            <input
              ref={searchInputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('Search members')}
              className='flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-foreground/40'
            />
          </div>
        </div>

        <div className='flex-1 overflow-y-auto px-2 pb-3' onScroll={handleScroll}>
          {members.map(person => (
            <div
              key={person.id}
              role='button'
              tabIndex={0}
              onClick={() => openProfile(person)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openProfile(person)
                }
              }}
              className='group w-full flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-foreground/10 transition-colors text-left'
            >
              <div className='relative shrink-0'>
                <Avatar avatarUrl={person.avatarUrl} small />
                {isRecentlyActive(person, now) && (
                  <span className='absolute -bottom-px -right-px w-[9px] h-[9px] rounded-full bg-green-500 border-2 border-background' aria-hidden='true' />
                )}
              </div>
              <div className='min-w-0 flex-1'>
                <div className='text-sm font-bold text-foreground truncate'>{person.name}</div>
                {(person.tagline || person.location) && (
                  <div className='text-xs text-foreground/50 truncate'>{person.tagline || person.location}</div>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type='button'
                    onClick={(e) => openDM(e, person)}
                    // Hidden-until-hover only where hover exists — on touch there is
                    // no hover to reveal it, so the button stays visible
                    className='shrink-0 w-7 h-7 grid place-items-center rounded-md text-foreground/50 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:!opacity-100 hover:text-foreground hover:bg-foreground/10 transition-all'
                    aria-label={t('Message Member')}
                  >
                    <MessageCircle className='w-4 h-4' />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('Message Member')}</TooltipContent>
              </Tooltip>
            </div>
          ))}
          {members.length === 0 && !pending && (
            <p className='text-sm text-foreground/40 text-center mt-6'>{t('No results for this search')}</p>
          )}
        </div>
      </div>
    </>
  )
}
