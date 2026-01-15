import { cn } from 'util/index'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Tooltip from 'components/Tooltip'
import { PROPOSAL_STATUS_COMPLETED } from 'store/models/Post'
import Icon from 'components/Icon/Icon'

import classes from './QuorumBar.module.scss'

const QuorumBar = ({ totalVoters, quorum, actualVoters, proposalStatus }) => {
  const { t } = useTranslation()

  const votersForQuorum = Math.ceil((quorum / 100) * totalVoters)
  const actualVotersWidth = (actualVoters / totalVoters) * 100
  const quorumReached = actualVoters >= votersForQuorum

  let quorumStatus = quorumReached ? t('Quorum reached') : t('Quorum')
  if (proposalStatus === PROPOSAL_STATUS_COMPLETED && !quorumReached) quorumStatus = t('Quorum not reached')

  return (
    // <div className='flex items-center gap-2 group relative'>
    //   <Icon name='Info' className={classes.quorumTooltip} tooltipContent={t('quorumExplainer')} tooltipId='quorum-tt' />
    //   <div className='w-full relative rounded-lg overflow-hidden bg-darkening/20 h-6 items-center flex'>
    //     {quorum > 10 && <div className='text-foreground text-xs absolute right-0 z-10 px-2'>{quorumStatus}{' '}{quorumReached && quorum > 20 && t('voterCount', { count: actualVoters })}</div>}
    //     {!quorumReached && <div className={cn('text-foreground text-xs w-fit absolute left-0 px-2', { [classes.quorumReached]: quorumReached, [classes.bigQuorum]: quorum > 70 })}>{quorum}% ({actualVoters || 0}/{votersForQuorum})</div>}
    //     <div className='h-full bg-selected/100 position absolute left-0 z-5' style={{ width: `${actualVotersWidth}%` }} />
    //     <div className='h-full bg-selected/40 position absolute left-0 z-5' style={{ width: `${quorum}%` }} />
    //     <div className='absolute right-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300' />
    <div className='flex items-center gap-2 group relative'>
      <Icon name='Info' className={classes.quorumTooltip} tooltipContent={t('quorumExplainer')} tooltipId='quorum-tt' />
      <div className={classes.voteProgressContainer}>
        <div className={classes.actualVoters} style={{ width: `${actualVotersWidth}%` }}>
          {quorum > 10 && <div className={classes.quorumText}>{quorumStatus}{' '}{quorumReached && quorum > 20 && t('voterCount', { count: actualVoters })}</div>}
        </div>
        <div className={classes.quorumBar} style={{ width: `${quorum}%` }}>
          {!quorumReached && <div className={cn(classes.quorumNumber, { [classes.quorumReached]: quorumReached, [classes.bigQuorum]: quorum > 70 })}>{quorum}% ({actualVoters || 0}/{votersForQuorum})</div>}
        </div>
        <div className={classes.totalVotersBar} />
      </div>
      <Tooltip
        backgroundColor='rgba(35, 65, 91, 1.0)'
        effect='solid'
        delayShow={0}
        id='quorum-tt'
      />
    </div>
  )
}

export default QuorumBar
