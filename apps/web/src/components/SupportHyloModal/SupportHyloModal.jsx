import { HeartHandshake } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'components/ui/dialog'
import { createSupportIntent, fetchSupportHylo } from 'store/actions/supportHylo'
import { buildDonateUrl, supportThanksUrl, SUPPORT_AMOUNT_PRESETS } from 'util/supportHylo'
import { cn } from 'util/index'

const choiceClass = selected => cn(
  'rounded-md border-2 px-3 py-1.5 text-sm font-medium transition-all',
  selected ? 'border-selected bg-selected/20 text-foreground' : 'border-foreground/20 text-foreground/80 hover:border-foreground/50'
)

/**
 * "Support Hylo" (#1754): pick who the support counts for, an amount and how
 * often, then continue to Open Collective's hosted donate page. We create a
 * support intent first so the contribution can be matched when the person
 * comes back to /support/thanks (or by the next sync if they don't).
 * `navigate` is injectable for tests; it defaults to a full-page redirect.
 */
export default function SupportHyloModal ({ open, onOpenChange, initialGroupId = null, navigate }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [adminGroups, setAdminGroups] = useState([])
  const [groupId, setGroupId] = useState(initialGroupId || '')
  const [frequency, setFrequency] = useState('month')
  const [amount, setAmount] = useState(25)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSubmitting(false)
    setGroupId(initialGroupId || '')
    dispatch(fetchSupportHylo())
      .then(res => setAdminGroups(res?.payload?.data?.supportHylo?.adminGroups || []))
      .catch(() => setAdminGroups([]))
  }, [open, initialGroupId])

  const intervals = [
    { value: 'oneTime', label: t('One time') },
    { value: 'month', label: t('Monthly') },
    { value: 'year', label: t('Yearly') }
  ]

  const handleContinue = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await dispatch(createSupportIntent(groupId || null))
      const tag = res?.payload?.data?.createSupportIntent?.tag
      if (!tag) throw new Error('No support intent')
      const url = buildDonateUrl({ amount, interval: frequency, tag, redirectUrl: supportThanksUrl() })
      if (navigate) navigate(url)
      else window.location.assign(url)
    } catch (e) {
      setError(t("We couldn't start your contribution. Please try again."))
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md' data-testid='support-hylo-modal'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <HeartHandshake className='h-5 w-5 text-pink-500' aria-hidden='true' />
            {t('Support Hylo')}
          </DialogTitle>
          <DialogDescription>
            {t('Hylo is a nonprofit, open-source platform funded by its community. Contributions go through our Open Collective.')}
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4'>
          <label className='flex flex-col gap-1 text-sm text-foreground'>
            <span className='font-semibold'>{t('Count my support for')}</span>
            <select
              data-testid='support-attribution'
              value={groupId}
              onChange={e => setGroupId(e.target.value)}
              className='rounded-md border-2 border-foreground/20 bg-background p-2 text-foreground'
            >
              <option value=''>{t('Just me')}</option>
              {adminGroups.map(g => (
                <option key={g.id} value={g.id}>{t('Me and {{groupName}}', { groupName: g.name })}</option>
              ))}
            </select>
            {adminGroups.length > 0 && (
              <span className='text-xs text-foreground/60'>{t('Groups you administer can show a supporter badge too.')}</span>
            )}
          </label>

          <div className='flex flex-col gap-1 text-sm text-foreground'>
            <span className='font-semibold'>{t('How often')}</span>
            <div className='flex flex-wrap gap-2' role='radiogroup' aria-label={t('How often')}>
              {intervals.map(option => (
                <button
                  key={option.value}
                  type='button'
                  role='radio'
                  aria-checked={frequency === option.value}
                  onClick={() => setFrequency(option.value)}
                  className={choiceClass(frequency === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className='flex flex-col gap-1 text-sm text-foreground'>
            <span className='font-semibold'>{t('Amount (USD)')}</span>
            <div className='flex flex-wrap items-center gap-2'>
              {SUPPORT_AMOUNT_PRESETS.map(preset => (
                <button
                  key={preset}
                  type='button'
                  aria-pressed={Number(amount) === preset}
                  onClick={() => setAmount(preset)}
                  className={choiceClass(Number(amount) === preset)}
                >
                  ${preset}
                </button>
              ))}
              <input
                type='number'
                min='1'
                step='1'
                aria-label={t('Other amount')}
                placeholder={t('Other')}
                value={SUPPORT_AMOUNT_PRESETS.includes(Number(amount)) ? '' : amount}
                onChange={e => setAmount(e.target.value)}
                className='w-24 rounded-md border-2 border-foreground/20 bg-background p-1.5 text-foreground'
              />
            </div>
            <span className='text-xs text-foreground/60'>{t('You can change the amount and currency on Open Collective.')}</span>
          </div>

          {error && <p className='text-sm text-destructive m-0' role='alert'>{error}</p>}
        </div>

        <DialogFooter>
          <button
            type='button'
            data-testid='support-hylo-continue'
            onClick={handleContinue}
            disabled={submitting || !(Number(amount) > 0)}
            className='rounded-md bg-selected px-4 py-2 text-sm font-semibold text-foreground hover:bg-selected/90 disabled:opacity-50'
          >
            {submitting ? t('Opening Open Collective...') : t('Continue to Open Collective')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
