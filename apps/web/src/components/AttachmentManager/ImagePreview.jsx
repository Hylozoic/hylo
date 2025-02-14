import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Icon from 'components/Icon'
import { bgImageStyle } from 'util/index'

import classes from './AttachmentManager.module.scss'

export function ImagePreview (props) {
  const {
    attachment, removeImage
  } = props

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: attachment.id,
    transition: null
    // transition: null,{
    //   duration: 150, // milliseconds
    //   easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
    // }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div className={classes.imagePreview} ref={setNodeRef} style={style}>
      <Icon name='Ex' className={classes.removeImage} onClick={removeImage} />
      <div style={bgImageStyle(attachment.url)} className={classes.image} {...listeners} {...attributes} />
    </div>
  )
}
