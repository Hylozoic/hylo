import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Button from 'components/ui/button'
import Loading from 'components/Loading'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from 'components/ui/dialog'
import { Label } from 'components/ui/label'
import { Input } from 'components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from 'components/ui/select'
import { cn } from 'util/index'
import { parseAccessGrants } from 'util/accessGrants'
import {
  fetchMembershipChangeEligibleOfferings,
  fetchMembershipChangeInvoicePreview,
  fetchMembershipChangePreview,
  commitMembershipChange
} from 'store/actions/membershipChange'
import { applyOptimisticMembershipChange } from 'store/actions/fetchMyTransactions'
import { membershipChangeDefersToPeriodEnd } from 'util/membershipChangeModes'
import HyloHTML from 'components/HyloHTML'

function formatCents (cents, currency = 'usd') {
  if (cents == null) return null
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase()
  }).format(cents / 100)
}

/**
 * Sliding scale config from offering metadata or accessGrants (mirrors backend helpers).
 */
function getSlidingScaleFromOffering (offering) {
  if (!offering) return null
  let meta = offering.metadata
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta)
    } catch {
      meta = {}
    }
  }
  if (meta?.slidingScale?.enabled) return meta.slidingScale
  const ag = parseAccessGrants(offering.accessGrants)
  if (ag.slidingScale?.enabled) return ag.slidingScale
  return null
}

function getErrorMessage (err) {
  if (!err) return 'Unknown error'
  if (typeof err === 'string') return err
  if (err.message) return err.message
  if (Array.isArray(err) && err[0]?.message) return err[0].message
  return String(err)
}

function normalizeCurrency (currency) {
  return (currency || '').toLowerCase().trim()
}

const NO_PLAN_VALUE = '__none__'

/**
 * Dropdown label: sliding scale shows range in money terms; fixed prices show unit price.
 */
function formatOfferingSelectLabel (offering, t) {
  if (!offering) return ''
  const name = offering.name || ''
  const ss = getSlidingScaleFromOffering(offering)
  const unitCents = offering.priceInCents
  const currency = offering.currency || 'usd'

  if (ss?.enabled) {
    const minQ = ss.minimum != null ? ss.minimum : 1
    const maxQ = ss.maximum
    if (unitCents != null && unitCents > 0) {
      const minMoney = minQ * unitCents
      if (maxQ != null && maxQ > minQ) {
        const maxMoney = maxQ * unitCents
        return `${name} — ${t('Sliding scale')} (${formatCents(minMoney, currency)}–${formatCents(maxMoney, currency)})`
      }
      return `${name} — ${t('Sliding scale')} (${formatCents(minMoney, currency)})`
    }
    if (maxQ != null && maxQ > minQ) {
      return `${name} — ${t('Sliding scale')} (${minQ}–${maxQ})`
    }
    return `${name} — ${t('Sliding scale')}`
  }

  if (unitCents != null) {
    return `${name} — ${formatCents(unitCents, currency)}`
  }
  return name
}

/**
 * Human-friendly details for the selected offering card.
 */
function getOfferingDetails (offering, t) {
  if (!offering) return null
  const ss = getSlidingScaleFromOffering(offering)
  const unitCents = offering.priceInCents
  const currency = (offering.currency || 'usd').toUpperCase()
  const accessGrants = parseAccessGrants(offering.accessGrants)

  let pricingLabel = null
  if (ss?.enabled) {
    const minQ = ss.minimum != null ? ss.minimum : 1
    const maxQ = ss.maximum
    if (unitCents != null && unitCents > 0) {
      const minMoney = minQ * unitCents
      if (maxQ != null && maxQ > minQ) {
        pricingLabel = `${t('Sliding scale')}: ${formatCents(minMoney, offering.currency)} - ${formatCents(maxQ * unitCents, offering.currency)}`
      } else {
        pricingLabel = `${t('Sliding scale')}: ${formatCents(minMoney, offering.currency)}`
      }
    } else if (maxQ != null && maxQ > minQ) {
      pricingLabel = `${t('Sliding scale')}: ${minQ} - ${maxQ} ${t('Quantity')}`
    } else {
      pricingLabel = t('Sliding scale')
    }
  } else if (unitCents != null) {
    pricingLabel = formatCents(unitCents, offering.currency)
  }

  const accessSummary = [
    (accessGrants.groupIds?.length ? `${accessGrants.groupIds.length} ${t('Group access')}` : null),
    (accessGrants.trackIds?.length ? `${accessGrants.trackIds.length} ${t('Track access')}` : null),
    ((accessGrants.groupRoleIds?.length || accessGrants.commonRoleIds?.length)
      ? `${(accessGrants.groupRoleIds?.length || 0) + (accessGrants.commonRoleIds?.length || 0)} ${t('Role access')}`
      : null)
  ].filter(Boolean).join(' • ')

  return {
    pricingLabel,
    currency,
    duration: offering.duration || null,
    accessSummary: accessSummary || null
  }
}

