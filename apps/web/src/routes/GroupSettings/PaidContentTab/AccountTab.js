/**
 * AccountTab Components
 *
 * Contains components for Stripe account setup and status display:
 * - AccountTab: Main tab for account setup/status
 * - AccountSetupSection: Initial account creation form
 * - StripeStatusSection: Status display for connected accounts
 * - StatusBadge: Small status indicator component
 */

import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

import Button from 'components/ui/button'
import SettingsControl from 'components/SettingsControl'

/**
 * Account Tab Component
 *
 * Main tab showing account setup and status
 */
function AccountTab ({ group, currentUser, accountId, loading, onCreateAccount, onCheckStatus, onStartOnboarding }) {
  const { t } = useTranslation()

  return (
    <>
      {!accountId
        ? (
          <AccountSetupSection
            loading={loading}
            onCreateAccount={onCreateAccount}
            group={group}
            currentUser={currentUser}
            t={t}
          />)
        : (
          <StripeStatusSection
            group={group}
            loading={loading}
            onCheckStatus={onCheckStatus}
            onStartOnboarding={onStartOnboarding}
            t={t}
          />)}
    </>
  )
}

/**
 * Section for initial account setup
 *
 * Displayed when the group doesn't have a Stripe account yet.
 * Provides a form to collect account information for creating a new Stripe account.
 * Note: If the user already has a Stripe account, Stripe will prompt them to connect it during onboarding.
 */
function AccountSetupSection ({ loading, onCreateAccount, group, currentUser, t }) {
  const [formData, setFormData] = useState({
    email: currentUser?.email || '',
    businessName: group?.name || '',
    country: 'US'
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.email.trim()) {
      window.alert(t('Email is required'))
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      window.alert(t('Please enter a valid email address'))
      return
    }

    setSubmitting(true)
    try {
      await onCreateAccount({
        email: formData.email.trim(),
        businessName: formData.businessName.trim() || group.name,
        country: formData.country
      })
    } catch (error) {
      console.error('Error creating account:', error)
      // Error state is handled by parent component
    } finally {
      setSubmitting(false)
    }
  }, [formData, onCreateAccount, group, t])

  return (
    <>
      <div className='mb-4'>
        <h3 className='text-lg font-semibold mb-2'>{t('Get started with payments')}</h3>
        <p className='text-sm text-foreground/70 mb-4'>
          {t('Set up Stripe Connect to accept payments. If you already have a Stripe account, Stripe will prompt you to connect it during onboarding.')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-4'>
        <SettingsControl
          label={t('Email')}
          type='email'
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          placeholder={currentUser?.email || t('your-email@example.com')}
          required
          helpText={t('This email will be associated with your Stripe account')}
        />

        <SettingsControl
          label={t('Business Name')}
          value={formData.businessName}
          onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
          placeholder={group?.name || t('Business or Organization Name')}
          helpText={t('The name of your business or organization (defaults to group name)')}
        />

        <div className='flex gap-3'>
          <div className='flex-1'>
            <SettingsControl
              label={t('Country')}
              value={formData.country}
              onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
              renderControl={(props) => (
                <select {...props} className='w-full p-2 rounded-md bg-background border border-border text-foreground'>
                  <option value='US'>{t('United States')}</option>
                  <option value='CA'>{t('Canada')}</option>
                  <option value='GB'>{t('United Kingdom')}</option>
                  <option value='AU'>{t('Australia')}</option>
                  <option value='IE'>{t('Ireland')}</option>
                  <option value='NZ'>{t('New Zealand')}</option>
                  <option value='DE'>{t('Germany')}</option>
                  <option value='FR'>{t('France')}</option>
                  <option value='ES'>{t('Spain')}</option>
                  <option value='NL'>{t('Netherlands')}</option>
                </select>
              )}
              helpText={t('Country where your business is located')}
            />
          </div>
        </div>

        <div className='flex gap-2 justify-end pt-4'>
          <Button
            type='submit'
            disabled={loading || submitting}
            className='w-full sm:w-auto'
          >
            {submitting ? t('Creating...') : t('Create Account')}
          </Button>
        </div>
      </form>

      <div className='mt-4 p-3 bg-background/50 rounded-md text-sm text-foreground/70'>
        <p className='font-semibold mb-2'>{t('About Stripe Connect:')}</p>
        <ul className='space-y-1 list-disc list-inside'>
          <li>{t('Accept credit card and other payment methods')}</li>
          <li>{t('Automatic payouts to your bank account')}</li>
          <li>{t('Full dashboard access to view transactions')}</li>
          <li>{t('Stripe handles all payment disputes and fraud')}</li>
        </ul>
      </div>
    </>
  )
}

