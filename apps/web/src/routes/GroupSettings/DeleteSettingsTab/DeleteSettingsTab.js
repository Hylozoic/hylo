import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Archive, Trash2, UserCheck } from 'lucide-react'
import { AnalyticsEvents, WebViewMessageTypes } from '@hylo/shared'
import { allGroupsUrl } from '@hylo/navigation'
import { HandOffPicker } from 'components/SoleAdminLeaveDialog/SoleAdminLeaveDialog'
import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import { isLegacyWebView, sendMessageToWebView } from 'util/webView'
import { cn } from 'util/index'

// Matches DELETE_CONFIRM_NAME_MEMBER_THRESHOLD on the server (models/group/deletion.js)
export const DELETE_CONFIRM_NAME_MEMBER_THRESHOLD = 10

const ARCHIVED = 'archived'

export function fetchCloseGroupDetails (groupId) {
  return {
    type: 'FETCH_CLOSE_GROUP_DETAILS',
    graphql: {
      query: `query CloseGroupDetails ($id: ID) {
        group(id: $id) { id memberCount status }
      }`,
      variables: { id: groupId }
    },
    meta: { extractModel: 'Group' }
  }
}

export function setGroupArchived (groupId, archived) {
  const mutation = archived ? 'archiveGroup' : 'unarchiveGroup'
  return {
    type: archived ? 'ARCHIVE_GROUP' : 'UNARCHIVE_GROUP',
    graphql: {
      query: `mutation SetGroupArchived ($groupId: ID!) {
        ${mutation}(groupId: $groupId) { id status }
      }`,
      variables: { groupId }
    },
    meta: { extractModel: 'Group' }
  }
}

export function deleteGroupWithName (groupId, confirmName) {
  return {
    type: 'DELETE_GROUP_WITH_NAME',
    graphql: {
      query: `mutation DeleteGroup ($id: ID, $confirmName: String) {
        deleteGroup(id: $id, confirmName: $confirmName) { success }
      }`,
      variables: { id: groupId, confirmName }
    }
  }
}

function CloseOption ({ icon: OptionIcon, title, description, destructive, children, testId }) {
  return (
    <section
      className={cn('rounded-lg border-2 p-4 flex flex-col gap-3', destructive ? 'border-destructive/30' : 'border-foreground/10')}
      data-testid={testId}
    >
      <div className='flex items-start gap-3'>
        <OptionIcon className={cn('w-5 h-5 mt-0.5 shrink-0', destructive ? 'text-destructive' : 'text-foreground/70')} />
        <div>
          <h3 className='text-foreground font-bold m-0'>{title}</h3>
          <p className='text-foreground/70 text-sm mt-1 mb-0'>{description}</p>
        </div>
      </div>
      <div className='pl-8'>{children}</div>
    </section>
  )
}

/**
 * Close a group: hand it to another Administrator, archive it read-only (top-level
 * groups), or delete it, which larger groups confirm by typing the group's name.
 */
