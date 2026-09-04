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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from 'components/ui/tooltip'

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

export default function JoinSection ({ accessCode, addSkill, currentUser, fullPage, group, groupsWithPendingRequests, invitationRole, invitationToken, joinGroup, linkedSpaceName, requestToJoinGroup, removeSkill, routeParams, t }) {
  const hasPendingRequest = groupsWithPendingRequests[group.id]

  // User arrived with a join link (accessCode) or email invite link (token) — pre-approved for Closed/Restricted
  const hasJoinOrInviteLink = !!(accessCode || invitationToken)

  const linkedSpaceNotice = linkedSpaceName
    ? (
      <div className='bg-selected/10 border border-selected/30 rounded-xl p-4 mb-4 text-center'>
        <span className='font-medium text-foreground'>
          {t('You will also be added to space {{name}} on joining', { name: linkedSpaceName })}
        </span>
      </div>
      )
    : null

  // If group has paywall, show paywall offerings with nested barriers
  if (group.paywall) {
    return (
      <div className={cn('JoinSection requestBar align-center flex flex-col z-20 border-0 justify-center h-auto', { 'w-full max-w-[750px]': fullPage })}>
        {linkedSpaceNotice}
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
      {linkedSpaceNotice}
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
                {/* The avatar and name are anchored inside the banner: the row is
                    pinned to the banner's bottom edge and the name truncates, so a
                    long name or a tall avatar can't push the block off the artwork. */}
                <Link
                  to={fullPage ? groupUrl(prereq.slug) : groupDetailUrl(prereq.slug, routeParams)}
                  className='relative block w-full h-[83px] rounded-md overflow-hidden bg-cover bg-center bg-no-repeat mb-3'
                  style={{ backgroundImage: `url(${prereq.bannerUrl || DEFAULT_BANNER})` }}
                >
                  <div className='absolute inset-0 bg-gradient-to-b from-black/0 to-black/70' />
                  <div className='absolute bottom-0 left-0 right-0 z-10 flex items-end gap-2 p-2'>
                    <img
                      src={prereq.avatarUrl || DEFAULT_AVATAR}
                      alt=''
                      className='w-[50px] h-[50px] shrink-0 rounded-md object-cover'
                    />
                    <div className='min-w-0'>
                      <div className='text-white text-base font-bold drop-shadow-md truncate'>{prereq.name}</div>
                      <TooltipProvider delayDuration={300}>
                        <div className='flex items-center gap-2 text-white/80 text-sm drop-shadow-md min-w-0'>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className='flex items-center'><Icon name={visibilityIcon(prereq.visibility)} /></span>
                            </TooltipTrigger>
                            <TooltipContent side='top'>{t(visibilityString(prereq.visibility))} - {t(visibilityDescription(prereq.visibility))}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className='flex items-center'><Icon name={accessibilityIcon(prereq.accessibility)} /></span>
                            </TooltipTrigger>
                            <TooltipContent side='top'>{t(accessibilityString(prereq.accessibility))} - {t(accessibilityDescription(prereq.accessibility))}</TooltipContent>
                          </Tooltip>
                          {prereq.location && <span className='truncate'>{prereq.location}</span>}
                        </div>
                      </TooltipProvider>
                    </div>
                  </div>
                </Link>
                <div className='text-left text-foreground/80 font-medium'>
                  {t('To join')}{' '}{group.name}{' '}{t('visit')}{' '}<Link to={fullPage ? groupUrl(prereq.slug) : groupDetailUrl(prereq.slug, routeParams)} className='inline-block rounded-full border border-foreground/20 bg-background px-2.5 py-0.5 text-foreground hover:border-foreground/40 hover:no-underline'>{prereq.name}</Link>{' '}{t('and become a member')}
                </div>
              </div>
            ))}
          </div>
          )
        : group.numPrerequisitesLeft
          ? t('This group has prerequisite groups you cannot see, you cannot join this group at this time')
          : group.accessibility === GROUP_ACCESSIBILITY.Open
            ? (
              <JoinQuestionsAndButtons
                addSkill={addSkill}
                currentUser={currentUser}
                group={group}
                joinGroup={joinGroup}
                joinText={t('Join {{group.name}}', { group })}
                removeSkill={removeSkill}
                t={t}
              />
              )
            : group.accessibility === GROUP_ACCESSIBILITY.Restricted ||
              group.accessibility === GROUP_ACCESSIBILITY.Closed
              ? hasJoinOrInviteLink
                ? (
                  <JoinQuestionsAndButtons
                    addSkill={addSkill}
                    currentUser={currentUser}
                    group={group}
                    joinGroup={joinGroup}
                    joinText={t('Join {{group.name}}', { group })}
                    removeSkill={removeSkill}
                    t={t}
                  />
                  )
                : group.accessibility === GROUP_ACCESSIBILITY.Restricted
                  ? hasPendingRequest
                    ? (
                      <div className='border-2 border-dashed border-selected/100 rounded-md text-center p-4 text-foreground mt-4 mb-8'>
                        <h3 className='mt-0 text-foreground font-bold mb-2'>{t('Request to join pending')}</h3>
                        <span> {t('You will be sent an email and notified on your device when the request is approved.')}</span>
                      </div>
                      )
                    : (
                      <JoinQuestionsAndButtons
                        addSkill={addSkill}
                        currentUser={currentUser}
                        group={group}
                        joinGroup={requestToJoinGroup}
                        joinText={t('Request Membership in {{group.name}}', { group })}
                        removeSkill={removeSkill}
                        t={t}
                      />
                      )
                  : (
                    <div className='border-2 border-dashed border-foreground/20 rounded-md text-center p-4 text-foreground mt-4 mb-8'>
                      <p className='m-0'>{t('This group is invite only. You require a join or invite link in order to join.')}</p>
                    </div>
                    )
              : null}
    </div>
  )
}

