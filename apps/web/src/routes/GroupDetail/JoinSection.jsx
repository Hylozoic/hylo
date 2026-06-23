import { trim } from 'lodash'
import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Button from 'components/ui/button'
import SuggestedSkills from 'components/SuggestedSkills'
import { DEFAULT_AVATAR, DEFAULT_BANNER, GROUP_ACCESSIBILITY, accessibilityIcon, accessibilityString, accessibilityDescription, visibilityIcon, visibilityString, visibilityDescription } from 'store/models/Group'
import { cn } from 'util/index'
import { groupUrl, groupDetailUrl } from '@hylo/navigation'
import PaywallOfferingsSection from './PaywallOfferingsSection'

import Icon from 'components/Icon'

import classes from './GroupDetail.module.scss'

/** Agreements list with per-item "I agree" below description; optional "accept all" when more than 3. */
function AgreementsBarrierBlock ({ agreements, acceptedAgreements, setAcceptedAgreements, introText }) {
  const { t } = useTranslation()
  const showAcceptAllRow = agreements.length > 3
  const allIndividualChecked = agreements.length > 0 && acceptedAgreements.length >= agreements.length &&
    agreements.every((_, index) => acceptedAgreements[index])

  const toggleAgreement = useCallback((index) => {
    setAcceptedAgreements(prev => {
      const next = [...prev]
      next[index] = !prev[index]
      return next
    })
  }, [setAcceptedAgreements])

  const handleAcceptAllChange = useCallback((event) => {
    const checked = event.target.checked
    setAcceptedAgreements(agreements.map(() => checked))
  }, [agreements, setAcceptedAgreements])

  return (
    <div className='mb-4'>
      <h3 className='text-foreground font-bold mb-2'>{t('Agreements')}</h3>
      <p className='text-foreground/60 text-sm mb-3'>{introText}</p>
      {agreements.map((agreement, index) => (
        <div
          key={agreement.id || index}
          className='p-3 mb-2 bg-input rounded-xl'
        >
          <strong className='text-foreground'>{agreement.title}</strong>
          {agreement.description && (
            <div className='text-foreground/70 text-sm mt-1'>{agreement.description}</div>
          )}
          <label className='flex items-center gap-2 mt-3 cursor-pointer select-none'>
            <input
              type='checkbox'
              checked={!!acceptedAgreements[index]}
              onChange={() => toggleAgreement(index)}
              className='h-4 w-4 shrink-0 rounded border-foreground/30 text-selected focus:ring-selected'
            />
            <span className='text-foreground text-sm'>{t('I agree to the above')}</span>
          </label>
        </div>
      ))}
      {showAcceptAllRow && (
        <label className='flex items-center gap-3 p-3 mt-2 bg-input rounded-xl cursor-pointer hover:bg-input/80 transition-colors select-none w-full'>
          <input
            type='checkbox'
            checked={allIndividualChecked}
            onChange={handleAcceptAllChange}
            className='h-4 w-4 shrink-0 rounded border-foreground/30 text-selected focus:ring-selected'
          />
          <span className='text-foreground text-sm font-medium'>{t('I agree to all of the above')}</span>
        </label>
      )}
    </div>
  )
}

/**
 * JoinBarriers - agreements and join questions that must be satisfied before join or purchase
 * Used by JoinQuestionsAndButtons (join) and PaywallOfferingsSection (checkout)
 */
