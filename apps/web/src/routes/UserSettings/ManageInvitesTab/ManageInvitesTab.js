import { toDateTime } from '@hylo/shared/src/DateTimeHelpers'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { push } from 'redux-first-history'
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
  getCanceledJoinRequests,
  getPendingGroupInvites,
  getPendingJoinRequests,
  getRejectedJoinRequests
} from './ManageInvitesTab.store'

import classes from './ManageInvitesTab.module.scss'

function ManageInvitesTab () {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const canceledJoinRequests = useSelector(getCanceledJoinRequests)
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
    <div className={classes.container}>
      <div className={classes.description}>
        {t('This list contains all open requests and invitations to join groups.')}
        &nbsp;{t('To view all groups you are a part of go to your')}{' '}<Link to={currentUserSettingsUrl('groups')}>{t('Groups & Affiliations')}</Link>.
      </div>

      <h2 className={classes.subhead}>{t('Invitations to Join New Groups')}</h2>
      <div className={classes.requestList}>
        {pendingGroupInvites.map(invite =>
          <GroupInvite
            acceptInvite={acceptInvite}
            declineInvite={handleDeclineInvite}
            invite={invite}
            key={invite.id}
          />
        )}
      </div>

      <h2 className={classes.subhead}>{t('Your Open Requests to Join Groups')}</h2>
      <div className={classes.requestList}>
        {pendingJoinRequests.map((jr) =>
          <JoinRequest
            joinRequest={jr}
            cancelJoinRequest={handleCancelJoinRequest}
            key={jr.id}
          />
        )}
      </div>

      <h2 className={classes.subhead}>{t('Declined Invitations & Requests')}</h2>
      <div className={classes.requestList}>
        {rejectedJoinRequests.map((jr) =>
          <JoinRequest
            joinRequest={jr}
            key={jr.id}
          />
        )}
        {canceledJoinRequests.map((jr) =>
          <JoinRequest
            joinRequest={jr}
            key={jr.id}
          />
        )}
      </div>
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
    <div className={classes.joinRequest}>
      <div className={classes.invitationDetail}>
        <div className={classes.invitationSource}>
          <div>
            <Link to={personUrl(creator.id)} className={classes.creator}>{creator.name}</Link>
            <span>{t('invited you to join')}</span>
          </div>
          <div className={classes.requestGroup}>
            <GroupButton group={group} />
          </div>
        </div>
        <div className={classes.invitationResponse}>
          <span className={classes.createdDate}>{t('Sent')} {toDateTime(createdAt).toFormat('MM-dd-yyyy')}</span>
          <span onClick={decline} className={classes.cancelButton}>{t('Decline')}</span>
          <span onClick={() => acceptInvite(token, group.slug)} className={classes.joinButton}>{t('Join')}</span>
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
    <div className={classes.joinRequest}>
      <div className={classes.requestGroup}>
        <GroupButton group={group} />
      </div>
      <div className={classes.requestDetail}>
        <span className={`${classes.createdDate} ${classes.joinRequestDate}`}>{t('Requested')} {toDateTime(createdAt).toFormat('yyyy-MM-dd')}</span>
        {joinRequest.status === JOIN_REQUEST_STATUS.Pending && (
          <span onClick={cancel} className={classes.cancelButton}>{t('Cancel')}</span>
        )}
        {joinRequest.status === JOIN_REQUEST_STATUS.Rejected && (
          <span className={classes.declinedCanceled}>{t('Declined')}</span>
        )}
        {joinRequest.status === JOIN_REQUEST_STATUS.Canceled && (
          <span className={classes.declinedCanceled}>{t('Canceled')}</span>
        )}
      </div>
    </div>
  )
}

export default ManageInvitesTab
