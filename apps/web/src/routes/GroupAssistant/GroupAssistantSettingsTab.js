import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Lock } from 'lucide-react'
import { groupUrl } from '@hylo/navigation'
import Loading from 'components/Loading'
import { Switch } from 'components/ui/switch'
import fetchForGroup from 'store/actions/fetchForGroup'
import { fetchGroupAssistant, updateGroupAssistantSettings } from 'store/actions/groupAssistant'
import { cn } from 'util/index'
import AxlAvatar from './AxlAvatar'

/**
 * Group Settings, Group Assistant: where stewards turn Axl on, choose what it
 * may do and choose the spaces it may read. Each change is saved at once, so
 * taking a space off the list stops Axl reading it from the next request.
 */
export default function GroupAssistantSettingsTab ({ group }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const [assistant, setAssistant] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const groupId = group?.id

  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    dispatch(fetchGroupAssistant(groupId)).then(response => {
      if (cancelled) return
      const result = response?.payload?.data?.groupAssistant
      if (response?.error || !result) setError(response?.payload?.message || t('Something went wrong. Please try again.'))
      else setAssistant(result)
    })
    return () => { cancelled = true }
  }, [dispatch, groupId, t])

  if (!assistant) return error ? <p className='text-accent' role='alert'>{error}</p> : <Loading />

  const { settings, spaces, hasPro } = assistant
  const save = async change => {
    const before = assistant
    // Shown at once; put back if the server refuses
    setAssistant({ ...assistant, settings: { ...settings, ...change } })
    setSaving(true)
    setError(null)
    const response = await dispatch(updateGroupAssistantSettings(groupId, change))
    const result = response?.payload?.data?.updateGroupAssistantSettings
    setSaving(false)
    if (response?.error || !result) {
      setAssistant(before)
      setError(response?.payload?.message || t('Something went wrong. Please try again.'))
      return
    }
    setAssistant(result)
    // The group menu shows the assistant row from the group's own record
    if (change.enabled !== undefined) dispatch(fetchForGroup(group.slug))
  }

  const toggleSpace = id => save({
    readableGroupIds: settings.readableGroupIds.includes(id)
      ? settings.readableGroupIds.filter(other => other !== id)
      : [...settings.readableGroupIds, id]
  })
  const turnOn = on => save(on && settings.readableGroupIds.length === 0
    // Start with the group's own posts; spaces are added by choice
    ? { enabled: true, readableGroupIds: spaces.filter(space => space.isGroup).map(space => space.id) }
    : { enabled: on })

  const abilities = [
    ['followUps', t('Suggest things for stewards to follow up on'), t('Unanswered requests and people who haven’t been welcomed. Only stewards see these.'), true],
    ['shareLoad', t('Share the load'), t('When the same few people answer most requests, suggest others who have offered to help. Only stewards see these.'), true],
    ['summarize', t('Summarize busy chats'), t('Anyone can ask for a summary of what they missed.'), true],
    ['answerMembers', t('Answer members’ questions'), t('Using your group’s posts, agreements, and About page. It says when it doesn’t know.'), true]
  ]

  return (
    <div className='flex flex-col gap-4' data-testid='assistant-settings'>
      <div className='flex items-start gap-3'>
        <AxlAvatar size={36} />
        <div className='min-w-0'>
          <h2 className='m-0 flex flex-wrap items-center gap-2 text-foreground font-bold'>
            {t('Group Assistant')}
            <span className='text-[10.5px] font-bold uppercase tracking-wide text-foreground/60 bg-foreground/10 px-1.5 py-0.5 rounded'>{t('Beta')}</span>
          </h2>
          <p className='m-0 mt-1 text-sm text-foreground/70'>
            {t('Axl is a private assistant for this group’s stewards. It only reads the spaces you choose, and your group’s content is never used to train AI models. It drafts and suggests; a steward decides.')}
          </p>
        </div>
      </div>

      {!hasPro && (
        <div className='flex items-start gap-2 rounded-lg border-2 border-foreground/20 bg-card p-3 text-sm text-foreground/80' data-testid='assistant-settings-locked'>
          <Lock className='w-4 h-4 mt-0.5 shrink-0' />
          <span>
            {t('The Group Assistant is part of Hylo Pro.')}{' '}
            <Link to={groupUrl(group.slug, 'settings/billing')} className='font-bold text-accent underline'>{t('See Hylo Pro')}</Link>
          </span>
        </div>
      )}

      <div className={cn('flex flex-col gap-4', !hasPro && 'opacity-60 pointer-events-none')}>
        <label className='flex items-center justify-between gap-4 rounded-lg border-2 border-foreground/20 bg-card p-3'>
          <span className='min-w-0'>
            <span className='block text-sm font-bold text-foreground'>{t('Assistant is on')}</span>
            <span className='block text-xs text-foreground/60'>{t('Turning it off hides it from the group menu and stops all reading.')}</span>
          </span>
          <Switch checked={settings.enabled} onCheckedChange={turnOn} disabled={saving || !hasPro} data-testid='assistant-enabled' aria-label={t('Assistant is on')} />
        </label>

        {settings.enabled && (
          <>
            <div>
              <h3 className='m-0 mb-1 text-sm font-bold text-foreground'>{t('Spaces it can read')}</h3>
              <p className='m-0 mb-2 text-xs text-foreground/60'>{t('Axl reads nothing outside this list, and never direct messages.')}</p>
              <div className='flex flex-wrap gap-1.5'>
                {spaces.map(space => {
                  const on = settings.readableGroupIds.includes(space.id)
                  return (
                    <button
                      key={space.id}
                      type='button'
                      onClick={() => toggleSpace(space.id)}
                      disabled={saving}
                      aria-pressed={on}
                      data-testid='assistant-space'
                      className={cn(
                        'inline-flex items-center gap-1 h-8 px-3 rounded-full border-2 text-xs font-semibold',
                        on ? 'border-selected bg-selected/15 text-foreground' : 'border-foreground/20 bg-card text-foreground/70'
                      )}
                    >
                      {on && <Check className='w-3.5 h-3.5 text-selected' strokeWidth={2.5} />}
                      {space.isGroup ? t('{{name}} (group posts)', { name: space.name }) : space.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <h3 className='m-0 mb-1 text-sm font-bold text-foreground'>{t('What it can do')}</h3>
              <p className='m-0 mb-2 text-xs text-foreground/60'>{t('These are saved now and take effect as each ability is released.')}</p>
              <div className='flex flex-col gap-2'>
                {abilities.map(([key, label, help]) => (
                  <label key={key} className='flex items-center justify-between gap-4 rounded-lg border-2 border-foreground/15 bg-card p-3'>
                    <span className='min-w-0'>
                      <span className='block text-sm font-semibold text-foreground'>{label}</span>
                      <span className='block text-xs text-foreground/60'>{help}</span>
                    </span>
                    <Switch checked={!!settings[key]} onCheckedChange={value => save({ [key]: value })} disabled={saving} aria-label={label} />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className='m-0 mb-1 text-sm font-bold text-foreground'>{t('Where it runs')}</h3>
              <p className='m-0 text-xs text-foreground/60'>{t('A hosted model that keeps nothing.')}</p>
            </div>

            <Link to={groupUrl(group.slug, 'assistant')} className='self-start text-sm font-bold text-selected' data-testid='assistant-open'>
              {t('Open the Group Assistant')}
            </Link>
          </>
        )}
      </div>

      {error && <p className='m-0 text-sm text-accent' role='alert'>{error}</p>}
    </div>
  )
}
