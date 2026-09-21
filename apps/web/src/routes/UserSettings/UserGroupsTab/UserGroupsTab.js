import get from 'lodash/get'
import React, { useCallback, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { WebViewMessageTypes } from '@hylo/shared'
import Button from 'components/ui/button'
import Dropdown from 'components/Dropdown'
import { Trash } from 'lucide-react'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import GroupCard from 'components/GroupCard'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from 'components/ui/dialog'
import {
  LEAVE_GROUP
} from 'store/constants'
import { cn } from 'util/index'
import { isLegacyWebView, sendMessageToWebView } from 'util/webView'

import { leaveGroup } from './UserGroupsTab.store'
import { getMyGroupsWithChildren, isSpaceGroup } from 'store/selectors/getMyGroups'
import { spaceHomeUrl } from '@hylo/navigation'

function UserGroupsTab () {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  // Get state from Redux
  const action = useSelector(state => get(state, 'UserGroupsTab.action'))
  const groupsTree = useSelector(getMyGroupsWithChildren)

  // Local state
  const [groups, setGroups] = useState(groupsTree || [])
  const [errorMessage, setErrorMessage] = useState(undefined)
  const [successMessage, setSuccessMessage] = useState(undefined)
  const [groupToLeave, setGroupToLeave] = useState(null)

  useEffect(() => {
    setGroups(groupsTree || [])
  }, [groupsTree])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('My Groups'),
      icon: '',
      info: '',
      search: false
    })
  }, [])

  const displayMessage = errorMessage || successMessage

  const resetMessage = useCallback(() => {
    setErrorMessage(undefined)
    setSuccessMessage(undefined)
  }, [])

  const handleLeaveGroup = useCallback((group) => {
    setGroupToLeave(group)
  }, [])

  const confirmLeaveGroup = useCallback(() => {
    if (!groupToLeave) return

    dispatch(leaveGroup(groupToLeave.id))
      .then(res => {
        if (res.error) {
          setErrorMessage(t('Error leaving {{group_name}}', { group_name: groupToLeave.name || 'this group' }))
          return
        }

        const deletedGroupId = get(res, 'payload.data.leaveGroup')
        if (deletedGroupId) {
          setSuccessMessage(t('You left {{group_name}}', { group_name: groupToLeave.name || 'this group' }))
          setGroups(currentGroups => currentGroups
            .map(group => ({
              ...group,
              spaces: (group.spaces || []).filter(space => String(space.id) !== String(deletedGroupId))
            }))
            .filter(group => String(group.id) !== String(deletedGroupId))
            .filter(group => !group.isParentOnly || (group.spaces || []).length > 0))
        }

        if (isLegacyWebView()) {
          sendMessageToWebView(WebViewMessageTypes.LEFT_GROUP, { groupId: deletedGroupId })
        }
      })
      .finally(() => {
        setGroupToLeave(null)
      })
  }, [groupToLeave, dispatch, t])

  if (!groups) return <Loading />

  const leaveLabel = (group) => t(isSpaceGroup(group) ? 'Leave Space' : 'Leave Group')

  const renderLeaveButton = (group) => (
    <div className='flex items-center p-2 bg-darkening/20 rounded-b-lg sm:rounded-r-lg sm:rounded-b-none group w-full sm:w-auto justify-end'>
      <Button variant='outline' onClick={() => handleLeaveGroup(group)} className='border-accent/20 hover:border-accent/100 text-sm text-accent/60 hover:text-accent/100'>
        <Trash className='opacity-50 group-hover:opacity-100 cursor-pointer text-accent hover:scale-110 w-10 h-10 transition-all duration-300' /> {leaveLabel(group)}
      </Button>
    </div>
  )

  const renderGroupRow = (group, { nested = false, to = null } = {}) => (
    <div key={group.id} className={cn('relative flex items-center mb-4 w-full flex-col sm:flex-row', nested && 'ml-4 sm:ml-8')}>
      <div className='flex-1 min-w-0 w-full'>
        <GroupCard
          group={{ ...group, memberStatus: 'member' }}
          to={to}
        />
      </div>
      {renderLeaveButton(group)}
    </div>
  )

  return (
    <div className='p-4 max-w-4xl mx-auto'>
      <div className='text-foreground/70 mb-6'>{t('This list shows which groups on Hylo you are a part of.')}</div>

      <h2 className='text-xl font-bold mb-4 text-foreground'>{t('Hylo Groups')}</h2>
      {action === LEAVE_GROUP && displayMessage && <Message errorMessage={errorMessage} successMessage={successMessage} reset={resetMessage} />}
      {groups.map(group => (
        <div key={group.id} className='mb-6'>
          {group.isParentOnly
            ? <h3 className='text-lg font-semibold text-foreground mb-3'>{group.name}</h3>
            : renderGroupRow(group)}
          {(group.spaces || []).map(space => renderGroupRow(space, {
            nested: true,
            to: spaceHomeUrl(group.slug, space)
          }))}
        </div>
      ))}

      <Dialog open={!!groupToLeave} onOpenChange={(open) => !open && setGroupToLeave(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{groupToLeave ? leaveLabel(groupToLeave) : t('Leave Group')}</DialogTitle>
            <DialogDescription className='text-foreground/70'>
              {t('Are you sure you want to leave {{group_name}}? You will no longer have access to this group\'s content.', { group_name: groupToLeave?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className='flex gap-2 mt-4'>
            <Button variant='outline' onClick={() => setGroupToLeave(null)}>
              {t('Cancel')}
            </Button>
            <Button variant='destructive' onClick={confirmLeaveGroup}>
              {groupToLeave ? leaveLabel(groupToLeave) : t('Leave Group')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function AddAffiliation ({ close, save }) {
  const { t } = useTranslation()
  const PREPOSITIONS = [t('of'), t('at'), t('for')]
  const [role, setRole] = useState('')
  const [preposition, setPreposition] = useState(PREPOSITIONS[0])
  const [orgName, setOrgName] = useState('')
  const [url, setUrl] = useState('')

  const canSave = role.length && orgName.length

  const URL_PROTOCOL = 'https://'
  const CHAR_LIMIT = 30

  const formatUrl = url => `${URL_PROTOCOL}${url}`

  return (
    <div className='bg-card rounded-lg shadow-xl p-4'>
      <div className='flex justify-between items-center mb-4 border-b pb-2'>
        <h3 className='text-lg font-bold text-foreground'>{t('Add new affiliation')}</h3>
        <button onClick={close} className='text-foreground/60 hover:text-foreground text-xl'>&times;</button>
      </div>

      <div className='space-y-4'>
        <div className='relative'>
          <input
            type='text'
            onChange={e => setRole(e.target.value.substring(0, CHAR_LIMIT))}
            placeholder={t('Name of role')}
            value={role}
            className='w-full p-2 rounded-md bg-background border-2 border-foreground/20 focus:border-foreground/40 outline-none'
          />
          <div className='absolute right-2 top-2 text-xs text-foreground/60'>{role.length}/{CHAR_LIMIT}</div>
        </div>

        <Dropdown
          toggleChildren={
            <span className='flex items-center gap-1 text-foreground'>
              {t(PREPOSITIONS.find(p => p === preposition))}
              <Icon name='ArrowDown' />
            </span>
          }
          items={PREPOSITIONS.map(p => ({
            label: t(p),
            onClick: () => setPreposition(p)
          }))}
          alignLeft
          className='w-32'
        />

        <div className='relative'>
          <input
            type='text'
            onChange={e => setOrgName(e.target.value.substring(0, CHAR_LIMIT))}
            placeholder={t('Name of organization')}
            value={orgName}
            className='w-full p-2 rounded-md bg-background border-2 border-foreground/20 focus:border-foreground/40 outline-none'
          />
          <div className='absolute right-2 top-2 text-xs text-foreground/60'>{orgName.length}/{CHAR_LIMIT}</div>
        </div>

        <div>
          <input
            type='text'
            onChange={e => setUrl(e.target.value.substring(URL_PROTOCOL.length))}
            placeholder={t('URL of organization')}
            value={formatUrl(url)}
            className='w-full p-2 rounded-md bg-background border-2 border-foreground/20 focus:border-foreground/40 outline-none'
          />
        </div>

        <button
          className={cn(
            'w-full p-2 rounded-md transition-all duration-300',
            canSave
              ? 'bg-selected text-foreground hover:bg-selected/90 hover:scale-102'
              : 'bg-foreground/20 text-foreground/50 cursor-not-allowed'
          )}
          onClick={canSave ? () => save({ role, preposition, orgName, url }) : undefined}
        >
          {t('Add Affiliation')}
        </button>
      </div>
    </div>
  )
}

export function Message ({ errorMessage, successMessage, reset }) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg mb-4 cursor-pointer transition-all hover:opacity-90',
        errorMessage ? 'bg-destructive text-destructive-foreground' : 'bg-selected text-foreground'
      )}
      onClick={reset}
    >
      {errorMessage || successMessage}
    </div>
  )
}

export default UserGroupsTab
