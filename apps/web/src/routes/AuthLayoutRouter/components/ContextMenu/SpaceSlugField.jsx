import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { localSpaceSlug, storedSpaceSlug } from '@hylo/navigation'
import { fetchGroupExists } from 'routes/CreateGroup/CreateGroup.store'
import { SLUG_MAX_LENGTH, slugValidatorRegex } from 'routes/CreateGroup/slug'
import { FIELD_LABEL_CLASS, INPUT_CLASS } from 'components/ui/form-field'
import InfoButton from 'components/ui/info'
import { cn } from 'util/index'

const SLUG_CHECK_DEBOUNCE = 300

/** Handle editor for a space — the same UX as the group creation modal's Handle field.
 * Shows and edits only the local portion; uniqueness uses `{parentSlug}-{localSlug}`. */
export default function SpaceSlugField ({ parentSlug, value, onChange, currentStoredSlug, onValidityChange, forceShowError = false }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [touched, setTouched] = useState(false)
  const inputRef = useRef()
  const slugExists = useSelector(state => state.CreateGroup?.slugExists)
  const slugChecked = useSelector(state => state.CreateGroup?.slugChecked)

  const formatError = useMemo(() => {
    if (!value) return t('Please enter a URL slug')
    if (!slugValidatorRegex.test(value)) {
      return t('URLs must have between 2 and 40 characters, and can only have lower case letters, numbers, and dashes.')
    }
    return null
  }, [value, t])

  const stored = storedSpaceSlug(parentSlug, value)
  const isCurrentSlug = Boolean(
    currentStoredSlug &&
    (stored === currentStoredSlug || localSpaceSlug(parentSlug, currentStoredSlug) === value)
  )
  const taken = !formatError && !isCurrentSlug && slugExists && slugChecked === stored
  const visibleFormatError = (touched || forceShowError) ? formatError : null
  const error = visibleFormatError || (taken ? t('This URL already exists. Try another.') : null)
  const isValid = !formatError && !taken

  useEffect(() => {
    onValidityChange?.(isValid)
  }, [isValid, onValidityChange])

  useEffect(() => {
    if (formatError || !parentSlug || isCurrentSlug) return
    const timeout = setTimeout(() => dispatch(fetchGroupExists(stored)), SLUG_CHECK_DEBOUNCE)
    return () => clearTimeout(timeout)
  }, [dispatch, formatError, parentSlug, stored, isCurrentSlug])

  const focusInput = () => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  return (
    <div className='flex flex-col gap-1'>
      <div className='h-5 flex items-center gap-1.5'>
        <label htmlFor='spaceSlug' className={FIELD_LABEL_CLASS}>{t('Handle')}</label>
        <InfoButton
          className='text-foreground/50'
          content={t("Your space's unique address on Hylo. It appears in your space's URL.")}
        />
      </div>
      <div className={cn(INPUT_CLASS, 'flex items-center', error && 'border-error')}>
        <span className='text-sm text-foreground/40 shrink-0'>@</span>
        <input
          id='spaceSlug'
          type='text'
          value={value}
          onChange={e => {
            setTouched(true)
            onChange(e.target.value)
          }}
          onClick={focusInput}
          ref={inputRef}
          placeholder={t('your-space-name')}
          maxLength={SLUG_MAX_LENGTH}
          className='flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder-foreground/40 focus:outline-none'
        />
      </div>
      {error
        ? <span className='text-error text-xs'>{error}</span>
        : (
          <span className='text-xs text-foreground/50 truncate'>
            hylo.com/groups/{parentSlug || '…'}/spaces/{value || '…'}
          </span>
          )}
    </div>
  )
}
