import PropTypes from 'prop-types'
import React, { Component, useState } from 'react'
import { withTranslation, useTranslation } from 'react-i18next'
import get from 'lodash/get'
import { WebViewMessageTypes } from '@hylo/shared'
import isWebView, { sendMessageToWebView } from 'util/webView'
import {
  CREATE_AFFILIATION,
  DELETE_AFFILIATION,
  LEAVE_GROUP
} from 'store/constants'
import Affiliation from 'components/Affiliation'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import Membership from 'components/Membership'
import classes from './UserGroupsTab.module.scss'
import { cn } from 'util/index'

const { array, func, object, string } = PropTypes

class UserGroupsTab extends Component {
  static propTypes = {
    action: string,
    affiliations: object,
    memberships: array,
    leaveGroup: func,
    createAffiliation: func,
    deleteAffiliation: func
  }

  state = {
    affiliations: this.props.affiliations,
    memberships: this.props.memberships,
    errorMessage: undefined,
    successMessage: undefined,
    showAddAffiliations: undefined
  }

  render () {
    const { action, t, affiliations } = this.props
    const { memberships, errorMessage, successMessage, showAddAffiliations } = this.state
    const displayMessage = errorMessage || successMessage
    if (!memberships || !affiliations) return <Loading />

    return (
      <div className={classes.container}>
        <h1 className={classes.title}>{t('Your affiliations with organizations')}</h1>

        <div className={classes.description}>{t('This list automatically shows which groups on Hylo you are a part of. You can also share your affiliations with organizations that are not currently on Hylo.')}</div>

        <h2 className={classes.subhead}>{t('Hylo Groups')}</h2>
        {action === LEAVE_GROUP && displayMessage && <Message errorMessage={errorMessage} successMessage={successMessage} reset={this.resetMessage} />}
        {memberships.map((m, index) =>
          <Membership
            membership={m}
            archive={this.leaveGroup}
            key={m.id}
            index={index}
            rowStyle
          />)}

        <h2 className={classes.subhead}>{t('Other Affiliations')}</h2>
        {action === DELETE_AFFILIATION && displayMessage && <Message errorMessage={errorMessage} successMessage={successMessage} reset={this.resetMessage} />}
        {affiliations && affiliations.items.length > 0 && affiliations.items.map((a, index) =>
          <Affiliation
            affiliation={a}
            archive={this.deleteAffiliation}
            key={a.id}
            index={index}
          />
        )}

        {action === CREATE_AFFILIATION && displayMessage && <Message errorMessage={errorMessage} successMessage={successMessage} reset={this.resetMessage} />}

        {showAddAffiliations
          ? <AddAffiliation close={this.toggleAddAffiliations} save={this.saveAffiliation} />
          : (
            <div className={classes.addAffiliation} onClick={this.toggleAddAffiliations}>
              <div className={classes.plus}>+</div>
              <div>{t('Add new affiliation')}</div>
            </div>
            )}
      </div>
    )
  }

  deleteAffiliation = (affiliationId) => {
    const { deleteAffiliation } = this.props
    const { affiliations } = this.state

    deleteAffiliation(affiliationId)
      .then(res => {
        let errorMessage, successMessage
        if (res.error) errorMessage = 'Error deleting this affiliation.'
        const deletedAffiliationId = get(res, 'payload.data.deleteAffiliation')
        if (deletedAffiliationId) {
          successMessage = 'Your affiliation was deleted.'
          affiliations.items = affiliations.items.filter((a) => a.id !== deletedAffiliationId)
        }
        return this.setState({ affiliations, errorMessage, successMessage })
      })
  }

  leaveGroup = (group) => {
    const { leaveGroup } = this.props
    const { memberships } = this.state

    leaveGroup(group.id)
      .then(res => {
        let errorMessage, successMessage
        if (res.error) errorMessage = `Error leaving ${group.name || 'this group'}.`
        const deletedGroupId = get(res, 'payload.data.leaveGroup')
        if (deletedGroupId) {
          successMessage = `You left ${group.name || 'this group'}.`
          const newMemberships = memberships.filter((m) => m.group.id !== deletedGroupId)
          this.setState({ memberships: newMemberships, errorMessage, successMessage })
        }

        if (isWebView()) {
          // Could be handled better using WebSockets
          sendMessageToWebView(WebViewMessageTypes.LEFT_GROUP, { groupId: deletedGroupId })
        }
      })
  }

  saveAffiliation = ({ role, preposition, orgName, url }) => {
    const { affiliations } = this.state
    this.props.createAffiliation({ role, preposition, orgName, url })
      .then(res => {
        let successMessage
        const affiliation = get(res, 'payload.data.createAffiliation')
        if (affiliation) {
          successMessage = 'Your affiliation was added'
          affiliations.items.push(affiliation)
        }
        return this.setState({ affiliations, successMessage, errorMessage: '', showAddAffiliations: false })
      }).catch((e) => this.setState({ errorMessage: e.message, showAddAffiliations: true }))
  }

  resetMessage = () => {
    this.setState({ action: undefined, errorMessage: undefined, successMessage: undefined })
  }

  toggleAddAffiliations = () => {
    this.setState({ showAddAffiliations: !this.state.showAddAffiliations })
  }
}

export function AddAffiliation ({ close, save }) {
  const { t } = useTranslation()
  const PREPOSITIONS = ['of', 'at', 'for']
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
export default withTranslation()(UserGroupsTab)
