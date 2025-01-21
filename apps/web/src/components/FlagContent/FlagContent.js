import { cn } from 'util/index'
import { isEmpty, trim } from 'lodash'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import TextareaAutosize from 'react-textarea-autosize'
import Button from 'components/Button'
import Icon from 'components/Icon'
import Select from 'components/Select'
import { submitFlagContent } from './FlagContent.store'

import classes from './FlagContent.module.scss'

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

  return (
    <div className={classes.popup}>
      <div className={classes.popupInner}>
        <h1>{t('Explanation for Flagging')}</h1>
        <span onClick={closeModal} className={classes.closeBtn} role='button' aria-label='Ex'>
          <Icon name='Ex' className={classes.icon} />
        </span>

        <div className={classes.content}>
          <div className={classes.reason}>
            <Select
              onChange={updateSelected}
              fullWidth
              className={cn({
                [classes.reasonRequired]: reasonRequired
              })}
              selected={selectedCategory}
              placeholder={t('Select a reason')}
              options={options}
            />
          </div>
          <TextareaAutosize
            className={classes.explanationTextbox}
            minRows={6}
            value={explanation}
            onChange={(e) => { setExplanation(e.target.value) }}
            placeholder={subtitle}
          />
          <Button className={classes.submitBtn} onClick={submit} disabled={isEmpty(selectedCategory)}>{t('Submit')}</Button>
        </div>
      </div>
    </div>
  )
}

export default FlagContent
