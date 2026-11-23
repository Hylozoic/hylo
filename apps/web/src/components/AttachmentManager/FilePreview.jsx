import React from 'react'
import Icon from 'components/Icon'
import { isDirectVideoFileUrl } from 'util/isPlayableVideoUrl'

export function FilePreview ({ attachment, removeFile, fileSize }) {
  const filename = new URL(attachment.url).pathname.split('/').pop()
  const video = isDirectVideoFileUrl(attachment.url)
  return (
    <div className='flex flex-col mb-1.5'>
      {video && (
        <video
          className='w-full max-h-[240px] rounded-lg bg-black mb-1'
          controls
          playsInline
          preload='metadata'
          src={attachment.url}
        />
      )}
      <div className='flex items-center'>
        {!video && <Icon name='Document' className='text-base mr-2.5 text-accent' />}
        <div className='text-sm text-foreground/80 leading-[18px] mr-2.5 overflow-hidden text-ellipsis'>{decodeURIComponent(filename)}</div>
        {fileSize && <div className='text-muted-foreground text-xs w-[70px]'>{fileSize}</div>}
        <Icon
          name='Ex'
          className='rounded-full bg-foreground text-background text-xs p-px border border-card bg-clip-padding cursor-pointer'
          onClick={removeFile}
        />
      </div>
    </div>
  )
}
