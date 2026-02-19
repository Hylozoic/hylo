import { trim } from 'lodash'
import React, { useState } from 'react'
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

export default function JoinSection ({ accessCode, addSkill, currentUser, fullPage, group, groupsWithPendingRequests, invitationRole, invitationToken, joinGroup, requestToJoinGroup, removeSkill, routeParams, t }) {
  const hasPendingRequest = groupsWithPendingRequests[group.id]

  // Check if user has a valid invitation (pre-approved for Restricted groups)
  const hasInvitation = !!(accessCode || invitationToken)

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
              ? hasInvitation
                // Pre-approved: user has invitation, can join directly
                ? <JoinQuestionsAndButtons group={group} joinGroup={joinGroup} joinText={t('Join {{group.name}}', { group })} t={t} />
                : hasPendingRequest
                  ? (
                    <div className='border-2 border-dashed border-selected/100 rounded-md text-center p-4 text-foreground mt-4 mb-8'>
                      <h3 className='mt-0 text-foreground font-bold mb-2'>{t('Request to join pending')}</h3>
                      <span> {t('You will be sent an email and notified on your device when the request is approved.')}</span>
                    </div>
                    )
                  : <JoinQuestionsAndButtons group={group} joinGroup={requestToJoinGroup} joinText={t('Request Membership in {{group.name}}', { group })} t={t} />
              : ''}
    </div>
  )
}

