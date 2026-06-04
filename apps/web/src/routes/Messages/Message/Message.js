import { cn } from 'util/index'
import PropTypes from 'prop-types'
import React from 'react'
import Avatar from 'components/Avatar'
import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import ProfileCardDialog from 'components/ProfileCardDialog/ProfileCardDialog'
import { TextHelpers } from '@hylo/shared'
import classes from './Message.module.scss'

export default function Message ({ message, isHeader }) {
  const person = message.creator
  const pending = message.id.slice(0, 13) === 'messageThread'
  // TODO: New line replacement is happening on both Web and Mobile
  //       This would probably be better handled as a markdown editor
  //       which sends HTML to API or an HTML editor (HyloEditor) in both places
  const text = pending
    ? 'sending...'
    : TextHelpers.markdown(message.text)

  return (
    <div className={cn('text-foreground w-full flex pr-3', { 'pt-2': isHeader })} data-message-id={message.id}>
      <div className={classes.avatar}>
        {isHeader && (
          <ProfileCardDialog personId={person.id}>
            <Avatar avatarUrl={person.avatarUrl} />
          </ProfileCardDialog>
        )}
      </div>
      <div className={cn(classes.content, 'min-w-0')}>
        {isHeader && (
          <div className='flex justify-between items-center gap-2'>
            <ProfileCardDialog personId={person.id}>
              <div className='text-foreground font-bold -mb-2 truncate hover:underline'>{person.name}</div>
            </ProfileCardDialog>
            <span className='text-xs text-foreground/50 whitespace-nowrap flex-shrink-0'>{pending ? 'sending...' : TextHelpers.humanDate(message.createdAt)}</span>
          </div>
        )}
        <div className='text-foreground'>
          <ClickCatcher>
            <HyloHTML element='span' html={text} />
          </ClickCatcher>
        </div>
      </div>
    </div>
  )
}

Message.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string,
    text: PropTypes.string,
    creator: PropTypes.object
  }).isRequired,
  isHeader: PropTypes.bool
}
