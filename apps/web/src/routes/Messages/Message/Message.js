import { cn } from 'util/index'
import PropTypes from 'prop-types'
import React from 'react'
import Avatar from 'components/Avatar'
import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import { personUrl } from 'util/navigation'
import { TextHelpers, DateTimeHelpers } from '@hylo/shared'
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
    <div className={cn('text-foreground w-full flex', { 'pt-2': isHeader })} data-message-id={message.id}>
      <div className={classes.avatar}>
        {isHeader && <Avatar url={personUrl(person.id)} avatarUrl={person.avatarUrl} />}
      </div>
      <div className={classes.content}>
        {isHeader && (
          <div className='flex justify-between items-center'>
            <div className='text-foreground font-bold -mb-2'>{person.name}</div>
            <span className='text-xs text-foreground/50'>{pending ? 'sending...' : DateTimeHelpers.humanDate(message.createdAt)}</span>
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