/**
 * Offerings for the select: includes current plan (injected if missing from API), current row first.
 */
function buildDisplayOfferings ({ eligibleOfferings, fromIdStr, fromOfferingId, currentOfferingName, t }) {
  const list = eligibleOfferings.map(o => ({
    ...o,
    isCurrentPlan: Boolean(fromIdStr && String(o.id) === fromIdStr)
  }))
  const hasCurrent = list.some(o => o.isCurrentPlan)
  if (fromIdStr && !hasCurrent) {
    list.unshift({
      id: fromOfferingId,
      name: currentOfferingName || t('Current subscription'),
      priceInCents: null,
      currency: 'usd',
      metadata: null,
      accessGrants: null,
      duration: null,
      isCurrentPlan: true,
      isInjectedCurrent: true
    })
  }
  list.sort((a, b) => {
    if (a.isCurrentPlan === b.isCurrentPlan) return 0
    return a.isCurrentPlan ? -1 : 1
  })
  return list
}

/**
 * Invoice preview for immediate upgrade: Hylo prepaid credit line + new plan (billing from today).
 */
function InvoicePreviewBreakdown ({ invoicePreview, invoicePreviewError, t }) {
  if (invoicePreviewError) {
    return (
      <p className='text-sm text-amber-800 dark:text-amber-200 leading-relaxed border-t border-primary/10 pt-2'>
        {t('subscriptionChange.invoicePreview.loadFailed')}
        <span className='mt-1 block text-xs opacity-90'>{invoicePreviewError}</span>
      </p>
    )
  }
  if (!invoicePreview) return null

  const lines = invoicePreview.lines || []
  const cur = invoicePreview.currency || 'usd'
  const due =
    invoicePreview.amountDue != null
      ? invoicePreview.amountDue
      : invoicePreview.total != null
        ? invoicePreview.total
        : null

  const showLines = lines.length > 0
  const showDue = due != null

  if (!showLines && !showDue) return null

  return (
    <div className='space-y-2 border-t border-primary/10 pt-2'>
      {showLines && (
        <>
          <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
            {t('subscriptionChange.invoicePreview.heading')}
          </p>
          <ul className='space-y-1.5 text-sm'>
            {lines.map((line, idx) => (
              <li key={idx} className='flex justify-between gap-3'>
                <span className='min-w-0 break-words text-muted-foreground'>
                  {line.description || '—'}
                  {line.proration && (
                    <span className='ml-1 text-[11px] font-semibold uppercase tracking-wide text-primary'>
                      ({t('subscriptionChange.invoicePreview.proration')})
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'shrink-0 tabular-nums font-medium',
                    line.amount < 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-foreground'
                  )}
                >
                  {formatCents(line.amount, line.currency || cur)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {showDue && (
        <p className={cn('text-sm font-semibold text-foreground break-words', showLines && 'pt-1')}>
          {t('Estimated due now')}: {formatCents(due, cur)}
        </p>
      )}
      {(showLines || showDue) && (
        <p className='text-xs text-muted-foreground leading-relaxed border-t border-primary/10 pt-2'>
          {t('subscriptionChange.invoicePreview.totalExplainer')}
        </p>
      )}
    </div>
  )
}

/**
 * Explains the resolved change mode for the member (English keys in locales).
 */
function ModeExplanation ({ mode, meta, t }) {
  if (!mode) return null

  const modeBodyClass =
    'text-sm text-muted-foreground leading-relaxed break-words'

  if (mode === 'immediate_upgrade') {
    return (
      <p className={modeBodyClass}>
        {t('subscriptionChange.immediateProrate.body')}
      </p>
    )
  }
  if (mode === 'scheduled_period_end') {
    return (
      <p className={modeBodyClass}>
        {t('subscriptionChange.scheduledPeriodEnd.body')}
      </p>
    )
  }
  if (mode === 'currency_mismatch_blocked') {
    return (
      <p className={modeBodyClass}>
        {t('subscriptionChange.currencyMismatch.blocked', {
          currentCurrency: meta?.currentCurrency || '—',
          targetCurrency: meta?.targetCurrency || '—'
        })}
      </p>
    )
  }
  if (mode === 'sliding_scale_next_cycle') {
    return (
      <p className={modeBodyClass}>
        {t('subscriptionChange.slidingScale.nextCycle')}
      </p>
    )
  }
  if (mode === 'past_due_no_proration') {
    return (
      <p className={modeBodyClass}>
        {t('subscriptionChange.pastDue.body')}
      </p>
    )
  }
  if (mode === 'lifetime_no_proration') {
    return (
      <p className={modeBodyClass}>
        {t('subscriptionChange.lifetime.body')}
      </p>
    )
  }
  return null
}

/**
 * Modal to change a group membership subscription (recurring) to another eligible offering.
 */
export default function ChangeSubscriptionModal ({
  open,
  onClose,
  groupId,
  fromOfferingId,
  currentOfferingName,
  subscriptionStatus,
  onCommitted
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const [eligibleOfferings, setEligibleOfferings] = useState([])
  const [loadingEligible, setLoadingEligible] = useState(false)
  const [selectedToId, setSelectedToId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [preview, setPreview] = useState(null)
  const [invoicePreview, setInvoicePreview] = useState(null)
  const [invoicePreviewError, setInvoicePreviewError] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingInvoice, setLoadingInvoice] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState(null)

  const fromIdStr = fromOfferingId != null ? String(fromOfferingId) : ''

  const displayOfferings = useMemo(
    () => buildDisplayOfferings({
      eligibleOfferings,
      fromIdStr,
      fromOfferingId,
      currentOfferingName,
      t
    }),
    [eligibleOfferings, fromIdStr, fromOfferingId, currentOfferingName, t]
  )

  const fromOffering = useMemo(
    () => displayOfferings.find(o => String(o.id) === fromIdStr),
    [displayOfferings, fromIdStr]
  )

  const toOffering = useMemo(
    () => displayOfferings.find(o => String(o.id) === String(selectedToId)),
    [displayOfferings, selectedToId]
  )

  const slidingScale = useMemo(() => getSlidingScaleFromOffering(toOffering), [toOffering])
  const selectedOfferingDetails = useMemo(() => getOfferingDetails(toOffering, t), [toOffering, t])
  const isSameOffering = selectedToId && String(selectedToId) === fromIdStr
  const showQuantity = slidingScale?.enabled === true
  const fromCurrency = normalizeCurrency(fromOffering?.currency)
  const hasCurrencyMismatchOptions = useMemo(
    () => displayOfferings.some((o) =>
      !o.isCurrentPlan &&
      fromCurrency &&
      normalizeCurrency(o.currency) &&
      normalizeCurrency(o.currency) !== fromCurrency
    ),
    [displayOfferings, fromCurrency]
  )

  const isPastDue = subscriptionStatus === 'past_due'

  const isSlidingScaleQuantityOnly = Boolean(
    isSameOffering &&
    showQuantity &&
    quantity >= 1 &&
    !Number.isNaN(parseInt(quantity, 10))
  )

  const loadEligible = useCallback(async () => {
    if (!groupId) return
    setLoadingEligible(true)
    setError(null)
    try {
      const result = await dispatch(fetchMembershipChangeEligibleOfferings({ groupId: String(groupId) }))
      const data = result.payload?.getData
        ? result.payload.getData()
        : result.payload?.data?.membershipChangeEligibleOfferings
      setEligibleOfferings(data?.offerings || [])
    } catch (err) {
      setError(getErrorMessage(err))
      setEligibleOfferings([])
    } finally {
      setLoadingEligible(false)
    }
  }, [dispatch, groupId])

  useEffect(() => {
    if (open && groupId) {
      loadEligible()
    }
  }, [open, groupId, loadEligible])

  useEffect(() => {
    if (!open) {
      setSelectedToId('')
      setQuantity(1)
      setPreview(null)
      setInvoicePreview(null)
      setInvoicePreviewError(null)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (!showQuantity || !slidingScale) return
    const min = slidingScale.minimum || 1
    setQuantity(q => (q < min ? min : q))
  }, [showQuantity, slidingScale, selectedToId])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!open || !groupId || !fromIdStr || !selectedToId) {
        setPreview(null)
        setInvoicePreview(null)
        setInvoicePreviewError(null)
        return
      }

      if (showQuantity) {
        const q = parseInt(quantity, 10)
        if (Number.isNaN(q) || q < 1) {
          setPreview(null)
          setInvoicePreview(null)
          setInvoicePreviewError(null)
          return
        }
        if (slidingScale?.minimum != null && q < slidingScale.minimum) {
          setPreview(null)
          setInvoicePreview(null)
          setInvoicePreviewError(null)
          return
        }
        if (slidingScale?.maximum != null && q > slidingScale.maximum) {
          setPreview(null)
          setInvoicePreview(null)
          setInvoicePreviewError(null)
          return
        }
      }

      setLoadingPreview(true)
      setError(null)
      try {
        const result = await dispatch(fetchMembershipChangePreview({
          groupId: String(groupId),
          fromOfferingId: fromIdStr,
          toOfferingId: String(selectedToId),
          isPastDue,
          isSlidingScaleQuantityOnly
        }))
        if (cancelled) return
        const data = result.payload?.getData
          ? result.payload.getData()
          : result.payload?.data?.membershipChangePreview
        setPreview(data || null)

        if (data?.mode === 'immediate_upgrade') {
          setLoadingInvoice(true)
          setInvoicePreviewError(null)
          try {
            const invResult = await dispatch(fetchMembershipChangeInvoicePreview({
              groupId: String(groupId),
              fromOfferingId: fromIdStr,
              toOfferingId: String(selectedToId)
            }))
            if (cancelled) return
            const invData = invResult.payload?.getData
              ? invResult.payload.getData()
              : invResult.payload?.data?.membershipChangeInvoicePreview
            setInvoicePreview(invData || null)
            setInvoicePreviewError(null)
          } catch (invErr) {
            if (!cancelled) {
              setInvoicePreview(null)
              setInvoicePreviewError(getErrorMessage(invErr))
            }
          } finally {
            if (!cancelled) setLoadingInvoice(false)
          }
        } else {
          setInvoicePreview(null)
          setInvoicePreviewError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setPreview(null)
          setInvoicePreview(null)
          setInvoicePreviewError(null)
          setError(getErrorMessage(err))
        }
      } finally {
        if (!cancelled) setLoadingPreview(false)
      }
    }

    run()
    return () => { cancelled = true }
  }, [
    open,
    dispatch,
    groupId,
    fromIdStr,
    selectedToId,
    isPastDue,
    showQuantity,
    quantity,
    slidingScale,
    isSlidingScaleQuantityOnly
  ])

  const handleCommit = async () => {
    if (!groupId || !fromIdStr || !selectedToId) return
    setCommitting(true)
    setError(null)
    try {
      const result = await dispatch(commitMembershipChange({
        groupId: String(groupId),
        fromOfferingId: fromIdStr,
        toOfferingId: String(selectedToId),
        newQuantity: showQuantity ? parseInt(quantity, 10) : null
      }))
      const data = result.payload?.getData
        ? result.payload.getData()
        : result.payload?.data?.membershipChangeCommit
      if (data?.success) {
        if (!membershipChangeDefersToPeriodEnd(data.mode)) {
          const qty = showQuantity ? parseInt(quantity, 10) : 1
          const unit = toOffering?.priceInCents
          const optimisticAmountPaid =
            unit != null && !Number.isNaN(qty) && qty >= 1 ? unit * qty : undefined
          dispatch(applyOptimisticMembershipChange({
            groupId: String(groupId),
            fromOfferingId: fromIdStr,
            toOffering: {
              id: toOffering.id,
              name: toOffering.name,
              duration: toOffering.duration,
              priceInCents: toOffering.priceInCents
            },
            amountPaid: optimisticAmountPaid,
            currency: toOffering?.currency
          }))
        }
        if (typeof onCommitted === 'function') onCommitted(data)
        onClose()
      } else {
        setError(data?.message || t('Could not update subscription'))
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setCommitting(false)
    }
  }

  const canSubmit = Boolean(
    selectedToId &&
    preview?.mode &&
    !loadingPreview &&
    (!showQuantity || isSlidingScaleQuantityOnly || !isSameOffering) &&
    preview?.mode !== 'currency_mismatch_blocked'
  )

  const selectValue = selectedToId ? String(selectedToId) : NO_PLAN_VALUE

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0',
          'w-[calc(100%-1rem)] max-w-lg sm:w-full',
          'max-h-[min(90vh,100dvh)] min-h-0 overflow-hidden p-4 sm:p-6',
          'pt-5 sm:pt-6'
        )}
      >
        <DialogHeader className='shrink-0 space-y-2 text-left pr-10 sm:pr-12'>
          <DialogTitle className='text-lg sm:text-xl font-semibold leading-snug tracking-tight'>
            {t('Change subscription')}
          </DialogTitle>
          <DialogDescription className='text-sm leading-relaxed text-muted-foreground'>
            {t('Choose a new plan for this membership. Changes follow your group billing rules.')}
          </DialogDescription>
        </DialogHeader>

        <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
          <div className='min-h-0 flex-1 overflow-y-auto overflow-x-visible py-2 px-1.5 sm:px-2 sm:py-3'>
            {loadingEligible && (
              <div className='flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-3'>
                <Loading />
                <span className='text-sm text-muted-foreground'>{t('Loading...')}</span>
              </div>
            )}

            {!loadingEligible && eligibleOfferings.length === 0 && (
              <p className='text-sm text-muted-foreground leading-relaxed break-words rounded-lg border border-dashed border-border bg-muted/10 px-3 py-3'>
                {t('No eligible offerings are available for this group right now.')}
              </p>
            )}

            {!loadingEligible && eligibleOfferings.length > 0 && (
              <div className='flex flex-col gap-4 sm:gap-5'>
                <div className='rounded-lg border border-border bg-muted/20 px-3 py-3 sm:px-4 sm:py-3.5'>
                  <Label className='mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                    {t('Current plan')}
                  </Label>
                  <p className='text-sm sm:text-base font-medium text-foreground break-words'>
                    {fromOffering?.name || currentOfferingName || t('Current subscription')}
                  </p>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='change-sub-to' className='text-sm font-medium'>
                    {t('New plan')}
                  </Label>
                  <Select
                    value={selectValue}
                    onValueChange={(v) => setSelectedToId(v === NO_PLAN_VALUE ? '' : v)}
                  >
                    <SelectTrigger
                      id='change-sub-to'
                      className={cn(
                        'min-h-11 w-full text-base sm:h-11 sm:min-h-0 sm:text-sm',
                        'bg-card text-foreground shadow-sm',
                        'border-2 border-input',
                        'ring-offset-0 focus:ring-inset focus:ring-offset-0',
                        'hover:border-primary/45 hover:bg-muted/25',
                        'focus:ring-2 focus:ring-ring',
                        'data-[state=open]:border-primary/55 data-[state=open]:bg-muted/20'
                      )}
                    >
                      <SelectValue placeholder={t('Choose an offering...')} />
                    </SelectTrigger>
                    <SelectContent position='popper' className='z-[200] max-h-[min(60vh,20rem)]'>
                      <SelectItem value={NO_PLAN_VALUE} className='text-muted-foreground'>
                        {t('Choose an offering...')}
                      </SelectItem>
                      {displayOfferings.map(o => {
                        const isCurrent = o.isCurrentPlan === true
                        const isCurrencyMismatchOption =
                          !isCurrent &&
                          fromCurrency &&
                          normalizeCurrency(o.currency) &&
                          normalizeCurrency(o.currency) !== fromCurrency
                        return (
                          <SelectItem
                            key={String(o.id)}
                            value={String(o.id)}
                            disabled={isCurrencyMismatchOption}
                            className={cn(
                              'whitespace-normal break-words py-2.5',
                              isCurrent &&
                                cn(
                                  'border-l-4 border-l-emerald-600 dark:border-l-emerald-400',
                                  'bg-emerald-50/90 dark:bg-emerald-950/40',
                                  'font-medium text-foreground',
                                  'data-[highlighted]:bg-emerald-100/95 data-[highlighted]:text-foreground',
                                  'dark:data-[highlighted]:bg-emerald-950/55'
                                )
                            )}
                          >
                            <span className='block pr-1'>
                              <span className='block leading-snug'>
                                {formatOfferingSelectLabel(o, t)}
                              </span>
                              {isCurrent && (
                                <span
                                  className={cn(
                                    'mt-1 inline-flex w-fit rounded-md px-2 py-0.5',
                                    'text-[11px] font-semibold uppercase tracking-wide',
                                    'bg-emerald-600/15 text-emerald-900',
                                    'dark:bg-emerald-400/20 dark:text-emerald-100'
                                  )}
                                >
                                  {t('Current')}
                                </span>
                              )}
                              {isCurrencyMismatchOption && (
                                <span className='mt-1 inline-flex w-fit rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
                                  {t('Not available')}
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {hasCurrencyMismatchOptions && (
                  <p className='text-xs text-muted-foreground leading-relaxed'>
                    {t('subscriptionChange.currencyMismatch.blockedListNotice')}
                  </p>
                )}

                {showQuantity && (
                  <div className='space-y-2'>
                    <Label htmlFor='change-sub-qty' className='text-sm font-medium'>
                      {t('Quantity')}
                    </Label>
                    <Input
                      id='change-sub-qty'
                      type='number'
                      inputMode='numeric'
                      min={slidingScale?.minimum || 1}
                      max={slidingScale?.maximum || undefined}
                      className='min-h-11 text-base sm:min-h-10 sm:text-sm'
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                    />
                  </div>
                )}

                {toOffering && selectedOfferingDetails && (
                  <div className='space-y-2 rounded-lg border border-border bg-muted/20 p-3 sm:p-4'>
                    <Label className='block text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                      {t('New plan')}
                    </Label>
                    <p className='text-sm sm:text-base font-semibold text-foreground break-words'>
                      {toOffering.name}
                    </p>
                    <div className='space-y-1.5 text-sm text-muted-foreground'>
                      {selectedOfferingDetails.pricingLabel && (
                        <p>
                          <span className='font-medium text-foreground'>{t('Price')}:</span> {selectedOfferingDetails.pricingLabel}
                        </p>
                      )}
                      {selectedOfferingDetails.duration && (
                        <p>
                          <span className='font-medium text-foreground'>{t('Duration')}:</span> {selectedOfferingDetails.duration}
                        </p>
                      )}
                      {selectedOfferingDetails.currency && (
                        <p>
                          <span className='font-medium text-foreground'>{t('Currency')}:</span> {selectedOfferingDetails.currency}
                        </p>
                      )}
                      {selectedOfferingDetails.accessSummary && (
                        <p>{selectedOfferingDetails.accessSummary}</p>
                      )}
                      {toOffering.description && (
                        <div className='border-t border-border/60 pt-2 mt-2'>
                          <HyloHTML
                            html={toOffering.description}
                            className='text-sm text-muted-foreground leading-relaxed [&>p:first-child]:mt-0 [&>p:last-child]:mb-0'
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(loadingPreview || loadingInvoice) && (
                  <div className='flex items-center gap-2 rounded-md border border-border/60 bg-muted/15 px-3 py-2.5'>
                    <Loading />
                    <span className='text-sm text-muted-foreground'>{t('Updating preview...')}</span>
                  </div>
                )}

                {preview?.mode && (
                  <div className='space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4'>
                    <ModeExplanation mode={preview.mode} meta={preview.meta} t={t} />
                    {preview.mode === 'immediate_upgrade' && (
                      <InvoicePreviewBreakdown
                        invoicePreview={invoicePreview}
                        invoicePreviewError={invoicePreviewError}
                        t={t}
                      />
                    )}
                  </div>
                )}

                <p className='text-xs text-muted-foreground leading-relaxed'>
                  {t('subscriptionChange.groupAccessOverlapNotice')}
                </p>

                {error && (
                  <p className='text-sm text-destructive leading-relaxed break-words rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2' role='alert'>
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter
          className={cn(
            'shrink-0 flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:justify-end sm:gap-2 sm:border-t-0 sm:pt-0',
            'pb-[max(0.5rem,env(safe-area-inset-bottom))]'
          )}
        >
          <Button
            type='button'
            variant='outline'
            className='w-full min-h-11 sm:w-auto sm:min-h-10'
            onClick={onClose}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            className='w-full min-h-11 sm:w-auto sm:min-h-10'
            disabled={!canSubmit || committing}
            onClick={handleCommit}
          >
            {committing ? t('Loading...') : t('Confirm plan change')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
