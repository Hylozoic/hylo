import React, { createContext, useContext, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ExternalLink, MessageCircle } from 'lucide-react'
import { sanitizeDesignedView } from '@hylo/shared'
import { groupUrl, personUrl, postUrl } from '@hylo/navigation'
import RoundImage from 'components/RoundImage'
import { cn } from 'util/index'
import DesignedCanvas from './DesignedCanvas'
import DesignedPostPart from './DesignedPostPart'
import useDesignedViewBlockData from './useDesignedViewBlockData'

/**
 * Draws a designed view: a group page stored as a list of building blocks (see
 * DesignedViewHelpers in @hylo/shared). Every block is drawn with Hylo's own
 * markup and the group's theme tokens; the stored data never carries HTML or
 * styles. The posts, events and members blocks load the group's live content.
 */

// How to link to a post. The page that shows a designed view passes a link that opens the
// post in a dialog over the page; without one, posts open on their own page.
const PostLinkContext = createContext(null)

function usePostLink (groupSlug) {
  const postUrlFor = useContext(PostLinkContext)
  return postId => postUrlFor ? postUrlFor(postId) : postUrl(postId, { groupSlug })
}

// Where each button destination leads inside the group
const DESTINATION_PATHS = {
  stream: 'all',
  events: 'events',
  members: 'members',
  about: 'about',
  discussions: 'discussions',
  projects: 'projects',
  resources: 'resources',
  map: 'map'
}

const CALLOUT_TONES = {
  accent: 'border-accent/50 bg-accent/10',
  primary: 'border-primary/50 bg-primary/10',
  muted: 'border-foreground/15 bg-muted/50'
}

const HERO_HEIGHTS = {
  short: 'min-h-[160px]',
  medium: 'min-h-[260px]',
  tall: 'min-h-[380px]'
}

const HEADING_CLASSES = {
  1: 'text-3xl font-bold m-0',
  2: 'text-xl font-bold m-0 mt-2',
  3: 'text-base font-bold m-0 mt-1'
}

function BlockTitle ({ children }) {
  if (!children) return null
  return <h3 className='text-sm font-bold uppercase tracking-wide text-foreground/60 m-0 mb-2'>{children}</h3>
}

function ListState ({ loading, error, empty, emptyText }) {
  const { t } = useTranslation()
  if (loading) return <p className='text-sm text-foreground/50 m-0' role='status'>{t('Loading...')}</p>
  if (error) return <p className='text-sm text-destructive m-0'>{t('This list could not be loaded.')}</p>
  if (empty) return <p className='text-sm text-foreground/50 m-0'>{emptyText}</p>
  return null
}

