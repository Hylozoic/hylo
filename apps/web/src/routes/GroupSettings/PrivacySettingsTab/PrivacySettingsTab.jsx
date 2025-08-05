import { cn } from 'util/index'
import { set, startCase, trim } from 'lodash'
import React, { useState, useEffect } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { EyeOff, Shield, X, Globe, Lock, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import GroupsSelector from 'components/GroupsSelector'
import Button from 'components/ui/button'
import { Switch } from 'components/ui/switch'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { groupUrl } from '@hylo/navigation'
import {
  accessibilityDescription,
  accessibilityString,
  GROUP_ACCESSIBILITY,
  GROUP_VISIBILITY,
  visibilityDescription,
  visibilityString
} from 'store/models/Group'
import SaveButton from '../SaveButton'
import SettingsSection from '../SettingsSection'

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
        settings: typeof settings !== 'undefined' ? settings : { },
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

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: {
        desktop: `${t('Group Settings')} > ${t('Privacy')}`,
        mobile: t('Privacy')
      },
      icon: 'Settings'
    })
  }, [])

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

  const visibilityIcons = {
    [GROUP_VISIBILITY.Public]: Globe,
    [GROUP_VISIBILITY.Protected]: Shield,
    [GROUP_VISIBILITY.Hidden]: EyeOff
  }

  const accessibilityIcons = {
    [GROUP_ACCESSIBILITY.Open]: Globe,
    [GROUP_ACCESSIBILITY.Restricted]: Lock,
    [GROUP_ACCESSIBILITY.Closed]: EyeOff
  }

  return (
    <div className='space-y-8'>
      <SettingsSection>
        <h3 className='text-foreground font-bold mb-2'>{t('Visibility')}</h3>
        <p className='text-foreground/70 mb-4'>{t('Who is able to see')} <strong>{name}</strong>?</p>
        <div className='flex flex-col gap-0'>
          {Object.values(GROUP_VISIBILITY).map(visibilitySetting => {
            const Icon = visibilityIcons[visibilitySetting]
            return (
              <div
                key={visibilitySetting}
                className={cn(
                  'flex items-start gap-4 p-4 rounded-lg transition-all cursor-pointer',
                  visibility === visibilitySetting ? 'bg-selected/20' : 'hover:bg-selected/5'
                )}
                onClick={() => updateSetting('visibility')({ target: { value: visibilitySetting } })}
              >
                <div className='flex items-center h-5'>
                  <input
                    type='radio'
                    name='Visibility'
                    value={visibilitySetting}
                    onChange={updateSetting('visibility')}
                    checked={visibility === visibilitySetting}
                    className='form-radio text-accent border-accent/20 relative top-0.5'
                  />
                </div>
                <div className='flex-1 flex gap-3'>
                  <Icon className='w-5 h-5 text-foreground/100 mt-0.5' />
                  <div>
                    <h4 className='text-foreground font-medium m-0'>{t(visibilityString(visibilitySetting))}</h4>
                    <p className='text-foreground/70 text-sm m-0 p-0'>{t(visibilityDescription(visibilitySetting))}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </SettingsSection>

      {visibility === GROUP_VISIBILITY.Public && !group.allowInPublic && (
        <SettingsSection>
          <h3 className='text-foreground font-bold mb-2'>{t('Add my group into the commons')}</h3>
          <p className='text-foreground/70 mb-2'>{t('commonsExplainerText1')}</p>
          <p className='text-foreground/70 mb-4'>{t('commonsExplainerText2')}</p>
          <p className='text-foreground/70'>
            {t('Apply here') + ': '}
            <a
              href='https://docs.google.com/forms/d/e/1FAIpQLScuxRGl65OMCVkjjsFllWwK4TQjddkufMu9rukIocgmhyHL7w/viewform'
              target='_blank'
              rel='noopener noreferrer'
              className='text-accent hover:underline'
            >
              {t('Allow-in-Commons form')}
            </a>
          </p>
        </SettingsSection>
      )}

      <SettingsSection>
        <h3 className='text-foreground font-bold mb-2'>{t('Access')}</h3>
        <p className='text-foreground/70 mb-4'>{t('How can people become members of')} <strong>{name}</strong></p>
        <div className='flex flex-col gap-0'>
          {Object.values(GROUP_ACCESSIBILITY).map(accessSetting => {
            const Icon = accessibilityIcons[accessSetting]
            return (
              <div
                key={accessSetting}
                className={cn(
                  'flex items-start gap-4 p-4 rounded-lg transition-all cursor-pointer',
                  accessibility === accessSetting ? 'bg-selected/20' : 'hover:bg-selected/5'
                )}
                onClick={() => updateSetting('accessibility')({ target: { value: accessSetting } })}
              >
                <div className='flex items-center h-5'>
                  <input
                    type='radio'
                    name='accessibility'
                    value={accessSetting}
                    onChange={updateSetting('accessibility')}
                    checked={accessibility === accessSetting}
                    className='form-radio text-accent border-accent/20 relative top-0.5'
                  />
                </div>
                <div className='flex-1 flex gap-3'>
                  <Icon className='w-5 h-5 text-foreground/100 mt-0.5' />
                  <div>
                    <h4 className='text-foreground font-medium m-0'>{t(accessibilityString(accessSetting))}</h4>
                    <p className='text-foreground/70 text-sm m-0 p-0'>{t(accessibilityDescription(accessSetting))}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </SettingsSection>

      <SettingsSection>
        <h3 className='text-foreground font-bold mb-2'>{t('Join Questions')}</h3>
        <div className={cn('space-y-4', { 'opacity-50': !settings?.askJoinQuestions })}>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <h4 className='text-foreground font-medium'>{t('Require people to answer questions when requesting to join this group')}</h4>
              <p className='text-foreground/70 text-sm'>{t('Ask specific questions to help you evaluate join requests')}</p>
            </div>
            <Switch
              checked={askJoinQuestions}
              onCheckedChange={() => updateSettingDirectly('settings.askJoinQuestions')(!askJoinQuestions)}
            />
          </div>
          <QuestionsForm
            questions={joinQuestions}
            save={updateSettingDirectly('joinQuestions', true)}
            disabled={!askJoinQuestions}
          />
        </div>
      </SettingsSection>

      <SettingsSection>
        <h3 className='text-foreground font-bold mb-2'>{t('Prerequisite Groups')}</h3>
        <p className='text-foreground/70 mb-4'>
          {t('When you select a prerequisite group, people must join the prerequisite group before joining this group.')} <strong>{name}</strong>.{' '}
          {t('Only parent groups can be added as prerequisite groups.')}{' '}
          <Link to={groupUrl(group.slug, 'settings/relationships')} className='text-accent hover:underline'>
            {t('Add parent groups in Related Groups settings')}
          </Link>.
        </p>
        {parentGroups?.length > 0
          ? (
            <>
              <div className='bg-accent/5 text-destructive p-4 rounded-lg mb-4'>
                <p className='text-accent/100 m-0 p-0'>
                  <strong><TriangleAlert className='w-4 h-4 inline' /> {t('Warning:')} </strong>
                  <span>{t('If you select a prerequisite group that has a visibility setting of')}</span>
                  <span className='inline-flex mx-1.5 relative top-[3px] items-center gap-1 font-bold'><EyeOff className='w-4 h-4' /> {t('Hidden')}</span>
                  <span>{t('or')}</span>
                  <span className='inline-flex mx-1.5 relative top-[3px] items-center gap-1 font-bold'><Shield className='w-4 h-4' /> {t('Protected')}</span>
                  <span>{t('only members of those groups will be able to join this group. Because of these settings, people who find your group will not be able to see the prerequisite group.')}</span>
                </p>
              </div>
              <GroupsSelector
                options={parentGroups}
                selected={prerequisiteGroups}
                onChange={updateSettingDirectly('prerequisiteGroups')}
                groupSettings
              />
            </>)
          : (
            <div className='bg-muted p-8 rounded-lg text-center'>
              <p className='text-foreground/70 mb-2'>{t('{{group.name}} is not a member any groups', { group })}</p>
              <p className='text-sm text-foreground/50'>
                {t('A parent group is necessary to add as a prerequisite group. You may add parent groups if you are a Host of the group you wish to add, or if the group you wish to add has the Open access setting which allows any group to join it')}{' '}
                <Link to={groupUrl(group.slug, 'settings/relationships')} className='text-accent hover:underline'>
                  {t('Related Groups settings')}
                </Link>
              </p>
            </div>)}
      </SettingsSection>

      <SettingsSection>
        <h3 className='text-foreground font-bold mb-2'>{t('Group Access Questions')}</h3>
        <div className={cn('space-y-4', { 'opacity-50': !askGroupToGroupJoinQuestions })}>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <h4 className='text-foreground font-medium'>{t('Require groups to answer questions when requesting to join this group')}</h4>
              <p className='text-foreground/70 text-sm'>{t('What questions are asked when a group requests to join this group?')}</p>
            </div>
            <Switch
              checked={askGroupToGroupJoinQuestions}
              onCheckedChange={() => updateSettingDirectly('settings.askGroupToGroupJoinQuestions')(!askGroupToGroupJoinQuestions)}
            />
          </div>
          <QuestionsForm
            questions={groupToGroupJoinQuestions}
            save={updateSettingDirectly('groupToGroupJoinQuestions')}
            disabled={!askGroupToGroupJoinQuestions}
          />
        </div>
      </SettingsSection>

      {type && (
        <SettingsSection>
          <h3 className='text-foreground font-bold mb-2'>{t('Hide {{postType}} Data', { postType: startCase(type) })}</h3>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div className='space-y-1'>
                <h4 className='text-foreground font-medium'>{t('Hide {{postType}} data for this group', { postType: type })}</h4>
                <p className='text-foreground/70 text-sm'>{t('If you don\'t want to display the detailed {{postType}} specific data on your group\'s profile', { postType: type })}</p>
              </div>
              <Switch
                checked={hideExtensionData}
                onCheckedChange={() => updateSettingDirectly('settings.hideExtensionData')(hideExtensionData === undefined || hideExtensionData === null || !hideExtensionData)}
              />
            </div>
          </div>
        </SettingsSection>
      )}

      <SettingsSection>
        <h3 className='text-foreground font-bold mb-2'>{t('Publish Murmurations Profile')}</h3>
        <p className='text-foreground/70 mb-4'>
          <Trans i18nKey='murmurationsHeader'>
            Add your group to the <a href='https://murmurations.network' target='_blank' rel='noopener noreferrer' className='text-accent hover:underline'>Murmurations</a> directory so it can be found and easily added to third-party public maps. You must first set visibility to Public.
          </Trans>
        </p>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <h4 className='text-foreground font-medium'>{t('Publish to Murmurations')}</h4>
              <p className='text-foreground/70 text-sm'>{t('Make your group discoverable in the Murmurations network')}</p>
            </div>
            <Switch
              checked={visibility === GROUP_VISIBILITY.Public && settings.publishMurmurationsProfile}
              onCheckedChange={() => updateSettingDirectly('settings.publishMurmurationsProfile')(!settings.publishMurmurationsProfile)}
              disabled={visibility !== GROUP_VISIBILITY.Public}
            />
          </div>
        </div>
        {visibility === GROUP_VISIBILITY.Public && settings.publishMurmurationsProfile && (
          <p className='text-foreground/70 mt-4'>
            <Trans i18nKey='murmurationsDescription'>
              Your group is now published to the Murmurations directory. You can find your profile <a href={`/noo/group/${slug}/murmurations`} target='_blank' rel='noopener noreferrer' className='text-accent hover:underline'>here</a>.
            </Trans>
          </p>
        )}
      </SettingsSection>

      <SaveButton save={save} changed={changed} />
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

  return (
    <div className='space-y-2'>
      {questions.map((q, i) => (
        <div key={i} className='relative'>
          <input
            name='questions[]'
            disabled={disabled}
            value={q.text}
            placeholder={t('Add a new question')}
            onChange={updateJoinQuestion(i)}
            className={cn(
              'w-full px-4 py-2 rounded-md bg-background',
              'border border-input focus:border-accent',
              'text-foreground placeholder:text-foreground/50',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
          {q.text && (
            <Button
              variant='ghost'
              size='icon'
              className='absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6'
              onClick={() => updateJoinQuestion(i)({ target: { value: '' } })}
            >
              <X className='w-4 h-4' />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}

export default PrivacySettingsTab
