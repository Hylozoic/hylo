import React, { useState, useEffect } from 'react'
import { useInView } from 'react-cool-inview'
import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { humanResponse } from '@hylo/presenters/EventInvitationPresenter'
import Button from 'components/Button'
import CheckBox from 'components/CheckBox'
import Loading from 'components/Loading'
import TextInput from 'components/TextInput'
import { bgImageStyle, cn } from 'util/index'
import { CENTER_COLUMN_ID } from 'util/scrolling'

import styles from './EventInviteDialog.module.scss'

const pageSize = 30

const EventInviteDialog = ({
  eventTitle,
  fetchPeople,
  forGroups,
  eventInvitations,
  people,
  eventId,
  onClose,
  invitePeopleToEvent,
  pending
}) => {
  const [invitedIds, setInvitedIds] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [pageFetched, setPageFetched] = useState(0)

  const toggleInvite = id => (invitedIds.includes(id))
    ? setInvitedIds(invitedIds.filter(invitedId => invitedId !== id))
    : setInvitedIds(invitedIds.concat([id]))

  const onSearchChange = ({ target: { value } }) => setSearchTerm(value)
  const { t } = useTranslation()

  useEffect(() => {
    const fetch = () => {
      const forGroupIds = forGroups.map(c => c.id).filter(c => c !== 'public')
      fetchPeople({ autocomplete: searchTerm, groupIds: forGroupIds, first: pageSize, offset: 0 })
      setPageFetched(pageSize)
    }
    fetch()
  }, [searchTerm])

  const { observe } = useInView({
    onEnter: () => {
      const fetch = () => {
        const forGroupIds = forGroups.map(c => c.id).filter(c => c !== 'public')
        fetchPeople({ autocomplete: searchTerm, groupIds: forGroupIds, first: pageSize, offset: pageFetched })
        setPageFetched(pageFetched + pageSize)
      }
      fetch()
    }
  })

  const getFilteredInviteSuggestions = () => {
    return people.filter(person => {
      return !eventInvitations.map(ei => ei.id).includes(person.id) &&
      person.name.toLowerCase().includes(searchTerm.toLowerCase())
    })
  }

  const submit = () => {
    invitePeopleToEvent(eventId, invitedIds)
    onClose()
  }

  const filteredInviteSuggestions = getFilteredInviteSuggestions()

  const inviteButtonLabel = invitedIds.length === 0
    ? t('Select people to invite')
    : invitedIds.length === 1
      ? t('Invite 1 person')
      : t('Invite {{invitedIds.length}} people', { invitedIds })

  return (
    <Dialog.Root defaultOpen onOpenChange={onClose}>
      <Dialog.Portal container={document.getElementById(CENTER_COLUMN_ID)}>
        <Dialog.Overlay className='EventInviteDialog-Overlay bg-black/50 absolute left-0 right-0 bottom-0 grid place-items-center overflow-y-auto z-[100] h-full backdrop-blur-sm p-2'>
          <Dialog.Content className='EventInviteDialog-Content min-w-[300px] w-full bg-background p-3 rounded-md z-[41] max-w-[750px] outline-none relative'>
            <Dialog.Title className='text-xl font-semibold leading-none tracking-tight'>Invite to event: {eventTitle}</Dialog.Title>
            <Dialog.Description className='sr-only'>Invite group members to event: {eventTitle}</Dialog.Description>
            <div className={styles.container}>
              <Search onChange={onSearchChange} />
              <div className={styles.inviteSuggestions}>
                {filteredInviteSuggestions.map((invitee, idx) => (
                  <InviteeRow
                    key={invitee.id}
                    person={invitee}
                    ref={idx === filteredInviteSuggestions.length - 10 ? observe : null}
                    selected={invitedIds.includes(invitee.id)}
                    onClick={() => toggleInvite(invitee.id)}
                  />))}
                <div className={cn(styles.row)}>
                  <div className={cn(styles.col)} style={{ height: '40px' }}>
                    {pending && <div><Loading /></div>}
                  </div>
                </div>
              </div>

              <div className='font-bold pb-2 mt-6'>{t('Already Invited')}</div>
              <div className={styles.alreadyInvited}>
                {eventInvitations.map(eventInvitation =>
                  <InviteeRow
                    person={eventInvitation}
                    showResponse
                    key={eventInvitation.id}
                  />)}
              </div>
              <Button
                small
                className={styles.inviteButton}
                label={inviteButtonLabel}
                onClick={submit}
                disabled={invitedIds.length === 0}
              />
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export const InviteeRow = React.forwardRef((props, ref) => {
  const { t } = useTranslation()
  const { person, selected, showResponse, onClick } = props
  const { name, avatarUrl, response } = person
  return (
    <div ref={ref} className={cn(styles.row)} onClick={onClick}>
      <div className={styles.col}>
        <div className={styles.avatar} style={bgImageStyle(avatarUrl)} />
      </div>
      <div className={styles.col}>
        {name}
      </div>
      {!showResponse && (
        <div className={cn(styles.col, styles.check)}>
          <CheckBox checked={selected} noInput />
        </div>
      )}
      {showResponse && response && (
        <div className={cn(styles.col, styles.response)}>
          {t(humanResponse(response))}
        </div>
      )}
    </div>
  )
})

export function Search ({ onChange }) {
  const { t } = useTranslation()
  return (
    <div className={styles.search}>
      <TextInput
        theme={styles}
        inputRef={x => x && x.focus()}
        placeholder={t('Search members')}
        onChange={onChange}
      />
    </div>
  )
}

export default EventInviteDialog
