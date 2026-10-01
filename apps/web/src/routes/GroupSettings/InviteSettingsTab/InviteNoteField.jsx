import PropTypes from 'prop-types'
import React, { useId } from 'react'
import { useTranslation } from 'react-i18next'
import TextareaAutosize from 'react-textarea-autosize'

// The server strips any HTML and keeps at most this many characters
export const INVITE_NOTE_MAX_LENGTH = 300

/**
 * An optional plain-text personal note for invitation emails, shown quoted in the email.
 */
export default function InviteNoteField ({ value, onChange, disabled = false }) {
  const { t } = useTranslation()
  const id = useId()
  const remaining = INVITE_NOTE_MAX_LENGTH - (value || '').length

  return (
    <div className='flex flex-col gap-1 mt-2'>
      <label htmlFor={id} className='text-foreground'>{t('Add a personal note (optional)')}</label>
      <TextareaAutosize
        id={id}
        minRows={2}
        maxLength={INVITE_NOTE_MAX_LENGTH}
        className='rounded-lg bg-input text-foreground focus:outline-none focus:ring-0 focus:ring-offset-0 border-2 border-transparent focus:border-focus p-2'
        placeholder={t('Say why you would like them to join')}
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value.slice(0, INVITE_NOTE_MAX_LENGTH))}
      />
      <span className='text-sm text-foreground/50' aria-live='polite'>
        {t('Plain text, shown in the invitation email. {{remaining}} characters left.', { remaining })}
      </span>
    </div>
  )
}

InviteNoteField.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool
}
