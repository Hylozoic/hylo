import { MessageCircle, Search, Users, X } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import Avatar from 'components/Avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import useRouteParams from 'hooks/useRouteParams'
import {
  FETCH_MEMBERS,
  fetchMembers,
  getHasMoreMembers,
  getMemberQueryProps,
  getMembers
} from 'routes/Members/Members.store'
import { messagePersonUrl, personUrl } from '@hylo/navigation'
import { cn } from 'util/index'

// "Recently active" for the online dot — inside this window someone is treated
// as present. lastActiveAt updates on page loads rather than heartbeats, so a
// tight window would flicker people offline mid-session.
const RECENTLY_ACTIVE_MS = 15 * 60 * 1000

function isRecentlyActive (person, now) {
  if (!person?.lastActiveAt) return false
  return now - new Date(person.lastActiveAt).getTime() < RECENTLY_ACTIVE_MS
}

/**
 * The chat room's member affordance, from the prototype's BDChatScreen: a pill in
 * the top right (member icon, count, and a green dot when anyone is recently
 * active) opening a panel that slides in over the chat — search on top, rows
 * ordered by name, each opening the member's profile, with a DM shortcut.
 * Mounts inside the chat's relative container; the overlay and panel are
 * absolute within it, so the chat pane is covered but the sidebar is not.
 */
export default function ChatMembersPanel ({ group }) {
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

  // First page up front so the pill's online dot has data before the panel opens;
  // refetched when the search term settles
  useEffect(() => { fetchPage(0) }, [fetchPage])

  // One clock reading per render pass, not per row
  const now = Date.now()
  const anyOnline = useMemo(() => members.some(m => isRecentlyActive(m, now)), [members, now])

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

  // Focus search as the panel arrives
  useEffect(() => {
    if (open) searchInputRef.current?.focus()
  }, [open])

  if (!group) return null

  return (
    <>
      {/* The pill */}
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='absolute top-2 right-2 z-30 inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-md bg-card/90 backdrop-blur-sm border border-foreground/20 text-foreground text-xs font-semibold cursor-pointer transition-all hover:border-foreground/40 hover:scale-105'
        aria-label={t('Members')}
      >
        <Users className='w-3.5 h-3.5' />
        {group.memberCount != null && <span>{group.memberCount}</span>}
        {anyOnline && <span className='w-[7px] h-[7px] rounded-full bg-green-500' aria-hidden='true' />}
      </button>

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
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full'
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
                    className='shrink-0 w-7 h-7 grid place-items-center rounded-md text-foreground/50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground hover:bg-foreground/10 transition-all'
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
