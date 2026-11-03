import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import Loading from 'components/Loading'
import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import { cn } from 'util/index'
import SubscriptionRow from './SubscriptionRow'
import { fetchHyloProMetrics, fetchHyloProSubscriptions, grantHyloPro } from './HyloPro.store'
import { endOfDayIso, formatMoney, runGraphql } from './util'

const PAGE_SIZE = 50

/**
 * Hylo staff page for Hylo Pro: metrics, granting Pro outside of payments, and managing grants and
 * Stripe subscriptions (cancel, extend, refund). The server refuses anyone who isn't Hylo staff.
 */
export default function HyloPro () {
  const { t, i18n } = useTranslation()
  const dispatch = useDispatch()
  const [metrics, setMetrics] = useState(null)
  const [metricsError, setMetricsError] = useState(null)
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingRows, setLoadingRows] = useState(true)

  const filters = [
    { value: 'active', label: t('Has Pro now') },
    { value: 'past_due', label: t('Payment failed') },
    { value: 'manual', label: t('Grants') },
    { value: 'stripe', label: t('Subscriptions') },
    { value: 'all', label: t('All') }
  ]

  const loadMetrics = useCallback(async () => {
    try {
      setMetrics(await runGraphql(dispatch, fetchHyloProMetrics(), 'hyloProMetrics'))
      setMetricsError(null)
    } catch (e) {
      setMetricsError(e?.message || t('Something went wrong'))
    }
  }, [dispatch])

  const loadRows = useCallback(async (offset = 0) => {
    setLoadingRows(true)
    try {
      const result = await runGraphql(dispatch, fetchHyloProSubscriptions({ filter, search: appliedSearch, first: PAGE_SIZE, offset }), 'hyloProSubscriptions')
      setRows(existing => offset === 0 ? result.items : existing.concat(result.items))
      setTotal(result.total)
      setHasMore(result.hasMore)
    } catch (e) {
      toast.error(e?.message || t('Something went wrong'))
    } finally {
      setLoadingRows(false)
    }
  }, [dispatch, filter, appliedSearch])

  useEffect(() => { loadMetrics() }, [loadMetrics])
  useEffect(() => { loadRows(0) }, [loadRows])

  // After any change: refresh the numbers, and the list (a row may have left the current filter)
  const refresh = useCallback(() => {
    loadMetrics()
    loadRows(0)
  }, [loadMetrics, loadRows])

  return (
    <div className='p-6 space-y-8 max-w-5xl'>
      <div>
        <h1 className='text-2xl font-bold text-foreground'>{t('Hylo Pro')}</h1>
        <p className='text-sm text-foreground/60 mt-1'>
          {t('Groups paying for Hylo Pro or granted it by Hylo. Changes to subscriptions are made in Stripe, then saved here.')}
        </p>
      </div>

      <Metrics metrics={metrics} error={metricsError} t={t} language={i18n.language} />

      <GrantForm onGranted={refresh} />

      <section className='space-y-3'>
        <h2 className='text-lg font-semibold text-foreground'>{t('Subscriptions and grants')}</h2>
        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex flex-wrap gap-1' role='tablist'>
            {filters.map(f => (
              <Button
                key={f.value}
                role='tab'
                aria-selected={filter === f.value}
                variant={filter === f.value ? 'default' : 'ghost'}
                size='sm'
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <form
            className='flex gap-2 ml-auto'
            onSubmit={e => { e.preventDefault(); setAppliedSearch(search.trim()) }}
          >
            <Input
              className='w-56 h-9'
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('Search groups')}
              aria-label={t('Search groups')}
            />
            <Button type='submit' size='sm' variant='outline'>{t('Search')}</Button>
          </form>
        </div>

        {loadingRows && rows.length === 0
          ? <Loading />
          : rows.length === 0
            ? <div className='text-foreground/50 p-4 border border-foreground/20 rounded-md'>{t('Nothing here.')}</div>
            : (
              <>
                <p className='text-xs text-foreground/50 m-0'>{t('{{count}} results', { count: total })}</p>
                <ul className='divide-y divide-foreground/10 border border-foreground/20 rounded-md p-0 m-0' data-testid='hylo-pro-rows'>
                  {rows.map(row => <SubscriptionRow key={row.id} row={row} onChanged={refresh} />)}
                </ul>
                {hasMore && (
                  <Button variant='outline' size='sm' disabled={loadingRows} onClick={() => loadRows(rows.length)}>
                    {t('Load more')}
                  </Button>
                )}
              </>
              )}
      </section>
    </div>
  )
}

function Metrics ({ metrics, error, t, language }) {
  if (error) return <div className='text-red-500'>{error}</div>
  if (!metrics) return <Loading />

  const stats = [
    {
      label: t('Groups with Pro'),
      value: metrics.activeGroups,
      detail: t('{{paid}} paying · {{granted}} granted', { paid: metrics.stripeGroups, granted: metrics.manualGroups })
    },
    {
      label: t('Monthly recurring revenue'),
      value: formatMoney(metrics.mrrCents, metrics.currency, language),
      detail: t('Yearly plans count 1/12. Trialing not included.')
    },
    {
      label: t('Paid subscriptions'),
      value: metrics.monthlySubscriptions + metrics.yearlySubscriptions,
      detail: t('{{monthly}} monthly · {{yearly}} yearly', { monthly: metrics.monthlySubscriptions, yearly: metrics.yearlySubscriptions })
    },
    { label: t('Payment failed'), value: metrics.pastDue, highlight: metrics.pastDue > 0 },
    { label: t('Set to cancel'), value: metrics.cancelling },
    { label: t('Trialing (extended)'), value: metrics.trialing },
    { label: t('Grants ending within 30 days'), value: metrics.grantsExpiringSoon }
  ]

  return (
    <section className='space-y-4' data-testid='hylo-pro-metrics'>
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        {stats.map(stat => (
          <div key={stat.label} className='bg-card rounded-lg p-4 border border-foreground/10'>
            <div className={cn('text-2xl font-bold', stat.highlight ? 'text-yellow-500' : 'text-foreground')}>{stat.value}</div>
            <div className='text-xs text-foreground/60 mt-1'>{stat.label}</div>
            {stat.detail && <div className='text-[11px] text-foreground/40 mt-1'>{stat.detail}</div>}
          </div>
        ))}
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full text-sm text-left border-collapse'>
          <thead>
            <tr className='border-b border-foreground/10 text-foreground/50 text-xs uppercase'>
              <th className='py-2 pr-4'>{t('Month')}</th>
              <th className='py-2 pr-4 text-right'>{t('New subscriptions')}</th>
              <th className='py-2 pr-4 text-right'>{t('Cancellations')}</th>
              <th className='py-2 pr-4 text-right'>{t('Ended')}</th>
              <th className='py-2 pr-4 text-right'>{t('Grants made')}</th>
            </tr>
          </thead>
          <tbody>
            {[...metrics.months].reverse().map(m => (
              <tr key={m.month} className='border-b border-foreground/5'>
                <td className='py-2 pr-4 text-foreground'>{formatMonth(m.month, language)}</td>
                <td className='py-2 pr-4 text-right text-foreground'>{m.newSubscriptions}</td>
                <td className='py-2 pr-4 text-right text-foreground'>{m.cancellations}</td>
                <td className='py-2 pr-4 text-right text-foreground'>{m.ended}</td>
                <td className='py-2 pr-4 text-right text-foreground'>{m.grants}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function formatMonth (month, language) {
  const [year, monthIndex] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthIndex - 1, 1)).toLocaleDateString(language, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function GrantForm ({ onGranted }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [groupId, setGroupId] = useState('')
  const [expiresOn, setExpiresOn] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async event => {
    event.preventDefault()
    if (!groupId.trim()) return
    setSaving(true)
    try {
      const row = await runGraphql(dispatch, grantHyloPro({ groupId: groupId.trim(), expiresAt: endOfDayIso(expiresOn), note }), 'grantHyloPro')
      toast.success(t('Hylo Pro granted to {{name}}', { name: row.group?.name }))
      setGroupId('')
      setExpiresOn('')
      setNote('')
      onGranted()
    } catch (e) {
      toast.error(e?.message || t('Something went wrong'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className='space-y-3'>
      <h2 className='text-lg font-semibold text-foreground'>{t('Grant Hylo Pro')}</h2>
      <p className='text-sm text-foreground/60 m-0'>{t('Give a group Pro without a payment, e.g. for partners or pilots. Leave the end date empty for no end date.')}</p>
      <form className='grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3 bg-card rounded-lg p-4 border border-foreground/10' onSubmit={handleSubmit} data-testid='hylo-pro-grant-form'>
        <label className='text-sm text-foreground space-y-1'>
          <span>{t('Group slug or ID')}</span>
          <Input value={groupId} onChange={e => setGroupId(e.target.value)} placeholder='my-group' required />
        </label>
        <label className='text-sm text-foreground space-y-1'>
          <span>{t('Ends on (optional)')}</span>
          <Input type='date' value={expiresOn} onChange={e => setExpiresOn(e.target.value)} />
        </label>
        <label className='text-sm text-foreground space-y-1 sm:col-span-2'>
          <span>{t('Note (why it was granted)')}</span>
          <Input value={note} onChange={e => setNote(e.target.value)} maxLength={1000} />
        </label>
        <div className='sm:col-span-2'>
          <Button type='submit' disabled={saving || !groupId.trim()}>{saving ? t('Saving...') : t('Grant Pro')}</Button>
        </div>
      </form>
    </section>
  )
}
