import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { groupUrl, personUrl } from '@hylo/navigation'
import Loading from 'components/Loading'
import Button from 'components/ui/button'
import { cn } from 'util/index'
import { fetchPublicListingRequests, reviewPublicListingRequest } from 'store/actions/publicListingRequests'

const STATUS_FILTERS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'denied', label: 'Denied' },
  { value: '', label: 'All' }
]

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied'
}

const STATUS_CLASSES = {
  pending: 'bg-accent/20 text-foreground',
  approved: 'bg-selected/30 text-foreground',
  denied: 'bg-foreground/10 text-foreground/70'
}

function formatDate (date) {
  return date ? new Date(date).toLocaleString() : ''
}

/**
 * Superadmin page to review groups' requests to be added to the commons
 * (allowInPublic: the public stream, Group Explorer and public map).
 */
export default function CommonsRequests () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [status, setStatus] = useState('pending')
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState({})
  const [reviewingId, setReviewingId] = useState(null)

  const loadRequests = useCallback(() => {
    setLoading(true)
    return dispatch(fetchPublicListingRequests(status)).then(result => {
      const items = result?.payload?.data?.publicListingRequests
      setGroups(Array.isArray(items) ? items : [])
    }).catch(() => {
      setGroups([])
    }).finally(() => setLoading(false))
  }, [dispatch, status])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const handleReview = useCallback(async (group, approved) => {
    setReviewingId(group.id)
    const onError = () => toast.error(t('Something went wrong saving the decision'))
    try {
      const result = await dispatch(reviewPublicListingRequest(group.id, approved, messages[group.id]))
      if (result?.error || !result?.payload?.data?.reviewPublicListingRequest) {
        onError()
        return
      }
      toast.success(approved
        ? t('{{name}} was added to the commons', { name: group.name })
        : t('{{name}} was not added to the commons', { name: group.name }))
      setMessages(m => ({ ...m, [group.id]: '' }))
      await loadRequests()
    } catch (e) {
      onError()
    } finally {
      setReviewingId(null)
    }
  }, [dispatch, loadRequests, messages, t])

  return (
    <div className='p-6 max-w-4xl mx-auto'>
      <h1 className='text-2xl font-bold mb-2'>{t('Commons Requests')}</h1>
      <p className='text-foreground/70 mb-6'>
        {t('Groups asking to be added to the commons: the public stream, Group Explorer and public map. Approving or denying emails the person who asked.')}
      </p>

      <div className='flex gap-2 mb-4' role='tablist'>
        {STATUS_FILTERS.map(filter => (
          <Button
            key={filter.value || 'all'}
            role='tab'
            aria-selected={status === filter.value}
            variant={status === filter.value ? 'default' : 'ghost'}
            size='sm'
            onClick={() => setStatus(filter.value)}
          >
            {t(filter.label)}
          </Button>
        ))}
      </div>

      {loading
        ? <Loading />
        : groups.length === 0
          ? <div className='text-foreground/50 p-4 border border-foreground/20 rounded-md'>{t('No requests.')}</div>
          : (
            <ul className='divide-y divide-foreground/10 border border-foreground/20 rounded-md' data-testid='commons-requests-list'>
              {groups.map(group => {
                const request = group.publicListingRequest || {}
                const isPending = request.status === 'pending'
                return (
                  <li key={group.id} className='p-4' data-testid='commons-request-row'>
                    <div className='flex items-start gap-3'>
                      <div
                        className='w-10 h-10 rounded-lg bg-cover bg-center shrink-0 bg-foreground/10'
                        style={group.avatarUrl ? { backgroundImage: `url(${group.avatarUrl})` } : undefined}
                      />
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <Link to={groupUrl(group.slug)} className='font-bold text-foreground hover:underline'>{group.name}</Link>
                          <span className={cn('text-xs rounded-full px-2 py-0.5', STATUS_CLASSES[request.status])}>
                            {t(STATUS_LABELS[request.status] || request.status)}
                          </span>
                        </div>
                        <p className='text-xs text-foreground/50 m-0 mt-1'>
                          {t('Requested {{date}}', { date: formatDate(request.requestedAt) })}
                          {request.requestedBy && (
                            <>
                              {` · ${t('by')} `}
                              <Link to={personUrl(request.requestedBy.id)} className='hover:underline'>{request.requestedBy.name}</Link>
                            </>
                          )}
                          {typeof group.memberCount === 'number' && ` · ${t('{{count}} members', { count: group.memberCount })}`}
                        </p>
                        {request.message && (
                          <p className='text-sm text-foreground mt-2 mb-0 whitespace-pre-wrap'>{request.message}</p>
                        )}
                        {!isPending && request.reviewedAt && (
                          <p className='text-xs text-foreground/50 m-0 mt-2'>
                            {t('Reviewed {{date}}', { date: formatDate(request.reviewedAt) })}
                            {request.reviewedBy?.name && ` · ${t('by')} ${request.reviewedBy.name}`}
                          </p>
                        )}
                        {!isPending && request.reviewMessage && (
                          <p className='text-sm text-foreground/70 mt-1 mb-0 whitespace-pre-wrap'>{request.reviewMessage}</p>
                        )}
                        {isPending && (
                          <div className='mt-3'>
                            <textarea
                              aria-label={t('Message to the requester (optional)')}
                              className='w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground mb-2'
                              value={messages[group.id] || ''}
                              maxLength={2000}
                              onChange={e => setMessages(m => ({ ...m, [group.id]: e.target.value }))}
                              placeholder={t('Message to the requester (optional), included in the email')}
                            />
                            <div className='flex gap-2'>
                              <Button
                                variant='default'
                                size='sm'
                                disabled={reviewingId === group.id}
                                onClick={() => handleReview(group, true)}
                              >
                                {t('Approve')}
                              </Button>
                              <Button
                                variant='destructive'
                                size='sm'
                                disabled={reviewingId === group.id}
                                onClick={() => handleReview(group, false)}
                              >
                                {t('Deny')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            )}
    </div>
  )
}
