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
import { RESPONSES } from '@hylo/presenters/EventInvitationPresenter'
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
  const isPastEvent = endTime && new Date(endTime) < new Date()

  return (
    <div>
      {isFlagged && !event.clickthrough &&
        <div className={classes.clickthroughContainer}>
          <div>{t('clickthroughExplainer')}</div>
          <div className={classes.clickthroughButton} onClick={() => dispatch(recordClickthrough({ postId: event.id }))}>{t('View post')}</div>
        </div>}

      <div className={cn(classes.body, classes.eventBody, { [classes.smallMargin]: !expanded, [classes.eventImage]: attachmentType === 'image', [classes.constrained]: constrained }, className)}>
        <div className={cn(classes.eventBodyColumn, { [classes.constrained]: constrained, [classes.isFlagged]: isFlagged && !event.clickthrough })}>
          <div className='flex flex-row gap-5 items-center justify-start mb-4'>
            <EventDate {...event} />
            <div className='flex flex-col gap-0'>
              <div className={cn('text-xs text-foreground/50')} onClick={onClick}>
                {TextHelpers.formatDatePair(startTime, endTime)}
                {isPastEvent && (
                  <span className={cn('text-sm text-foreground/50 ml-2 px-2 inline-block p-1 rounded-md bg-foreground/10 text-xs')}>{t('Event ended')}</span>
                )}
              </div>
              <PostTitle {...event} constrained={constrained} onClick={onClick} />
              {!!location && (
                <div className={cn('text-xs text-foreground/50')} onClick={onClick}>
                  <Icon name='Location' className='w-4 h-4' /> {location}
                </div>
              )}
            </div>
          </div>
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

        <div className='border-2 mt-2 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 background-black/10 rounded-lg border-dashed relative text-center'>
          <div onClick={onClick}>
            <div className={classes.fade} />
            <PeopleInfo
              people={eventAttendees}
              peopleTotal={eventAttendees.length}
              excludePersonId={get('id', currentUser)}
              onClick={currentUser && togglePeopleDialog}
              phrases={{
                emptyMessage: isPastEvent ? t('No one attended') : t('No one is attending yet'),
                phraseSingular: isPastEvent ? t('attended') : t('is attending'),
                mePhraseSingular: isPastEvent ? t('attended') : t('are attending'),
                pluralPhrase: isPastEvent ? t('attended') : t('attending')
              }}
            />
          </div>

          {currentUser && !isPastEvent && (
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