export function JoinBarriers ({ group, onBarriersStateChange, joinIntroCopy = false }) {
  const { t } = useTranslation()
  const [questionAnswers, setQuestionAnswers] = useState(
    (group.joinQuestions || []).map(q => ({ questionId: q.questionId, text: q.text, answer: '' }))
  )
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(
    () => !group.settings?.askJoinQuestions || !(group.joinQuestions || []).length
  )

  // joinQuestions often arrive after first paint; useState only uses its initial value once
  useEffect(() => {
    const questions = group.joinQuestions || []
    setQuestionAnswers(questions.map(q => ({ questionId: q.questionId, text: q.text, answer: '' })))
    setAllQuestionsAnswered(!group.settings?.askJoinQuestions || questions.length === 0)
  }, [group.joinQuestions?.length, group.settings?.askJoinQuestions])

  const agreements = group.agreements || []
  const [acceptedAgreements, setAcceptedAgreements] = useState(agreements.map(() => false))
  const allAgreementsAccepted = agreements.length === 0 || acceptedAgreements.every(a => a)

  useEffect(() => {
    setAcceptedAgreements(agreements.map(() => false))
  }, [agreements.length])

  const hasAgreements = agreements.length > 0
  const hasRequiredQuestions = group.settings?.askJoinQuestions && group.joinQuestions?.length > 0
  const hasBarriers = hasAgreements || hasRequiredQuestions
  const canProceed = allQuestionsAnswered && allAgreementsAccepted

  useEffect(() => {
    if (onBarriersStateChange) {
      onBarriersStateChange({
        canProceed,
        questionAnswers,
        hasBarriers,
        allQuestionsAnswered,
        allAgreementsAccepted
      })
    }
  }, [canProceed, questionAnswers, hasBarriers, allQuestionsAnswered, allAgreementsAccepted, onBarriersStateChange])

  const setAnswer = (index) => (event) => {
    const answerValue = event.target.value
    setQuestionAnswers(prevAnswers => {
      const newAnswers = [...prevAnswers]
      newAnswers[index].answer = answerValue
      setAllQuestionsAnswered(newAnswers.every(a => trim(a.answer).length > 0))
      return newAnswers
    })
  }

  if (!hasBarriers) {
    return null
  }

  const agreementsIntro = joinIntroCopy
    ? <>{t('Please review and accept the following agreements to join')}:</>
    : <>{t('Please review and accept the following agreements')}:</>

  const questionsIntro = joinIntroCopy
    ? t('Please answer the following to join')
    : t('Please answer the following')

  return (
    <div className='JoinBarriers mb-4'>
      {hasAgreements && (
        <AgreementsBarrierBlock
          agreements={agreements}
          acceptedAgreements={acceptedAgreements}
          setAcceptedAgreements={setAcceptedAgreements}
          introText={agreementsIntro}
        />
      )}

      {hasRequiredQuestions && (
        <div className='mb-4'>
          <div className='text-foreground/60 font-medium text-base mb-2'>{questionsIntro}:</div>
          {questionAnswers.map((q, index) => (
            <div className='bg-input rounded-xl p-2 mb-4' key={index}>
              <h3>{q.text}</h3>
              <textarea
                name={`question_${q.questionId}`}
                className='w-full bg-input rounded-xl p-2'
                onChange={setAnswer(index)}
                value={q.answer}
                placeholder={t('Type your answer here...')}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function JoinSection ({ accessCode, addSkill, currentUser, fullPage, group, groupsWithPendingRequests, invitationRole, invitationToken, joinGroup, requestToJoinGroup, removeSkill, routeParams, t }) {
  const hasPendingRequest = groupsWithPendingRequests[group.id]

  // User arrived with a join link (accessCode) or email invite link (token) — pre-approved for Closed/Restricted
  const hasJoinOrInviteLink = !!(accessCode || invitationToken)

  // If group has paywall, show paywall offerings with nested barriers
  if (group.paywall) {
    return (
      <div className={cn('JoinSection requestBar align-center flex flex-col z-20 border-0 justify-center h-auto', { 'w-full max-w-[750px]': fullPage })}>
        <PaywallOfferingsSection group={group} />
      </div>
    )
  }

  return (
    <div className={cn('JoinSection requestBar align-center flex flex-col z-20 border-0 justify-center h-auto', { 'w-full max-w-[750px]': fullPage })}>
      {/* Display assigned role if invitation includes one */}
      {invitationRole && (
        <div className='bg-selected/10 border border-selected/30 rounded-xl p-4 mb-4 text-center'>
          <div className='flex items-center justify-center gap-2 text-foreground'>
            {invitationRole.emoji && <span className='text-xl'>{invitationRole.emoji}</span>}
            <span className='font-medium'>
              {t('When you join, you will receive the {{roleName}} role', { roleName: invitationRole.name })}
            </span>
          </div>
        </div>
      )}
      {group.suggestedSkills && group.suggestedSkills.length > 0 &&
        <SuggestedSkills addSkill={addSkill} currentUser={currentUser} group={group} removeSkill={removeSkill} />}
      {group.prerequisiteGroups && group.prerequisiteGroups.length > 0
        ? (
          <div className='w-full mb-[100px] border border-dashed p-3 rounded bg-midground'>
            <h4 className='text-center text-foreground/60 font-medium text-base leading-6'>
              {group.prerequisiteGroups.length === 1
                ? <span>{group.name}{' '}{t('is only accessible to members of')}{' '}{group.prerequisiteGroups.map(prereq => <span key={prereq.id}>{prereq.name}</span>)}</span>
                : <span>{t('{{group.name}} is only accessible to members of the following groups:', { group })}</span>}
            </h4>
            {group.prerequisiteGroups.map(prereq => (
              <div key={prereq.id} className='p-3 rounded-lg bg-muted shadow mb-4 xs:p-4'>
                <Link to={fullPage ? groupUrl(prereq.slug) : groupDetailUrl(prereq.slug, routeParams)} className={cn(classes.groupDetailHeader, classes.prereqHeader)} style={{ backgroundImage: `url(${prereq.bannerUrl || DEFAULT_BANNER})` }}>
                  <div className={classes.groupTitleContainer}>
                    <img src={prereq.avatarUrl || DEFAULT_AVATAR} height='50px' width='50px' />
                    <div>
                      <div className={classes.groupTitle}>{prereq.name}</div>
                      <div className={classes.groupContextInfo}>
                        <span className={classes.groupPrivacy}>
                          <Icon name={visibilityIcon(prereq.visibility)} className={classes.privacyIcon} />
                          <div className={classes.privacyTooltip}>
                            <div>{t(visibilityString(prereq.visibility))} - {t(visibilityDescription(prereq.visibility))}</div>
                          </div>
                        </span>
                        <span className={classes.groupPrivacy}>
                          <Icon name={accessibilityIcon(prereq.accessibility)} className={classes.privacyIcon} />
                          <div className={classes.privacyTooltip}>
                            <div>{t(accessibilityString(prereq.accessibility))} - {t(accessibilityDescription(prereq.accessibility))}</div>
                          </div>
                        </span>
                        {prereq.location}
                      </div>
                    </div>
                  </div>
                  <div className={classes.headerBackground} />
                </Link>
                <div className={classes.cta}>
                  {t('To join')}{' '}{group.name}{' '}{t('visit')}<Link to={fullPage ? groupUrl(prereq.slug) : groupDetailUrl(prereq.slug, routeParams)} className={classes.prereqVisitLink}>{prereq.name}</Link>{' '}{t('and become a member')}
                </div>
              </div>
            ))}
          </div>
          )
        : group.numPrerequisitesLeft
          ? t('This group has prerequisite groups you cannot see, you cannot join this group at this time')
          : group.accessibility === GROUP_ACCESSIBILITY.Open
            ? <JoinQuestionsAndButtons group={group} joinGroup={joinGroup} joinText={t('Join {{group.name}}', { group })} t={t} />
            : group.accessibility === GROUP_ACCESSIBILITY.Restricted
              ? hasJoinOrInviteLink
                ? <JoinQuestionsAndButtons group={group} joinGroup={joinGroup} joinText={t('Join {{group.name}}', { group })} t={t} />
                : hasPendingRequest
                  ? (
                    <div className='border-2 border-dashed border-selected/100 rounded-md text-center p-4 text-foreground mt-4 mb-8'>
                      <h3 className='mt-0 text-foreground font-bold mb-2'>{t('Request to join pending')}</h3>
                      <span> {t('You will be sent an email and notified on your device when the request is approved.')}</span>
                    </div>
                    )
                  : <JoinQuestionsAndButtons group={group} joinGroup={requestToJoinGroup} joinText={t('Request Membership in {{group.name}}', { group })} t={t} />
              : group.accessibility === GROUP_ACCESSIBILITY.Closed
                ? hasJoinOrInviteLink
                  ? <JoinQuestionsAndButtons group={group} joinGroup={joinGroup} joinText={t('Join {{group.name}}', { group })} t={t} />
                  : (
                    <div className='border-2 border-dashed border-foreground/20 rounded-md text-center p-4 text-foreground mt-4 mb-8'>
                      <p className='m-0'>{t('This group is invite only. You require a join or invite link in order to join.')}</p>
                    </div>
                    )
                : null}
    </div>
  )
}

function JoinQuestionsAndButtons ({ group, joinGroup, joinText, t }) {
  const agreements = group.agreements || []
  const hasAgreements = agreements.length > 0
  const hasRequiredQuestions = group.settings?.askJoinQuestions && group.joinQuestions?.length > 0
  const hasBarriers = hasAgreements || hasRequiredQuestions
  const [barriersExpanded, setBarriersExpanded] = useState(!hasBarriers)

  const [barriersState, setBarriersState] = useState(null)

  const handleBarriersStateChange = useCallback((state) => {
    setBarriersState(state)
  }, [])

  useEffect(() => {
    setBarriersState(null)
  }, [group.id])

  const canJoin = !hasBarriers || barriersState?.canProceed === true

  const getDisabledReason = () => {
    if (!hasBarriers || !barriersState) {
      return ''
    }
    const { allQuestionsAnswered, allAgreementsAccepted } = barriersState
    if (!allQuestionsAnswered && !allAgreementsAccepted) {
      return t('You must answer all questions and accept all agreements to join')
    }
    if (!allQuestionsAnswered) {
      return t('You must answer all the questions to join')
    }
    if (!allAgreementsAccepted) {
      return t('You must accept all agreements to join')
    }
    return ''
  }

  const handleButtonClick = () => {
    if (hasBarriers && !barriersExpanded) {
      setBarriersExpanded(true)
    } else if (canJoin) {
      joinGroup(group.id, hasBarriers ? (barriersState?.questionAnswers ?? []) : [])
    }
  }

  const getButtonText = () => {
    if (hasBarriers && !barriersExpanded) {
      return joinText
    }
    return joinText
  }

  const isButtonDisabled = barriersExpanded && !canJoin

  return (
    <div className='JoinSection-QuestionsAndButton border-2 border-dashed border-foreground/20 rounded-xl p-4 w-full mt-4 mb-8'>
      {barriersExpanded && (
        <JoinBarriers group={group} onBarriersStateChange={handleBarriersStateChange} joinIntroCopy />
      )}

      <Button
        variant='secondary'
        className='JoinSection-JoinButton border-2 border-selected w-full font-bold rounded-xl p-2 whitespace-normal'
        disabled={isButtonDisabled}
        onClick={handleButtonClick}
        data-tooltip-content={isButtonDisabled ? getDisabledReason() : ''}
        data-tooltip-id='join-tip'
      >
        {getButtonText()}
      </Button>
    </div>
  )
}
