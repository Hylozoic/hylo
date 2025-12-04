import { trim } from 'lodash'
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from 'components/ui/button'
import SuggestedSkills from 'components/SuggestedSkills'
import { DEFAULT_AVATAR, DEFAULT_BANNER, GROUP_ACCESSIBILITY, accessibilityIcon, accessibilityString, accessibilityDescription, visibilityIcon, visibilityString, visibilityDescription } from 'store/models/Group'
import { cn } from 'util/index'
import { groupUrl, groupDetailUrl } from '@hylo/navigation'

import Icon from 'components/Icon'

import classes from './GroupDetail.module.scss'

export default function JoinSection ({ addSkill, currentUser, fullPage, group, groupsWithPendingRequests, joinGroup, requestToJoinGroup, removeSkill, routeParams, t }) {
  const hasPendingRequest = groupsWithPendingRequests[group.id]

  return (
    <div className={cn('JoinSection requestBar align-center flex flex-col z-20 border-0 justify-center h-auto', { 'w-full max-w-[750px]': fullPage })}>
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
              ? hasPendingRequest
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

  const setAnswer = (index) => (event) => {
    const answerValue = event.target.value
    setQuestionAnswers(prevAnswers => {
      const newAnswers = [...prevAnswers]
      newAnswers[index].answer = answerValue
      setAllQuestionsAnswered(newAnswers.every(a => trim(a.answer).length > 0))
      return newAnswers
    })
  }

  return (
    <div className='JoinSection-QuestionsAndButton border-2 border-dashed border-foreground/20 rounded-xl p-4 w-full mt-4 mb-8'>
      {group.settings.askJoinQuestions && questionAnswers.length > 0 && <div className='text-foreground/60 font-medium text-base mb-2'>{t('Please answer the following to join')}:</div>}
      {group.settings.askJoinQuestions && questionAnswers.map((q, index) => (
        <div className='bg-input rounded-xl p-2 mb-4' key={index}>
          <h3>{q.text}</h3>
          <textarea name={`question_${q.questionId}`} className='w-full bg-input rounded-xl p-2' onChange={setAnswer(index)} value={q.answer} placeholder={t('Type your answer here...')} />
        </div>
      )
      )}
      <Button
        variant='secondary'
        className='JoinSection-JoinButton border-2 border-selected w-full font-bold rounded-xl p-2 whitespace-normal'
        disabled={!allQuestionsAnswered}
        onClick={() => joinGroup(group.id, questionAnswers)}
        data-tooltip-content={!allQuestionsAnswered ? t('You must answer all the questions to join') : ''}
        data-tooltip-id='join-tip'
      >
        {joinText}
      </Button>
    </div>
  )
}
