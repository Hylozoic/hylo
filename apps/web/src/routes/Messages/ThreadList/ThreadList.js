import { isEmpty, orderBy } from 'lodash/fp'
import { SquarePen, Search, SearchX } from 'lucide-react'
import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams, useNavigate } from 'react-router-dom'
import TextInput from 'components/TextInput'
import ScrollListener from 'components/ScrollListener'
import { toRefArray, itemsToArray } from 'util/reduxOrmMigration'
import fetchThreads from 'store/actions/fetchThreads'
import getMe from 'store/selectors/getMe'
import isPendingFor from 'store/selectors/isPendingFor'
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

  const onSearchChange = event => setThreadSearchAction(event.target.value)

  const handleContainerClick = (e) => {
    // Don't focus if clicking on a link or button
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
    dispatch(fetchThreads(20, 0)).then(() => {
      if (!messageThreadId) {
        const firstThread = threads[0]
        if (firstThread) {
          navigate(`/messages/${firstThread.id}`, { replace: true })
        }
      }
    })
  }, [])

  return (
    <div 
      className={cn(
        'bg-background h-full flex flex-col flex-wrap overflow-visible w-[320px]'
      )}
      onClick={handleContainerClick}
    >
      <div className={classes.header}>
        <div className={cn('bg-black/20 p-2 relative border-2 transition-all border-transparent rounded flex items-center', { 'border-2 border-focus': isSearchFocused })}>
          <div className='absolute left-1 top-1'>
            <Search />
          </div>
          <TextInput
            ref={searchInputRef}
            placeholder={t('Search messages...')}
            value={threadSearch}
            onChange={onSearchChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            className='text-foreground'
            inputClassName='bg-transparent border-foreground pl-6 text-foreground placeholder:text-foreground/50 outline-none border-none'
            noClearButton
          />
        </div>
        <Link className='bg-black/20 rounded-lg text-foreground flex justify-center items-center w-10 h-10 hover:bg-selected/100 scale-100 hover:scale-105 transition-all hover:text-foreground' to='/messages/new'>
          <SquarePen />
        </Link>
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
            />
          )
        })}
        {threadsPending &&
          <Loading type='bottom' />}
        {!threadsPending && isEmpty(threads) && !threadSearch &&
          <div className={classes.noConversations}>
            {t('You have no active messages!')}
            <Link to='/messages/new'>{t('Send a message')}</Link>
            {t('to get started.')}
          </div>}
        {!threadsPending && isEmpty(threads) && threadSearch &&
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
