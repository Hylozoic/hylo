import { DateTimeHelpers } from '@hylo/shared'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { push } from 'redux-first-history'
import { getLocaleFromLocalStorage } from 'util/locale'
import { CircleOff } from 'lucide-react'
import GroupButton from 'components/GroupButton'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { JOIN_REQUEST_STATUS } from 'store/models/JoinRequest'
import { currentUserSettingsUrl, personUrl, groupUrl } from 'util/navigation'
import acceptInvitation from 'store/actions/acceptInvitation'
import { FETCH_MY_REQUESTS_AND_INVITES } from 'store/constants'
import {
  cancelJoinRequest,
  declineInvite,
  fetchMyInvitesAndRequests,
  getPendingGroupInvites,
  getPendingJoinRequests,
  getRejectedJoinRequests
} from './ManageInvitesTab.store'

function ManageInvitesTab () {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  // const canceledJoinRequests = useSelector(getCanceledJoinRequests)
  const pendingGroupInvites = useSelector(getPendingGroupInvites)
  const pendingJoinRequests = useSelector(getPendingJoinRequests)
  const rejectedJoinRequests = useSelector(getRejectedJoinRequests)
  const loading = useSelector(state => state.pending[FETCH_MY_REQUESTS_AND_INVITES])

  const acceptInvite = (invitationToken, groupSlug) => {
    dispatch(acceptInvitation({ invitationToken }))
      .then(() => dispatch(push(groupUrl(groupSlug))))
  }

  const handleCancelJoinRequest = (params) => dispatch(cancelJoinRequest(params))
  const handleDeclineInvite = (inviteId) => dispatch(declineInvite(inviteId))

  useEffect(() => {
    dispatch(fetchMyInvitesAndRequests())
  }, [dispatch])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Group Invitations & Join Requests'),
      icon: '',
      info: '',
      search: true
    })
  }, [setHeaderDetails])

  if (loading) return <Loading />

  return (
    <div className='p-4 space-y-6'>
      <div className='text-foreground/70'>
        {t('This list contains all open requests and invitations to join groups.')}
        &nbsp;{t('To view all groups you are a part of go to your')}{' '}
        <Link to={currentUserSettingsUrl('groups')} className='text-accent hover:text-accent/80 transition-colors'>
          {t('Groups & Affiliations')}
        </Link>.
      </div>

      <section className='bg-transparent'>
        <h2 className='text-xl font-semibold mb-4'>{t('Invitations to Join New Groups')}</h2>
        <div className='space-y-4'>
          {pendingGroupInvites.map(invite =>
            <GroupInvite
              acceptInvite={acceptInvite}
              declineInvite={handleDeclineInvite}
              invite={invite}
              key={invite.id}
            />
          )}
          {pendingGroupInvites.length === 0 && (
            <div className='text-foreground/50 flex flex-col items-center justify-center gap-4 p-4 border-2 border-foreground/10 bg-card/20 rounded-lg'>
              <CircleOff className='w-16 h-16 text-foreground/50' />
              <span>{t('No active invitations to join new groups')}</span>
            </div>
          )}
        </div>
      </section>

      <section className='bg-transparent'>
        <h2 className='text-xl font-semibold mb-4'>{t('Your Open Requests to Join Groups')}</h2>
        <div className='space-y-4'>
          {pendingJoinRequests.map((jr) =>
            <JoinRequest
              joinRequest={jr}
              cancelJoinRequest={handleCancelJoinRequest}
              key={jr.id}
            />
          )}
          {pendingJoinRequests.length === 0 && (
            <div className='text-foreground/50 flex flex-col items-center justify-center gap-4 p-4 border-2 border-foreground/10 bg-card/20 rounded-lg'>
              <CircleOff className='w-16 h-16 text-foreground/50' />
              <span>{t('No active requests to join groups')}</span>
            </div>
          )}
        </div>
      </section>

      <section className='bg-transparent'>
        <h2 className='text-xl font-semibold mb-4'>{t('Declined Invitations & Requests')}</h2>
        <div className='space-y-4'>
          {rejectedJoinRequests.map((jr) =>
            <JoinRequest
              joinRequest={jr}
              key={jr.id}
            />
          )}
          {rejectedJoinRequests.length === 0 && (
            <div className='text-foreground/50 flex flex-col items-center justify-center gap-4 p-4 border-2 border-foreground/10 bg-card/20 rounded-lg'>
              <CircleOff className='w-16 h-16 text-foreground/50' />
              <span>{t('You have not declined any invitations or requests')}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function GroupInvite ({ acceptInvite, declineInvite, invite }) {
  const { creator, createdAt, group, id, token } = invite
  const { t } = useTranslation()

  const decline = () => {
    if (window.confirm(t('Are you sure you want to decline the invitation to join {{groupName}}?', { groupName: group.name }))) {
      declineInvite(id)
    }
  }

  return (
    <div className='bg-card rounded-lg p-4 shadow-lg'>
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-2'>
          <div className='flex items-center gap-2'>
            <Link to={personUrl(creator.id)} className='text-accent hover:text-accent/80 transition-colors font-medium'>
              {creator.name}
            </Link>
            <span className='text-foreground/70'>{t('invited you to join')}</span>
          </div>
          <div>
            <GroupButton group={group} />
          </div>
        </div>
        <div className='flex items-center justify-between border-t-2 border-foreground/10 pt-3'>
          <span className='text-sm text-foreground/50'>
            {t('Sent')} {DateTimeHelpers.toDateTime(createdAt, { locale: getLocaleFromLocalStorage() }).toFormat('MM-dd-yyyy')}
          </span>
          <div className='flex items-center gap-3'>
            <button
              onClick={decline}
              className='text-accent/60 hover:text-accent/100 transition-colors border-2 border-accent/20 hover:border-accent/100 rounded-md p-2'
            >
              {t('Decline')}
            </button>
            <button
              onClick={() => acceptInvite(token, group.slug)}
              className='border-2 border-selected/20 hover:border-selected/100 text-selected p-2 rounded-lg transition-all'
            >
              {t('Join group')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function JoinRequest ({ joinRequest, cancelJoinRequest }) {
  const { createdAt, group, id } = joinRequest
  const { t } = useTranslation()

  const cancel = () => {
    if (window.confirm(t('Are you sure you want to cancel your request to join {{groupName}}?', { groupName: group.name }))) {
      cancelJoinRequest(id)
    }
  }

  return (
    <div className='bg-card rounded-lg p-4 shadow-sm'>
      <div className='flex flex-col gap-4'>
        <div>
          <GroupButton group={group} />
        </div>
        <div className='flex items-center justify-between border-t-2 border-foreground/10 pt-3'>
          <span className='text-sm text-foreground/50'>
            {t('You requested to join')} {DateTimeHelpers.toDateTime(createdAt, { locale: getLocaleFromLocalStorage() }).toFormat('yyyy-MM-dd')}
          </span>
          {joinRequest.status === JOIN_REQUEST_STATUS.Pending && (
            <button
              onClick={cancel}
              className='text-accent/60 hover:text-accent/100 transition-colors border-2 border-accent/20 hover:border-accent/100 rounded-md p-2'
            >
              {t('Cancel Request')}
            </button>
          )}
          {joinRequest.status === JOIN_REQUEST_STATUS.Rejected && (
            <span className='text-destructive'>{t('Declined')}</span>
          )}
          {joinRequest.status === JOIN_REQUEST_STATUS.Canceled && (
            <span className='text-foreground/50'>{t('Canceled')}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default ManageInvitesTab
