import cx from 'classnames'
import { set, startCase, trim } from 'lodash'
import React, { useState, useEffect } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import Button from 'components/Button'
import GroupsSelector from 'components/GroupsSelector'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import SwitchStyled from 'components/SwitchStyled'
import {
  accessibilityDescription,
  accessibilityIcon,
  accessibilityString,
  GROUP_ACCESSIBILITY,
  GROUP_VISIBILITY,
  visibilityDescription,
  visibilityIcon,
  visibilityString
} from 'store/models/Group'
import SettingsSection from '../SettingsSection'

import general from '../GroupSettings.module.scss'
import styles from './PrivacySettingsTab.module.scss'

const { object } = PropTypes

function PrivacySettingsTab ({ group, fetchPending, parentGroups, updateGroupSettings }) {
  const { t } = useTranslation()

  const [state, setState] = useState(defaultEditState())

  useEffect(() => {
    if (!fetchPending) {
      setState(defaultEditState())
    }
  }, [fetchPending])

  function defaultEditState () {
    if (!group) return { edits: {}, changed: false }

    const {
      accessibility, groupToGroupJoinQuestions, joinQuestions, prerequisiteGroups, settings, visibility
    } = group

    return {
      edits: {
        accessibility: typeof accessibility !== 'undefined' ? accessibility : GROUP_ACCESSIBILITY.Restricted,
        groupToGroupJoinQuestions: groupToGroupJoinQuestions ? groupToGroupJoinQuestions.concat({ text: '' }) : [{ text: '' }],
        joinQuestions: joinQuestions ? joinQuestions.concat({ text: '' }) : [{ text: '' }],
        prerequisiteGroups: prerequisiteGroups || [],
        settings: typeof settings !== 'undefined' ? settings : {},
        visibility: typeof visibility !== 'undefined' ? visibility : GROUP_VISIBILITY.Protected
      },
      changed: false
    }
  }

  const updateSetting = (key, setChanged = true) => event => {
    const { edits, changed } = state

    if (key === 'accessibility' || key === 'visibility') {
      edits[key] = parseInt(event.target.value)
    } else {
      set(edits, key, event.target.value)
    }

    setState({
      changed: setChanged ? true : changed,
      edits: { ...edits }
    })
  }

  const updateSettingDirectly = (key, changed) => value =>
    updateSetting(key, changed)({ target: { value } })

  const save = async () => {
    setState({ ...state, changed: false })
    updateGroupSettings({ ...state.edits })
  }

  if (!group) return <Loading />

  const { edits, changed } = state
  const {
    accessibility,
    groupToGroupJoinQuestions,
    joinQuestions,
    prerequisiteGroups,
    settings,
    visibility
  } = edits
  const { askJoinQuestions, askGroupToGroupJoinQuestions, hideExtensionData } = settings
  const { name, slug, type } = group

  return (
    <div className={general.groupSettings}>
      <SettingsSection>
        <h3>{t('Visibility')}</h3>
        <p className={general.detailText}>{t('Who is able to see')} <strong>{name}</strong>?</p>
        {Object.values(GROUP_VISIBILITY).map(visibilitySetting =>
          <VisibilitySettingRow
            key={visibilitySetting}
            forSetting={visibilitySetting}
            currentSetting={visibility}
            updateSetting={updateSetting}
            t={t}
          />
        )}
      </SettingsSection>

      <SettingsSection>
        <h3>{t('Access')}</h3>
        <p className={general.detailText}>{t('How can people become members of')} <strong>{name}</strong></p>
        {Object.values(GROUP_ACCESSIBILITY).map(accessSetting =>
          <AccessibilitySettingRow
            key={accessSetting}
            forSetting={accessSetting}
            currentSetting={accessibility}
            askJoinQuestions={askJoinQuestions}
            joinQuestions={joinQuestions}
            updateSetting={updateSetting}
            updateSettingDirectly={updateSettingDirectly}
          />
        )}
      </SettingsSection>

      <SettingsSection>
        <h3>{t('Join Questions')}</h3>
        <div className={cx(styles.groupQuestions, { [styles.on]: settings?.askJoinQuestions })}>
          <div className={cx(general.switchContainer, { [general.on]: askJoinQuestions })}>
            <SwitchStyled
              checked={askJoinQuestions}
              onChange={() => updateSettingDirectly('settings.askJoinQuestions')(!askJoinQuestions)}
              backgroundColor={askJoinQuestions ? '#0DC39F' : '#8B96A4'}
            />
            <span className={general.toggleDescription}>{t('Require people to answer questions when requesting to join this group')}</span>
            <div className={general.onOff}>
              <div className={general.off}>{t('OFF')}</div>
              <div className={general.on}>{t('ON')}</div>
            </div>
          </div>
          <QuestionsForm questions={joinQuestions} save={updateSettingDirectly('joinQuestions', true)} disabled={!askJoinQuestions} />
        </div>
      </SettingsSection>

      <SettingsSection>
        <h3>{t('Prerequisite Groups')}</h3>
        <p className={general.detailText}>{t('When you select a prerequisite group, people must join the selected groups before joining')} <strong>{name}</strong>. {t('Only parent groups can be added as prerequisite groups.')}</p>
        <p className={styles.prerequisiteWarning}>
          <strong className={styles.warning}>{t('Warning:')}</strong> {t('If you select a prerequisite group that has a visibility setting of')}
          <strong><Icon name='Hidden' className={styles.prerequisiteIcon} /> {t('Hidden')}</strong> {t('or')}
          <strong><Icon name='Shield' className={styles.prerequisiteIcon} /> {t('Protected')}</strong>,
          {t('only members of those groups will be able to join this group. Because of these settings, people who find your group will not be able to see the prerequisite group.')}
        </p>
        <GroupsSelector
          options={parentGroups}
          selected={prerequisiteGroups}
          onChange={updateSettingDirectly('prerequisiteGroups')}
          groupSettings
        />
      </SettingsSection>

      <SettingsSection>
        <h3>{t('Group Access Questions')}</h3>
        <p className={general.detailText}>{t('What questions are asked when a group requests to join this group?')}</p>

        <div className={cx(styles.groupQuestions, { [styles.on]: askGroupToGroupJoinQuestions })}>
          <div className={cx(general.switchContainer, { [general.on]: askGroupToGroupJoinQuestions })}>
            <SwitchStyled
              checked={askGroupToGroupJoinQuestions}
              onChange={() => updateSettingDirectly('settings.askGroupToGroupJoinQuestions')(!askGroupToGroupJoinQuestions)}
              backgroundColor={askGroupToGroupJoinQuestions ? '#0DC39F' : '#8B96A4'}
            />
            <span className={general.toggleDescription}>{t('Require groups to answer questions when requesting to join this group')}</span>
            <div className={general.onOff}>
              <div className={general.off}>{t('OFF')}</div>
              <div className={general.on}>{t('ON')}</div>
            </div>
          </div>
          <QuestionsForm questions={groupToGroupJoinQuestions} save={updateSettingDirectly('groupToGroupJoinQuestions')} disabled={!askGroupToGroupJoinQuestions} />
        </div>
      </SettingsSection>

      {type
        ? (
          <SettingsSection>
            <h3>{t('Hide {{postType}} Data', { postType: startCase(type) })}</h3>
            <p className={styles.dataDetail}>{t('If you don\'t want to display the detailed {{postType}} specific data on your group\'s profile', { postType: type })}</p>
            <div className={cx(general.switchContainer, { [general.on]: hideExtensionData })}>
              <SwitchStyled
                checked={hideExtensionData}
                onChange={() => updateSettingDirectly('settings.hideExtensionData')(hideExtensionData === undefined || hideExtensionData === null || !hideExtensionData)}
                backgroundColor={hideExtensionData ? '#0DC39F' : '#8B96A4'}
              />
              <span className={general.toggleDescription}>{t('Hide {{postType}} data for this group', { postType: type })}</span>
              <div className={general.onOff}>
                <div className={general.off}>{t('OFF')}</div>
                <div className={general.on}>{t('ON')}</div>
              </div>
            </div>
          </SettingsSection>
          )
        : ''}

      <SettingsSection>
        <h3>{t('Publish Murmurations Profile')}</h3>
        <p className={styles.dataDetail}>
          <Trans i18nKey='murmurationsHeader'>
            Add your group to the <a href='https://murmurations.network' target='_blank' rel='noopener noreferrer'>Murmurations</a> directory so it can be found and easily added to third-party public maps. You must first set visibility to Public.
          </Trans>
        </p>
        <div className={cx(general.switchContainer, { [general.on]: visibility === GROUP_VISIBILITY.Public && settings.publishMurmurationsProfile })}>
          <SwitchStyled
            checked={visibility === GROUP_VISIBILITY.Public && settings.publishMurmurationsProfile}
            onChange={() => updateSettingDirectly('settings.publishMurmurationsProfile')(!settings.publishMurmurationsProfile)}
            backgroundColor={visibility === GROUP_VISIBILITY.Public && settings.publishMurmurationsProfile ? '#0DC39F' : '#8B96A4'}
            disabled={visibility !== GROUP_VISIBILITY.Public}
          />
          <span className={general.toggleDescription}>{t('Publish to Murmurations')}</span>
          <div className={general.onOff}>
            <div className={general.off}>{t('OFF')}</div>
            <div className={general.on}>{t('ON')}</div>
          </div>
        </div>
        {visibility === GROUP_VISIBILITY.Public && settings.publishMurmurationsProfile && (
          <p className={styles.dataDetail}>
            <Trans i18nKey='murmurationsDescription'>
              Your group is now published to the Murmurations directory. You can find your profile <a href={`/noo/group/${slug}/murmurations`} target='_blank' rel='noopener noreferrer'>here</a>.
            </Trans>
          </p>
        )}
      </SettingsSection>

      <div className={general.saveChanges}>
        <span className={cx({ [general.settingChanged]: changed })}>{changed ? t('Changes not saved') : t('Current settings up to date')}</span>
        <Button label={t('Save Changes')} color={changed ? 'green' : 'gray'} onClick={changed ? save : null} className={general.saveButton} />
      </div>
    </div>
  )
}