/**
 * Section showing Stripe account status from database
 *
 * Displays the current state of the connected account based on database values,
 * and provides actions to check status with Stripe or complete onboarding.
 */
function StripeStatusSection ({ group, loading, onCheckStatus, onStartOnboarding, t }) {
  const chargesEnabled = group?.stripeChargesEnabled
  const payoutsEnabled = group?.stripePayoutsEnabled
  const detailsSubmitted = group?.stripeDetailsSubmitted
  const isFullyOnboarded = chargesEnabled && payoutsEnabled
  const needsOnboarding = !detailsSubmitted
  const isPending = detailsSubmitted && (!chargesEnabled || !payoutsEnabled)

  return (
    <div className='bg-card p-6 rounded-md text-foreground shadow-xl mb-4'>
      <div className='flex items-start justify-between mb-4'>
        <div className='flex items-start gap-3'>
          {isFullyOnboarded
            ? (<CheckCircle className='w-8 h-8 text-green-500 flex-shrink-0' />)
            : (<AlertCircle className='w-8 h-8 text-amber-500 flex-shrink-0' />)}
          <div>
            <h3 className='text-lg font-semibold mb-1'>
              {isFullyOnboarded
                ? t('Account Active')
                : isPending
                  ? t('Account Status: Pending')
                  : t('Stripe Account Setup Required')}
            </h3>
            <p className='text-sm text-foreground/70'>
              {isFullyOnboarded
                ? t('Your Stripe account is fully set up and ready to accept payments.')
                : isPending
                  ? t('Your account details have been submitted to Stripe and are being reviewed. This process typically takes a few minutes to a few hours.')
                  : t('Complete your account setup to start accepting payments.')}
            </p>
          </div>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={onCheckStatus}
          disabled={loading}
        >
          {loading ? t('Checking...') : t('Check Stripe Status')}
        </Button>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4'>
        <StatusBadge
          label={t('Details Submitted')}
          value={detailsSubmitted}
          t={t}
        />
        <StatusBadge
          label={t('Accept Payments')}
          value={chargesEnabled}
          t={t}
        />
        <StatusBadge
          label={t('Receive Payouts')}
          value={payoutsEnabled}
          t={t}
        />
      </div>

      {group?.stripeDashboardUrl && (
        <div className='mb-4'>
          <a
            href={group.stripeDashboardUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-background'
          >
            <ExternalLink className='w-4 h-4' />
            {t('Open Stripe Dashboard')}
          </a>
        </div>
      )}

      {needsOnboarding && (
        <Button
          onClick={() => onStartOnboarding()}
          className='w-full sm:w-auto'
        >
          <ExternalLink className='w-4 h-4 mr-2' />
          {t('Complete Onboarding')}
        </Button>
      )}
    </div>
  )
}

/**
 * Badge showing a single status indicator
 */
function StatusBadge ({ label, value, t }) {
  return (
    <div className='flex items-center gap-2 p-3 bg-background rounded-md'>
      <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-gray-400'}`} />
      <div>
        <p className='text-xs text-foreground/70'>{label}</p>
        <p className='text-sm font-medium'>{value ? t('Yes') : t('No')}</p>
      </div>
    </div>
  )
}

export default AccountTab
