import React from 'react'
import { Link } from 'lucide-react'
import { cn, bgImageStyle } from 'util/index'

export default function LinkPreview ({ className, title, url, imageUrl, description }) {
  const domain = url && new URL(url).hostname.replace('www.', '')

  return (
    <a className={cn(className)} href={url} target='_blank' rel='noreferrer' aria-label={title}>
      <div className='rounded-lg bg-midground p-2 flex items-center gap-2 shadow-lg text-foreground hover:scale-105 duration-300 hover:shadow-xl'>
        {imageUrl && <div style={bgImageStyle(imageUrl)} className='min-w-16 h-16 bg-cover rounded-lg shadow-lg' />}
        <div className='text-foreground p-2'>
          <div className='text-sm font-bold flex items-center gap-1'><Link className='w-3 h-3' />{title}</div>
          <div className='text-xs line-clamp-2'>{description}</div>
          <div className='text-xs text-foreground/50'>{domain}</div>
        </div>
      </div>
    </a>
  )
}
