import { cn } from 'util/index'
import PropTypes from 'prop-types'
import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { each, values } from 'lodash'
import { clearUserTyping, getPeopleTyping } from './PeopleTyping.store'
import classes from './PeopleTyping.module.scss'

const { string } = PropTypes

// the amount to delay before deciding that someone is no longer typing
const MAX_TYPING_PAUSE = 5000

// Entries without a context (older events) match every surface.
function matchesContext (entry, groupId, postId) {
  if (groupId && entry.groupId) return String(entry.groupId) === String(groupId)
  if (postId && entry.postId) return String(entry.postId) === String(postId)
  if (entry.groupId || entry.postId) return false
  return true
}

function PeopleTyping ({ className, groupId, postId }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const peopleTyping = useSelector(getPeopleTyping)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    intervalRef.current = setInterval(() => {
      const now = Date.now()
      each(peopleTyping, ({ timestamp }, id) =>
        now - timestamp > MAX_TYPING_PAUSE && dispatch(clearUserTyping(id)))
    }, 500)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [dispatch, peopleTyping])

  const names = values(peopleTyping).filter(v => matchesContext(v, groupId, postId)).map(v => v.name)
  return (
    <div className={cn(classes.typing, className)} data-testid='people-typing'>
      {names.length === 1 && <span>{names[0]} {t('is typing...')}&nbsp;</span>}
      {names.length > 1 && <span>{t('Multiple people are typing...')}&nbsp;</span>}
    </div>
  )
}

PeopleTyping.propTypes = {
  className: string
}

export default PeopleTyping
