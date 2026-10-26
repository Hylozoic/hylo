import { get } from 'lodash/fp'
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import Button from 'components/ui/button'
import SettingsSection from '../../GroupSettings/SettingsSection/SettingsSection'
import { fetchAtprotoStatus, createAtprotoIdentity } from '../UserSettings.store'

/**
 * Experimental: lets eligible users create their Hylo-hosted AT Protocol identity (DID + handle)
 * and shows it once they have one. Renders nothing for everyone else, or if the status can't load.
 */
export default function AtprotoIdentitySection () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [status, setStatus] = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.resolve(dispatch(fetchAtprotoStatus()))
      .then(result => { if (!cancelled) setStatus(get('payload.data.me.atproto', result) || null) })
      .catch(() => { if (!cancelled) setStatus(null) })
    return () => { cancelled = true }
  }, [dispatch])

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      const result = await dispatch(createAtprotoIdentity())
      if (result?.error) throw result.payload
      setStatus(get('payload.data.createAtprotoIdentity', result) || status)
    } catch (err) {
      setError(err?.message || t('Something went wrong. Please try again.'))
    } finally {
      setCreating(false)
    }
  }

  if (!status || !status.enabled || (!status.eligible && !status.identity)) return null

  const { identity, proposedHandle } = status

  return (
    <SettingsSection>
      <div data-testid='atproto-identity-section'>
        <div className='flex items-center gap-2 mb-2'>
          <h3 className='text-foreground font-bold'>{t('AT Protocol identity')}</h3>
          <span className='text-xs px-1.5 py-0.5 rounded border border-foreground/30 text-foreground/60'>{t('Experimental')}</span>
        </div>
        <p className='text-foreground/70 mb-4'>
          {t('AT Protocol is the open network behind apps like Bluesky. Hylo can host an AT Protocol identity for you: a permanent ID (a DID) and a handle. For now this only creates your identity; nothing you post on Hylo is shared.')}
        </p>

        {identity
          ? (
            <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm'>
              <dt className='text-foreground/50'>{t('Handle')}</dt>
              <dd className='text-foreground font-medium'>@{identity.handle}</dd>
              <dt className='text-foreground/50'>DID</dt>
              <dd className='text-foreground font-mono text-xs break-all'>{identity.did}</dd>
              <dt className='text-foreground/50'>{t('Status')}</dt>
              <dd className='text-foreground'>
                {identity.status === 'active' && t('Active')}
                {identity.status === 'pending' && t('Being set up. This can take a few minutes.')}
                {identity.status === 'tombstoned' && t('This identity has been retired.')}
              </dd>
            </dl>
            )
          : (
            <div className='space-y-3'>
              {proposedHandle && (
                <p className='text-foreground text-sm'>
                  {t('Your new handle:')} <span className='font-medium'>@{proposedHandle}</span>
                </p>
              )}
              <Button onClick={handleCreate} disabled={creating} data-testid='atproto-create-identity'>
                {creating ? t('Creating...') : t('Create my AT Protocol identity')}
              </Button>
            </div>
            )}

        {error && <p className='text-sm text-destructive mt-3'>{error}</p>}
      </div>
    </SettingsSection>
  )
}
