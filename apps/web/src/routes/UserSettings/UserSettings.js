import { isEmpty, every, includes, get } from 'lodash/fp'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { createSelector } from 'reselect'

import { PROJECT_CONTRIBUTIONS } from 'config/featureFlags'
import EditProfileTab from './EditProfileTab/EditProfileTab'
import UserGroupsTab from './UserGroupsTab/'
import BlockedUsersTab from './BlockedUsersTab/BlockedUsersTab'
import ManageInvitesTab from './ManageInvitesTab/'
import NotificationSettingsTab from './NotificationSettingsTab/NotificationSettingsTab'
import AccountSettingsTab from './AccountSettingsTab/AccountSettingsTab'
import PaymentSettingsTab from './PaymentSettingsTab/PaymentSettingsTab'
import SavedSearchesTab from './SavedSearchesTab/SavedSearchesTab'
import FullPageModal from 'routes/FullPageModal'
import deactivateMe from 'store/actions/deactivateMe'
import deleteMe from 'store/actions/deleteMe'
import logout from 'store/actions/logout'
import unBlockUser from 'store/actions/unBlockUser'
import { FETCH_FOR_CURRENT_USER } from 'store/constants'
import getBlockedUsers from 'store/selectors/getBlockedUsers'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import {
  updateUserSettings,
  unlinkAccount,
  updateMembershipSettings,
  updateAllMemberships,
  registerStripeAccount
} from './UserSettings.store'
import { fetchLocation } from 'components/LocationInput/LocationInput.store'
import { setConfirmBeforeClose } from '../FullPageModal/FullPageModal.store'

const getAllGroupsSettings = createSelector(
  getMyMemberships,
  memberships => ({
    sendEmail: every(m => m.settings && m.settings.sendEmail, memberships),
    sendPushNotifications: every(m => m.settings && m.settings.sendPushNotifications, memberships)
  })
)

const getMessageSettings = createSelector(
  getMe,
  me => me && ({
    sendEmail: includes(me.settings && me.settings.dmNotifications, ['email', 'both']),
    sendPushNotifications: includes(me.settings && me.settings.dmNotifications, ['push', 'both'])
  })
)

const UserSettings = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const location = useLocation()

  const currentUser = useSelector(getMe)
  const blockedUsers = useSelector(getBlockedUsers)
  const allGroupsSettings = useSelector(getAllGroupsSettings)
  const memberships = useSelector(state => getMyMemberships(state).sort((a, b) => a.group.name.localeCompare(b.group.name)))
  const messageSettings = useSelector(getMessageSettings)
  const confirm = useSelector(state => get('FullPageModal.confirm', state))
  const fetchPending = useSelector(state => state.pending[FETCH_FOR_CURRENT_USER])
  const queryParams = {
    registered: getQuerystringParam('registered', location)
  }

  const setConfirm = newState => {
    if (newState === confirm) return
    return dispatch(setConfirmBeforeClose(newState))
  }

  const content = [
    {
      name: t('Edit Profile'),
      path: '',
      component: (
        <EditProfileTab
          currentUser={currentUser}
          updateUserSettings={(...args) => dispatch(updateUserSettings(...args))}
          loginWithService={() => {}} // This action is not provided in the original code
          unlinkAccount={(...args) => dispatch(unlinkAccount(...args))}
          setConfirm={setConfirm}
          fetchLocation={(...args) => dispatch(fetchLocation(...args))}
          fetchPending={fetchPending}
        />
      )
    },
    {
      name: t('Groups & Affiliations'),
      path: 'groups',
      component: <UserGroupsTab personId={currentUser.id} />
    },
    {
      name: t('Invites & Requests'),
      path: 'invitations',
      component: <ManageInvitesTab currentUser={currentUser} />
    },
    {
      name: t('Notifications'),
      path: 'notifications',
      component: (
        <NotificationSettingsTab
          currentUser={currentUser}
          updateUserSettings={(...args) => dispatch(updateUserSettings(...args))}
          memberships={memberships}
          updateMembershipSettings={(...args) => dispatch(updateMembershipSettings(...args))}
          updateAllMemberships={(...args) => dispatch(updateAllMemberships(...args))}
          messageSettings={messageSettings}
          allGroupsSettings={allGroupsSettings}
        />
      )
    },
    {
      name: t('Account'),
      path: 'account',
      component: (
        <AccountSettingsTab
          currentUser={currentUser}
          deactivateMe={(...args) => dispatch(deactivateMe(...args))}
          deleteMe={(...args) => dispatch(deleteMe(...args))}
          logout={(...args) => dispatch(logout(...args))}
          setConfirm={setConfirm}
          updateUserSettings={(...args) => dispatch(updateUserSettings(...args))}
        />
      )
    },
    {
      name: t('Saved Searches'),
      path: 'saved-searches',
      component: <SavedSearchesTab />
    }
  ]

  if (currentUser && !isEmpty(currentUser.blockedUsers.toRefArray())) {
    content.push({
      name: t('Blocked Users'),
      path: 'blocked-users',
      component: (
        <BlockedUsersTab
          blockedUsers={blockedUsers}
          unBlockUser={(...args) => dispatch(unBlockUser(...args))}
          loading={fetchPending}
        />
      )
    })
  }

  if (currentUser && currentUser.hasFeature(PROJECT_CONTRIBUTIONS)) {
    content.push({
      name: t('Payment'),
      path: 'payment',
      component: (
        <PaymentSettingsTab
          currentUser={currentUser}
          updateUserSettings={(...args) => dispatch(updateUserSettings(...args))}
          setConfirm={setConfirm}
          queryParams={queryParams}
          registerStripeAccount={(...args) => dispatch(registerStripeAccount(...args))}
        />
      )
    })
  }

  return <FullPageModal content={content} />
}

export default UserSettings
