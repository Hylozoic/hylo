import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Link } from 'lucide-react'
import { internalPathname, isStaticPagePath } from 'components/ClickCatcher/ClickCatcher'
import { cn, bgImageStyle } from 'util/index'

/**
 * Renders a link preview card; invalid or missing URLs are not rendered to avoid URL parse crashes (e.g. on mobile Safari).
 * Links to this Hylo site navigate in the app, like links in post text; other links open in a new tab.
 */
export default function LinkPreview ({ className, title, url, imageUrl, description }) {
  if (!url) return null
  let domain = ''
  try {
    const parsed = new URL(url)
    domain = parsed.hostname.replace('www.', '')
  } catch {
    return null
  }

  const card = (
    <div className='rounded-lg bg-card border border-foreground/10 p-2 flex items-center gap-2 shadow-lg text-foreground hover:scale-102 duration-300 hover:shadow-xl'>
      {imageUrl && <div style={bgImageStyle(imageUrl)} className='self-stretch aspect-square min-h-16 shrink-0 bg-cover bg-center rounded-lg shadow-lg' />}
      <div className='text-foreground p-2'>
        <div className='text-sm font-bold flex items-center gap-1'><Link className='w-3 h-3' />{title}</div>
        <div className='text-xs line-clamp-2'>{description}</div>
        <div className='text-xs text-foreground-muted'>{domain}</div>
      </div>
    </div>
  )

  const pathname = internalPathname(url)
  if (pathname && !isStaticPagePath(pathname)) {
    return <RouterLink className={cn(className)} to={pathname} aria-label={title}>{card}</RouterLink>
  }

  return (
    <a className={cn(className)} href={url} target='_blank' rel='noreferrer' aria-label={title}>
      {card}
    </a>
  )
}
