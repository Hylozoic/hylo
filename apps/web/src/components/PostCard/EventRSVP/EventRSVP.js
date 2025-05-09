import React from 'react'
import { useTranslation } from 'react-i18next'
import { RESPONSES } from '@hylo/presenters/EventInvitationPresenter'
import classes from './EventRSVP.module.scss'
import DropdownButton from 'components/DropdownButton'

export default function EventRSVP ({ myEventResponse, respondToEvent, position }) {
  const { t } = useTranslation()
  let label

  switch (myEventResponse) {
    case RESPONSES.YES:
      label = t('Going')
      break
    case RESPONSES.INTERESTED:
      label = t('Interested')
      break
    case RESPONSES.NO:
      label = t('Not Going')
      break
    default:
      label = t('RSVP')
  }

  const choices = [
    { label: t('Going'), value: RESPONSES.YES },
    { label: t('Interested'), value: RESPONSES.INTERESTED },
    { label: t('Not Going'), value: RESPONSES.NO }
  ]

  return (
    <div className={classes.eventRSVP}>
      <DropdownButton
        label={label}
        choices={choices}
        onChoose={response => respondToEvent(response)}
        position={position}
      />
    </div>
  )
}