PrivacySettingsTab.propTypes = {
  group: object,
  fetchPending: object,
  parentGroups: PropTypes.array,
  updateGroupSettings: PropTypes.func
}

function VisibilitySettingRow ({ currentSetting, forSetting, updateSetting, t }) {
  return (
    <div className={cx(styles.privacySetting, { [styles.on]: currentSetting === forSetting })}>
      <label>
        <input type='radio' name='Visibility' value={forSetting} onChange={updateSetting('visibility')} checked={currentSetting === forSetting} />
        <Icon name={visibilityIcon(forSetting)} className={styles.settingIcon} />
        <div className={styles.settingDescription}>
          <h4>{t(visibilityString(forSetting))}</h4>
          <span className={cx(styles.privacyOption, { [styles.disabled]: currentSetting !== forSetting })}>{t(visibilityDescription(forSetting))}</span>
        </div>
      </label>
    </div>
  )
}

function AccessibilitySettingRow ({ currentSetting, forSetting, updateSetting }) {
  const { t } = useTranslation()
  return (
    <div className={cx(styles.privacySetting, { [styles.on]: currentSetting === forSetting })}>
      <label>
        <input type='radio' name='accessibility' value={forSetting} onChange={updateSetting('accessibility')} checked={currentSetting === forSetting} />
        <Icon name={accessibilityIcon(forSetting)} className={styles.settingIcon} />
        <div className={styles.settingDescription}>
          <h4>{t(accessibilityString(forSetting))}</h4>
          <span className={cx(styles.privacyOption, { [styles.disabled]: currentSetting !== forSetting })}>{t(accessibilityDescription(forSetting))}</span>
        </div>
      </label>
    </div>
  )
}

function QuestionsForm ({ disabled, questions, save }) {
  const { t } = useTranslation()
  const updateJoinQuestion = (index) => event => {
    const value = event.target.value
    const newQuestions = questions
    if (trim(value) === '') {
      newQuestions.splice(index, 1)
    } else if (newQuestions[index].text !== value) {
      newQuestions[index] = { text: value }
    }
    if (newQuestions[newQuestions.length - 1].text !== '') {
      newQuestions.push({ text: '' })
    }
    save(newQuestions)
  }

  const clearField = (index) => event => {
    event.target.value = ''
    updateJoinQuestion(index)(event)
  }

  return (
    <div className={styles.questionList}>
      {questions.map((q, i) => (
        <div key={i} className={styles.question}>
          {q.text ? <div className={styles.deleteInput}><Icon name='CircleEx' className={styles.close} onClick={clearField(i)} /></div> : <span className={styles.createInput}>+</span>}
          <input name='questions[]' disabled={disabled} value={q.text} placeholder={t('Add a new question')} onChange={updateJoinQuestion(i)} />
        </div>
      ))}
    </div>
  )
}

export default PrivacySettingsTab
