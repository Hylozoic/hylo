import { compact } from 'lodash/fp'
import React, { useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { push } from 'redux-first-history'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import useIsPhoneViewport from 'hooks/useIsPhoneViewport'
import AppearanceTab from './AppearanceTab/AppearanceTab'
import AgreementsTab from './AgreementsTab'
import CustomViewsTab from './CustomViewsTab'
import DeleteSettingsTab from './DeleteSettingsTab'
import GroupSettingsTab from './GroupSettingsTab'
import ImportExportSettingsTab from './ImportExportSettingsTab'
import InviteSettingsTab from './InviteSettingsTab'
import MembershipRequestsTab from './MembershipRequestsTab'
import RolesSettingsTab from './RolesSettingsTab'
import PrivacySettingsTab from './PrivacySettingsTab'
import RelatedGroupsTab from './RelatedGroupsTab'
import ResponsibilitiesTab from './ResponsibilitiesTab'
import ExportDataTab from './ExportDataTab'
import TracksTab from './TracksTab'
import WelcomePageTab from './WelcomePageTab'
import Loading from 'components/Loading'
import { fetchLocation } from 'components/LocationInput/LocationInput.store'
import FullPageModal from 'routes/FullPageModal'
import { RESP_ADD_MEMBERS, RESP_ADMINISTRATION, RESP_MANAGE_TRACKS } from 'store/constants'
import { WebViewMessageTypes } from '@hylo/shared'
import { isLegacyWebView, sendMessageToWebView } from 'util/webView'
import getResponsibilitiesForGroup from 'store/selectors/getResponsibilitiesForGroup'
import { allGroupsUrl, groupUrl } from '@hylo/navigation'
import presentGroup from 'store/presenters/presentGroup'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getParentGroups } from 'store/selectors/getGroupRelationships'
import getCommonRoles from 'store/selectors/getCommonRoles'
import getMe from 'store/selectors/getMe'
import {
  FETCH_GROUP_SETTINGS,
  deleteGroup,
  fetchGroupSettings,
  updateGroupSettings
} from './GroupSettings.store'

// On phone, /settings shows this list-of-categories instead of the default tab content.
// Tapping a category navigates to /settings/<path>; the back chevron there returns here.
function PhoneSettingsMenuList ({ items, groupSlug }) {
  const navigate = useNavigate()
  return (
    <ul className='flex flex-col gap-2 p-0 m-0 list-none'>
      {items.map(item => (
        <li key={item.path}>
          <button
            type='button'
            onClick={() => navigate(groupUrl(groupSlug, `settings/${item.path}`))}
            className='flex items-center justify-between w-full px-4 py-3 rounded-lg bg-card hover:bg-card/80 text-foreground text-left cursor-pointer border border-foreground/10 transition-colors'
          >
            <span className='text-base'>{item.name}</span>
            <ChevronRight className='w-5 h-5 text-foreground/40' />
          </button>
        </li>
      ))}
    </ul>
  )
}

