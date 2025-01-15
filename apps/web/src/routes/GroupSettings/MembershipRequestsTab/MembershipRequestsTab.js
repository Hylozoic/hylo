import { cn } from 'util/index'
import { get } from 'lodash/fp'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import isWebView from 'util/webView'
import { groupUrl, personUrl } from 'util/navigation'
import Avatar from 'components/Avatar'
import Button from 'components/Button'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import {
  acceptJoinRequest,
  declineJoinRequest,
  fetchJoinRequests
} from './MembershipRequestsTab.store'
import { jollyAxolotl } from 'util/assets'

import classes from './MembershipRequestsTab.module.scss'

export default function MembershipRequestsTab ({
  group
}) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    dispatch(fetchJoinRequests(group.id))
  }, [group.id])

  const joinRequests = useSelector(state => get('MembershipRequests', state))

  const submitAccept = (joinRequestId) => {
    dispatch(acceptJoinRequest(joinRequestId))
  }

  const submitDecline = (joinRequestId) => {
    dispatch(declineJoinRequest(joinRequestId))
  }

  const handleViewMembers = () => {
    dispatch(navigate(groupUrl(group.slug, 'members')))
  }

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: `${t('Group Settings')} > ${t('Join Requests')}`,
      icon: 'Settings',
      info: ''
    })
  }, [])

  if (!joinRequests) return <Loading />

  return joinRequests.length
    ? <NewRequests
        accept={submitAccept}
        decline={submitDecline}
        group={group}
        joinRequests={joinRequests}
      />
    : <NoRequests group={group} handleViewMembers={handleViewMembers} />
}

export function NoRequests ({ group, handleViewMembers }) {
  const { t } = useTranslation()
  return (
    <>
      <div className={classes.noRequests}>
        <img src={jollyAxolotl} />
        <br />
        <div>
          <h2>{t('No new join requests')}</h2>
          {t('We\'ll notify you by email when someone wants to join')}{' '}<strong>{group.name}</strong>
        </div>
        {!isWebView() && (
          <Button
            label={t('View Current Members')}
            onClick={handleViewMembers}
            className={classes.viewMembers}
          />
        )}
      </div>
    </>
  )
}

function NewRequests ({ accept, decline, group, joinRequests }) {
  const { t } = useTranslation()
  return (
    <>
      <div>
        <div className={classes.header}>
          <h2>{t('People want to join your group!')}</h2>
          {/* TODO: For later implementation
          <span className={classes.responseTime}>Your average response time: 1 day</span> */}
        </div>
        <div className={classes.requestList}>
          {joinRequests.map(r => (
            <JoinRequest
              key={r.id}
              accept={accept}
              decline={decline}
              group={group}
              request={r}
            />
          ))}
        </div>
      </div>
    </>
  )
}

function JoinRequest ({ accept, decline, group, request }) {
  const { questionAnswers, user } = request
  const { t } = useTranslation()

  // Answers to questions no longer being asked by the group
  const otherAnswers = questionAnswers.filter(qa => !group.joinQuestions.find(jq => jq.questionId === qa.question.id))

  return (
    <div className={classes.request}>
      <div className={classes.requestor}>
        <Avatar avatarUrl={user.avatarUrl} url={personUrl(user.id)} className={classes.requestorAvatar} />
        <div className={classes.requestorInfo}>
          <div className={classes.name}>{user.name}</div>
          {user.skills.items.length > 0 ? <div className={classes.skills}>{user.skills.items.map(({ name }) => <span key={user.id + '-' + name}>#{name}</span>)}</div> : <div>{user.location}</div>}
        </div>
      </div>
      {group.joinQuestions.map(q =>
        <div className={classes.answer} key={q.id}>
          <h3>{q.text}</h3>
          <p>{get('answer', questionAnswers.find(qa => qa.question.id === q.questionId)) || <i>{t('Not answered')}</i>}</p>
        </div>
      )}
      {otherAnswers.map(qa =>
        <div className={classes.answer} key={qa.question.id}>
          <h3>{qa.question.text}</h3>
          <p>{qa.answer}</p>
        </div>
      )}
      <div className={classes.actionButtons}>
        <div className={cn(classes.accept)} onClick={() => accept(request.id)}><Icon name='Checkmark' className={classes.iconGreen} />{t('Welcome')}</div>
        <div onClick={() => decline(request.id)}><Icon name='Ex' className={classes.iconRed} />{t('Decline')}</div>
      </div>
    </div>
  )
}
