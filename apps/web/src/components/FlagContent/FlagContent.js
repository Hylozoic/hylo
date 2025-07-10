import { isEmpty, trim } from 'lodash'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { createPortal } from 'react-dom'
import TextareaAutosize from 'react-textarea-autosize'
import Button from 'components/ui/button'
import Icon from 'components/Icon'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { submitFlagContent } from './FlagContent.store'
import { rootDomId } from 'client/util'

function FlagContent ({ linkData, onClose, type = 'content' }) {
  const { t } = useTranslation()
  const [highlightRequired, setHighlightRequired] = useState(false)
  const [reasonRequired, setReasonRequired] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [subtitle, setSubtitle] = useState(t('What was wrong?'))
  const dispatch = useDispatch()

  const closeModal = () => {
    setHighlightRequired(false)
    if (onClose) {
      onClose()
    }
  }

  // Add escape key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const isExplanationOptional = (selectedCategory) =>
    (selectedCategory || selectedCategory) !== 'other'

  const submit = () => {
    if (isEmpty(selectedCategory)) {
      setReasonRequired(true)
      return
    }

    if (!isExplanationOptional() && isEmpty(trim(explanation))) {
      setHighlightRequired(true)
      updateSelected(selectedCategory)
    } else {
      dispatch(submitFlagContent(selectedCategory, trim(explanation), linkData))
      closeModal()
      return true
    }

    return false
  }

  const updateSelected = (selectedCategory) => {
    setSelectedCategory(selectedCategory)

    const required = !isExplanationOptional(selectedCategory) && highlightRequired
      ? ` ${t('(explanation required)')}`
      : ''
    const newSubtitle = t('Why was this {{type}} \'{{selectedCategory}}\'{{required}}?', {
      type,
      selectedCategory,
      required
    })
    setSubtitle(newSubtitle)
  }

  const options = [
    { label: t('Inappropriate Content'), id: 'inappropriate' },
    { label: t('Spam'), id: 'spam' },
    { label: t('Offensive'), id: 'offensive' },
    { label: t('Abusive'), id: 'abusive' },
    { label: t('Illegal'), id: 'illegal' },
    { label: t('Other'), id: 'other' }
  ]

  const modalContent = (
    <div className='fixed inset-0 z-[1001] overflow-y-auto pointer-events-auto' onClick={(e) => e.stopPropagation()}>
      <div className='absolute inset-0 bg-black/50 z-0 w-full h-full top-0 left-0' onClick={closeModal} />
      <div className='relative max-h-screen flex items-center justify-center p-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[750px] w-full'>
        <div className='relative bg-background rounded-lg shadow-xl w-full max-w-[750px] p-6'>
          <div className='flex flex-row items-center justify-between mb-4'>
            <h2 className='text-xl font-semibold'>{t('Explanation for Flagging')}</h2>
            <button onClick={closeModal} className='text-foreground/70 hover:text-foreground transition-colors'>
              <Icon name='Ex' className='w-5 h-5' />
            </button>
          </div>

          <div className='space-y-4'>
            <div className={`space-y-2 ${reasonRequired ? 'ring-2 ring-red-500 rounded-lg' : ''}`}>
              <Select
                value={selectedCategory}
                onValueChange={updateSelected}
              >
                <SelectTrigger className='w-full'>
                  {selectedCategory ? options.find(opt => opt.id === selectedCategory)?.label : t('Select a reason')}
                </SelectTrigger>
                <SelectContent className='z-[1002]'>
                  {options.map(option => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reasonRequired && (
                <p className='text-red-500 text-sm'>{t('Please select a reason')}</p>
              )}
            </div>

            <TextareaAutosize
              className={`w-full min-h-[120px] p-3 rounded-lg border-2 ${
                highlightRequired && !isExplanationOptional() ? 'border-red-500' : 'border-foreground/10'
              } bg-transparent text-foreground/80 focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-foreground/50`}
              minRows={4}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder={subtitle}
            />

            <div className='flex justify-end space-x-2'>
              <Button variant='outline' onClick={closeModal}>
                {t('Cancel')}
              </Button>
              <Button
                variant='secondary'
                onClick={submit}
                disabled={isEmpty(selectedCategory)}
              >
                {t('Submit')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return document.getElementById(rootDomId)
    ? createPortal(modalContent, document.getElementById(rootDomId))
    : null
}

export default FlagContent
