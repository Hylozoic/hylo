import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Settings, Trash2 } from 'lucide-react'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'

import Avatar from 'components/Avatar'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import useAppearance from 'hooks/useAppearance'
import { DEFAULT_BANNER } from 'store/models/Group'
import { bgImageStyle, cn } from 'util/index'

import CardIconField from './CardIconField'
import GroupViewIcon from './GroupViewIcon'
import {
  viewCardColor,
  inkOn,
  cardGradient,
  cardFieldTint,
  cardHoverRing,
  cardRestRing,
  cardNeutralBg,
  cardBaseColor
} from './viewCardTheme'

const CARD_CLASS = 'group relative flex flex-col overflow-hidden rounded-2xl border transition-all w-[calc(50%-6px)] aspect-[13/11] sm:w-[208px] sm:h-[176px] sm:aspect-auto cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] active:duration-[50ms]'

/** Scheme-dependent card border + resting shadow. */
function cardChrome (isDark) {
  return isDark
    ? 'border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
    : 'border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
}

const cardHoverShadow = (isDark) => isDark ? '0 12px 30px rgba(0,0,0,0.45)' : '0 12px 30px rgba(0,0,0,0.18)'
const cardRestShadow = (isDark) => isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.12)'
const CARD_ACTION_BTN = 'p-1.5 rounded-md bg-background/90 text-foreground/60 hover:text-foreground pointer-events-auto'

/** Edit-mode action row at the bottom of a card: +, gear, delete. */
export function CardEditActions ({ onAddToMenu, onOpenSettings, onDelete, addLabel, settingsLabel, deleteLabel }) {
  return (
    <div className='absolute bottom-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none'>
      {onAddToMenu && (
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation()
            onAddToMenu()
          }}
          className={CARD_ACTION_BTN}
          aria-label={addLabel}
          title={addLabel}
        >
          <Plus className='w-4 h-4' />
        </button>
      )}
      {onOpenSettings && (
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation()
            onOpenSettings()
          }}
          className={CARD_ACTION_BTN}
          aria-label={settingsLabel}
          title={settingsLabel}
        >
          <Settings className='w-4 h-4' />
        </button>
      )}
      {onDelete && (
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={cn(CARD_ACTION_BTN, 'hover:text-destructive')}
          aria-label={deleteLabel}
          title={deleteLabel}
        >
          <Trash2 className='w-4 h-4' />
        </button>
      )}
    </div>
  )
}

/** Card for a GroupView, themed by its postType color. */
export default function GroupViewCard ({ view, isEditing, onAddToMenu, onOpen, onOpenSettings, onDelete }) {
  const { t } = useTranslation()
  const { effectiveColorScheme } = useAppearance()
  const isDark = effectiveColorScheme === 'dark'
  const [hover, setHover] = useState(false)
  const presented = useMemo(() => GroupViewPresenter(view), [view])
  const title = displayNameForView(presented, t)
  const col = viewCardColor(presented)
  const tint = cardFieldTint(col, effectiveColorScheme)
  const ink = inkOn(col)

  const handleOpen = () => {
    if (isEditing) return
    onOpen?.(view)
  }

  return (
    <div
      className={cn(CARD_CLASS, cardChrome(isDark), isEditing && 'cursor-default')}
      style={{
        background: cardGradient(col, effectiveColorScheme),
        // Light mode: border takes the view color — faint at rest, full on hover
        ...(!isDark ? { borderColor: hover && !isEditing ? col : `${col}33` } : {}),
        boxShadow: hover && !isEditing
          ? `${cardHoverShadow(isDark)}, ${cardHoverRing(col)}`
          : `${cardRestShadow(isDark)}, ${cardRestRing(col)}`
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role={isEditing ? undefined : 'button'}
      tabIndex={isEditing ? undefined : 0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (isEditing) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen?.(view)
        }
      }}
    >
      <CardIconField view={presented} tint={tint} w={208} h={176} />
      {/* Settles the pattern toward the card's base color at the bottom, so the label reads clearly */}
      <div className='absolute inset-0 pointer-events-none' style={{ background: `linear-gradient(180deg, transparent 0%, ${cardBaseColor(effectiveColorScheme, 0.5)} 100%)` }} />
      <div className='relative h-full'>
        <div className='absolute inset-0 grid place-items-center'>
          <div
            className='w-14 h-14 rounded-[15px] grid place-items-center shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.35)]'
            style={{ background: col, color: ink, border: `1px solid color-mix(in srgb, ${col} 55%, white)` }}
          >
            <span className='flex items-center justify-center w-[26px] h-[26px] [&>svg]:!w-full [&>svg]:!h-full [&>img]:!w-full [&>img]:!h-full [&>span]:!text-[26px] [&>span]:!leading-none'>
              <GroupViewIcon view={presented} className='!w-[26px] !h-[26px] !mr-0' />
            </span>
          </div>
        </div>
        <div className='absolute left-0 right-0 top-[calc(50%+28px)] bottom-0 flex flex-col items-center justify-center text-center px-3'>
          <h3 className={cn(
            'text-sm font-bold line-clamp-2 m-0 leading-tight',
            isDark ? 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]' : 'text-foreground'
          )}
          >{title}
          </h3>
        </div>
      </div>
      {isEditing && (
        <CardEditActions
          onAddToMenu={onAddToMenu ? () => onAddToMenu(view) : null}
          onOpenSettings={onOpenSettings ? () => onOpenSettings(view) : null}
          onDelete={onDelete ? () => onDelete(view) : null}
          addLabel={t('Add to Menu')}
          settingsLabel={t('Settings')}
          deleteLabel={t('Delete')}
        />
      )}
    </div>
  )
}

