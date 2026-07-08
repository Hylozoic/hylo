import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Icon from 'components/Icon'
import { bgImageStyle } from 'util/index'

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
    <div className='relative cursor-move w-[100px] h-[100px] rounded mr-4 mb-4' ref={setNodeRef} style={style}>
      <Icon
        name='Ex'
        className='absolute -top-2 -right-2 rounded-full bg-foreground text-background text-xs p-px border border-card bg-clip-padding cursor-pointer'
        onClick={removeImage}
      />
      <div
        style={bgImageStyle(attachment.url)}
        className='image w-full h-full bg-cover bg-center rounded p-2'
        {...listeners}
        {...attributes}
      />
    </div>
  )
}
