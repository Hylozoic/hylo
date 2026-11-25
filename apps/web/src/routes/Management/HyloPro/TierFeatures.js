import React from 'react'
import { useTranslation } from 'react-i18next'
import { HYLO_PRO_FEATURES, HYLO_PRO_TIERS, featuresForTier } from '@hylo/shared'
import { cn } from 'util/index'
import { featureLabel, tierLabel } from './featureLabels'

/**
 * A tier select and a checkbox per registered feature, for a grant. The tier's features are
 * ticked; unticking one removes it from the grant, ticking one from another tier adds it. The
 * parent owns `tier` and `chosen` (the ticked keys) and turns the difference into overrides with
 * proFeatureOverrides when it saves.
 */
export default function TierFeatures ({ tier, chosen, onChange, disabled }) {
  const { t } = useTranslation()
  const included = new Set(featuresForTier(tier))
  const ticked = new Set(chosen)

  const changeTier = next => onChange({ tier: next, chosen: featuresForTier(next) })
  const toggle = key => {
    const next = new Set(ticked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange({ tier, chosen: HYLO_PRO_FEATURES.map(f => f.key).filter(k => next.has(k)) })
  }

  return (
    <div className='space-y-3'>
      <label className='text-sm text-foreground space-y-1 block w-fit'>
        <span>{t('Tier')}</span>
        <select
          className='block h-10 rounded-md border border-input bg-background px-3 text-sm'
          value={tier}
          disabled={disabled}
          onChange={e => changeTier(e.target.value)}
          data-testid='hylo-pro-tier'
        >
          {HYLO_PRO_TIERS.map(option => <option key={option} value={option}>{tierLabel(option, t)}</option>)}
        </select>
      </label>
      <div className='space-y-1'>
        <span className='text-sm text-foreground'>{t('Features')}</span>
        <p className='text-xs text-foreground/60 m-0'>
          {t("Ticked features are what the grant gives. The tier's features are ticked already: untick one to remove it, or tick one from another tier to add it.")}
        </p>
      </div>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-3' data-testid='hylo-pro-features'>
        {HYLO_PRO_TIERS.map(group => (
          <fieldset key={group} className='m-0 p-0 border-0 space-y-1'>
            <legend className='text-xs uppercase text-foreground/50 mb-1'>{tierLabel(group, t)}</legend>
            {HYLO_PRO_FEATURES.filter(f => f.tier === group).map(({ key }) => {
              const isTicked = ticked.has(key)
              const differs = isTicked !== included.has(key)
              return (
                <label key={key} className={cn('flex items-start gap-2 text-sm text-foreground', differs && 'font-semibold')}>
                  <input
                    type='checkbox'
                    className='mt-1'
                    checked={isTicked}
                    disabled={disabled}
                    onChange={() => toggle(key)}
                    data-testid={`hylo-pro-feature-${key}`}
                  />
                  <span>{featureLabel(key, t)}</span>
                </label>
              )
            })}
          </fieldset>
        ))}
      </div>
    </div>
  )
}
