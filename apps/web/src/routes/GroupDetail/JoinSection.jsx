import { trim } from 'lodash'
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import SuggestedSkills from 'components/SuggestedSkills'
import { DEFAULT_AVATAR, DEFAULT_BANNER, GROUP_ACCESSIBILITY, accessibilityIcon, accessibilityString, accessibilityDescription, visibilityIcon, visibilityString, visibilityDescription } from 'store/models/Group'
import { cn } from 'util/index'
import { groupUrl, groupDetailUrl } from 'util/navigation'

import Icon from 'components/Icon'

import classes from './GroupDetail.module.scss'

export default function JoinSection ({ addSkill, currentUser, fullPage, group, groupsWithPendingRequests, joinGroup, requestToJoinGroup, removeSkill, routeParams, t }) {
  const hasPendingRequest = groupsWithPendingRequests[group.id]

  return (
    <div className={cn('requestBar bg-white text-accent-foreground align-center flex flex-col p-4 z-20 border-0 justify-center h-auto', { 'w-full max-w-[640px]': fullPage })}>
      {group.suggestedSkills && group.suggestedSkills.length > 0 &&
        <SuggestedSkills addSkill={addSkill} currentUser={currentUser} group={group} removeSkill={removeSkill} />}
      {group.prerequisiteGroups && group.prerequisiteGroups.length > 0
        ? (
          <div className='w-full mb-[100px] border border-dashed p-3 rounded bg-muted'>
            <h4 className='text-center text-accent-foreground font-medium text-base leading-6'>
              {group.prerequisiteGroups.length === 1
                ? <span>{group.name}{' '}{t('is only accessible to members of')}{' '}{group.prerequisiteGroups.map(prereq => <span key={prereq.id}>{prereq.name}</span>)}</span>
                : <span>{t('{{group.name}} is only accessible to members of the following groups:', { group })}</span>}
            </h4>
            {group.prerequisiteGroups.map(prereq => (
              <div key={prereq.id} className='p-3 rounded-lg bg-white shadow mb-4 xs:p-4'>
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
                  {t('To join')}{' '}{group.name} <Link to={fullPage ? groupUrl(prereq.slug) : groupDetailUrl(prereq.slug, routeParams)} className={classes.prereqVisitLink}>{t('visit')} {prereq.name}</Link>{' '}{t('and become a member')}
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
                ? <div className={classes.requestPending}>{t('Request to join pending')}</div>
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
    <div className={classes.requestOption}>
      {group.settings.askJoinQuestions && questionAnswers.length > 0 && <div>{t('Please answer the following to join')}:</div>}
      {group.settings.askJoinQuestions && questionAnswers.map((q, index) => (
        <div className={classes.joinQuestion} key={index}>
          <h3>{q.text}</h3>
          <textarea name={`question_${q.questionId}`} onChange={setAnswer(index)} value={q.answer} placeholder={t('Type your answer here...')} />
        </div>
      )
      )}
      <div className={classes.center}>
        <div
          className={cn('shadow-md', { [classes.disabledButton]: !allQuestionsAnswered })}
          onClick={allQuestionsAnswered ? () => joinGroup(group.id, questionAnswers) : () => {}}
          data-tooltip-content={!allQuestionsAnswered ? t('You must answer all the questions to join') : ''}
          data-tooltip-id='join-tip'
        >
          {joinText}
        </div>
      </div>
    </div>
  )
}