export default function GroupSettings () {
  const dispatch = useDispatch()
  const routeParams = useParams()
  const { t } = useTranslation()
  const isPhoneViewport = useIsPhoneViewport()

  // State selectors
  const slug = routeParams.groupSlug
  const rawGroup = useSelector(state => getGroupForSlug(state, slug))
  const group = useMemo(() => rawGroup ? presentGroup(rawGroup) : null, [rawGroup])
  const currentUser = useSelector(getMe)
  const parentGroups = useSelector(state => getParentGroups(state, rawGroup))
  const commonRoles = useSelector(getCommonRoles)
  const fetchPending = useSelector(state => state.pending[FETCH_GROUP_SETTINGS])

  // Action creators
  const fetchGroupSettingsAction = () => slug && dispatch(fetchGroupSettings(slug))
  const fetchLocationAction = (location) => dispatch(fetchLocation(location))
  const updateGroupSettingsAction = changes => group && dispatch(updateGroupSettings(group.id, changes))
  const deleteGroupAction = () => {
    if (group) {
      dispatch(deleteGroup(group.id)).then(({ error }) => {
        if (!error) {
          if (isLegacyWebView()) {
            sendMessageToWebView(WebViewMessageTypes.GROUP_DELETED, {
              groupSlug: group.slug,
              groupId: group.id
            })
          }
          window.location = allGroupsUrl()
        }
      })
    }
  }

  useEffect(() => {
    group && fetchGroupSettingsAction()
  }, [slug])

  const responsibilities = useSelector(state => getResponsibilitiesForGroup(state, { person: currentUser, groupId: group?.id })).map(r => r.title)
  const canAdminister = responsibilities.includes(RESP_ADMINISTRATION)
  const canAddMembers = responsibilities.includes(RESP_ADD_MEMBERS)
  const canManageTracks = responsibilities.includes(RESP_MANAGE_TRACKS)

  if (!group) return <Loading />

  if (!responsibilities.includes(RESP_ADMINISTRATION) && !responsibilities.includes(RESP_ADD_MEMBERS)) push(groupUrl(slug))
  if (!responsibilities.includes(RESP_ADMINISTRATION) && responsibilities.includes(RESP_ADD_MEMBERS)) push('settings/invite')

  const groupDetailsTab = (
    <GroupSettingsTab
      fetchLocation={fetchLocationAction}
      fetchPending={fetchPending}
      currentUser={currentUser}
      group={group}
      parentGroups={parentGroups}
      updateGroupSettings={updateGroupSettingsAction}
    />
  )

  // Build the phone menu list from the same metadata as the tabs themselves so
  // labels and visibility follow the user's permissions automatically.
  const phoneMenuItems = compact([
    canAdminister && { name: t('Group Details'), path: 'details' },
    canAdminister && { name: t('Agreements'), path: 'agreements' },
    canAdminister && { name: t('Welcome Page'), path: 'welcome' },
    canAdminister && { name: t('Responsibilities'), path: 'responsibilities' },
    canAdminister && { name: t('Roles & Badges'), path: 'roles' },
    canAdminister && { name: t('Privacy & Access'), path: 'privacy' },
    canAddMembers && { name: t('Invite'), path: 'invite' },
    canAddMembers && { name: t('Join Requests'), path: 'requests' },
    canAdminister && { name: t('Related Groups'), path: 'relationships' },
    canManageTracks && { name: t('Tracks'), path: 'tracks' },
    canAdminister && { name: t('Custom Views'), path: 'views' },
    canAdminister && { name: t('Export Data'), path: 'export' },
    canAdminister && { name: t('Appearance & Layout'), path: 'appearance' },
    canAdminister && { name: t('Delete'), path: 'delete' }
  ])

  const overallSettings = {
    name: t('Settings'),
    path: '',
    component: isPhoneViewport
      ? <PhoneSettingsMenuList items={phoneMenuItems} groupSlug={slug} />
      : groupDetailsTab
  }

  // Stable URL for Group Details (used by the phone menu list and the desktop
  // sidebar so both link to the same place).
  const detailsSettings = {
    name: t('Group Details'),
    path: 'details',
    component: groupDetailsTab
  }

  const agreementSettings = {
    name: t('Agreements'),
    path: 'agreements',
    component: <AgreementsTab group={group} />
  }

  const welcomePageSettings = {
    name: t('Welcome Page'),
    path: 'welcome',
    component: <WelcomePageTab group={group} updateGroupSettings={updateGroupSettingsAction} />
  }

  const responsibilitiesSettings = {
    name: t('Responsibilities'),
    path: 'responsibilities',
    component: <ResponsibilitiesTab groupId={group.id} group={group} slug={group.slug} />
  }

  const rolesSettings = {
    name: t('Roles & Badges'),
    path: 'roles',
    component: <RolesSettingsTab groupId={group.id} group={group} slug={group.slug} commonRoles={commonRoles} />
  }

  const accessSettings = {
    name: t('Privacy & Access'),
    path: 'privacy',
    component: <PrivacySettingsTab group={group} slug={group.slug} updateGroupSettings={updateGroupSettingsAction} parentGroups={parentGroups} fetchPending={fetchPending} />
  }

  const customViewsSettings = {
    name: t('Custom Views'),
    path: 'views',
    component: (
      <CustomViewsTab group={group} />
    )
  }

  // const topicsSettings = {
  //   name: t('Topics'),
  //   path: 'topics',
  //   component: <TopicsSettingsTab group={group} />
  // }

  const inviteSettings = {
    name: t('Invite'),
    path: 'invite',
    component: <InviteSettingsTab group={group} />
  }

  const joinRequestSettings = {
    name: t('Join Requests'),
    path: 'requests',
    component: <MembershipRequestsTab group={group} currentUser={currentUser} />
  }

  const relatedGroupsSettings = {
    name: t('Related Groups'),
    path: 'relationships',
    component: <RelatedGroupsTab group={group} currentUser={currentUser} />
  }

  const tracksSettings = {
    name: t('Tracks'),
    path: 'tracks',
    component: <TracksTab group={group} currentUser={currentUser} />
  }

  const importSettings = {
    name: '',
    path: 'import',
    component: <ImportExportSettingsTab group={group} />
  }

  const exportSettings = {
    name: t('Export Data'),
    path: 'export',
    component: <ExportDataTab group={group} />
  }

  const appearanceSettings = {
    name: t('Appearance & Layout'),
    path: 'appearance',
    component: <AppearanceTab group={group} updateGroupSettings={updateGroupSettingsAction} />
  }

  const deleteSettings = {
    name: t('Delete'),
    path: 'delete',
    component: <DeleteSettingsTab group={group} deleteGroup={deleteGroupAction} />
  }

  return (
    <FullPageModal
      goToOnClose={groupUrl(slug)}
      content={compact([
        canAdminister ? overallSettings : null,
        canAdminister ? detailsSettings : null,
        canAdminister ? agreementSettings : null,
        canAdminister ? welcomePageSettings : null,
        canAdminister ? responsibilitiesSettings : null,
        canAdminister ? rolesSettings : null,
        canAdminister ? accessSettings : null,
        canAdminister ? customViewsSettings : null,
        // canAdminister ? topicsSettings : null, TODO: hide for now, we may want to bring back
        canAddMembers ? inviteSettings : null,
        canAddMembers ? joinRequestSettings : null,
        canAdminister ? relatedGroupsSettings : null,
        canManageTracks ? tracksSettings : null,
        canAdminister ? importSettings : null,
        canAdminister ? exportSettings : null,
        canAdminister ? appearanceSettings : null,
        canAdminister ? deleteSettings : null
      ])}
    />
  )
}