function formatWhen (iso, language) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(language, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function PostRow ({ post, groupSlug, card }) {
  const { t } = useTranslation()
  const postLink = usePostLink(groupSlug)
  return (
    <Link
      to={postLink(post.id)}
      className={cn(
        'flex items-center gap-3 text-foreground hover:text-foreground no-underline',
        card
          ? 'rounded-lg border-2 border-foreground/20 hover:border-foreground/50 bg-card text-card-foreground p-3'
          : 'rounded-md border-2 border-transparent hover:border-foreground/20 px-2 py-1.5'
      )}
    >
      <RoundImage url={post.creator?.avatarUrl} small className='w-8 h-8 shrink-0' />
      <span className='min-w-0 flex-1'>
        <span className='block font-bold truncate'>{post.title || t('Untitled')}</span>
        <span className='block text-xs text-foreground/60 truncate'>
          {post.creator?.name}
          {post.type ? ` · ${t(post.type)}` : ''}
        </span>
      </span>
      {post.commentsTotal > 0 && (
        <span className='flex items-center gap-1 text-xs text-foreground/60 shrink-0'>
          <MessageCircle className='w-3.5 h-3.5' />{post.commentsTotal}
        </span>
      )}
    </Link>
  )
}

function PostsBlock ({ block, groupSlug }) {
  const { t } = useTranslation()
  const { items, loading, error } = useDesignedViewBlockData(groupSlug, block)
  const cards = block.layout === 'cards'
  return (
    <section data-block='posts'>
      <BlockTitle>{block.title}</BlockTitle>
      <ListState loading={loading} error={error} empty={items.length === 0} emptyText={t('Nothing here yet.')} />
      <div className={cn(cards ? 'grid gap-2 grid-cols-1 sm:grid-cols-2' : 'flex flex-col')}>
        {items.map(post => <PostRow key={post.id} post={post} groupSlug={groupSlug} card={cards} />)}
      </div>
    </section>
  )
}

function EventsBlock ({ block, groupSlug }) {
  const { t, i18n } = useTranslation()
  const { items, loading, error } = useDesignedViewBlockData(groupSlug, block)
  const postLink = usePostLink(groupSlug)
  return (
    <section data-block='events'>
      <BlockTitle>{block.title}</BlockTitle>
      <ListState loading={loading} error={error} empty={items.length === 0} emptyText={t('No upcoming events.')} />
      <div className='flex flex-col gap-2'>
        {items.map(event => (
          <Link
            key={event.id}
            to={postLink(event.id)}
            className='flex items-start gap-3 rounded-lg border-2 border-foreground/20 hover:border-foreground/50 bg-card text-card-foreground hover:text-card-foreground no-underline p-3'
          >
            <CalendarDays className='w-5 h-5 mt-0.5 shrink-0 text-accent' />
            <span className='min-w-0'>
              <span className='block font-bold truncate'>{event.title || t('Untitled')}</span>
              <span className='block text-xs text-foreground/60 truncate'>
                {formatWhen(event.startTime, i18n.language)}
                {event.location ? ` · ${event.location}` : ''}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function MembersBlock ({ block, groupSlug }) {
  const { t } = useTranslation()
  const { items, loading, error } = useDesignedViewBlockData(groupSlug, block)
  return (
    <section data-block='members'>
      <BlockTitle>{block.title}</BlockTitle>
      <ListState loading={loading} error={error} empty={items.length === 0} emptyText={t('No members to show.')} />
      <div className='grid gap-2 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]'>
        {items.map(person => (
          <Link
            key={person.id}
            to={personUrl(person.id, groupSlug)}
            className='flex items-center gap-2 rounded-lg border-2 border-transparent hover:border-foreground/20 text-foreground hover:text-foreground no-underline p-1.5 min-w-0'
          >
            <RoundImage url={person.avatarUrl} small className='w-8 h-8 shrink-0' />
            <span className='min-w-0'>
              <span className='block text-sm font-bold truncate'>{person.name}</span>
              {person.tagline && <span className='block text-xs text-foreground/60 truncate'>{person.tagline}</span>}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function ButtonBlock ({ block, groupSlug }) {
  const className = 'inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground hover:text-primary-foreground border-2 border-transparent px-4 py-2 text-sm font-bold no-underline'
  if (block.destination === 'url') {
    return (
      <div data-block='button'>
        <a href={block.url} target='_blank' rel='noopener noreferrer' className={className}>
          {block.label}<ExternalLink className='w-3.5 h-3.5' />
        </a>
      </div>
    )
  }
  return (
    <div data-block='button'>
      <Link to={groupUrl(groupSlug, DESTINATION_PATHS[block.destination] || 'all')} className={className}>{block.label}</Link>
    </div>
  )
}

// A banner image with its title over a dark scrim, so the text stays readable on any picture
function HeroBlock ({ block }) {
  const centered = block.align === 'center'
  return (
    <div
      data-block='hero'
      className={cn('relative overflow-hidden rounded-xl bg-darkening flex flex-col justify-end', HERO_HEIGHTS[block.height])}
    >
      <img src={block.imageUrl} alt='' className='absolute inset-0 w-full h-full object-cover m-0' />
      {(block.title || block.subtitle) && (
        <div className={cn('relative bg-gradient-to-t from-black/75 via-black/45 to-transparent p-6 pt-16', centered && 'text-center')}>
          {block.title && <h1 className='text-3xl sm:text-4xl font-bold m-0 text-white'>{block.title}</h1>}
          {block.subtitle && <p className='m-0 mt-1 text-base text-white/90 whitespace-pre-line'>{block.subtitle}</p>}
        </div>
      )}
    </div>
  )
}

function ImageBlock ({ block }) {
  return (
    <figure data-block='image' className='m-0'>
      <img src={block.url} alt={block.alt || ''} loading='lazy' className='block w-full h-auto m-0 rounded-lg border-2 border-foreground/10' />
      {block.caption && <figcaption className='text-xs text-foreground/60 mt-1'>{block.caption}</figcaption>}
    </figure>
  )
}

function Block ({ block, groupSlug }) {
  switch (block.type) {
    case 'hero':
      return <HeroBlock block={block} />
    case 'image':
      return <ImageBlock block={block} />
    case 'heading': {
      const Tag = `h${block.level}`
      return <Tag data-block='heading' className={HEADING_CLASSES[block.level]}>{block.text}</Tag>
    }
    case 'text':
      return <p data-block='text' className='m-0 whitespace-pre-line leading-relaxed'>{block.text}</p>
    case 'callout':
      return (
        <div data-block='callout' className={cn('rounded-lg border-2 p-4', CALLOUT_TONES[block.tone])}>
          {block.title && <p className='font-bold m-0 mb-1'>{block.title}</p>}
          <p className='m-0 whitespace-pre-line'>{block.text}</p>
        </div>
      )
    case 'posts':
      return <PostsBlock block={block} groupSlug={groupSlug} />
    case 'events':
      return <EventsBlock block={block} groupSlug={groupSlug} />
    case 'members':
      return <MembersBlock block={block} groupSlug={groupSlug} />
    case 'postPart':
      return <DesignedPostPart block={block} groupSlug={groupSlug} />
    case 'button':
      return <ButtonBlock block={block} groupSlug={groupSlug} />
    case 'divider':
      return <hr data-block='divider' className='border-0 border-t-2 border-foreground/10 m-0' />
    case 'columns':
      return (
        <div
          data-block='columns'
          className={cn('grid gap-6 grid-cols-1', block.columns.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3')}
        >
          {block.columns.map((column, index) => (
            <div key={index} className='flex flex-col gap-4 min-w-0'>
              {column.map((inner, innerIndex) => <Block key={innerIndex} block={inner} groupSlug={groupSlug} />)}
            </div>
          ))}
        </div>
      )
    case 'canvas':
      return (
        <DesignedCanvas
          block={block}
          renderBlock={(inner, index) => <Block key={index} block={inner} groupSlug={groupSlug} />}
        />
      )
    default:
      return null
  }
}

export default function DesignedView ({ design, groupSlug, className, postUrlFor = null }) {
  const { t } = useTranslation()
  const view = useMemo(() => sanitizeDesignedView(design), [design])

  // A page with a canvas gives the canvas the whole view, edge to edge; ordinary pages keep a
  // comfortable reading width with padding around them
  const hasCanvas = !!view?.blocks.some(block => block.type === 'canvas')

  if (!view) {
    return <p className='text-foreground/60 p-4' data-testid='designed-view-empty'>{t('This page has no content yet')}</p>
  }

  return (
    <PostLinkContext.Provider value={postUrlFor}>
      <div className={cn('w-full', className)} data-testid='designed-view'>
        {hasCanvas
          ? (
            <div className='flex flex-col w-full text-foreground'>
              {view.blocks.map((block, index) => block.type === 'canvas'
                ? <DesignedCanvas key={index} block={block} fill renderBlock={(inner, innerIndex) => <Block key={innerIndex} block={inner} groupSlug={groupSlug} />} />
                : <div key={index} className='px-4 py-2'><Block block={block} groupSlug={groupSlug} /></div>)}
            </div>
            )
          : (
            <div className='flex flex-col gap-4 w-full max-w-[960px] mx-auto p-4 text-foreground'>
              {view.blocks.map((block, index) => <Block key={index} block={block} groupSlug={groupSlug} />)}
            </div>
            )}
      </div>
    </PostLinkContext.Provider>
  )
}
