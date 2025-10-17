import { Check, ChevronsRight, DoorOpen, Eye } from 'lucide-react'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import Button from 'components/ui/button'
import HyloHTML from 'components/HyloHTML'
import { joinFundingRound, leaveFundingRound, updateFundingRound } from 'routes/FundingRounds/FundingRounds.store'
import { bgImageStyle } from 'util/index'

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
  const dispatch = useDispatch()

  const renderRoles = (roles) => {
    if (!roles || roles.length === 0) return t('Any member')
    return (
      <div className='flex flex-wrap gap-1'>
        {roles.map(role => (
          <span key={role.id} className='inline-flex items-center gap-1 px-2 py-1 bg-accent/20 rounded-md text-sm'>
            <span className='text-base'>{role.emoji}</span>
            <span>{role.name}</span>
          </span>
        ))}
      </div>
    )
  }

  const handleJoinFundingRound = useCallback(() => {
    dispatch(joinFundingRound(round.id))
  }, [round?.id])

  const handlePublishRound = useCallback((publishedAt) => {
    if (window.confirm(publishedAt ? t('Are you sure you want to publish this round?') : t('Are you sure you want to unpublish this round?'))) {
      dispatch(updateFundingRound({ id: round.id, publishedAt }))
    }
  }, [round?.id])

  return (
    <div className='flex flex-col gap-3 pb-[100px]'>
      {round.bannerUrl && (
        <div
          className='w-full shadow-2xl max-w-[750px] rounded-xl h-[40vh] flex flex-col items-center justify-end bg-cover mb-2 pb-2 relative overflow-hidden'
          style={bgImageStyle(round.bannerUrl)}
        />)}
      <h1 className='text-2xl font-bold'>{round.title}</h1>
      {round.description && (
        <HyloHTML html={round.description} />
      )}
      {round.criteria && (
        <div>
          <h2 className='text-lg font-semibold'>{t('Submission Criteria')}</h2>
          <HyloHTML html={round.criteria} />
        </div>
      )}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <Info label={t('Budget Required')} value={round.requireBudget ? t('Yes') : t('No')} />
        <Info label={t('Voting Method')} value={round.votingMethod === 'token_allocation_constant' ? t('Equal Token Allocation') : t('Divide Total Tokens Equally')} />
        {round.tokenType && <Info label={t('Token Type')} value={round.tokenType} />}
        {round.totalTokens != null && <Info label={round.votingMethod === 'token_allocation_constant' ? t('Tokens per Voter') : t('Total Tokens')} value={round.totalTokens} />}
        {round.minTokenAllocation != null && <Info label={t('Minimum Tokens per Submission')} value={round.minTokenAllocation} />}
        {round.maxTokenAllocation != null && <Info label={t('Maximum Tokens per Submission')} value={round.maxTokenAllocation} />}
      </div>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2'>
        <div className='border border-foreground/20 rounded-lg p-3'>
          <div className='text-xs text-foreground/60 uppercase mb-2'>{t('Who Can Submit')}</div>
          {renderRoles(round.submitterRoles)}
        </div>
        <div className='border border-foreground/20 rounded-lg p-3'>
          <div className='text-xs text-foreground/60 uppercase mb-2'>{t('Who Can Vote')}</div>
          {renderRoles(round.voterRoles)}
        </div>
      </div>

      <div className='absolute bottom-0 left-0 right-0 flex flex-row gap-2 mx-auto w-full max-w-[750px] px-4 py-2 items-center bg-input rounded-t-md z-10'>
        {!round.publishedAt
          ? (
            <>
              <span className='flex-1'>{t('This round is not yet published')}</span>
              <Button
                variant='secondary'
                onClick={(e) => handlePublishRound(new Date().toISOString())}
              >
                <Eye className='w-5 h-5 inline-block' /> <span className='inline-block'>{t('Publish')}</span>
              </Button>
            </>
            )
          : round.isParticipating
            ? (
              <>
                <div className='flex flex-row gap-2 items-center justify-between w-full'>
                  <span className='flex flex-row gap-2 items-center'><Check className='w-4 h-4 text-selected' /> {t('You have joined this funding round')}</span>
                  <button
                    className='border-2 border-foreground/20 flex flex-row gap-2 items-center rounded-md p-2 px-4'
                    onClick={() => dispatch(leaveFundingRound(round.id))}
                  >
                    <DoorOpen className='w-4 h-4' /> {t('Leave Round')}
                  </button>
                </div>
              </>
              )
            : (
              <div className='flex flex-row gap-2 items-center justify-between w-full'>
                <span>{t('Ready to jump in?')}</span>
                <button
                  className='bg-selected text-foreground rounded-md p-2 px-4 flex flex-row gap-2 items-center'
                  onClick={handleJoinFundingRound}
                >
                  <ChevronsRight className='w-4 h-4' /> {t('Join')}
                </button>
              </div>
              )}
      </div>
    </div>
  )
}
