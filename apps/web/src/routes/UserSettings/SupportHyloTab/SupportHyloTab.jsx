import { HeartHandshake } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import Loading from 'components/Loading'
import SupporterBadge from 'components/SupporterBadge/SupporterBadge'
import SupportHyloModal from 'components/SupportHyloModal/SupportHyloModal'
import { Switch } from 'components/ui/switch'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import {
  attributeSupportContribution,
  checkOpenCollectiveContributions,
  fetchSupportHylo,
  setSupporterBadgeVisibility,
  supportErrorCode
} from 'store/actions/supportHylo'

const sectionClass = 'rounded-xl border-2 border-foreground/10 bg-background/50 p-4 mb-4'

function formatDate (value) {
  if (!value) return ''
  const date = new Date(value)
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString()
}

/**
 * Settings > Support Hylo (#1754): supporter status, the opt-in badge, the
 * "Check my Open Collective contributions" email check, which group each
 * contribution counts for, and the entry point to the donation flow.
 * Amounts are never shown: the API doesn't expose them.
 */
export default function SupportHyloTab () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { setHeaderDetails } = useViewHeader()
  const [info, setInfo] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    setHeaderDetails({ title: t('Support Hylo'), icon: '', info: '', search: false })
  }, [])

  const load = useCallback(() => {
    return dispatch(fetchSupportHylo())
      .then(res => {
        const data = res?.payload?.data?.supportHylo
        if (!data) throw new Error('No support info')
        setInfo(data)
        setLoadError(false)
      })
      .catch(() => setLoadError(true))
  }, [dispatch])

  useEffect(() => { load() }, [load])

  const handleBadgeToggle = async show => {
    setInfo(prev => ({ ...prev, showSupporterBadge: show }))
    try {
      await dispatch(setSupporterBadgeVisibility({ show }))
    } catch (e) {
      setInfo(prev => ({ ...prev, showSupporterBadge: !show }))
    }
  }

  const handleCheck = async () => {
    setChecking(true)
    setCheckResult(null)
    try {
      const res = await dispatch(checkOpenCollectiveContributions())
      const result = res?.payload?.data?.checkOpenCollectiveContributions
      if (!result) throw res
      setCheckResult(!result.found ? 'notFound' : result.linkedCount > 0 ? 'found' : result.linkedElsewhere ? 'linkedElsewhere' : 'found')
      await load()
    } catch (e) {
      const code = supportErrorCode(e)
      setCheckResult(code === 'EMAIL_NOT_VERIFIED' ? 'emailNotVerified' : code === 'OPEN_COLLECTIVE_NOT_CONFIGURED' ? 'notConfigured' : 'error')
    } finally {
      setChecking(false)
    }
  }

  const handleAttribute = async (contributionId, groupId) => {
    try {
      await dispatch(attributeSupportContribution(contributionId, groupId))
    } finally {
      load()
    }
  }

  if (!info && !loadError) return <Loading />
  if (loadError) return <p className='text-foreground/70'>{t('Something went wrong loading your supporter details. Please try again.')}</p>

  const isSupporter = info.supporterStatus === 'supporter'
  const checkMessages = {
    found: t('We found your contributions on Open Collective and linked them to your account.'),
    notFound: t('We couldn\'t find any contributions to Hylo made with your email address.'),
    linkedElsewhere: t('Those contributions are already linked to a different Hylo account.'),
    emailNotVerified: t('Please verify your email address first, then check again.'),
    notConfigured: t('Checking Open Collective contributions isn\'t available yet.'),
    error: t('Something went wrong. Please try again later.')
  }
  const frequencyLabels = {
    ONETIME: t('One-time contribution'),
    MONTHLY: t('Monthly contribution'),
    YEARLY: t('Yearly contribution')
  }

  return (
    <div data-testid='support-hylo-tab'>
      <div className={sectionClass}>
        <div className='flex items-center gap-3 mb-2'>
          <HeartHandshake className='h-6 w-6 text-pink-500' aria-hidden='true' />
          <h2 className='m-0 text-xl font-bold text-foreground'>
            {isSupporter ? t('You are a Hylo supporter') : t('Support Hylo')}
          </h2>
        </div>
        <p className='text-foreground/80 text-sm'>
          {isSupporter
            ? t('Thank you for helping keep Hylo running for communities everywhere.')
            : t('Hylo is a nonprofit, open-source platform funded by its community. Contributions go through our Open Collective.')}
        </p>
        {info.manualGrant && (
          <p className='text-foreground/80 text-sm' data-testid='support-manual-grant'>
            {info.manualGrantExpiresAt
              ? t('The Hylo team has recognised your contribution to Hylo until {{date}}.', { date: formatDate(info.manualGrantExpiresAt) })
              : t('The Hylo team has recognised your contribution to Hylo.')}
          </p>
        )}
        <button
          type='button'
          data-testid='open-support-hylo-modal'
          onClick={() => setModalOpen(true)}
          className='mt-2 rounded-md bg-selected px-4 py-2 text-sm font-semibold text-foreground hover:bg-selected/90'
        >
          {isSupporter ? t('Contribute again') : t('Become a supporter')}
        </button>
      </div>

      <div className={sectionClass}>
        <h3 className='mt-0 mb-2 text-lg font-semibold text-foreground'>{t('Supporter badge')}</h3>
        <div className='flex items-center justify-between gap-4'>
          <label htmlFor='show-supporter-badge' className='text-sm text-foreground'>
            {t('Show a supporter badge on my profile')}
          </label>
          <Switch
            id='show-supporter-badge'
            data-testid='show-supporter-badge'
            checked={!!info.showSupporterBadge}
            onCheckedChange={handleBadgeToggle}
          />
        </div>
        <p className='text-xs text-foreground/60 mt-2 mb-0'>
          {isSupporter
            ? t('Off by default. Only shows that you support Hylo, never how much.')
            : t('The badge appears once you are a supporter. It only shows that you support Hylo, never how much.')}
        </p>
        {info.hasIncognitoContributions && (
          <p className='text-xs text-foreground/60 mt-2 mb-0' data-testid='support-incognito-note'>
            {t('Some of your contributions were made incognito on Open Collective. Turning the badge on shows that you support Hylo.')}
          </p>
        )}
        {isSupporter && info.showSupporterBadge && (
          <div className='mt-3 flex items-center gap-2 text-xs text-foreground/60'>
            {t('Preview:')} <SupporterBadge className='bg-foreground/70' />
          </div>
        )}
      </div>

      <div className={sectionClass}>
        <h3 className='mt-0 mb-2 text-lg font-semibold text-foreground'>{t('Your Open Collective contributions')}</h3>
        <p className='text-sm text-foreground/80'>
          {t('Already contributed through Open Collective? We can look for contributions made with the verified email address on your Hylo account.')}
        </p>
        <button
          type='button'
          data-testid='check-open-collective'
          onClick={handleCheck}
          disabled={!info.checkAvailable || checking}
          className='rounded-md border-2 border-foreground/20 px-3 py-1.5 text-sm font-medium text-foreground hover:border-foreground/50 disabled:opacity-50'
        >
          {checking ? t('Checking...') : t('Check my Open Collective contributions')}
        </button>
        {!info.checkAvailable && (
          <p className='text-xs text-foreground/60 mt-2 mb-0' data-testid='support-check-unavailable'>
            {checkMessages.notConfigured}
          </p>
        )}
        {checkResult && (
          <p className='text-sm text-foreground mt-2 mb-0' role='status' data-testid='support-check-result'>{checkMessages[checkResult]}</p>
        )}

        {info.contributions.length > 0 && (
          <ul className='mt-4 mb-0 p-0 flex flex-col gap-2' data-testid='support-contributions'>
            {info.contributions.map(contribution => (
              <li key={contribution.id} className='list-none rounded-lg border border-foreground/10 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                <div className='text-sm text-foreground'>
                  <div className='font-semibold'>{frequencyLabels[contribution.frequency] || t('Contribution')}</div>
                  <div className='text-foreground/60 text-xs'>
                    {t('Started {{date}}', { date: formatDate(contribution.createdAt) })}
                    {' · '}
                    {contribution.qualifies ? t('Counts towards your supporter status') : t('No longer active')}
                  </div>
                </div>
                {info.adminGroups.length > 0 && (
                  <label className='text-xs text-foreground/80 flex flex-col gap-1'>
                    {t('Also counts for')}
                    <select
                      value={contribution.group?.id || ''}
                      onChange={e => handleAttribute(contribution.id, e.target.value || null)}
                      className='rounded-md border-2 border-foreground/20 bg-background p-1 text-foreground text-sm'
                    >
                      <option value=''>{t('No group')}</option>
                      {info.adminGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </label>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <SupportHyloModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  )
}
