import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { localSpaceSlug, storedSpaceSlug } from '@hylo/navigation'
import { fetchGroupExists } from 'routes/CreateGroup/CreateGroup.store'
import { SLUG_MAX_LENGTH, slugValidatorRegex } from 'routes/CreateGroup/slug'
import { Input } from 'components/ui/input'
import { cn } from 'util/index'

const SLUG_CHECK_DEBOUNCE = 300

/** URL slug editor for a space. Shows and edits only the local portion; uniqueness uses `{parentSlug}-{localSlug}`. */
export default function SpaceSlugField ({ parentSlug, value, onChange, currentStoredSlug, onValidityChange, forceShowError = false }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [touched, setTouched] = useState(false)
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

  return (
    <div className='flex flex-col gap-1'>
      <label className='text-sm text-foreground/70'>{t('URL slug')}</label>
      <Input
        value={value}
        onChange={e => {
          setTouched(true)
          onChange(e.target.value)
        }}
        placeholder={t('your-space-name')}
        maxLength={SLUG_MAX_LENGTH}
        className={cn(error && 'border-error')}
      />
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
