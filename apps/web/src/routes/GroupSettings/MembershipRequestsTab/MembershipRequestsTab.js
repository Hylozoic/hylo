import { get } from 'lodash/fp'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Check, X, Users, CircleOff } from 'lucide-react'
import isWebView from 'util/webView'
import { groupUrl, personUrl } from 'util/navigation'
import Avatar from 'components/Avatar'
import Button from 'components/ui/button'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import {
  acceptJoinRequest,
  declineJoinRequest,
  fetchJoinRequests
} from './MembershipRequestsTab.store'

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
      title: {
        desktop: `${t('Group Settings')} > ${t('Join Requests')}`,
        mobile: t('Join Requests')
      },
      icon: 'Settings'
    })
  }, [])

  if (!joinRequests) return <Loading />

  return (
    <div className='space-y-4'>
      {joinRequests.length > 0 &&
        <NewRequests
          accept={submitAccept}
          decline={submitDecline}
          group={group}
          joinRequests={joinRequests}
        />}
      {!joinRequests.length &&
        <NoRequests group={group} handleViewMembers={handleViewMembers} />}
      {!isWebView() && (
        <div className='flex flex-col sm:flex-row items-center gap-4'>
          <p className='text-foreground/70 text-center sm:text-left'>{t('Responses from members who have already joined are available on their member profile')}</p>
          <Button
            variant='outline'
            onClick={handleViewMembers}
            className='flex items-center gap-2'
          >
            <Users className='w-4 h-4' />
            {t('View Members')}
          </Button>
        </div>
      )}
    </div>
  )
}

export function NoRequests ({ group }) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col items-center text-center gap-4 p-8'>
      <CircleOff className='w-16 h-16 text-foreground/50' />
      <div className='space-y-2'>
        <h2 className='text-foreground font-bold'>{t('No new join requests')}</h2>
        <p className='text-foreground/70'>
          {t('We\'ll notify you by email when someone wants to join')}{' '}
          <strong>{group.name}</strong>
        </p>
      </div>
    </div>
  )
}

function NewRequests ({ accept, decline, group, joinRequests }) {
  const { t } = useTranslation()
  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h2 className='text-foreground font-bold'>{t('People want to join your group!')}</h2>
        {/* TODO: For later implementation
        <span className='text-foreground/70 text-sm'>Your average response time: 1 day</span> */}
      </div>
      <div className='space-y-4'>
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
  )
}

function JoinRequest ({ accept, decline, group, request }) {
  const { questionAnswers, user } = request
  const { t } = useTranslation()

  // Answers to questions no longer being asked by the group
  const otherAnswers = questionAnswers.filter(qa => !group.joinQuestions.find(jq => jq.questionId === qa.question.id))

  return (
    <div className='bg-card p-4 rounded-lg space-y-4'>
      <div className='flex items-start gap-4'>
        <Avatar avatarUrl={user.avatarUrl} url={personUrl(user.id)} className='w-12 h-12 rounded-full' />
        <div className='flex-1'>
          <div className='font-medium text-foreground'>{user.name}</div>
          {user.skills.items.length > 0
            ? (
              <div className='text-sm text-foreground/70 space-x-2'>
                {user.skills.items.map(({ name }) => (
                  <span key={user.id + '-' + name}>#{name}</span>
                ))}
              </div>)
            : (
              <div className='text-sm text-foreground/70'>{user.location}</div>)}
        </div>
      </div>

      <div className='space-y-3'>
        {group.joinQuestions.map(q => (
          <div key={q.id} className='space-y-1'>
            <h3 className='text-foreground font-medium'>{q.text}</h3>
            <p className='text-foreground/70'>
              {get('answer', questionAnswers.find(qa => qa.question.id === q.questionId)) ||
                <i className='text-foreground/50'>{t('Not answered')}</i>}
            </p>
          </div>
        ))}
        {otherAnswers.map(qa => (
          <div key={qa.question.id} className='space-y-1'>
            <h3 className='text-foreground font-medium'>{qa.question.text}</h3>
            <p className='text-foreground/70'>{qa.answer}</p>
          </div>
        ))}
      </div>

      <div className='flex gap-2 justify-end'>
        <Button
          variant='outline'
          className='flex items-center gap-2 text-accent hover:text-foreground hover:bg-accent/20 border-accent/20 hover:border-accent/100'
          onClick={() => decline(request.id)}
        >
          <X className='w-4 h-4' />
          {t('Decline')}
        </Button>
        <Button
          variant='outline'
          className='flex items-center gap-2 text-selected hover:text-foreground hover:bg-selected/20 border-selected/20 hover:border-selected/100'
          onClick={() => accept(request.id)}
        >
          <Check className='w-4 h-4' />
          {t('Welcome')}
        </Button>
      </div>
    </div>
  )
}
