import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'

import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import { addQuerystringToPath } from '@hylo/navigation'
import { createSpace } from 'store/actions/groupViews'
import fetchGroupViews from 'store/actions/fetchGroupViews'

/** Modal for creating a new space under the current group. */
export default function AddSpaceDialog ({ group, onClose }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !group?.id) return
    setIsCreating(true)
    try {
      await dispatch(createSpace({
        parentGroupId: group.id,
        name: name.trim(),
        description: description || null
      }))
      await dispatch(fetchGroupViews(group.id))
      onClose()
      navigate(addQuerystringToPath(location.pathname, { edit: 'true' }))
    } catch (error) {
      console.error('Failed to create space:', error)
    } finally {
      setIsCreating(false)
    }
  }, [dispatch, group?.id, name, description, onClose, navigate, location.pathname])

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-darkening/50'>
      <div className='bg-midground rounded-lg shadow-lg p-4 w-full max-w-md'>
        <h2 className='text-lg font-semibold mb-4'>{t('Add Space')}</h2>
        <div className='flex flex-col gap-3'>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('Space name')}
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('Description (optional)')}
            rows={3}
            className='w-full rounded-md border border-foreground/20 bg-input p-2 text-sm text-foreground'
          />
        </div>
        <div className='flex justify-end gap-2 mt-4'>
          <Button variant='secondary' onClick={onClose}>{t('Cancel')}</Button>
          <Button variant='primary' disabled={!name.trim() || isCreating} onClick={handleCreate}>
            {isCreating ? t('Creating...') : t('Create')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Button row for adding spaces in edit mode. */
export function AddSpaceButton ({ onClick }) {
  const { t } = useTranslation()
  return (
    <button
      type='button'
      onClick={onClick}
      className='flex items-center gap-2 w-full text-base text-foreground border-2 border-dashed border-foreground/30 hover:border-foreground/50 rounded-md p-2 pl-2 mb-2 transition-all opacity-85 hover:opacity-100'
    >
      <Plus className='w-4 h-4' />
      <span>{t('Add Space')}</span>
    </button>
  )
}
