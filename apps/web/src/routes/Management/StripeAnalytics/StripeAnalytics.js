import React, { useState, useEffect } from 'react'
import Loading from 'components/Loading'

// Stripe's thresholds for dispute rates (mirrors backend constants)
const DISPUTE_RATE_CRITICAL = 0.01
const DISPUTE_RATE_WARNING = 0.0075

/**
 * Returns a tailwind color class for a dispute rate value.
 */
function rateColorClass (rate) {
  if (rate >= DISPUTE_RATE_CRITICAL) return 'text-red-500 font-semibold'
  if (rate >= DISPUTE_RATE_WARNING) return 'text-yellow-500 font-semibold'
  return 'text-foreground'
}

/**
 * Formats a decimal rate as a percentage string.
 */
function formatRate (rate) {
  if (rate == null) return 'N/A'
  return `${(rate * 100).toFixed(2)}%`
}

/**
 * Admin analytics view for Stripe disputes and refunds across all connected group accounts.
 * Fetches from GET /noo/admin/stripe-analytics.
 */
export default function StripeAnalytics () {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingGroupId, setUpdatingGroupId] = useState(null)

  useEffect(() => {
    fetch('/noo/admin/stripe-analytics', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        return res.json()
      })
      .then(json => {
        setData(json)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const handleSetPaused = (group, paused) => {
    const reason = paused
      ? window.prompt('Reason for pausing Stripe sales for this group (required for audit log):')
      : ''
    if (paused && !reason) return

    setUpdatingGroupId(group.group_id)
    fetch('/noo/admin/stripe-sales-pause', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: group.group_id, paused, reason })
    })
      .then(res => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        return res.json()
      })
      .then(result => {
        setData(prev => ({
          ...prev,
          groups: prev.groups.map(g => (
            g.group_id === group.group_id
              ? {
                  ...g,
                  stripe_sales_paused: !!result.stripeSalesPaused,
                  stripe_sales_paused_at: result.stripeSalesPausedAt,
                  stripe_sales_paused_reason: result.stripeSalesPausedReason
                }
              : g
          ))
        }))
      })
      .catch(err => setError(err.message))
      .finally(() => setUpdatingGroupId(null))
  }

  if (loading) return <div className='p-6'><Loading /></div>
  if (error) return <div className='p-6 text-red-500'>Error loading analytics: {error}</div>

  const { groups, platform_totals: totals } = data

  return (
    <div className='p-6 space-y-6'>
      <h1 className='text-2xl font-bold text-foreground'>Stripe Disputes & Refunds</h1>
      <p className='text-sm text-foreground/60'>
        Stripe flags accounts at <span className='font-medium text-yellow-500'>0.75%</span> (early warning) and{' '}
        <span className='font-medium text-red-500'>1.0%</span> (critical risk). Groups above either threshold may have
        received an alert email. Dispute rates are calculated over the last 90 days.
      </p>

      <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
        <PlatformStat label='Total disputes (90d)' value={totals.total_disputes_90d} />
        <PlatformStat label='Open disputes' value={totals.total_open_disputes} highlight={totals.total_open_disputes > 0} />
        <PlatformStat label='Total refunds (90d)' value={totals.total_refunds_90d} />
        <PlatformStat label='Total charges (90d)' value={totals.total_charges_90d} />
      </div>

      {groups.length === 0
        ? <p className='text-foreground/60'>No groups with Stripe Connect accounts found.</p>
        : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm text-left border-collapse'>
              <thead>
                <tr className='border-b border-foreground/10 text-foreground/50 text-xs uppercase'>
                  <th className='py-2 pr-4'>Group</th>
                  <th className='py-2 pr-4 text-right'>Charges (90d)</th>
                  <th className='py-2 pr-4 text-right'>Disputes (90d)</th>
                  <th className='py-2 pr-4 text-right'>Dispute rate</th>
                  <th className='py-2 pr-4 text-right'>Disputes (7d)</th>
                  <th className='py-2 pr-4 text-right'>Open</th>
                  <th className='py-2 pr-4 text-right'>Refunds (90d)</th>
                  <th className='py-2 pr-4'>Last alert</th>
                  <th className='py-2 pr-4'>Sales control</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.group_id} className='border-b border-foreground/5 hover:bg-card transition-colors'>
                    <td className='py-3 pr-4'>
                      <a
                        href={`/groups/${g.group_slug}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='font-medium text-foreground hover:underline'
                      >
                        {g.group_name}
                      </a>
                      {g.stripe_account_external_id && (
                        <a
                          href={`https://dashboard.stripe.com/${g.stripe_account_external_id}`}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='block text-xs text-foreground/40 hover:underline'
                        >
                          {g.stripe_account_external_id}
                        </a>
                      )}
                    </td>
                    <td className='py-3 pr-4 text-right'>{g.total_charges_90d}</td>
                    <td className='py-3 pr-4 text-right'>{g.disputes_90d}</td>
                    <td className={`py-3 pr-4 text-right ${rateColorClass(g.dispute_rate_90d)}`}>
                      {formatRate(g.dispute_rate_90d)}
                    </td>
                    <td className={`py-3 pr-4 text-right ${g.disputes_7d >= 20 ? 'text-red-500 font-semibold' : 'text-foreground'}`}>
                      {g.disputes_7d}
                    </td>
                    <td className={`py-3 pr-4 text-right ${g.open_disputes > 0 ? 'text-yellow-500' : 'text-foreground'}`}>
                      {g.open_disputes}
                    </td>
                    <td className='py-3 pr-4 text-right'>{g.refunds_90d}</td>
                    <td className='py-3 text-xs text-foreground/50'>
                      {g.last_alert_at
                        ? (
                          <span title={g.last_alert_threshold}>
                            {new Date(g.last_alert_at).toLocaleDateString()} — {g.last_alert_type?.replace(/_/g, ' ')}
                          </span>
                          )
                        : <span className='text-foreground/30'>None</span>}
                    </td>
                    <td className='py-3 pr-4'>
                      <div className='flex flex-col gap-2'>
                        <button
                          type='button'
                          disabled={updatingGroupId === g.group_id}
                          onClick={() => handleSetPaused(g, !g.stripe_sales_paused)}
                          className={`text-xs px-2 py-1 rounded border ${
                            g.stripe_sales_paused
                              ? 'border-green-500/50 text-green-500 hover:bg-green-500/10'
                              : 'border-red-500/50 text-red-500 hover:bg-red-500/10'
                          } disabled:opacity-50`}
                        >
                          {updatingGroupId === g.group_id
                            ? 'Saving...'
                            : (g.stripe_sales_paused ? 'Resume sales' : 'Pause sales')}
                        </button>
                        {g.stripe_sales_paused && (
                          <span className='text-[11px] text-yellow-500'>
                            Paused{g.stripe_sales_paused_reason ? `: ${g.stripe_sales_paused_reason}` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
    </div>
  )
}

function PlatformStat ({ label, value, highlight }) {
  return (
    <div className='bg-card rounded-lg p-4 border border-foreground/10'>
      <div className={`text-2xl font-bold ${highlight ? 'text-yellow-500' : 'text-foreground'}`}>{value}</div>
      <div className='text-xs text-foreground/50 mt-1'>{label}</div>
    </div>
  )
}
