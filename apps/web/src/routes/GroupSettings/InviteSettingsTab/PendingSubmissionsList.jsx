import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { TextHelpers } from '@hylo/shared'
import Avatar from 'components/Avatar'
import {
  cancelInvitationSubmission,
  fetchInvitationSubmissions
} from './InviteSettingsTab.store'

/**
 * "Your pending invites" for someone with limited invite access: every address they typed
 * and every person they picked, with when they did, shown the same way whether or not an
 * invitation went out. Cancel takes a row off the list (and cancels its invitation, if any).
 * reloadKey changes after each send so the list shows what was just submitted. Rows load a
 * page at a time, with "Show more" for older ones.
 */
export default function PendingSubmissionsList ({ groupId, reloadKey }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const [items, setItems] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchPage = useCallback(async offset => {
    const result = await dispatch(fetchInvitationSubmissions(groupId, { offset }))
    return result?.payload?.data?.group?.myInvitationSubmissions
  }, [dispatch, groupId])

  // A failed load leaves the list as it was
  const load = useCallback(async () => {
    try {
      const page = await fetchPage(0)
      if (page?.items) {
        setItems(page.items)
        setHasMore(!!page.hasMore)
      }
    } catch {}
  }, [fetchPage])

  // Cancelled rows are gone on the server too, so the rows shown are the offset of the next page
  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    try {
      const page = await fetchPage(items.length)
      if (page?.items) {
        setItems(previous => [...previous, ...page.items.filter(item => !previous.some(shown => shown.id === item.id))])
        setHasMore(!!page.hasMore)
      }
    } catch {} finally {
      setLoadingMore(false)
    }
  }, [fetchPage, items.length])

  useEffect(() => {
    if (groupId) load()
  }, [groupId, load, reloadKey])

  const cancel = useCallback(async id => {
    setItems(previous => previous.filter(item => item.id !== id))
    try {
      await dispatch(cancelInvitationSubmission(id))
    } catch {
      load()
    }
  }, [dispatch, load])

  if (items.length === 0) return null

  return (
    <div className='border-2 mt-2 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex flex-col gap-2'>
      <h2 className='text-lg font-bold mt-0 mb-1 text-foreground'>{t('Your pending invites')}</h2>
      <ul className='flex flex-col gap-1 list-none p-0 m-0'>
        {items.map(item => (
          <li className='w-full flex items-center justify-between gap-2 bg-card rounded-lg px-2 py-1.5' key={item.id}>
            {item.person && <Avatar avatarUrl={item.person.avatarUrl} small className='shrink-0' />}
            <div className='flex-1 min-w-0'>
              <span className='block truncate'>{item.person ? item.person.name : item.email}</span>
              <span className='text-foreground-muted text-sm'>{TextHelpers.humanDate(item.createdAt)}</span>
            </div>
            <button
              type='button'
              className='shrink-0 bg-foreground/10 rounded-lg p-1 hover:bg-selected/50 transition-all'
              onClick={() => cancel(item.id)}
            >
              {t('Cancel')}
            </button>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type='button'
          className='self-center bg-foreground/10 rounded-lg px-3 py-1 hover:bg-selected/50 transition-all disabled:opacity-50'
          onClick={loadMore}
          disabled={loadingMore}
        >
          {t('Show more')}
        </button>
      )}
    </div>
  )
}

PendingSubmissionsList.propTypes = {
  groupId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  reloadKey: PropTypes.number
}
