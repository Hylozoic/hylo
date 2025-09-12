import React from 'react'
import { useTranslation } from 'react-i18next'
import { filter, get } from 'lodash/fp'
import * as Dialog from '@radix-ui/react-dialog'
import TextInput from 'components/TextInput'
import Member from 'components/Member'
import { humanResponse } from '@hylo/presenters/EventInvitationPresenter'
import { bgImageStyle, cn } from 'util/index'
import { CENTER_COLUMN_ID } from 'util/scrolling'

function PostPeopleDialog ({ members, onClose, currentGroup, title }) {
  const { t } = useTranslation()
  const [searchString, setSearchString] = React.useState('')
  const [selectedMember, setSelectedMember] = React.useState(members[0])
  const [filteredMembers, setFilteredMembers] = React.useState(members)

  const selectMember = member => () => setSelectedMember(member)

  const search = ({ target }) => {
    const newSearchString = target.value
    const membersFilter = m => m.name.toLowerCase().includes(newSearchString.toLowerCase())

    setSearchString(newSearchString)
    setFilteredMembers(filter(membersFilter, members))
  }

  const dialogTitle = title ?? t('People')
  const loading = false

  return (
    <Dialog.Root defaultOpen onOpenChange={onClose}>
      <Dialog.Portal container={document.getElementById(CENTER_COLUMN_ID)}>
        <Dialog.Overlay
          className='PostPeopleDialog-Overlay bg-black/50 absolute left-0 right-0 bottom-0 grid place-items-center overflow-y-auto z-[100] h-full backdrop-blur-sm p-2'
        >
          <Dialog.Content className='PostPeopleDialog-Content min-w-[300px] w-full bg-background p-3 rounded-md z-[41] max-w-[750px] outline-none relative'>
            <Dialog.Title>{dialogTitle}</Dialog.Title>
            <Dialog.Description className='sr-only'>{dialogTitle}</Dialog.Description>
            <div className='flex flex-wrap h-[380px] content-start'>
              {/**
                Note: Can make memberDetails optional by adding a `withDetails` flag
                sending in `goToMember` and switchin the onClick on a `MemberRow` to
                go there instead of showing detail and making adding a conditional
                style to make width of members-list be 100% in that case.
              */}
              <div className='w-1/2 pr-1 flex flex-col h-full'>
                {members.length > 7 && (
                  <TextInput
                    className='mb-[5px] w-full flex'
                    aria-label='members-search'
                    autoFocus
                    label='members-search'
                    name='members-search'
                    onChange={search}
                    loading={loading}
                    value={searchString}
                    placeholder={t('Find a member')}
                  />
                )}
                <section className='flex-1 overflow-y-auto border border-border rounded'>
                  {filteredMembers.map(member => (
                    <MemberRow
                      member={member}
                      selected={member.id === get('id', selectedMember)}
                      onClick={selectMember(member)}
                      key={member.id}
                    />
                  ))}
                </section>
              </div>
              {selectedMember && <MemberDetail member={selectedMember} currentGroup={currentGroup} />}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function MemberRow ({ member, selected, onClick }) {
  const { t } = useTranslation()
  const { name, avatarUrl, response } = member

  return (
    <div className={cn('flex items-center w-full cursor-pointer bg-background', selected && 'bg-selected')} onClick={onClick}>
      <div className='flex items-center justify-start p-[5px]'>
        <div className='w-10 h-10 rounded-full bg-cover bg-center' style={bgImageStyle(avatarUrl)} />
      </div>
      <div className='flex items-center justify-start p-[5px]'>
        {name}
      </div>
      {response && <div className={cn('flex items-center justify-start p-[5px]', 'ml-auto text-[12px]')}>{t(humanResponse(response))}</div>}
    </div>
  )
}

function MemberDetail ({ member, currentGroup }) {
  return (
    <div className='w-1/2'>
      <Member member={member} className='w-full border-0 p-0 pl-[10px] pb-[10px] m-0 max-w-none' group={currentGroup} />
    </div>
  )
}

export default PostPeopleDialog
