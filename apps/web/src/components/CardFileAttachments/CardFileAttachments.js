import React from 'react'
import { filter } from 'lodash/fp'
import { cn } from 'util/index'
import Icon from 'components/Icon'
import classes from './CardFileAttachments.module.scss'

export default function CardFileAttachments ({
  attachments = [],
  className
}) {
  const fileAttachments = filter({ type: 'file' }, attachments)

  return (
    <div className={cn(className)}>
      {fileAttachments.map((fileAttachment, i) =>
        <CardFileAttachment fileAttachment={fileAttachment} key={i} />)}
    </div>
  )
}

export function CardFileAttachment ({
  fileAttachment = {}
}) {
  return (
    <a
      className='rounded-lg bg-midground p-2 flex items-center gap-2 shadow-lg transition-all hover:scale-105 hover:shadow-xl text-foreground mb-1'
      href={fileAttachment.url}
      target='_blank'
      key={fileAttachment.id} rel='noreferrer'
    >
      <Icon name='Document' className={classes.fileIcon} />
      <span className={classes.fileName}>{decodeURIComponent(new URL(fileAttachment.url).pathname.split('/').pop())}</span>
    </a>
  )
}
