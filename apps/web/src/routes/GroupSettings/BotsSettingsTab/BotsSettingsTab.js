/* eslint-disable multiline-ternary */
import React, { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Icon from 'components/Icon'
import Button from 'components/ui/button'
import Loading from 'components/Loading'
import SettingsSection from '../SettingsSection'
import {
  fetchGroupBots,
  inviteBotToGroup,
  removeBotFromGroup,
  updateBotPermissions,
  BOT_PERMISSIONS
} from './BotsSettingsTab.store'

import classes from './BotsSettingsTab.module.scss'

export default function BotsSettingsTab ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const [loading, setLoading] = useState(true)
  const [groupBots, setGroupBots] = useState([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [botIdToInvite, setBotIdToInvite] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState(['read_posts'])
  const [editingBot, setEditingBot] = useState(null)

  useEffect(() => {
    loadGroupBots()
  }, [group?.id])

  const loadGroupBots = async () => {
    if (!group?.id) return
    setLoading(true)
    try {
      const result = await dispatch(fetchGroupBots(group.id))
      if (result?.payload?.data?.group?.botPermissions?.items) {
        setGroupBots(result.payload.data.group.botPermissions.items)
      }
    } catch (e) {
      console.error('Error loading group bots:', e)
    }
    setLoading(false)
  }

  const handleInviteBot = async () => {
    if (!botIdToInvite.trim() || selectedPermissions.length === 0) return

    try {
      const result = await dispatch(inviteBotToGroup(
        botIdToInvite.trim(),
        group.id,
        selectedPermissions
      ))
      if (result?.payload?.data?.inviteBotToGroup) {
        setGroupBots([...groupBots, result.payload.data.inviteBotToGroup])
        setShowInviteModal(false)
        setBotIdToInvite('')
        setSelectedPermissions(['read_posts'])
      }
    } catch (e) {
      console.error('Error inviting bot:', e)
      alert(t('Failed to invite bot. Make sure the Bot User ID is correct.'))
    }
  }

  const handleRemoveBot = async (botPermission) => {
    if (!window.confirm(t('Are you sure you want to remove this bot from the group?'))) {
      return
    }

    try {
      await dispatch(removeBotFromGroup(botPermission.id))
      setGroupBots(groupBots.filter(b => b.id !== botPermission.id))
    } catch (e) {
      console.error('Error removing bot:', e)
      alert(t('Failed to remove bot.'))
    }
  }

  const handleUpdatePermissions = async (botPermission) => {
    try {
      const result = await dispatch(updateBotPermissions(
        botPermission.id,
        selectedPermissions
      ))
      if (result?.payload?.data?.updateBotPermissions) {
        setGroupBots(groupBots.map(b =>
          b.id === botPermission.id
            ? { ...b, permissions: selectedPermissions }
            : b
        ))
        setEditingBot(null)
      }
    } catch (e) {
      console.error('Error updating bot permissions:', e)
      alert(t('Failed to update permissions.'))
    }
  }

  const togglePermission = (permission) => {
    if (selectedPermissions.includes(permission)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== permission))
    } else {
      setSelectedPermissions([...selectedPermissions, permission])
    }
  }

  const startEditingBot = (botPermission) => {
    setSelectedPermissions(botPermission.permissions || [])
    setEditingBot(botPermission)
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className={classes.container}>
      <SettingsSection>
        <div className={classes.header}>
          <div>
            <h2>{t('Bots & Integrations')}</h2>
            <p className={classes.description}>
              {t('Manage bots that can interact with this group. Bots can read posts, create content, and perform automated actions based on the permissions you grant them.')}
            </p>
          </div>
          <Button
            onClick={() => setShowInviteModal(true)}
            variant='primary'
          >
            <Icon name='Plus' /> {t('Invite Bot')}
          </Button>
        </div>

        {groupBots.length === 0 ? (
          <div className={classes.emptyState}>
            <Icon name='Robot' className={classes.emptyIcon} />
            <h3>{t('No bots in this group')}</h3>
            <p>{t('Invite a bot to automate tasks and integrate with external services.')}</p>
          </div>
        ) : (
          <div className={classes.botList}>
            {groupBots.filter(b => b.isActive !== false).map(botPermission => (
              <div key={botPermission.id} className={classes.botCard}>
                <div className={classes.botHeader}>
                  <div className={classes.botInfo}>
                    {botPermission.bot?.avatarUrl ? (
                      <img
                        src={botPermission.bot.avatarUrl}
                        alt={botPermission.bot.name}
                        className={classes.botAvatar}
                      />
                    ) : (
                      <div className={classes.botAvatarPlaceholder}>
                        <Icon name='Robot' />
                      </div>
                    )}
                    <div>
                      <h4 className={classes.botName}>{botPermission.bot?.name || 'Unknown Bot'}</h4>
                      <span className={classes.botId}>ID: {botPermission.botUserId}</span>
                    </div>
                  </div>
                  <div className={classes.botActions}>
                    <Button
                      onClick={() => startEditingBot(botPermission)}
                      variant='secondary'
                      small
                    >
                      {t('Edit Permissions')}
                    </Button>
                    <Button
                      onClick={() => handleRemoveBot(botPermission)}
                      variant='danger'
                      small
                    >
                      {t('Remove')}
                    </Button>
                  </div>
                </div>

                {editingBot?.id === botPermission.id ? (
                  <div className={classes.permissionsEditor}>
                    <h5>{t('Edit Permissions')}</h5>
                    <div className={classes.permissionsList}>
                      {BOT_PERMISSIONS.map(perm => (
                        <label key={perm.key} className={classes.permissionItem}>
                          <input
                            type='checkbox'
                            checked={selectedPermissions.includes(perm.key)}
                            onChange={() => togglePermission(perm.key)}
                          />
                          <div>
                            <span className={classes.permissionLabel}>{t(perm.label)}</span>
                            <span className={classes.permissionDesc}>{t(perm.description)}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className={classes.editorActions}>
                      <Button
                        onClick={() => setEditingBot(null)}
                        variant='secondary'
                        small
                      >
                        {t('Cancel')}
                      </Button>
                      <Button
                        onClick={() => handleUpdatePermissions(botPermission)}
                        variant='primary'
                        small
                      >
                        {t('Save Changes')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className={classes.currentPermissions}>
                    <span className={classes.permissionsLabel}>{t('Permissions')}:</span>
                    <div className={classes.permissionTags}>
                      {(botPermission.permissions || []).map(perm => (
                        <span key={perm} className={classes.permissionTag}>
                          {BOT_PERMISSIONS.find(p => p.key === perm)?.label || perm}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {botPermission.invitedBy && (
                  <div className={classes.invitedBy}>
                    {t('Invited by')} {botPermission.invitedBy.name}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      {/* Invite Bot Modal */}
      {showInviteModal && (
        <div className={classes.modal}>
          <div className={classes.modalContent}>
            <h3>{t('Invite Bot to Group')}</h3>
            <p className={classes.modalDescription}>
              {t('Enter the Bot User ID to invite it to this group. You can find the Bot User ID in the Developer Settings.')}
            </p>

            <div className={classes.formGroup}>
              <label>{t('Bot User ID')}</label>
              <input
                type='text'
                value={botIdToInvite}
                onChange={(e) => setBotIdToInvite(e.target.value)}
                placeholder={t('e.g., 6007')}
                className={classes.input}
              />
            </div>

            <div className={classes.formGroup}>
              <label>{t('Permissions')}</label>
              <p className={classes.permissionsHelp}>
                {t('Select what the bot can do in this group:')}
              </p>
              <div className={classes.permissionsList}>
                {BOT_PERMISSIONS.map(perm => (
                  <label key={perm.key} className={classes.permissionItem}>
                    <input
                      type='checkbox'
                      checked={selectedPermissions.includes(perm.key)}
                      onChange={() => togglePermission(perm.key)}
                    />
                    <div>
                      <span className={classes.permissionLabel}>{t(perm.label)}</span>
                      <span className={classes.permissionDesc}>{t(perm.description)}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className={classes.modalActions}>
              <Button onClick={() => setShowInviteModal(false)} variant='secondary'>
                {t('Cancel')}
              </Button>
              <Button
                onClick={handleInviteBot}
                variant='primary'
                disabled={!botIdToInvite.trim() || selectedPermissions.length === 0}
              >
                {t('Invite Bot')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