function DeleteSettingsTab ({ group }) {
  const { name } = group
  const { t } = useTranslation()
  const dispatch = useDispatch()
  // Until the member count is known, deleting waits; if it can't be loaded, the name is asked for
  const [details, setDetails] = useState({ memberCount: group.memberCount, status: group.status, loaded: group.memberCount != null })
  const [confirmName, setConfirmName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)
  const isSpace = group.type === 'space' || !!group.parentGroup
  const archived = details.status === ARCHIVED
  const needsName = details.memberCount == null
    ? details.loaded
    : details.memberCount > DELETE_CONFIRM_NAME_MEMBER_THRESHOLD
  const nameMatches = confirmName.trim().toLowerCase() === (name || '').trim().toLowerCase()

  useEffect(() => {
    if (!group.id) return
    let active = true
    Promise.resolve(dispatch(fetchCloseGroupDetails(group.id)))
      .then(result => {
        const fetched = result?.payload?.data?.group
        if (!active) return
        setDetails(current => fetched
          ? { memberCount: fetched.memberCount, status: fetched.status, loaded: true }
          : { ...current, loaded: true })
      })
      .catch(() => { if (active) setDetails(current => ({ ...current, loaded: true })) })
    return () => { active = false }
  }, [group.id, dispatch])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: {
        desktop: `${t('Group Settings')} > ${t('Close Group')}`,
        mobile: t('Close Group')
      },
      icon: 'Settings'
    })
  }, [])

  const handleHandedOff = useCallback(person => {
    setNotice(t('{{name}} is now an Administrator of {{group}}.', { name: person.name, group: name }))
  }, [name, t])

  const toggleArchived = useCallback(() => {
    const archiving = !archived
    if (archiving && !window.confirm(t('Archive {{name}}? Members can still read it, but nobody can post, comment, chat or join until you open it again.', { name }))) return
    setBusy(true)
    setError(null)
    Promise.resolve(dispatch(setGroupArchived(group.id, archiving)))
      .then(result => {
        const saved = result?.payload?.data?.[archiving ? 'archiveGroup' : 'unarchiveGroup']
        if (result?.error || !saved) throw result?.payload || new Error('failed')
        setDetails(current => ({ ...current, status: saved.status }))
        setNotice(archiving ? t('{{name}} is archived.', { name }) : t('{{name}} is open again.', { name }))
        dispatch(trackAnalyticsEvent(archiving ? AnalyticsEvents.GROUP_ARCHIVED : AnalyticsEvents.GROUP_UNARCHIVED, { groupId: group.id }))
      })
      .catch(() => setError(t('There was an error, please try again.')))
      .finally(() => setBusy(false))
  }, [archived, dispatch, group.id, name, t])

  const handleDelete = useCallback(() => {
    if (needsName && !nameMatches) return
    if (!needsName && !window.confirm(t('Delete {{name}}? Everyone will be removed and emailed. Hylo staff can restore it for 30 days.', { name }))) return
    setBusy(true)
    setError(null)
    Promise.resolve(dispatch(deleteGroupWithName(group.id, needsName ? confirmName : undefined)))
      .then(result => {
        if (result?.error || !result?.payload?.data?.deleteGroup?.success) throw result?.payload || new Error('failed')
        dispatch(trackAnalyticsEvent(AnalyticsEvents.GROUP_DELETED, { groupId: group.id, memberCount: details.memberCount }))
        if (isLegacyWebView()) {
          sendMessageToWebView(WebViewMessageTypes.GROUP_DELETED, { groupSlug: group.slug, groupId: group.id })
        }
        window.location = allGroupsUrl()
      })
      .catch(() => {
        setError(t('There was an error, please try again.'))
        setBusy(false)
      })
  }, [confirmName, details.memberCount, dispatch, group.id, group.slug, name, nameMatches, needsName, t])

  return (
    <div className='flex flex-col gap-4'>
      <div>
        <h2 className='text-foreground font-bold mb-2'>{t('Close {{groupName}}', { groupName: name })}</h2>
        <p className='text-foreground/70 m-0'>{t('Stepping back from this group? Choose what happens to it.')}</p>
      </div>

      {notice && <p className='text-sm text-foreground bg-selected/20 rounded-md p-3 m-0' role='status'>{notice}</p>}
      {error && <p className='text-sm text-destructive m-0' role='alert'>{error}</p>}

      <CloseOption
        icon={UserCheck}
        testId='close-group-hand-off'
        title={t('Hand it to someone else')}
        description={t('Make another member an Administrator so the group can carry on without you. You can stay or leave afterwards.')}
      >
        <HandOffPicker group={group} surface='close' onHandedOff={handleHandedOff} />
      </CloseOption>

      {!isSpace && (
        <CloseOption
          icon={Archive}
          testId='close-group-archive'
          title={archived ? t('This group is archived') : t('Archive it')}
          description={archived
            ? t('Members can still read everything, but nobody can post, comment, chat or join. You can open it again at any time.')
            : t('Keep everything readable for members, but stop new posts, comments, chat and joins. You can open it again at any time.')}
        >
          <Button variant='outline' disabled={busy} onClick={toggleArchived} className='w-fit'>
            {archived ? t('Open group again') : t('Archive group')}
          </Button>
        </CloseOption>
      )}

      <CloseOption
        icon={Trash2}
        destructive
        testId='close-group-delete'
        title={t('Delete it')}
        description={t('The group disappears for everyone. All members are removed and get an email saying it was closed. If you change your mind, Hylo staff can restore it for 30 days.')}
      >
        {needsName && (
          <label className='flex flex-col gap-1 text-sm text-foreground/80 mb-3'>
            {t('Type {{name}} to confirm', { name })}
            <Input value={confirmName} onChange={event => setConfirmName(event.target.value)} autoComplete='off' />
          </label>
        )}
        <Button
          variant='destructive'
          onClick={handleDelete}
          disabled={busy || !details.loaded || (needsName && !nameMatches)}
          className='w-fit flex items-center justify-center gap-2'
        >
          <Trash2 className='w-4 h-4' />
          {t('Delete Group')}
        </Button>
      </CloseOption>
    </div>
  )
}

DeleteSettingsTab.propTypes = {
  group: PropTypes.object
}

export default DeleteSettingsTab
