import get from 'lodash/get'
import React, { useCallback, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { useDispatch, useSelector } from 'react-redux'
import { WebViewMessageTypes } from '@hylo/shared'
import Affiliation from 'components/Affiliation'
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
  CREATE_AFFILIATION,
  DELETE_AFFILIATION,
  LEAVE_GROUP
} from 'store/constants'
import orm from 'store/models'
import { cn } from 'util/index'
import isWebView, { sendMessageToWebView } from 'util/webView'

import { createAffiliation, deleteAffiliation, leaveGroup } from './UserGroupsTab.store'
import getMyMemberships from 'store/selectors/getMyMemberships'
import useRouteParams from 'hooks/useRouteParams'

export const getCurrentUserAffiliations = ormCreateSelector(
  orm,
  session => {
    const me = session.Me.first()
    if (!me) return {}
    return me?.affiliations?.items
  }
)

function UserGroupsTab () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useRouteParams()

  // Get state from Redux
  const action = useSelector(state => get(state, 'UserGroupsTab.action'))
  const reduxAffiliations = useSelector(getCurrentUserAffiliations)
  const reduxMemberships = useSelector(getMyMemberships).sort((a, b) =>
    a.group.name.localeCompare(b.group.name))

  // Local state
  const [affiliations, setAffiliations] = useState(reduxAffiliations || [])
  const [memberships, setMemberships] = useState(reduxMemberships || [])
  const [errorMessage, setErrorMessage] = useState(undefined)
  const [successMessage, setSuccessMessage] = useState(undefined)
  const [showAddAffiliations, setShowAddAffiliations] = useState(false)
  const [groupToLeave, setGroupToLeave] = useState(null)

  useEffect(() => {
    setAffiliations(reduxAffiliations || [])
  }, [reduxAffiliations])

  useEffect(() => {
    setMemberships(reduxMemberships || [])
  }, [reduxMemberships])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Groups and Affiliations'),
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

  const toggleAddAffiliations = useCallback(() => {
    setShowAddAffiliations(!showAddAffiliations)
  }, [showAddAffiliations])

  const deleteAffiliationHandler = useCallback((affiliationId) => {
    dispatch(deleteAffiliation(affiliationId))
      .then(res => {
        if (res.error) {
          setErrorMessage(t('Error deleting this affiliation.'))
          return
        }

        const deletedAffiliationId = get(res, 'payload.data.deleteAffiliation')
        if (deletedAffiliationId) {
          setSuccessMessage(t('Your affiliation was deleted'))
          const updatedItems = affiliations.filter((a) => a.id !== deletedAffiliationId)
          setAffiliations([...updatedItems])
        }
      })
  }, [affiliations])

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
          const newMemberships = memberships.filter((m) => m.group.id !== deletedGroupId)
          setMemberships(newMemberships)
        }

        if (isWebView()) {
          sendMessageToWebView(WebViewMessageTypes.LEFT_GROUP, { groupId: deletedGroupId })
        }
      })
      .finally(() => {
        setGroupToLeave(null)
      })
  }, [groupToLeave, memberships, dispatch, t])

  const saveAffiliation = useCallback(({ role, preposition, orgName, url }) => {
    dispatch(createAffiliation({ role, preposition, orgName, url }))
      .then(res => {
        const affiliation = get(res, 'payload.data.createAffiliation')
        if (affiliation) {
          setSuccessMessage(t('Your affiliation was added'))
          const updatedItems = [...affiliations, affiliation]
          setAffiliations(updatedItems)
          setShowAddAffiliations(false)
          setErrorMessage('')
        }
      })
      .catch((e) => {
        setErrorMessage(e.message)
        setShowAddAffiliations(true)
      })
  }, [affiliations])

  if (!memberships && !affiliations) return <Loading />

  return (
    <div className='p-4 max-w-4xl mx-auto'>
      <div className='text-foreground/70 mb-6'>{t('This list shows which groups on Hylo you are a part of. You can also share your affiliations with organizations that are not currently on Hylo, which will appear on your profile.')}</div>

      <h2 className='text-xl font-bold mb-4 text-foreground'>{t('Hylo Groups')}</h2>
      {action === LEAVE_GROUP && displayMessage && <Message errorMessage={errorMessage} successMessage={successMessage} reset={resetMessage} />}
      {memberships.map(m => {
        const group = {
          ...m.group.ref,
          memberStatus: 'member'
        }
        return (
          <div key={m.id} className='relative flex items-center mb-4 w-full flex-col sm:flex-row'>
            <div className='flex-1 min-w-0 w-full'>
              <GroupCard
                group={group}
                routeParams={routeParams}
                className='w-full'
              />
            </div>
            <div className='flex items-center p-2 bg-black/20 rounded-b-lg sm:rounded-r-lg sm:rounded-b-none group w-full sm:w-auto justify-end'>
              <Button variant='outline' onClick={() => handleLeaveGroup(m.group)} className='border-accent/20 hover:border-accent/100 text-sm text-accent/60 hover:text-accent/100'>
                <Trash className='opacity-50 group-hover:opacity-100 cursor-pointer text-accent hover:scale-110 w-10 h-10 transition-all duration-300' /> {t('Leave Group')}
              </Button>
            </div>
          </div>
        )
      })}

      <h2 className='text-xl font-bold mb-4 mt-8 text-foreground'>{t('Other Affiliations')}</h2>
      {action === DELETE_AFFILIATION && displayMessage && <Message errorMessage={errorMessage} successMessage={successMessage} reset={resetMessage} />}
      {affiliations && affiliations.length > 0 && affiliations.map((a, index) =>
        <Affiliation
          affiliation={a}
          archive={deleteAffiliationHandler}
          key={a.id}
          index={index}
        />
      )}

      {action === CREATE_AFFILIATION && displayMessage && <Message errorMessage={errorMessage} successMessage={successMessage} reset={resetMessage} />}

      {showAddAffiliations
        ? <AddAffiliation close={toggleAddAffiliations} save={saveAffiliation} />
        : (
          <div
            className='flex items-center gap-2 p-4 rounded-lg bg-card/60 hover:bg-card/100 cursor-pointer transition-all shadow-lg hover:shadow-xl hover:scale-102'
            onClick={toggleAddAffiliations}
          >
            <div className='flex items-center justify-center w-8 h-8 rounded-full bg-selected text-foreground font-bold'>+</div>
            <div className='text-foreground'>{t('Add new affiliation')}</div>
          </div>
          )}

      <Dialog open={!!groupToLeave} onOpenChange={(open) => !open && setGroupToLeave(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Leave Group')}</DialogTitle>
            <DialogDescription className='text-foreground/70'>
              {t('Are you sure you want to leave {{group_name}}? You will no longer have access to this group\'s content.', { group_name: groupToLeave?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className='flex gap-2 mt-4'>
            <Button variant='outline' onClick={() => setGroupToLeave(null)}>
              {t('Cancel')}
            </Button>
            <Button variant='destructive' onClick={confirmLeaveGroup}>
              {t('Leave Group')}
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