function JoinQuestionsAndButtons ({ group, joinGroup, joinText, t }) {
  const [questionAnswers, setQuestionAnswers] = useState(group.joinQuestions.map(q => { return { questionId: q.questionId, text: q.text, answer: '' } }))
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(!group.settings.askJoinQuestions || questionAnswers.length === 0)

  // Track agreement acceptance - initialize all as unchecked
  const agreements = group.agreements || []
  const [acceptedAgreements, setAcceptedAgreements] = useState(agreements.map(() => false))
  const allAgreementsAccepted = agreements.length === 0 || acceptedAgreements.every(a => a)

  // Toggle behavior: barriers are hidden until first button click
  const hasAgreements = agreements.length > 0
  const hasRequiredQuestions = group.settings.askJoinQuestions && group.joinQuestions?.length > 0
  const hasBarriers = hasAgreements || hasRequiredQuestions
  const [barriersExpanded, setBarriersExpanded] = useState(!hasBarriers) // Start expanded only if no barriers

  const setAnswer = (index) => (event) => {
    const answerValue = event.target.value
    setQuestionAnswers(prevAnswers => {
      const newAnswers = [...prevAnswers]
      newAnswers[index].answer = answerValue
      setAllQuestionsAnswered(newAnswers.every(a => trim(a.answer).length > 0))
      return newAnswers
    })
  }

  const toggleAgreement = (index) => () => {
    setAcceptedAgreements(prev => {
      const newState = [...prev]
      newState[index] = !newState[index]
      return newState
    })
  }

  const canJoin = allQuestionsAnswered && allAgreementsAccepted

  const getDisabledReason = () => {
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

  // Handle button click: expand barriers on first click, join on subsequent clicks
  const handleButtonClick = () => {
    if (hasBarriers && !barriersExpanded) {
      // First click with barriers: expand the barriers UI
      setBarriersExpanded(true)
    } else if (canJoin) {
      // All barriers satisfied: perform the join
      joinGroup(group.id, questionAnswers)
    }
  }

  // Determine button state and text
  const getButtonText = () => {
    if (hasBarriers && !barriersExpanded) {
      return joinText // Show original join text for initial state
    }
    return joinText
  }

  const isButtonDisabled = barriersExpanded && !canJoin

  return (
    <div className='JoinSection-QuestionsAndButton border-2 border-dashed border-foreground/20 rounded-xl p-4 w-full mt-4 mb-8'>
      {/* Barriers Section - only shown when expanded */}
      {barriersExpanded && (
        <>
          {/* Agreements Section */}
          {hasAgreements && (
            <div className='mb-4'>
              <h3 className='text-foreground font-bold mb-2'>{t('Agreements')}</h3>
              <p className='text-foreground/60 text-sm mb-3'>{t('Please review and accept the following agreements to join')}:</p>
              {agreements.map((agreement, index) => (
                <label
                  key={agreement.id || index}
                  className='flex items-start gap-3 p-3 mb-2 bg-input rounded-xl cursor-pointer hover:bg-input/80 transition-colors'
                >
                  <input
                    type='checkbox'
                    checked={acceptedAgreements[index]}
                    onChange={toggleAgreement(index)}
                    className='mt-1 h-4 w-4 rounded border-foreground/30 text-selected focus:ring-selected'
                  />
                  <div className='flex-1'>
                    <strong className='text-foreground'>{agreement.title}</strong>
                    {agreement.description && (
                      <div className='text-foreground/70 text-sm mt-1'>{agreement.description}</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Join Questions Section */}
          {hasRequiredQuestions && (
            <>
              <div className='text-foreground/60 font-medium text-base mb-2'>{t('Please answer the following to join')}:</div>
              {questionAnswers.map((q, index) => (
                <div className='bg-input rounded-xl p-2 mb-4' key={index}>
                  <h3>{q.text}</h3>
                  <textarea name={`question_${q.questionId}`} className='w-full bg-input rounded-xl p-2' onChange={setAnswer(index)} value={q.answer} placeholder={t('Type your answer here...')} />
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* Join Button */}
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

/**
 * JoinBarriers - Reusable component for displaying and tracking agreement/question barriers
 * Used by both JoinSection (for regular joins) and PaywallOfferingsSection (for purchases)
 */
export function JoinBarriers ({ group, onBarriersStateChange }) {
  const { t } = useTranslation()
  const [questionAnswers, setQuestionAnswers] = useState(
    (group.joinQuestions || []).map(q => ({ questionId: q.questionId, text: q.text, answer: '' }))
  )
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(
    !group.settings?.askJoinQuestions || (group.joinQuestions || []).length === 0
  )

  // Track agreement acceptance - initialize all as unchecked
  const agreements = group.agreements || []
  const [acceptedAgreements, setAcceptedAgreements] = useState(agreements.map(() => false))
  const allAgreementsAccepted = agreements.length === 0 || acceptedAgreements.every(a => a)

  const hasAgreements = agreements.length > 0
  const hasRequiredQuestions = group.settings?.askJoinQuestions && group.joinQuestions?.length > 0
  const hasBarriers = hasAgreements || hasRequiredQuestions
  const canProceed = allQuestionsAnswered && allAgreementsAccepted

  // Notify parent of barriers state changes
  React.useEffect(() => {
    if (onBarriersStateChange) {
      onBarriersStateChange({ canProceed, questionAnswers, hasBarriers })
    }
  }, [canProceed, questionAnswers, hasBarriers, onBarriersStateChange])

  const setAnswer = (index) => (event) => {
    const answerValue = event.target.value
    setQuestionAnswers(prevAnswers => {
      const newAnswers = [...prevAnswers]
      newAnswers[index].answer = answerValue
      setAllQuestionsAnswered(newAnswers.every(a => trim(a.answer).length > 0))
      return newAnswers
    })
  }

  const toggleAgreement = (index) => () => {
    setAcceptedAgreements(prev => {
      const newState = [...prev]
      newState[index] = !newState[index]
      return newState
    })
  }

  if (!hasBarriers) {
    return null
  }

  return (
    <div className='JoinBarriers mb-4'>
      {/* Agreements Section */}
      {hasAgreements && (
        <div className='mb-4'>
          <h3 className='text-foreground font-bold mb-2'>{t('Agreements')}</h3>
          <p className='text-foreground/60 text-sm mb-3'>{t('Please review and accept the following agreements')}:</p>
          {agreements.map((agreement, index) => (
            <label
              key={agreement.id || index}
              className='flex items-start gap-3 p-3 mb-2 bg-input rounded-xl cursor-pointer hover:bg-input/80 transition-colors'
            >
              <input
                type='checkbox'
                checked={acceptedAgreements[index]}
                onChange={toggleAgreement(index)}
                className='mt-1 h-4 w-4 rounded border-foreground/30 text-selected focus:ring-selected'
              />
              <div className='flex-1'>
                <strong className='text-foreground'>{agreement.title}</strong>
                {agreement.description && (
                  <div className='text-foreground/70 text-sm mt-1'>{agreement.description}</div>
                )}
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Join Questions Section */}
      {hasRequiredQuestions && (
        <div className='mb-4'>
          <div className='text-foreground/60 font-medium text-base mb-2'>{t('Please answer the following')}:</div>
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
