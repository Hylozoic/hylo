import isMobile from 'ismobilejs'
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { isEmpty, some } from 'lodash/fp'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { newMessageUrl, messageThreadUrl } from '@hylo/navigation'
import Icon from 'components/Icon'
import { Popover, PopoverTrigger, PopoverContent } from 'components/ui/popover'
import MessagesDropdownItem from './MessagesDropdownItem'
import { isUnread, isUpdatedSince } from 'store/models/MessageThread'
import NoItems from 'routes/AuthLayoutRouter/components/GlobalNav/NoItems'
import LoadingItems from 'routes/AuthLayoutRouter/components/GlobalNav/LoadingItems'
import fetchThreads from 'store/actions/fetchThreads'
import { getThreads } from 'routes/Messages/Messages.store'
import getMe from 'store/selectors/getMe'
import { FETCH_THREADS } from 'store/constants'

const MessagesDropdown = ({
  renderToggleChildren,
  className
}) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [lastOpenedAt, setLastOpenedAt] = useState(null)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const currentUser = useSelector(state => getMe(state))
  const threads = useSelector(state => getThreads(state))
  const pending = useSelector(state => state.pending[FETCH_THREADS])

  useEffect(() => {
    dispatch(fetchThreads(10, 0))
  }, [dispatch])

  const handleOpenChange = isOpen => {
    if (isOpen) setLastOpenedAt(new Date())
    setModalOpen(isOpen)
  }

  const hasUnread = () => {
    if (isEmpty(threads)) {
      return currentUser && currentUser.unseenThreadCount > 0
    }

    return some(
      thread => isUnread(thread) && (!lastOpenedAt || isUpdatedSince(thread, lastOpenedAt)),
      threads
    )
  }

  const close = () => {
    setModalOpen(false)
  }

  const onClick = id => {
    if (id) navigate(messageThreadUrl(id))
    setModalOpen(false)
  }

  let body
  if (pending) {
    body = <LoadingItems />
  } else if (isEmpty(threads)) {
    body = <NoItems message={t("You don't have any messages yet")} />
  } else {
    body = (
      <div className='overflow-y-auto overflow-x-hidden h-[calc(100vh-100px)]'>
        {threads.map(thread =>
          <MessagesDropdownItem
            thread={thread}
            onClick={() => onClick(thread.id)}
            currentUser={currentUser}
            key={thread.id}
          />
        )}
      </div>
    )
  }

  const firstThreadUrl = !isEmpty(threads)
    ? isMobile.any ? '/messages' : messageThreadUrl(threads[0].id)
    : newMessageUrl()

  return (
    <Popover onOpenChange={handleOpenChange} open={modalOpen}>
      <PopoverTrigger>
        {renderToggleChildren(hasUnread())}
      </PopoverTrigger>
      <PopoverContent side='right' align='start' className='!p-0 !w-[340px]'>
        <div className='flex items-center w-full z-10 p-2 text-foreground'>
          <Link to={firstThreadUrl} className='flex items-center text-sm text-white bg-primary rounded-full px-4 py-2 shadow-md' onClick={close}>
            <Icon className='!text-sm text-white' name='ArrowForward' />
            <span className='text-sm ml-2'>{t('Open Messages')}</span>
          </Link>
          <Link to={newMessageUrl()} className='ml-auto text-foreground' onClick={close}>
            <Icon name='SmallEdit' className='!text-sm !text-foreground' />
            <span className='text-sm ml-2'>{t('New')}</span>
          </Link>
        </div>
        {body}
      </PopoverContent>
    </Popover>
  )
}

export default MessagesDropdown
