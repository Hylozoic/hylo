import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Loading from 'components/Loading'

/**
 * Admin view of the experimental AT Protocol identities (DIDs + handles) hosted by this instance.
 * Fetches from GET /noo/admin/atproto-metrics; "Verify sample" posts to /noo/admin/atproto-verify-sample.
 */
export default function AtprotoIdentities () {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyResults, setVerifyResults] = useState(null)
  const [verifyError, setVerifyError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/noo/admin/atproto-metrics', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        return res.json()
      })
      .then(json => {
        setData(json)
        setError(null)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const verifySample = () => {
    setVerifying(true)
    setVerifyError(null)
    fetch('/noo/admin/atproto-verify-sample', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: 10 })
    })
      .then(res => res.json().then(json => {
        if (!res.ok) throw new Error(json.error || `Server returned ${res.status}`)
        return json
      }))
      .then(json => setVerifyResults(json.results))
      .catch(err => setVerifyError(err.message))
      .finally(() => setVerifying(false))
  }

  if (loading && !data) return <div className='p-6'><Loading /></div>
  if (error) return <div className='p-6 text-red-500'>{t('Error loading AT Protocol metrics: {{error}}', { error })}</div>

  const { instance, identities, eligibleWithoutIdentity, foreignIdentities, stuckPending, stuckPendingMinutes, recent, days } = data
  const activity = mergeActivity(data.createdPerDay, data.tombstonedPerDay)

  return (
    <div className='p-6 space-y-6 max-w-5xl'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-foreground'>{t('AT Protocol Identities')}</h1>
          <p className='text-sm text-foreground/60'>
            {t('Experimental: DIDs and handles hosted by this Hylo instance, which acts as their PDS.')}
          </p>
        </div>
        <button
          type='button'
          onClick={load}
          disabled={loading}
          className='text-xs px-2 py-1 rounded border border-foreground/20 text-foreground hover:bg-card disabled:opacity-50'
        >
          {loading ? t('Refreshing...') : t('Refresh')}
        </button>
      </div>

      {!instance.enabled && (
        <div className='rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-foreground'>
          {t('AT Protocol identities are turned off on this instance (ATPROTO_ENABLED). Nothing is created or served.')}
        </div>
      )}

      <div className='bg-card rounded-lg p-4 border border-foreground/10 text-sm space-y-1' data-testid='atproto-instance'>
        <h2 className='text-xs uppercase text-foreground/50 mb-2'>{t('This instance')}</h2>
        <InstanceRow label={t('PLC directory')}>
          <code>{instance.plcUrl || '—'}</code>
          {instance.productionPlc && <Badge className='border-red-500/50 text-red-500'>{t('Public production directory')}</Badge>}
          {instance.sandbox && <Badge className='border-blue-500/50 text-blue-500'>{t('Sandbox')}</Badge>}
        </InstanceRow>
        <InstanceRow label={t('PDS URL')}><code>{instance.pdsUrl || '—'}</code></InstanceRow>
        <InstanceRow label={t('Handles')}><code>{instance.handleDomain ? `*.${instance.handleDomain}` : '—'}</code></InstanceRow>
        <InstanceRow label={t('Eligible email domains')}>{instance.allowedEmailDomains.join(', ') || '—'}</InstanceRow>
        <InstanceRow label={t('Account allowlist')}>
          {instance.allowlistSize > 0
            ? t('{{count}} accounts', { count: instance.allowlistSize })
            : t('Off (all eligible accounts)')}
        </InstanceRow>
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-5 gap-4'>
        <Stat label={t('Active')} value={identities.active} />
        <Stat label={t('Pending')} value={identities.pending} highlight={stuckPending.length > 0} />
        <Stat label={t('Tombstoned')} value={identities.tombstoned} />
        <Stat label={t('Eligible without identity')} value={eligibleWithoutIdentity} />
        <Stat label={t('From other instances')} value={foreignIdentities} highlight={foreignIdentities > 0} />
      </div>

      {foreignIdentities > 0 && (
        <p className='text-sm text-yellow-500'>
          {t('This database contains identities created by another instance (for example after copying in a production database). They are ignored here. Remove them with:')}{' '}
          <code>yarn atproto purge-foreign --yes</code>
        </p>
      )}

      {stuckPending.length > 0 && (
        <section>
          <h2 className='text-lg font-semibold text-foreground'>{t('Stuck pending')}</h2>
          <p className='text-sm text-foreground/60 mb-2'>
            {t('Pending for more than {{minutes}} minutes: the PLC directory has not confirmed them yet. Retry with:', { minutes: stuckPendingMinutes })}{' '}
            <code>yarn atproto backfill --yes</code>
          </p>
          <IdentityTable rows={stuckPending} t={t} />
        </section>
      )}

      <section>
        <h2 className='text-lg font-semibold text-foreground mb-2'>{t('Recent identities')}</h2>
        {recent.length === 0
          ? <p className='text-sm text-foreground/60'>{t('No identities yet.')}</p>
          : <IdentityTable rows={recent} t={t} showStatus />}
      </section>

      <section>
        <h2 className='text-lg font-semibold text-foreground mb-2'>{t('Activity (last {{days}} days)', { days })}</h2>
        {activity.length === 0
          ? <p className='text-sm text-foreground/60'>{t('No identities created or tombstoned in this period.')}</p>
          : (
            <table className='text-sm text-left border-collapse'>
              <thead>
                <tr className='border-b border-foreground/10 text-foreground/50 text-xs uppercase'>
                  <th className='py-2 pr-6'>{t('Day')}</th>
                  <th className='py-2 pr-6 text-right'>{t('Created')}</th>
                  <th className='py-2 pr-6 text-right'>{t('Tombstoned')}</th>
                </tr>
              </thead>
              <tbody>
                {activity.map(row => (
                  <tr key={row.day} className='border-b border-foreground/5'>
                    <td className='py-1 pr-6'>{row.day}</td>
                    <td className='py-1 pr-6 text-right'>{row.created}</td>
                    <td className='py-1 pr-6 text-right'>{row.tombstoned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
      </section>

      <section>
        <h2 className='text-lg font-semibold text-foreground'>{t('Check against the PLC directory')}</h2>
        <p className='text-sm text-foreground/60 mb-2'>
          {t('Compares up to 10 random active identities with what the PLC directory publishes: handle, PDS URL, signing key and rotation key.')}
        </p>
        <button
          type='button'
          onClick={verifySample}
          disabled={verifying || !instance.enabled || identities.active === 0}
          className='text-sm px-3 py-1 rounded border border-foreground/20 text-foreground hover:bg-card disabled:opacity-50'
          data-testid='atproto-verify-sample'
        >
          {verifying ? t('Checking...') : t('Verify sample')}
        </button>
        {verifyError && <p className='text-sm text-red-500 mt-2'>{verifyError}</p>}
        {verifyResults && (
          <ul className='mt-3 space-y-1 text-sm' data-testid='atproto-verify-results'>
            {verifyResults.length === 0 && <li className='text-foreground/60'>{t('No active identities to check.')}</li>}
            {verifyResults.map(result => (
              <li key={result.did}>
                {result.problems.length === 0
                  ? <span className='text-green-500'>✔</span>
                  : <span className='text-red-500'>✘</span>}{' '}
                <span className='font-medium'>{result.handle}</span>{' '}
                <span className='font-mono text-xs text-foreground/60'>{result.did}</span>
                {result.problems.map(problem => (
                  <div key={problem} className='ml-5 text-xs text-red-500'>{problem}</div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// Combines the per-day created/tombstoned series into rows, newest first
function mergeActivity (created, tombstoned) {
  const byDay = {}
  created.forEach(({ day, count }) => { byDay[day] = { day, created: count, tombstoned: 0 } })
  tombstoned.forEach(({ day, count }) => { byDay[day] = { ...(byDay[day] || { day, created: 0 }), tombstoned: count } })
  return Object.values(byDay).sort((a, b) => b.day.localeCompare(a.day))
}

function IdentityTable ({ rows, t, showStatus }) {
  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-sm text-left border-collapse'>
        <thead>
          <tr className='border-b border-foreground/10 text-foreground/50 text-xs uppercase'>
            <th className='py-2 pr-4'>{t('Handle')}</th>
            <th className='py-2 pr-4'>DID</th>
            {showStatus && <th className='py-2 pr-4'>{t('Status')}</th>}
            <th className='py-2 pr-4'>{t('User')}</th>
            <th className='py-2 pr-4'>{t('Created')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.did} className='border-b border-foreground/5 hover:bg-card transition-colors'>
              <td className='py-2 pr-4 font-medium text-foreground'>{row.handle}</td>
              <td className='py-2 pr-4 font-mono text-xs text-foreground/70'>{row.did}</td>
              {showStatus && <td className='py-2 pr-4'><StatusLabel status={row.status} t={t} /></td>}
              <td className='py-2 pr-4'>
                <a href={`/members/${row.user_id}`} target='_blank' rel='noopener noreferrer' className='hover:underline'>
                  {row.user_name || `#${row.user_id}`}
                </a>
              </td>
              <td className='py-2 pr-4 text-xs text-foreground/50'>{new Date(row.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusLabel ({ status, t }) {
  const labels = { active: t('Active'), pending: t('Pending'), tombstoned: t('Tombstoned') }
  const colors = { active: 'text-green-500', pending: 'text-yellow-500', tombstoned: 'text-foreground/40' }
  return <span className={colors[status]}>{labels[status] || status}</span>
}

function InstanceRow ({ label, children }) {
  return (
    <div className='flex flex-wrap items-center gap-2'>
      <span className='text-foreground/50 w-44 shrink-0'>{label}</span>
      <span className='text-foreground flex flex-wrap items-center gap-2'>{children}</span>
    </div>
  )
}

function Badge ({ className, children }) {
  return <span className={`text-[11px] px-1.5 py-0.5 rounded border ${className}`}>{children}</span>
}

function Stat ({ label, value, highlight }) {
  return (
    <div className='bg-card rounded-lg p-4 border border-foreground/10'>
      <div className={`text-2xl font-bold ${highlight ? 'text-yellow-500' : 'text-foreground'}`}>{value}</div>
      <div className='text-xs text-foreground/50 mt-1'>{label}</div>
    </div>
  )
}
