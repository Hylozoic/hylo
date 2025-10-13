import React from 'react'
import { useTranslation } from 'react-i18next'
import HyloHTML from 'components/HyloHTML'

function Info ({ label, value }) {
  return (
    <div className='border border-foreground/20 rounded-lg p-3'>
      <div className='text-xs text-foreground/60 uppercase'>{label}</div>
      <div className='text-base'>{value}</div>
    </div>
  )
}

export default function AboutTab ({ round }) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col gap-3'>
      <h1 className='text-2xl font-bold'>{round.title}</h1>
      {round.description && (
        <HyloHTML html={round.description} />
      )}
      {round.criteria && (
        <div>
          <div className='font-semibold'>{t('Criteria')}</div>
          <HyloHTML html={round.criteria} />
        </div>
      )}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <Info label={t('Require Budget')} value={round.requireBudget ? t('Yes') : t('No')} />
        <Info label={t('Voting Method')} value={round.votingMethod} />
        {round.tokenType && <Info label={t('Token Type')} value={round.tokenType} />}
        {round.totalTokens != null && <Info label={t('Total Tokens')} value={round.totalTokens} />}
        {round.minTokenAllocation != null && <Info label={t('Min Token Allocation')} value={round.minTokenAllocation} />}
        {round.maxTokenAllocation != null && <Info label={t('Max Token Allocation')} value={round.maxTokenAllocation} />}
      </div>
    </div>
  )
}
