import { isEmpty, orderBy } from 'lodash/fp'
import { CircleOff, SquarePen, Search, SearchX, X } from 'lucide-react'
import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams, useNavigate } from 'react-router-dom'
import ScrollListener from 'components/ScrollListener'
import { toRefArray, itemsToArray } from 'util/reduxOrmMigration'
import fetchThreads from 'store/actions/fetchThreads'
import getMe from 'store/selectors/getMe'
import isPendingFor from 'store/selectors/isPendingFor'
import useDebounce from 'hooks/useDebounce'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import getPreviousLocation from 'store/selectors/getPreviousLocation'
import {
  setThreadSearch,
  getThreadSearch,
  getThreads,
  getThreadsHasMore,
  getThreadTab,
  setThreadTab,
  THREAD_TAB_INBOX,
  THREAD_TAB_MUTED
} from '../Messages.store'

import Loading from 'components/Loading'
import ThreadListItem from './ThreadListItem'
import { cn } from 'util/index'
import { isPhoneDevice } from 'util/mobile'

import classes from './ThreadList.module.scss'

function ThreadList () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const searchInputRef = useRef(null)
  const currentUser = useSelector(getMe)
  const routeParams = useParams()
  const navigate = useNavigate()
  const { messageThreadId } = routeParams

  const previousLocation = useSelector(getPreviousLocation)
  // Where the X returns to: wherever the user was when they entered Messages.
  // Captured once on mount so navigating between threads doesn't retarget it.
  // previousLocation is a history location object, not a path string.
  const previousPath = previousLocation
    ? `${previousLocation.pathname || ''}${previousLocation.search || ''}`
    : ''
  const returnToRef = useRef(
    previousPath && !previousPath.startsWith('/messages') ? previousPath : '/'
  )
  const handleClose = () => navigate(returnToRef.current)

  const threads = useSelector(state => getThreads(state))
  const threadsPending = useSelector(state => isPendingFor(fetchThreads, state))
  const hasMoreThreads = useSelector(state => getThreadsHasMore(state))
  const threadSearch = useSelector(state => getThreadSearch(state))
  const threadTab = useSelector(getThreadTab)
  const isMutedTab = threadTab === THREAD_TAB_MUTED
  const [searchInput, setSearchInput] = useState(threadSearch || '')
  const debouncedSearch = useDebounce(searchInput, 300)

  const fetchThreadsAction = useCallback(
    (offset = 0) => dispatch(fetchThreads(20, offset, {
      muted: isMutedTab,
      search: debouncedSearch || undefined
    })),
    [debouncedSearch, dispatch, isMutedTab]
  )
  const fetchMoreThreadsAction = useCallback(
    () => hasMoreThreads && fetchThreadsAction(threads.length),
    [hasMoreThreads, threads.length, fetchThreadsAction]
  )
  const setThreadSearchAction = useCallback((search) => dispatch(setThreadSearch(search)), [dispatch])

  const toggleNavMenuAction = useCallback(() => dispatch(toggleNavMenu()), [])

  const onSearchChange = event => {
    setSearchInput(event.target.value)
  }

  useEffect(() => {
    setThreadSearchAction(debouncedSearch)
  }, [debouncedSearch, setThreadSearchAction])

  const handleContainerClick = (e) => {
    if (e.target.closest('a') || e.target.closest('button')) return
    searchInputRef.current?.focus()
  }

  const handleSearchFocus = () => {
    setIsSearchFocused(true)
  }

  const handleSearchBlur = () => {
    setIsSearchFocused(false)
  }

  useEffect(() => {
    fetchThreadsAction(0).then((response) => {
      if (!messageThreadId && !debouncedSearch && !isMutedTab) {
        const firstThread = response.payload.data?.me?.messageThreads?.items[0]
        if (firstThread) {
          // Desktop's split view wants a conversation showing; on a phone the
          // inbox itself is the screen, so opening one uninvited is jarring
          if (!isPhoneDevice()) {
            navigate(`/messages/${firstThread.id}`, { replace: true })
          }
        } else {
          // Nothing in the inbox: open the composer with the recipient picker
          // ready, so a first-time user can start a message immediately
          navigate('/messages/new', { replace: true })
        }
      }
    })
  }, [debouncedSearch, isMutedTab])

  const handleSelectInboxTab = () => dispatch(setThreadTab(THREAD_TAB_INBOX))
  const handleSelectMutedTab = () => dispatch(setThreadTab(THREAD_TAB_MUTED))

  return (
    <div
      className={cn(
        // Width comes from MessagesLayout's resizable wrapper on desktop.
        // Same ground as the group context menu, so the two sidebars match
        'bg-background bg-gradient-to-b from-context-menu-background to-theme-background/10 dark:to-theme-background/40 h-full flex flex-col flex-wrap overflow-hidden min-w-0 w-full'
      )}
      style={{ boxShadow: 'inset -15px 0 15px -10px hsl(var(--darkening) / 0.3)' }}
      onClick={handleContainerClick}
    >
      {/* Title row: X back to wherever the user came from, then New Message */}
      <div className='flex items-center gap-2 px-3 pt-3 pb-1'>
        <button
          type='button'
          onClick={handleClose}
          aria-label={t('Close')}
          title={t('Close')}
          className='w-8 h-8 grid place-items-center rounded-lg bg-darkening/20 text-foreground/70 hover:text-foreground hover:bg-darkening/40 transition-colors shrink-0'
        >
          <X className='w-4 h-4' />
        </button>
        <h2 className='flex-1 m-0 text-lg font-bold text-foreground truncate'>{t('Messages')}</h2>
        <Link
          className='w-8 h-8 grid place-items-center rounded-lg bg-selected text-white hover:text-white scale-100 hover:scale-105 transition-all flex-shrink-0'
          to='/messages/new'
          aria-label={t('New Message')}
          onClick={isPhoneDevice() ? toggleNavMenuAction : undefined}
        >
          <SquarePen className='w-4 h-4' />
        </Link>
      </div>
      {/* Search on its own row */}
      <div className='px-3 py-1'>
        <div className={cn('bg-darkening/20 p-2 relative border-2 transition-all border-transparent rounded flex items-center w-full', { 'border-2 border-focus': isSearchFocused })}>
          <Search width={18} height={18} />
          <input
            ref={searchInputRef}
            type='text'
            placeholder={t('Search messages...')}
            value={searchInput}
            onChange={onSearchChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            className='bg-transparent border-foreground pl-2 text-foreground placeholder:text-foreground/50 outline-none border-none w-full'
          />
        </div>
      </div>
      <div className='flex gap-1.5 px-3 py-1.5'>
        <button
          type='button'
          onClick={handleSelectInboxTab}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-semibold transition-all',
            !isMutedTab ? 'bg-selected text-foreground' : 'bg-darkening/20 text-foreground/70 hover:bg-selected/50'
          )}
        >
          {t('Inbox')}
        </button>
        <button
          type='button'
          onClick={handleSelectMutedTab}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-semibold transition-all',
            isMutedTab ? 'bg-selected text-foreground' : 'bg-darkening/20 text-foreground/70 hover:bg-selected/50'
          )}
        >
          {t('Muted')}
        </button>
      </div>
      <ul className={classes.list} id='thread-list-list' role='list'>
        {!isEmpty(threads) && threads.map(t => {
          const messages = itemsToArray(toRefArray(t.messages))
          const isUnread = t.unreadCount > 0
          const latestMessage = orderBy(m => Date.parse(m.createdAt), 'desc', messages)[0]

          return (
            <ThreadListItem
              id={t.id}
              active={t.id === messageThreadId}
              thread={t}
              latestMessage={latestMessage}
              currentUser={currentUser}
              unreadCount={t.unreadCount}
              key={`thread-li-${t.id}`}
              isUnread={isUnread}
              isMuted={isMutedTab}
            />
          )
        })}
        {threadsPending &&
          <Loading type='bottom' />}
        {!threadsPending && isEmpty(threads) && !searchInput && !isMutedTab &&
          <div className='text-center text-foreground/70 border-2 border-dashed border-foreground/20 rounded-lg m-4 p-4 flex flex-col items-center justify-center gap-2'>
            <CircleOff className='w-6 h-6' />
            <div>{t('No active messages')}</div>
          </div>}
        {!threadsPending && isEmpty(threads) && !searchInput && isMutedTab &&
          <div className='text-center text-foreground/70 border-2 border-dashed border-foreground/20 rounded-lg m-4 p-4 flex flex-col items-center justify-center gap-2'>
            <CircleOff className='w-6 h-6' />
            <div>{t('No muted conversations')}</div>
          </div>}
        {!threadsPending && isEmpty(threads) && searchInput &&
          <div className='text-center text-foreground border-2 border-dashed border-foreground/20 rounded-lg m-4 p-4 flex flex-col items-center justify-center'>
            <SearchX />
            <div>{t('No messages found')}</div>
          </div>}
      </ul>
      <ScrollListener
        elementId='thread-list-list'
        onBottom={fetchMoreThreadsAction}
      />
    </div>
  )
}

export default ThreadList
