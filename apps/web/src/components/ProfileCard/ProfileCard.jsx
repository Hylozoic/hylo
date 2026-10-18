import React from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, ExternalLink, MapPin } from 'lucide-react'
import RoundImage from 'components/RoundImage'
import { cn } from 'util/index'

const BUTTON_CLASS = 'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-foreground/10 hover:bg-foreground/20 text-foreground text-sm font-medium transition-all cursor-pointer border-none'

/**
 * Summary card for a person: banner, avatar, name, tagline, their roles in the
 * current group and buttons to message them or open their full profile.
 * Shared by the click-to-open ProfileCardDialog and the avatar ProfileHoverCard.
 *
 * Pass `roles` only when there is a group in context; omit `onMessage` to hide
 * the message button (own card, or a viewer who can't message).
 */
export default function ProfileCard ({ person, roles = [], showDetails = false, onMessage, onViewProfile, className }) {
  const { t } = useTranslation()

  return (
    <div className={cn('flex flex-col', className)} data-testid='profile-card'>
      <div className='relative h-28 bg-darkening/80 overflow-hidden'>
        <div
          className='absolute inset-0 bg-cover bg-center opacity-70'
          style={{ backgroundImage: `url(${person.bannerUrl || '/default-user-banner.svg'})` }}
          data-testid='profile-card-banner'
        />
        <div className='absolute inset-0 bg-gradient-to-b from-transparent to-black/60' />
      </div>

      <div className='flex flex-col items-center -mt-10 relative z-10 px-4'>
        <RoundImage url={person.avatarUrl} className='shadow-xl' large />
        <h2 className='text-foreground text-lg font-bold mt-2 mb-0 text-center'>{person.name}</h2>
        {person.tagline && (
          <p className='text-foreground/70 text-sm text-center mt-1 mb-0'>{person.tagline}</p>
        )}
        {showDetails && person.location && (
          <div className='flex items-center gap-1 text-foreground/50 text-xs mt-1'>
            <MapPin className='w-3 h-3' />
            <span>{person.location.replace(', United States', '')}</span>
          </div>
        )}
      </div>

      {roles.length > 0 && (
        <div className='flex flex-wrap justify-center gap-1 px-4 mt-3' data-testid='profile-card-roles'>
          {roles.map(role => (
            <span
              key={`${role.common ? 'c' : 'g'}-${role.id}`}
              className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-foreground/10 border border-foreground/15 text-foreground'
            >
              {role.emoji && <span aria-hidden>{role.emoji}</span>}
              <span>{role.name}</span>
            </span>
          ))}
        </div>
      )}

      {showDetails && person.bio && (
        <div className='px-4 mt-3'>
          <p className='text-foreground/70 text-sm text-center line-clamp-3 m-0'>{person.bio.replace(/<[^>]*>/g, '')}</p>
        </div>
      )}

      <div className='flex gap-2 p-4'>
        {onMessage && (
          <button type='button' onClick={onMessage} className={BUTTON_CLASS}>
            <MessageSquare className='w-4 h-4' />
            {t('Message')}
          </button>
        )}
        <button type='button' onClick={onViewProfile} className={BUTTON_CLASS}>
          <ExternalLink className='w-4 h-4' />
          {t('View Profile')}
        </button>
      </div>
    </div>
  )
}
