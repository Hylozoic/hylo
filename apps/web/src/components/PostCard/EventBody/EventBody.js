import { cn } from 'util/index'
import { get, filter } from 'lodash/fp'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { TextHelpers } from '@hylo/shared'
import Button from 'components/Button'
import EventInviteDialog from 'components/EventInviteDialog'
import EventDate from '../EventDate'
import EventRSVP from '../EventRSVP'
import Icon from 'components/Icon'
import PostTitle from '../PostTitle'
import PostContent from '../PostContent'
import PeopleInfo from 'components/PostCard/PeopleInfo'
import { recordClickthrough } from 'store/actions/moderationActions'
import { RESPONSES } from 'store/models/EventInvitation'
import classes from '../PostBody/PostBody.module.scss'

function EventBody (props) {
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const dispatch = useDispatch()
  const { t } = useTranslation()

  const toggleInviteDialog = () => setShowInviteDialog(!showInviteDialog)

  const { currentUser, event, isFlagged, respondToEvent, slug, expanded, className, constrained, onClick, togglePeopleDialog } = props
  const { id, startTime, endTime, location, eventInvitations, groups } = event

  const firstAttachment = event.attachments?.[0]
  const attachmentType = firstAttachment?.type

  const eventAttendees = filter(ei => ei.response === RESPONSES.YES, eventInvitations)

  return (
    <div>
      {isFlagged && !event.clickthrough &&
        <div className={classes.clickthroughContainer}>
          <div>{t('clickthroughExplainer')}</div>
          <div className={classes.clickthroughButton} onClick={() => dispatch(recordClickthrough({ postId: event.id }))}>{t('View post')}</div>
        </div>}

      <div className={cn(classes.body, classes.eventBody, { [classes.smallMargin]: !expanded, [classes.eventImage]: attachmentType === 'image', [classes.constrained]: constrained }, className)}>
        <div className={classes.eventTop}>
          <div className={cn(classes.calendarDate)} onClick={onClick}>
            <EventDate {...event} />
          </div>
          {currentUser && (
            <div className={classes.eventResponseTop}>
              <div className={classes.rsvp}>
                <EventRSVP {...event} respondToEvent={respondToEvent} />
              </div>
              <Button label={t('Invite')} onClick={toggleInviteDialog} narrow small color='green-white' className={classes.inviteButton} />
            </div>
          )}
        </div>

        <div className={cn(classes.eventBodyColumn, { [classes.constrained]: constrained, [classes.isFlagged]: isFlagged && !event.clickthrough })}>
          <PostTitle {...event} constrained={constrained} onClick={onClick} />
          <div className={cn(classes.eventData, { [classes.constrained]: constrained })} onClick={onClick}>
            <Icon name='Clock' className={classes.icon} /> {TextHelpers.formatDatePair(startTime, endTime)}
          </div>
          {!!location && (
            <div className={cn(classes.eventData, classes.eventLocation)} onClick={onClick}>
              <Icon name='Location' className={classes.icon} /> {location}
            </div>
          )}
          <div className={cn(classes.eventDetails, { [classes.constrained]: constrained })}>
            <PostContent
              {...event}
              onClick={onClick}
              constrained={constrained}
              expanded={expanded}
              slug={slug}
            />
          </div>
        </div>

        <div className={classes.eventAttendance}>
          <div className={classes.people} onClick={onClick}>
            <div className={classes.fade} />
            <PeopleInfo
              people={eventAttendees}
              peopleTotal={eventAttendees.length}
              excludePersonId={get('id', currentUser)}
              onClick={currentUser && togglePeopleDialog}
              phrases={{
                emptyMessage: t('No one is attending yet'),
                phraseSingular: t('is attending'),
                mePhraseSingular: t('are attending'),
                pluralPhrase: t('attending')
              }}
            />
          </div>

          {currentUser && (
            <div className={classes.eventResponse}>
              <div className={classes.rsvp}>
                <EventRSVP {...event} respondToEvent={respondToEvent} />
              </div>
              <Button label={t('Invite')} onClick={toggleInviteDialog} narrow small color='green-white' className={classes.inviteButton} />
            </div>
          )}
        </div>
        {showInviteDialog && (
          <EventInviteDialog
            eventId={id}
            eventInvitations={eventInvitations}
            forGroups={groups}
            onClose={toggleInviteDialog}
          />
        )}
      </div>
    </div>
  )
}

export default EventBody
