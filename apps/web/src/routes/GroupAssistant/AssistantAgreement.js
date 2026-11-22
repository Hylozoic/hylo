import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { isGroupAssistantAgreement } from '@hylo/shared'
import { setGroupAssistantConsent } from 'store/actions/groupAssistant'
import { cn } from 'util/index'

export { isGroupAssistantAgreement }

/**
 * The Group Assistant's data-sharing agreement, in the viewer's language. The server stores it in
 * English like any agreement (packages/shared GROUP_ASSISTANT_AGREEMENT); wherever agreements are
 * shown, this one is found with isGroupAssistantAgreement and shown with this text instead.
 */
export function useAssistantAgreementText () {
  const { t } = useTranslation()
  return {
    title: t('Sharing member content with a third-party AI'),
    description: t('The group admins have turned on features that allow member data to be shared with a third-party AI (Claude, made by Anthropic), through the Hylo Group Assistant. If you agree, your posts and replies in the spaces the stewards choose, and your name, join date and when you last posted, may be sent to it to help the stewards and answer members’ questions. If you do not agree, none of your posts, replies or member details are sent, and you keep using the group as before. You can change your choice at any time on the group’s About page.')
  }
}

/**
 * The two answers to the agreement, as buttons: value is true (agree), false (do not share) or
 * null (not chosen yet). Unlike the other agreements, either answer lets a member carry on.
 */
export function AssistantConsentChoice ({ value, onChange, disabled = false }) {
  const { t } = useTranslation()
  const option = (accepted, label, testId) => (
    <button
      type='button'
      onClick={() => onChange(accepted)}
      disabled={disabled}
      aria-pressed={value === accepted}
      data-testid={testId}
      className={cn(
        'inline-flex items-center gap-1.5 p-2 rounded-md text-sm border-2',
        value === accepted ? 'bg-selected border-selected text-white' : 'bg-input border-transparent text-foreground'
      )}
    >
      {value === accepted && <Check className='w-4 h-4' strokeWidth={2.5} />}
      {label}
    </button>
  )
  return (
    <div className='flex flex-wrap gap-2 mt-4' role='group' aria-label={t('Sharing member content with a third-party AI')}>
      {option(true, t('I agree to share my content'), 'assistant-consent-accept')}
      {option(false, t('Don’t share my content'), 'assistant-consent-decline')}
    </div>
  )
}

/**
 * A member's answer to the agreement where a group's agreements are listed, with the choice to
 * change it at any time. Saved at once. Only for members of the group (assistantForMe is set).
 */
export function AssistantConsentControl ({ group }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const consent = group?.assistantForMe?.consent
  if (!consent) return null

  const choose = async accepted => {
    setSaving(true)
    setError(null)
    try {
      const response = await dispatch(setGroupAssistantConsent(group.id, accepted))
      if (response?.error || !response?.payload?.data?.setGroupAssistantConsent) throw new Error()
    } catch (err) {
      setError(t('Something went wrong. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='mt-2' data-testid='assistant-consent-control'>
      <p className='m-0 text-sm text-foreground/70'>
        {consent === 'accepted'
          ? t('You agreed: your posts, replies and member details can be shared with the Group Assistant.')
          : consent === 'declined'
            ? t('You chose not to share: nothing of yours is sent to the Group Assistant.')
            : t('You haven’t answered yet, so nothing of yours is shared.')}
      </p>
      <AssistantConsentChoice value={consent === 'pending' ? null : consent === 'accepted'} onChange={choose} disabled={saving} />
      {error && <p className='m-0 mt-1 text-xs text-accent' role='alert'>{error}</p>}
    </div>
  )
}
