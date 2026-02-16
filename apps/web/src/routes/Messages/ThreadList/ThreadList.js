import { isEmpty, orderBy } from 'lodash/fp'
import { SquarePen, Search, SearchX } from 'lucide-react'
import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams, useNavigate } from 'react-router-dom'
import ScrollListener from 'components/ScrollListener'
import { toRefArray, itemsToArray } from 'util/reduxOrmMigration'
import fetchThreads from 'store/actions/fetchThreads'
import getMe from 'store/selectors/getMe'
import isPendingFor from 'store/selectors/isPendingFor'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import {
  setThreadSearch,
  getThreadSearch,
  getThreads,
  getThreadsHasMore
} from '../Messages.store'

import Loading from 'components/Loading'
import ThreadListItem from './ThreadListItem'
import { cn } from 'util/index'

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

  const threads = useSelector(state => getThreads(state))
  const threadsPending = useSelector(state => isPendingFor(fetchThreads, state))
  const hasMoreThreads = useSelector(state => getThreadsHasMore(state))
  const threadSearch = useSelector(state => getThreadSearch(state))

  const fetchMoreThreadsAction = useCallback(() => hasMoreThreads && dispatch(fetchThreads(20, threads.length)), [hasMoreThreads])
  const setThreadSearchAction = useCallback((search) => dispatch(setThreadSearch(search)), [])

  const toggleNavMenuAction = useCallback(() => dispatch(toggleNavMenu()), [])

  const onSearchChange = event => {
    const searchTerm = event.target.value
    setThreadSearchAction(searchTerm)
  }

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
    dispatch(fetchThreads(20, 0)).then((response) => {
      if (!messageThreadId) {
        const firstThread = response.payload.data?.me?.messageThreads?.items[0]
        if (firstThread) {
          navigate(`/messages/${firstThread.id}`, { replace: true })
        }
      }
    })
  }, [])

  const displayThreads = useMemo(() => {
    if (!threadSearch) return threads
    const normalizedSearch = threadSearch.toLowerCase()
    return threads.filter(thread => {
      const participants = toRefArray(thread.participants || {})
      const participantMatch = participants.some(p =>
        (p.name || '').toLowerCase().includes(normalizedSearch)
      )
      const messages = itemsToArray(toRefArray(thread.messages))
      const messageMatch = messages.some(msg => {
        const messageContent = [
          msg.text,
          msg.content,
          msg.body,
          msg.message,
          msg.lastMessage,
          typeof msg === 'string' ? msg : null
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .replace(/<[^>]*>/g, '')
        return messageContent.includes(normalizedSearch)
      })
      return participantMatch || messageMatch
    })
  }, [threads, threadSearch])

  return (
    <div
      className={cn(
        'bg-background h-full flex flex-col flex-wrap overflow-visible w-full max-w-[320px] border-r-2 border-foreground/30'
      )}
      onClick={handleContainerClick}
    >
      <div className={cn(classes.header, 'flex items-center gap-3')}>
        <div className={cn('bg-darkening/20 p-2 relative border-2 transition-all border-transparent rounded flex items-center flex-1', { 'border-2 border-focus': isSearchFocused })}>
          <Search width={20} height={20} />
          <input
            ref={searchInputRef}
            type='text'
            placeholder={t('Search messages...')}
            value={threadSearch || ''}
            onChange={onSearchChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            className='bg-transparent border-foreground pl-2 text-foreground placeholder:text-foreground/50 outline-none border-none w-full'
          />
        </div>
        <Link className='bg-darkening/20 rounded-lg text-foreground flex justify-center items-center w-10 h-10 hover:bg-selected/100 scale-100 hover:scale-105 transition-all hover:text-foreground flex-shrink-0' to='/messages/new' onClick={toggleNavMenuAction}>
          <SquarePen />
        </Link>
      </div>
      <ul className={classes.list} id='thread-list-list' role='list'>
        {!isEmpty(displayThreads) && displayThreads.map(t => {
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
            />
          )
        })}
        {threadsPending &&
          <Loading type='bottom' />}
        {!threadsPending && isEmpty(displayThreads) && !threadSearch &&
          <div className={classes.noConversations}>
            {t('You have no active messages!')}
            <Link to='/messages/new' onClick={toggleNavMenuAction}>{t('Send a message')}</Link>
            {t('to get started.')}
          </div>}
        {!threadsPending && isEmpty(displayThreads) && threadSearch &&
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