function JoinQuestionsAndButtons ({ addSkill, currentUser, group, joinGroup, joinText, removeSkill, t }) {
  const agreements = group.agreements || []
  const hasAgreements = agreements.length > 0
  const hasRequiredQuestions = group.settings?.askJoinQuestions && group.joinQuestions?.length > 0
  const hasSuggestedSkills = group.suggestedSkills?.length > 0
  const hasBarriers = hasAgreements || hasRequiredQuestions
  // Expand for agreements/questions and/or skills — skills stay hidden until Join is clicked
  const hasExpandableContent = hasBarriers || hasSuggestedSkills
  const [formExpanded, setFormExpanded] = useState(!hasExpandableContent)

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
    if (hasExpandableContent && !formExpanded) {
      setFormExpanded(true)
    } else if (canJoin) {
      joinGroup(group.id, hasBarriers ? (barriersState?.questionAnswers ?? []) : [])
    }
  }

  const isButtonDisabled = formExpanded && !canJoin

  return (
    <div className='JoinSection-QuestionsAndButton border-2 border-dashed border-foreground/20 rounded-xl p-4 w-full mt-4 mb-8'>
      {formExpanded && (
        <>
          {hasBarriers &&
            <JoinBarriers group={group} onBarriersStateChange={handleBarriersStateChange} joinIntroCopy />}
          {hasSuggestedSkills &&
            <SuggestedSkills addSkill={addSkill} currentUser={currentUser} group={group} removeSkill={removeSkill} />}
        </>
      )}

      <Button
        variant='secondary'
        className='JoinSection-JoinButton border-2 border-selected w-full font-bold rounded-xl p-2 whitespace-normal'
        disabled={isButtonDisabled}
        onClick={handleButtonClick}
        data-tooltip-content={isButtonDisabled ? getDisabledReason() : ''}
        data-tooltip-id='join-tip'
      >
        {joinText}
      </Button>
    </div>
  )
}
