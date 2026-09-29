/**
 * Group paywall toggle on the Paid Offerings tab in Paid Content settings.
 * Requires Stripe verification and a published offering that grants group access before enabling.
 * Also holds the preview toggle: whether people who haven't bought access see titles of what's
 * inside (on unless a steward turns it off; it covers this group's paid spaces too).
 */

import React, { useCallback, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'

import SettingsControl from 'components/SettingsControl'
import { Switch } from 'components/ui/switch'
import { fetchGroupSettings, updateGroupSettings } from '../GroupSettings.store'
import { offeringGrantsGroupAccess } from 'util/accessGrants'

function GroupPaywallSection ({ group, offerings }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [updatingPaywall, setUpdatingPaywall] = useState(false)
  const [updatingPreview, setUpdatingPreview] = useState(false)
  const showPaywallPreview = group?.settings?.showPaywallPreview ?? true

  /**
   * Validates if the group meets requirements before the paywall can be turned on.
   */
  const groupPaywallValidation = useCallback(() => {
    if (!group?.stripeAccountId) {
      return false
    }

    if (!group?.stripeChargesEnabled || !group?.stripePayoutsEnabled || !group?.stripeDetailsSubmitted) {
      return false
    }

    if (!offerings || offerings.length === 0) {
      return false
    }

    const hasGroupAccessOffering = offerings.some(offering => {
      if (offering.publishStatus !== 'published') {
        return false
      }
      return offeringGrantsGroupAccess(offering, group?.id)
    })

    return hasGroupAccessOffering
  }, [group, offerings])

  const isPaywallReady = groupPaywallValidation()

  /**
   * Persists paywall on/off and refreshes group settings from the server.
   */
  const handleTogglePaywall = useCallback(async (checked) => {
    if (!group) return

    setUpdatingPaywall(true)

    try {
      await dispatch(updateGroupSettings(group.id, { paywall: checked }))
      if (group?.slug) {
        await dispatch(fetchGroupSettings(group.slug))
      }
    } catch (error) {
      console.error('Error updating paywall:', error)
      window.alert(t('Failed to update paywall setting: {{error}}', { error: error.message }))
    } finally {
      setUpdatingPaywall(false)
    }
  }, [dispatch, group, t])

  /**
   * Persists the preview setting and refreshes group settings from the server.
   */
  const handleTogglePreview = useCallback(async (checked) => {
    if (!group) return

    setUpdatingPreview(true)

    try {
      await dispatch(updateGroupSettings(group.id, { settings: { showPaywallPreview: checked } }))
      if (group?.slug) {
        await dispatch(fetchGroupSettings(group.slug))
      }
    } catch (error) {
      console.error('Error updating paywall preview:', error)
      window.alert(t('Failed to update paywall setting: {{error}}', { error: error.message }))
    } finally {
      setUpdatingPreview(false)
    }
  }, [dispatch, group, t])

  const paywallSwitchDisabled =
    updatingPaywall || !group || (!group?.paywall && !isPaywallReady)

  return (
    <div className='border-2 border-foreground/20 rounded-lg p-4 mb-4'>
      <SettingsControl
        label={t('Group Paywall')}
        helpText={t('When enabled, users must purchase access to join this group')}
        renderControl={() => (
          <div className='flex flex-col gap-2'>
            <div className='flex items-center gap-3 flex-wrap'>
              <Switch
                checked={group?.paywall || false}
                onCheckedChange={handleTogglePaywall}
                disabled={paywallSwitchDisabled}
                aria-label={group?.paywall ? t('Enabled') : t('Disabled')}
              />
              <span className={`text-sm font-medium ${group?.paywall ? 'text-foreground' : 'text-foreground/70'}`}>
                {group?.paywall ? t('Enabled') : t('Disabled')}
              </span>
            </div>
            <div className='text-xs mt-1'>
              {isPaywallReady && group?.paywall
                ? (<span className='text-accent'>{t('Paywall enabled')}</span>)
                : isPaywallReady
                  ? (<span className='text-accent'>{t('This group is ready to have a paywall added')}</span>)
                  : (<span className='text-destructive'>{t('To have a paywall to group access, the group needs to have a Stripe Connect account, have that account verified and then have at least ONE published offering that allows access to the group')}</span>)}
            </div>
          </div>
        )}
      />
      <SettingsControl
        label={t('Show a preview before purchase')}
        helpText={t('People who have not bought access see the titles of pinned and recent posts, or a track\'s action titles and how many people completed it. Post contents stay private.')}
        renderControl={() => (
          <div className='flex items-center gap-3 flex-wrap'>
            <Switch
              checked={showPaywallPreview}
              onCheckedChange={handleTogglePreview}
              disabled={updatingPreview || !group}
              aria-label={t('Show a preview before purchase')}
            />
            <span className={`text-sm font-medium ${showPaywallPreview ? 'text-foreground' : 'text-foreground/70'}`}>
              {showPaywallPreview ? t('Enabled') : t('Disabled')}
            </span>
          </div>
        )}
      />
    </div>
  )
}

export default GroupPaywallSection
