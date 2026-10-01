import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { personUrl } from '@hylo/navigation'
import Loading from 'components/Loading'
import Button from 'components/ui/button'
import { cn } from 'util/index'

export const FETCH_STAFF_REPORTS = 'Management/FETCH_STAFF_REPORTS'
export const RESOLVE_STAFF_REPORT = 'Management/RESOLVE_STAFF_REPORT'

const PAGE_SIZE = 20

export function fetchStaffReports ({ status = 'active', offset = 0, first = PAGE_SIZE } = {}) {
  return {
    type: FETCH_STAFF_REPORTS,
    graphql: {
      query: `query StaffReports ($status: String, $offset: Int, $first: Int) {
        staffReports (status: $status, offset: $offset, first: $first) {
          total
          hasMore
          items {
            id
            category
            text
            status
            createdAt
            resolvedAt
            messageThreadId
            reporter { id name avatarUrl }
            reportedUser { id name avatarUrl }
            threadParticipants { id name }
            resolvedBy { id name }
          }
        }
      }`,
      variables: { status, offset, first }
    }
  }
}

export function resolveStaffReport (id) {
  return {
    type: RESOLVE_STAFF_REPORT,
    graphql: {
      query: `mutation ResolveStaffReport ($id: ID) {
        resolveStaffReport (id: $id) {
          success
        }
      }`,
      variables: { id }
    }
  }
}

function PersonLink ({ person }) {
  if (!person) return null
  return (
    <Link to={personUrl(person.id)} className='font-medium text-foreground hover:text-accent'>
      {person.name}
    </Link>
  )
}

/**
 * Management page for reports people send to Hylo staff about a person or a
 * direct message conversation. Staff see who reported whom and why, not the
 * conversation's messages, and mark each report resolved once it's handled.
 */
export default function ReportQueue () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [status, setStatus] = useState('active')
  const [reports, setReports] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resolvingId, setResolvingId] = useState(null)
  // Only the newest request may update the list, so switching tabs mid-load can't mix them up
  const latestRequest = useRef(0)

  const categoryLabels = {
    inappropriate: t('Inappropriate Content'),
    spam: t('Spam'),
    offensive: t('Offensive'),
    abusive: t('Abusive'),
    illegal: t('Illegal'),
    safety: t('Safety concern'),
    other: t('Other')
  }

  const load = useCallback(async (offset = 0) => {
    const requestId = ++latestRequest.current
    const isCurrent = () => requestId === latestRequest.current
    setLoading(true)
    setError(null)
    if (offset === 0) setReports([])
    try {
      const result = await dispatch(fetchStaffReports({ status, offset }))
      const data = result?.payload?.data?.staffReports
      if (!data) throw new Error('no data')
      if (!isCurrent()) return
      setReports(prev => offset === 0 ? data.items : prev.concat(data.items))
      setHasMore(!!data.hasMore)
    } catch (err) {
      if (isCurrent()) setError(t('Could not load reports'))
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }, [dispatch, status, t])

  useEffect(() => { load(0) }, [load])

  const handleResolve = useCallback(async (id) => {
    setResolvingId(id)
    try {
      const result = await dispatch(resolveStaffReport(id))
      if (result?.payload?.data?.resolveStaffReport?.success) {
        // Resolved reports leave the Open list, so the next page's offset (the list length) stays right
        setReports(prev => prev.filter(report => report.id !== id))
      }
    } catch (err) {
      toast.error(t('Something went wrong. Please try again.'))
    } finally {
      setResolvingId(null)
    }
  }, [dispatch, t])

  return (
    <div className='p-6 max-w-4xl mx-auto' data-testid='report-queue'>
      <h1 className='text-2xl font-bold mb-2'>{t('Reports to Hylo')}</h1>
      <p className='text-foreground-muted text-sm mb-6'>{t('reportQueueExplainer')}</p>

      <div className='flex gap-2 mb-6' role='tablist'>
        {['active', 'resolved'].map(tab => (
          <button
            key={tab}
            type='button'
            role='tab'
            aria-selected={status === tab}
            onClick={() => setStatus(tab)}
            className={cn(
              'px-3 py-1 rounded-md border-2 text-sm transition-all',
              status === tab ? 'border-secondary text-foreground' : 'border-foreground/20 text-foreground-muted hover:border-foreground/50'
            )}
          >
            {tab === 'active' ? t('Open') : t('Resolved')}
          </button>
        ))}
      </div>

      {error && <div className='text-destructive mb-4'>{error}</div>}

      {!loading && !error && reports.length === 0 && (
        <div className='text-foreground-muted p-4 border border-foreground/20 rounded-md'>
          {status === 'active' ? t('No open reports') : t('No resolved reports')}
        </div>
      )}

      <ul className='space-y-4'>
        {reports.map(report => (
          <li key={report.id} className='rounded-xl p-4 bg-card/40 border-2 border-card/30 shadow-md' data-testid='staff-report'>
            <div className='flex flex-wrap items-center justify-between gap-2 border-b border-foreground/10 pb-3 mb-3'>
              <div className='text-sm text-foreground/70 flex flex-wrap items-center gap-1'>
                <PersonLink person={report.reporter} />
                <span>{report.messageThreadId ? t('reported a conversation') : t('reported a person')}</span>
                {report.createdAt && <span>· {new Date(report.createdAt).toLocaleDateString()}</span>}
              </div>
              <span className='px-3 py-1 rounded-full text-sm font-medium bg-accent/10 text-accent'>
                {categoryLabels[report.category] || report.category}
              </span>
            </div>

            <div className='space-y-2 text-sm'>
              {report.reportedUser && (
                <div>
                  <span className='text-foreground-muted'>{t('About')}: </span>
                  <PersonLink person={report.reportedUser} />
                </div>
              )}
              {report.messageThreadId && report.threadParticipants?.length > 0 && (
                <div>
                  <span className='text-foreground-muted'>{t('People in the conversation')}: </span>
                  {report.threadParticipants.map((person, index) => (
                    <React.Fragment key={person.id}>
                      {index > 0 && ', '}
                      <PersonLink person={person} />
                    </React.Fragment>
                  ))}
                </div>
              )}
              <div>
                <span className='text-foreground-muted'>{t('What they said')}: </span>
                <span className='text-foreground whitespace-pre-wrap'>{report.text || t('No explanation given')}</span>
              </div>
              {report.status === 'resolved' && (
                <div className='text-foreground-muted'>
                  {t('Resolved by {{name}}', { name: report.resolvedBy?.name || '' })}
                  {report.resolvedAt && ` · ${new Date(report.resolvedAt).toLocaleDateString()}`}
                </div>
              )}
            </div>

            {report.status === 'active' && (
              <div className='pt-3 mt-3 border-t border-foreground/10'>
                <Button
                  variant='outline'
                  onClick={() => handleResolve(report.id)}
                  disabled={resolvingId === report.id}
                  data-testid='resolve-staff-report'
                >
                  <CheckCircle2 className='w-4 h-4 mr-1' /> {t('Mark resolved')}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {loading && <Loading />}
      {!loading && hasMore && (
        <div className='mt-4 flex justify-center'>
          <Button variant='outline' onClick={() => load(reports.length)}>{t('Load more')}</Button>
        </div>
      )}
    </div>
  )
}
