import get from 'lodash/get'
import React, { useCallback, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { useDispatch, useSelector } from 'react-redux'
import { WebViewMessageTypes } from '@hylo/shared'
import Affiliation from 'components/Affiliation'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import Membership from 'components/Membership'
import { useViewHeader } from 'contexts/ViewHeaderContext'
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

import classes from './UserGroupsTab.module.scss'

export const getCurrentUserAffiliations = ormCreateSelector(
  orm,
  session => {
    const me = session.Me.first()
    // TODO post-redesign: this was being weird; affiliations aren't on the User Model
    if (!me) return {}
    console.log('me', me, me.affiliations)
    return me?.affiliations?.items
  }
)

function UserGroupsTab () {
  const { t } = useTranslation()
  const dispatch = useDispatch()

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

  const leaveGroupHandler = useCallback((group) => {
    dispatch(leaveGroup(group.id))
      .then(res => {
        if (res.error) {
          setErrorMessage(t('Error leaving {{group_name}}', { group_name: group.name || 'this group' }))
          return
        }

        const deletedGroupId = get(res, 'payload.data.leaveGroup')
        if (deletedGroupId) {
          setSuccessMessage(t('You left {{group_name}}', { group_name: group.name || 'this group' }))
          const newMemberships = memberships.filter((m) => m.group.id !== deletedGroupId)
          setMemberships(newMemberships)
        }

        if (isWebView()) {
          // Could be handled better using WebSockets
          sendMessageToWebView(WebViewMessageTypes.LEFT_GROUP, { groupId: deletedGroupId })
        }
      })
  }, [memberships])

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
    <div className={classes.container}>
      <div className={classes.description}>{t('This list shows which groups on Hylo you are a part of. You can also share your affiliations with organizations that are not currently on Hylo, which will appear on your profile.')}</div>

      <h2 className={classes.subhead}>{t('Hylo Groups')}</h2>
      {action === LEAVE_GROUP && displayMessage && <Message errorMessage={errorMessage} successMessage={successMessage} reset={resetMessage} />}
      {memberships.map((m, index) =>
        <Membership
          membership={m}
          archive={leaveGroupHandler}
          key={m.id}
          index={index}
          rowStyle
        />)}

      <h2 className={classes.subhead}>{t('Other Affiliations')}</h2>
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
          <div className={classes.addAffiliation} onClick={toggleAddAffiliations}>
            <div className={classes.plus}>+</div>
            <div>{t('Add new affiliation')}</div>
          </div>
          )}
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
    <div className={classes.affiliationForm}>
      <div className={classes.header}>
        <h3>{t('Add new affiliation')}</h3>
        <div className={classes.close} onClick={close}>x</div>
      </div>

      <div className={classes.body}>

        <div>
          <input
            type='text'
            onChange={e => setRole(e.target.value.substring(0, CHAR_LIMIT))}
            placeholder={t('Name of role')}
            value={role}
          />
          <div className={classes.chars}>{role.length}/{CHAR_LIMIT}</div>
        </div>

        <Dropdown
          toggleChildren={
            <span>
              {t(PREPOSITIONS.find(p => p === preposition))}
              <Icon name='ArrowDown' />
            </span>
          }
          items={PREPOSITIONS.map(p => ({
            label: t(p),
            onClick: () => setPreposition(p)
          }))}
          alignLeft
          className={classes.dropdown}
        />

        <div>
          <input
            type='text'
            onChange={e => setOrgName(e.target.value.substring(0, CHAR_LIMIT))}
            placeholder={t('Name of organization')}
            value={orgName}
          />
          <div className={classes.chars}>{orgName.length}/{CHAR_LIMIT}</div>
        </div>

        <div>
          <input
            type='text'
            onChange={e => setUrl(e.target.value.substring(URL_PROTOCOL.length))}
            placeholder={t('URL of organization')}
            value={formatUrl(url)}
          />
        </div>

        <div className={cn(classes.save, { [classes.disabled]: !canSave })}>
          <span onClick={canSave ? () => save({ role, preposition, orgName, url }) : undefined}>{t('Add Affiliation')}</span>
        </div>

      </div>
    </div>
  )
}

export function Message ({ errorMessage, successMessage, reset }) {
  return (
    <div className={cn(classes.message, { [classes.error]: errorMessage, [classes.success]: !errorMessage })} onClick={reset}>{errorMessage || successMessage}</div>
  )
}

export default UserGroupsTab
