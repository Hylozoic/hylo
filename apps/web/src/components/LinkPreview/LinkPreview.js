import React from 'react'
import { Link } from 'lucide-react'
import { cn, bgImageStyle } from 'util/index'

export default function LinkPreview ({ className, title, url, imageUrl, description }) {
  const domain = url && new URL(url).hostname.replace('www.', '')

  return (
    <a className={cn(className)} href={url} target='_blank' rel='noreferrer' aria-label={title}>
      <div className='border-2 border-foreground/20 rounded-lg overflow-hidden flex items-center'>
        {imageUrl && <div style={bgImageStyle(imageUrl)} className='w-16 h-16' />}
        <div className='text-foreground p-2'>
          <div className='text-sm font-bold flex items-center gap-1'><Link className='w-3 h-3' />{title}</div>
          <div className='text-xs'>{description}</div>
          <div className='text-xs text-foreground/50'>{domain}</div>
        </div>
      </div>
    </a>
  )
}
