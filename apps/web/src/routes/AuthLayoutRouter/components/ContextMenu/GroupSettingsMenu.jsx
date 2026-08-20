import { isPhoneDevice } from 'util/mobile'
import { get } from 'lodash/fp'
import { ChevronLeft } from 'lucide-react'
import React, { useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'

import { groupUrl } from '@hylo/navigation'

import MenuLink from './MenuLink'
import { setConfirmBeforeClose } from 'routes/FullPageModal/FullPageModal.store'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { RESP_ADD_MEMBERS, RESP_ADMINISTRATION } from 'store/constants'
import { GROUP_TYPES } from 'store/models/Group'
import { cn } from 'util/index'

/** Settings overlay for the ContextMenu panel. Accepts groupSlug directly (no context required). */
export default function GroupSettingsMenu ({ group, groupSlug, isOneColumn = false }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const slug = groupSlug || group?.slug

  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))
  const canAddMembers = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADD_MEMBERS, groupId: group?.id }))
  const isSpace = group?.type === GROUP_TYPES.space || !!group?.parentId

  // XXX: hacky way to track the view we were at before opening the settings menu. also see locationHistory.js
  const previousLocation = useSelector(state => get('locationHistory.currentLocation', state))
  const confirm = useSelector(state => get('FullPageModal.confirm', state))

  const closeMenu = useCallback(() => {
    if (!confirm || window.confirm(t('You have unsaved changes, are you sure you want to leave?'))) {
      dispatch(setConfirmBeforeClose(false))
      navigate(previousLocation || groupUrl(slug))
    }
  }, [confirm, previousLocation, slug])

  const phoneLayout = isPhoneDevice()

  const settingsMenuItems = useMemo(() => [
    canAdminister && { title: 'Group Details', url: 'settings' },
    canAdminister && { title: 'Agreements', url: 'settings/agreements' },
    canAdminister && { title: 'Responsibilities', url: 'settings/responsibilities' },
    canAdminister && { title: 'Roles & Badges', url: 'settings/roles' },
    canAdminister && { title: 'Privacy & Access', url: 'settings/privacy' },
    canAddMembers && !isSpace && { title: 'Invitations', url: 'settings/invite' },
    canAddMembers && { title: 'Join Requests', url: 'settings/requests' },
    canAdminister && { title: 'Related Groups', url: 'settings/relationships' },
    canAdminister && { title: 'Export Data', url: 'settings/export' },
    canAdminister && { title: 'Appearance & Layout', url: 'settings/appearance' },
    canAdminister && { title: 'Paid Content', url: 'settings/paid-content' },
    canAdminister && { title: 'Delete', url: 'settings/delete' }
  ].filter(Boolean), [canAdminister, canAddMembers, isSpace])

  return (
    <div
      className={cn(
        'ContextMenu-GroupSettings h-full bg-background bg-gradient-to-b from-background to-theme-background/20 z-[1050]',
        phoneLayout
          ? 'fixed top-0 left-[66px] sm:left-[80px] w-[260px] sm:w-[300px]'
          : 'absolute inset-0 w-full'
      )}
    >
      <div
        className={cn(
          'absolute h-full overflow-y-auto top-0 right-0 flex flex-col gap-2 bg-background shadow-[-15px_0px_25px_rgba(0,0,0,0.3)] px-2 z-10',
          phoneLayout ? (isOneColumn ? 'left-0' : 'left-14') : 'left-0'
        )}
      >
        <h3 className='text-lg font-bold flex items-center gap-2 text-foreground'>
          <ChevronLeft className='w-6 h-6 inline cursor-pointer' onClick={closeMenu} />
          {t('Group Settings')}
        </h3>
        <ul className='flex flex-col gap-2 p-0'>
          {settingsMenuItems.map(item => {
            const itemPath = groupUrl(slug, item.url)
            // Group Details uses the /settings prefix shared by all tabs, so only match exactly
            const isActive = item.url === 'settings'
              ? location.pathname === itemPath
              : location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`)

            return (
              <li key={item.url}>
                <MenuLink
                  to={itemPath}
                  isActive={isActive}
                  className={cn(
                    'text-base text-foreground border-2 border-transparent hover:border-foreground/50 hover:text-foreground rounded-md p-1 pl-2 hover:bg-card text-foreground w-full block transition-all scale-100 hover:scale-102 opacity-85 hover:opacity-100',
                    { 'border-secondary': isActive }
                  )}
                >
                  {t(item.title)}
                </MenuLink>
              </li>
            )
          })}
        </ul>
      </div>
      <div className='absolute top-0 left-0 z-0 w-full h-full' onClick={closeMenu} />
    </div>
  )
}