/** Card for an off-menu space: banner image + scrim with a frosted-glass tile. */
export function SpaceViewCard ({ space, isEditing, onOpen, onAddToMenu, onOpenSettings, onDelete }) {
  const { t } = useTranslation()
  const { effectiveColorScheme } = useAppearance()
  const isDark = effectiveColorScheme === 'dark'
  const bgImageUrl = (space.bannerUrl && space.bannerUrl !== DEFAULT_BANNER ? space.bannerUrl : null) || space.avatarUrl || null
  const onLightSurface = !isDark && !bgImageUrl

  return (
    <div
      className={cn(CARD_CLASS, cardChrome(isDark), isEditing && 'cursor-default')}
      style={{
        background: cardNeutralBg(effectiveColorScheme),
        // Photo-backed cards read better with a soft white edge than a dark hairline
        ...(!isDark && bgImageUrl ? { borderColor: 'hsl(0 0% 100% / 0.25)' } : {})
      }}
      role={isEditing ? undefined : 'button'}
      tabIndex={isEditing ? undefined : 0}
      onClick={() => {
        if (isEditing) return
        onOpen?.(space)
      }}
      onKeyDown={(e) => {
        if (isEditing) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen?.(space)
        }
      }}
    >
      {bgImageUrl && (
        <>
          <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bgImageUrl)} />
          <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)' }} />
        </>
      )}
      <div className='relative h-full'>
        <div className='absolute inset-0 grid place-items-center'>
          <div
            className={cn('w-14 h-14 rounded-[15px] grid place-items-center shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.35)]', onLightSurface ? 'text-foreground/80' : 'text-white')}
            style={onLightSurface
              ? { background: 'hsl(0 0% 0% / 0.06)', border: '1px solid hsl(0 0% 0% / 0.15)' }
              : { background: 'hsl(0 0% 100% / 0.16)', backdropFilter: 'blur(4px)', border: '1px solid hsl(0 0% 100% / 0.28)' }}
          >
            {space.avatarUrl
              ? <Avatar avatarUrl={space.avatarUrl} name={space.name} medium className='!w-10 !h-10' />
              : space.icon
                ? <LucideIcon name={space.icon} className='w-7 h-7' />
                : <div className={cn('w-7 h-7 rounded-full', onLightSurface ? 'bg-black/15' : 'bg-white/20')} />}
          </div>
        </div>
        <div className='absolute left-0 right-0 top-[calc(50%+28px)] bottom-0 flex flex-col items-center justify-center text-center px-3'>
          <h3 className={cn('text-sm font-bold line-clamp-2 m-0 leading-tight', onLightSurface ? 'text-foreground' : 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]')}>{space.name}</h3>
          {space.isDraft && (
            <span className={cn('text-[10.5px] font-semibold mt-1', onLightSurface ? 'text-foreground/60' : 'text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]')}>{t('Draft')}</span>
          )}
        </div>
      </div>
      {isEditing && (
        <CardEditActions
          onAddToMenu={onAddToMenu ? () => onAddToMenu(space) : null}
          onOpenSettings={onOpenSettings ? () => onOpenSettings(space) : null}
          onDelete={onDelete ? () => onDelete(space) : null}
          addLabel={t('Add to Menu')}
          settingsLabel={t('Settings')}
          deleteLabel={t('Delete Space')}
        />
      )}
    </div>
  )
}
