import { isEmpty, orderBy } from 'lodash/fp'
import React, { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams, useNavigate } from 'react-router-dom'
import Icon from 'components/Icon'
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
    <div className='bg-background h-full flex flex-col flex-wrap overflow-visible w-[320px]'>
      <div className={classes.header}>
        <div className={classes.search}>
          <div className={classes.searchIcon}>
            <Icon name='Search' />
          </div>
          <TextInput
            placeholder={t('Search messages...')}
            value={threadSearch}
            onChange={onSearchChange}
            noClearButton
          />
        </div>
        <Link className={classes.newMessage} to='/messages/new'>
          <span>{t('New')}</span>
          <Icon name='Messages' className={classes.messagesIcon} />
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
          <div className={classes.noConversations}>{t('You have no active messages')}</div>}
        {!threadsPending && isEmpty(threads) && threadSearch &&
          <div className={classes.noConversations}>{t('No messages found')}</div>}
      </ul>
      <ScrollListener
        elementId='thread-list-list'
        onBottom={fetchMoreThreadsAction}
      />
    </div>
  )
}

export default ThreadList
