import { isEmpty, trim } from 'lodash'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { CSSTransition } from 'react-transition-group'
import { useParams, useNavigate } from 'react-router-dom'
import { AnalyticsEvents, TextHelpers } from '@hylo/shared'
import getMe from 'store/selectors/getMe'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMyGroupMembership from 'store/selectors/getMyGroupMembership'
import presentGroup from 'store/presenters/presentGroup'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import { DEFAULT_AVATAR, DEFAULT_BANNER } from 'store/models/Group'
import { fetchGroupWelcomeData } from './GroupWelcomeModal.store'
import { updateMembershipSettings } from 'routes/UserSettings/UserSettings.store'
import { AssistantConsentChoice, isGroupAssistantAgreement, useAssistantAgreementText } from 'routes/GroupAssistant/AssistantAgreement'
import { setGroupAssistantConsent } from 'store/actions/groupAssistant'
import Button from 'components/ui/button'
import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import RoundImage from 'components/RoundImage'
import SuggestedSkills from 'components/SuggestedSkills'
import { leaveGroup } from 'routes/UserSettings/UserGroupsTab/UserGroupsTab.store'
import { bgImageStyle, cn } from 'util/index'

import classes from './GroupWelcomeModal.module.scss'

export default function GroupWelcomeModal (props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const navigate = useNavigate()
  const params = useParams()
  const currentGroup = useSelector(state => getGroupForSlug(state, params.groupSlug))
  const group = presentGroup(currentGroup)
  const currentMembership = useSelector(state => getMyGroupMembership(state, params.groupSlug))
  const membershipAgreements = currentMembership?.agreements?.toModelArray?.() || []
  const savedJoinAnswers = currentMembership?.joinQuestionAnswers?.toModelArray?.() || []
  const { agreementsAcceptedAt, joinQuestionsAnsweredAt } = currentMembership?.settings || {}
  const [page, setPage] = useState(1)
  const welcomeModalRef = useRef(null)
  const numAgreements = group?.agreements?.length || 0
  const [currentAgreements, setCurrentAgreements] = useState(Array(numAgreements).fill(false))

  // The Group Assistant's data-sharing agreement is answered yes or no, and either answer lets the
  // member in (Q-29/Q-31): it is not one of the agreements that must all be ticked
  const assistantAgreementText = useAssistantAgreementText()
  const assistantIndex = (group?.agreements || []).findIndex(isGroupAssistantAgreement)
  const assistantConsent = currentGroup?.assistantForMe?.consent
  const assistantPending = assistantConsent === 'pending'
  const [assistantChoice, setAssistantChoice] = useState(null)
  useEffect(() => {
    setAssistantChoice(assistantConsent === 'accepted' ? true : assistantConsent === 'declined' ? false : null)
  }, [assistantConsent])
  const isOtherAgreement = index => index !== assistantIndex

  const numOtherAgreements = numAgreements - (assistantIndex >= 0 ? 1 : 0)
  const numCheckedAgreements = currentAgreements.reduce((count, agreement, index) => count + (agreement && isOtherAgreement(index) ? 1 : 0), 0)
  const checkedAllAgreements = numCheckedAgreements === numOtherAgreements && (assistantIndex < 0 || assistantChoice !== null)

  const agreementsLastUpdatedAt = currentGroup?.settings?.agreementsLastUpdatedAt
  const agreementsChangedByTimestamp = Boolean(
    agreementsAcceptedAt &&
    agreementsLastUpdatedAt &&
    agreementsAcceptedAt < agreementsLastUpdatedAt
  )
  const allAgreementsAlreadyAccepted = numAgreements > 0 &&
    (group?.agreements || []).every((ga, index) => !isOtherAgreement(index) || membershipAgreements?.find(ma => ma.id === ga.id)?.accepted)
  // Re-show only when agreements actually changed, or they were never accepted, or the member
  // has not answered the Group Assistant's agreement yet
  const agreementsChanged = numAgreements > 0 && (
    agreementsChangedByTimestamp ||
    (!agreementsAcceptedAt && !allAgreementsAlreadyAccepted) ||
    (assistantIndex >= 0 && assistantPending)
  )

  const [questionAnswers, setQuestionAnswers] = useState(
    () => (group?.joinQuestions || []).map(q => ({ questionId: q.questionId, text: q.text, answer: '' }))
  )

  // Only show first page (agreements) if there are agreements that need to be accepted
  const hasFirstPage = agreementsChanged
  const questionsHaveSavedAnswers = Boolean(
    group?.joinQuestions?.length > 0 &&
    group.joinQuestions.every(q => {
      const saved = savedJoinAnswers.find(a => String(a.question?.id) === String(q.questionId))
      return saved && trim(saved.answer).length > 0
    })
  )
  // Questions are only required when the group asks them, answers are not yet recorded, and questions are loaded
  const questionsStillRequired = Boolean(
    group?.settings?.askJoinQuestions &&
    !joinQuestionsAnsweredAt &&
    !questionsHaveSavedAnswers &&
    questionAnswers?.length > 0
  )
  // Skills were already offered on GroupDetail join when joinQuestionsAnsweredAt is set
  const showSuggestedSkills = Boolean(
    group?.settings?.showSuggestedSkills &&
    group?.suggestedSkills?.length > 0 &&
    !joinQuestionsAnsweredAt &&
    !questionsHaveSavedAnswers
  )
  const hasSecondPage = questionsStillRequired || showSuggestedSkills
  // Skills are optional; only block Jump In when join questions are shown and unanswered
  const answersComplete = !questionsStillRequired ||
    (questionAnswers || []).every(a => trim(a.answer).length > 0)

  // assistantPending comes with the group itself, before the agreements are loaded
  const showWelcomeModal = currentMembership?.settings?.showJoinForm || agreementsChanged || assistantPending

  useEffect(() => {
    if (showWelcomeModal && group?.id && currentMembership) dispatch(fetchGroupWelcomeData(group.id, currentUser.id))
  }, [currentMembership?.id])

  useEffect(() => {
    if (numAgreements > 0) {
      setCurrentAgreements(group.agreements.map(ga => membershipAgreements?.find(ma => ma.id === ga.id)?.accepted))
    } else {
      setCurrentAgreements([])
    }
  }, [group?.agreements?.length, membershipAgreements?.length])

  useEffect(() => {
    if (group?.joinQuestions?.length > 0) {
      setQuestionAnswers(group.joinQuestions.map(q => {
        const saved = savedJoinAnswers.find(a => String(a.question?.id) === String(q.questionId))
        return { questionId: q.questionId, text: q.text, answer: saved?.answer || '' }
      }))
    }
  }, [group?.joinQuestions?.length, savedJoinAnswers.length])

  // Keep page in sync when agreements-changed state loads after first paint
  useEffect(() => {
    setPage(hasFirstPage ? 1 : 2)
  }, [hasFirstPage])

  if (!showWelcomeModal || !group || !currentMembership) return null

  const handleCheckAgreement = e => {
    const accepted = e.target.checked
    const agreementIndex = e.target.value
    const newAgreements = [...currentAgreements]
    newAgreements[agreementIndex] = accepted
    setCurrentAgreements(newAgreements)
  }

  const handleCheckAllAgreements = e => {
    const accepted = !(numCheckedAgreements === numOtherAgreements)
    const newAgreements = Array(numAgreements).fill(accepted)
    setCurrentAgreements(newAgreements)
  }

  const handleAccept = async () => {
    if (page === 1 && hasSecondPage) {
      setPage(2)
      return
    }

    // Existing members also see this modal to re-accept changed agreements; that is not a welcome
    const isFirstWelcome = Boolean(currentMembership.settings?.showJoinForm)
    // Their own answer about sharing with the Group Assistant (the server never takes it as accepted with the rest)
    if (assistantIndex >= 0 && assistantChoice !== null) {
      await dispatch(setGroupAssistantConsent(group.id, assistantChoice))
    }
    await dispatch(updateMembershipSettings(
      group.id,
      { joinQuestionsAnsweredAt: new Date(), showJoinForm: false },
      true, // acceptAgreements
      // If join questions were previously answered, don't overwrite them with empty answers here
      questionAnswers && !joinQuestionsAnsweredAt && !questionsHaveSavedAnswers ? questionAnswers.map(q => ({ questionId: q.questionId, answer: q.answer })) : null
    ))
    if (isFirstWelcome) {
      dispatch(trackAnalyticsEvent(AnalyticsEvents.GROUP_WELCOME_COMPLETED, {
        groupId: group.id,
        hadAgreements: hasFirstPage,
        hadJoinQuestions: questionsStillRequired
      }))
    }
    return null
  }

  const handleDecline = async () => {
    if (window.confirm(t('Are you sure you want to decline the agreements and leave this group?'))) {
      await dispatch(leaveGroup(group.id))
      navigate('/')
    }
  }

  const handleAnswerQuestion = (index) => (event) => {
    const answerValue = event.target.value
    setQuestionAnswers(prevAnswers => {
      const newAnswers = [...prevAnswers]
      newAnswers[index].answer = answerValue
      return newAnswers
    })
  }

  return (
    <CSSTransition
      classNames='welcome-modal'
      appear
      in
      timeout={{ appear: 400, enter: 400, exit: 300 }}
      nodeRef={welcomeModalRef}
    >
      <div className='fixed top-0 left-0 flex items-center justify-center w-full h-full z-[1000] overflow-y-auto bg-darkening/50 backdrop-blur-sm' data-testid='group-welcome-modal' key='welcome-modal' ref={welcomeModalRef}>
        <div className='w-full h-full overflow-y-auto p-4 flex flex-col items-center'>
          <div className={cn('bg-midground w-full max-w-[750px] my-4 rounded-xl p-4', classes[`viewingPage${page}`])}>
            <div style={bgImageStyle(group.bannerUrl || DEFAULT_BANNER)} className={classes.banner}>
              <div className={classes.bannerContent}>
                <RoundImage url={group.avatarUrl || DEFAULT_AVATAR} size='50px' square />
                <h2>{t('Welcome to {{group.name}}!', { group })}</h2>
                {hasFirstPage && hasSecondPage ? <span className={classes.pageNumber}>({page}/2)</span> : ''}
              </div>
              <div className={classes.fade} />
            </div>
            <div className={cn(classes.welcomeContent, classes.page1)}>
              {!isEmpty(group.purpose) &&
                <div>
                  <h2>{t('Our Purpose')}</h2>
                  <p>{group.purpose}</p>
                </div>}
              {agreementsChanged && (
                <div className='mt-4 border-2 border-dashed border-foreground/20 rounded-xl p-4'>
                  <h2 className='text-center'>{t('Our Agreements')}</h2>
                  {currentMembership?.settings.agreementsAcceptedAt && agreementsChanged
                    ? <p className={classes.agreementsChanged}>{t('The agreements have changed since you last accepted them. Please review and accept them again.')}</p>
                    : null}
                  <ol className='p-0'>
                    {group.agreements.map((agreement, i) => {
                      if (i === assistantIndex) {
                        return (
                          <li className={cn('border-b-2 border-b-dashed border-foreground/20 p-4', { 'border-b-2': group.agreements.length > 1 && i !== (group.agreements.length - 1) })} key={i} data-testid='assistant-agreement'>
                            <h3>{assistantAgreementText.title}</h3>
                            <div className={classes.agreementDescription}>
                              <p>{assistantAgreementText.description}</p>
                            </div>
                            <AssistantConsentChoice value={assistantChoice} onChange={setAssistantChoice} />
                          </li>
                        )
                      }
                      return (
                        <li className={cn('border-b-2 border-b-dashed border-foreground/20 p-4', { 'border-b-2': group.agreements.length > 1 && i !== (group.agreements.length - 1) })} key={i}>
                          <h3>{agreement.title}</h3>
                          <div className={classes.agreementDescription}>
                            <ClickCatcher>
                              <HyloHTML element='p' html={TextHelpers.markdown(agreement.description)} />
                            </ClickCatcher>
                          </div>
                          <div
                            className={cn(
                              'inline-flex p-2 rounded-md items-center gap-2 cursor-pointer mt-4',
                              currentAgreements[i] ? 'bg-selected' : 'bg-input'
                            )}
                          >
                            <input
                              className={classes.iAgree}
                              type='checkbox'
                              id={'agreement' + agreement.id}
                              data-testid={'cbAgreement' + i}
                              value={i}
                              onChange={handleCheckAgreement}
                              checked={currentAgreements[i] || false}
                            />
                            <label htmlFor={'agreement' + agreement.id} className={cn(classes.iAgree, { [classes.accepted]: currentAgreements[i] })}>
                              {t('I agree to the above')}
                            </label>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                  {numAgreements > 3 &&
                    <div className={cn('flex items-center gap-2 bg-input p-2 rounded-md mt-4', { 'bg-selected': checkedAllAgreements })}>
                      <input
                        type='checkbox'
                        id='checkAllAgreements'
                        onChange={handleCheckAllAgreements}
                        checked={numCheckedAgreements === numOtherAgreements}
                      />
                      <label htmlFor='checkAllAgreements' className={cn({ [classes.accepted]: checkedAllAgreements })}>
                        {t('I agree to all of the above')}
                      </label>
                    </div>}
                </div>
              )}
            </div>
            <div className={cn(classes.welcomeContent, classes.page2)}>
              {!isEmpty(group.purpose) &&
                <div>
                  <h2>{t('Our Purpose')}</h2>
                  <p>{group.purpose}</p>
                </div>}

              {showSuggestedSkills &&
                <SuggestedSkills currentUser={currentUser} group={group} />}

              {questionsStillRequired && <div className={classes.questionsHeader}>{t('Please answer the following questions to enter')}</div>}
              {questionsStillRequired && questionAnswers.map((q, index) => (
                <div className={classes.joinQuestion} key={index}>
                  <h3 className='text-lg font-bold'>{q.text}</h3>
                  <textarea name={`question_${q.questionId}`} onChange={handleAnswerQuestion(index)} value={q.answer} placeholder={t('Type your answer here...')} />
                </div>)
              )}
            </div>
            <div className='w-full p-4'>
              {page === 2 && hasFirstPage && (
                <Button
                  className={classes.previousButton}
                  onClick={() => setPage(1)}
                >
                  {t('Previous')}
                </Button>
              )}
              <Button
                variant='secondary'
                className='w-full rounded-md mt-4 border-highlight'
                data-testid='jump-in'
                disabled={(page === 1 && !checkedAllAgreements) || (page === 2 && !answersComplete)}
                onClick={handleAccept}
              >
                {page === 1 && hasSecondPage ? t('Next') : t('Jump in!')}
              </Button>
              {page === 1 && (
                <Button
                  variant='outline'
                  className='w-full rounded-md mt-4 border-highlight justify-center'
                  onClick={handleDecline}
                >
                  {t('Decline')}
                </Button>)}
            </div>
          </div>
        </div>
      </div>
    </CSSTransition>
  )
}
