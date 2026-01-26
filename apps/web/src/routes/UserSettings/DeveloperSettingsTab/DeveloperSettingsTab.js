import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import Icon from 'components/Icon'
import Button from 'components/ui/button'
import Loading from 'components/Loading'
import { Switch } from 'components/ui/switch'
import SettingsSection from '../../GroupSettings/SettingsSection/SettingsSection'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import getMe from 'store/selectors/getMe'
import {
  updateDeveloperMode,
  createApplication,
  deleteApplication,
  regenerateClientSecret,
  fetchApplications
} from './DeveloperSettingsTab.store'

import classes from './DeveloperSettingsTab.module.scss'

function DeveloperSettingsTab () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)

  const [developerModeEnabled, setDeveloperModeEnabled] = useState(false)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newAppName, setNewAppName] = useState('')
  const [newAppDescription, setNewAppDescription] = useState('')
  const [newClientSecret, setNewClientSecret] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const { setHeaderDetails } = useViewHeader()

  useEffect(() => {
    setHeaderDetails({
      title: t('Developer Settings'),
      icon: 'Code',
      info: '',
      search: false
    })
  }, [])

  useEffect(() => {
    if (currentUser) {
      setDeveloperModeEnabled(currentUser.settings?.developerModeEnabled || false)
      loadApplications()
    }
  }, [currentUser])

  const loadApplications = async () => {
    setLoading(true)
    try {
      const result = await dispatch(fetchApplications())
      if (result?.payload?.data?.me?.applications) {
        setApplications(result.payload.data.me.applications)
      }
    } catch (e) {
      console.error('Error loading applications:', e)
    }
    setLoading(false)
  }

  const handleToggleDeveloperMode = async () => {
    const newValue = !developerModeEnabled
    setDeveloperModeEnabled(newValue)
    try {
      await dispatch(updateDeveloperMode(newValue))
    } catch (e) {
      // Revert on error
      setDeveloperModeEnabled(!newValue)
      console.error('Error updating developer mode:', e)
    }
  }

  const handleCreateApplication = async () => {
    if (!newAppName.trim()) return

    try {
      const result = await dispatch(createApplication({
        name: newAppName.trim(),
        description: newAppDescription.trim() || null
      }))

      if (result?.payload?.data?.createApplication) {
        const { application, clientSecret } = result.payload.data.createApplication
        setNewClientSecret(clientSecret)
        setApplications([...applications, application])
        setNewAppName('')
        setNewAppDescription('')
      }
    } catch (e) {
      console.error('Error creating application:', e)
    }
  }

  const handleDeleteApplication = async (appId) => {
    if (!window.confirm(t('Are you sure you want to delete this application? This cannot be undone.'))) {
      return
    }

    try {
      await dispatch(deleteApplication(appId))
      setApplications(applications.filter(a => a.id !== appId))
    } catch (e) {
      console.error('Error deleting application:', e)
    }
  }

  const handleRegenerateSecret = async (appId) => {
    if (!window.confirm(t('Are you sure? The old secret will stop working immediately.'))) {
      return
    }

    try {
      const result = await dispatch(regenerateClientSecret(appId))
      if (result?.payload?.data?.regenerateClientSecret) {
        setNewClientSecret(result.payload.data.regenerateClientSecret)
      }
    } catch (e) {
      console.error('Error regenerating secret:', e)
    }
  }

  const handleCopy = (id) => {
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className={classes.container}>
      <SettingsSection>
        <h3>{t('Developer Mode')}</h3>
        <p className={classes.description}>
          {t('Enable developer mode to create OAuth applications and bots that integrate with Hylo.')}
        </p>
        <div className={classes.toggleRow}>
          <Switch
            checked={developerModeEnabled}
            onCheckedChange={handleToggleDeveloperMode}
          />
          <span className={classes.toggleLabel}>
            {developerModeEnabled ? t('Enabled') : t('Disabled')}
          </span>
        </div>
      </SettingsSection>

      {developerModeEnabled && (
        <>
          <SettingsSection>
            <div className={classes.sectionHeader}>
              <h3>{t('My Applications')}</h3>
              <Button
                onClick={() => setShowCreateModal(true)}
                variant='primary'
                small
              >
                <Icon name='Plus' /> {t('Create Application')}
              </Button>
            </div>

            {applications.length === 0 ? (
              <p className={classes.emptyState}>
                {t('You haven\'t created any applications yet.')}
              </p>
            ) : (
              <div className={classes.applicationList}>
                {applications.map(app => (
                  <div key={app.id} className={classes.applicationCard}>
                    <div className={classes.appInfo}>
                      <h4>{app.name}</h4>
                      {app.description && (
                        <p className={classes.appDescription}>{app.description}</p>
                      )}
                      <div className={classes.clientId}>
                        <span className={classes.label}>{t('Client ID')}:</span>
                        <code>{app.clientId}</code>
                        <CopyToClipboard text={app.clientId} onCopy={() => handleCopy(app.id)}>
                          <button className={classes.copyButton}>
                            <Icon name={copiedId === app.id ? 'Checkmark' : 'Copy'} />
                          </button>
                        </CopyToClipboard>
                      </div>
                      <div className={classes.scopes}>
                        <span className={classes.label}>{t('Scopes')}:</span>
                        {app.scopes?.join(', ') || 'openid, profile'}
                      </div>
                      {app.hasBot && (
                        <div className={classes.botBadge}>
                          <Icon name='Robot' /> {t('Bot enabled')}
                        </div>
                      )}
                    </div>
                    <div className={classes.appActions}>
                      <Button
                        onClick={() => handleRegenerateSecret(app.id)}
                        variant='secondary'
                        small
                      >
                        {t('Regenerate Secret')}
                      </Button>
                      <Button
                        onClick={() => handleDeleteApplication(app.id)}
                        variant='danger'
                        small
                      >
                        {t('Delete')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>

          {/* Create Application Modal */}
          {showCreateModal && (
            <div className={classes.modal}>
              <div className={classes.modalContent}>
                <h3>{t('Create New Application')}</h3>
                <div className={classes.formGroup}>
                  <label>{t('Application Name')}</label>
                  <input
                    type='text'
                    value={newAppName}
                    onChange={(e) => setNewAppName(e.target.value)}
                    placeholder={t('My Awesome App')}
                  />
                </div>
                <div className={classes.formGroup}>
                  <label>{t('Description')} ({t('optional')})</label>
                  <textarea
                    value={newAppDescription}
                    onChange={(e) => setNewAppDescription(e.target.value)}
                    placeholder={t('What does your application do?')}
                  />
                </div>
                <div className={classes.modalActions}>
                  <Button onClick={() => setShowCreateModal(false)} variant='secondary'>
                    {t('Cancel')}
                  </Button>
                  <Button onClick={handleCreateApplication} variant='primary'>
                    {t('Create')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Client Secret Display Modal */}
          {newClientSecret && (
            <div className={classes.modal}>
              <div className={classes.modalContent}>
                <h3>{t('Client Secret')}</h3>
                <div className={classes.secretWarning}>
                  <Icon name='AlertTriangle' />
                  <p>{t('This secret will only be shown once. Copy it now and store it securely.')}</p>
                </div>
                <div className={classes.secretDisplay}>
                  <code>{newClientSecret}</code>
                  <CopyToClipboard text={newClientSecret} onCopy={() => handleCopy('secret')}>
                    <Button variant='secondary' small>
                      <Icon name={copiedId === 'secret' ? 'Checkmark' : 'Copy'} />
                      {copiedId === 'secret' ? t('Copied!') : t('Copy')}
                    </Button>
                  </CopyToClipboard>
                </div>
                <div className={classes.modalActions}>
                  <Button onClick={() => setNewClientSecret(null)} variant='primary'>
                    {t('I\'ve copied the secret')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <SettingsSection>
            <h3>{t('API Documentation')}</h3>
            <p className={classes.description}>
              {t('Learn how to integrate with Hylo\'s GraphQL API.')}
            </p>
            <div className={classes.docLinks}>
              <a href='/noo/graphql' target='_blank' rel='noopener noreferrer'>
                <Icon name='Code' /> {t('GraphQL Playground')}
              </a>
            </div>
          </SettingsSection>
        </>
      )}
    </div>
  )
}

export default DeveloperSettingsTab
