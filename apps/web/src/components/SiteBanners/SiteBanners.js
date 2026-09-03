import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { DateTimeHelpers } from '@hylo/shared'
import { origin } from '@hylo/navigation'
import useAppearance from 'hooks/useAppearance'
import { getLocaleFromLocalStorage } from 'util/locale'
import Button from 'components/ui/button'
import ClickCatcher, { internalPathname } from 'components/ClickCatcher/ClickCatcher'
import HyloHTML from 'components/HyloHTML/HyloHTML'
import { normalizeUserLinkHref } from 'util/url'
import { cn } from 'util/index'
import { fetchSiteBanners, dismissSiteBanner } from 'store/actions/siteBanners'

const TYPE_STYLES = {
  info: 'bg-card border-foreground/10',
  warning: 'bg-accent border-accent-foreground/10',
  alert: 'bg-destructive text-destructive-foreground border-destructive-foreground/10'
}

const MAX_VISIBLE_PEEK = 3

/**
 * Floating deck of site-wide announcement banners. Only the top card is
 * interactive; the rest peek out behind it to hint that more are queued.
 * Dismissing the top card (via the X or the action button) reveals the next.
 */
export default function SiteBanners () {
  const { t } = useTranslation()
  const { effectiveColorScheme } = useAppearance()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [banners, setBanners] = useState([])
  const wasInManagementRef = useRef(location.pathname.startsWith('/management'))

  const loadBanners = useCallback(() => {
    dispatch(fetchSiteBanners()).then(result => {
      const items = result?.payload?.data?.siteBanners
      if (items) setBanners(items)
    })
  }, [dispatch])

  useEffect(() => {
    loadBanners()
  }, [loadBanners])

  // Superadmins compose and publish banners from Management, which never
  // dismisses anything for them, so they'd otherwise have to wait for their
  // next full page load to see how a just-published banner actually looks.
  // Refetch the moment they leave Management so it shows up right away.
  useEffect(() => {
    const isInManagement = location.pathname.startsWith('/management')
    if (wasInManagementRef.current && !isInManagement) {
      loadBanners()
    }
    wasInManagementRef.current = isInManagement
  }, [location.pathname, loadBanners])

  const handleDismiss = useCallback((id) => {
    setBanners(prev => prev.filter(b => b.id !== id))
    dispatch(dismissSiteBanner(id))
  }, [dispatch])

  const handleAction = useCallback((banner) => {
    handleDismiss(banner.id)
    const href = normalizeUserLinkHref(banner.actionUrl)
    const pathname = internalPathname(href, origin())
    if (pathname) {
      navigate(pathname)
    } else {
      window.open(href, '_blank', 'noopener,noreferrer')
    }
  }, [handleDismiss, navigate])

  if (banners.length === 0) return null

  const visible = banners.slice(0, MAX_VISIBLE_PEEK)

  return (
    // Scrim over the whole app: an announcement asks for a moment of full
    // attention, so the content behind is covered until the card is handled
    <div className='fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4'>
      <div className='relative w-full max-w-md sm:max-w-lg'>
        {visible.map((banner, index) => {
          const isTop = index === 0
          // The colored variants (warning orange, alert red) need the light
          // logo in both schemes; the neutral card follows the theme
          const logoSrc = banner.type === 'warning' || banner.type === 'alert' || effectiveColorScheme === 'dark'
            ? '/hylo-logo-light-horizontal.svg'
            : '/hylo-logo-dark-horizontal.svg'
          const createdOn = banner.createdAt
            ? DateTimeHelpers.toDateTime(banner.createdAt, { locale: getLocaleFromLocalStorage() }).toFormat('DD')
            : null
          return (
            <div
              key={banner.id}
              role={isTop ? 'dialog' : undefined}
              aria-modal={isTop || undefined}
              aria-hidden={!isTop}
              className={cn(
                'rounded-xl border shadow-2xl transition-all',
                TYPE_STYLES[banner.type] || TYPE_STYLES.info,
                isTop
                  ? 'relative pointer-events-auto'
                  : cn(
                    'absolute inset-x-0 top-0 pointer-events-none',
                    index === 1 && 'translate-y-[6px] scale-[0.97] opacity-70 -z-10',
                    index === 2 && 'translate-y-[12px] scale-[0.94] opacity-40 -z-20'
                  )
              )}
            >
              <div className='p-4 sm:p-5'>
                {/* Logo and Close oppose each other on the header row */}
                <div className='flex items-center justify-between'>
                  {/* my-0: a global stylesheet gives imgs vertical margins, which
                      inflated this row and pushed the header off the top edge */}
                  <img className='h-5 sm:h-6 my-0' src={logoSrc} alt={t('Hylo logo')} />
                  <div className='flex items-center gap-1 shrink-0'>
                    {isTop && banners.length > 1 && (
                      <span className='text-xs opacity-60 px-1'>{t('+{{count}} more', { count: banners.length - 1 })}</span>
                    )}
                    <button
                      type='button'
                      aria-label={t('Dismiss')}
                      className='p-1 rounded-full opacity-60 hover:opacity-100 transition-opacity'
                      onClick={() => handleDismiss(banner.id)}
                    >
                      <X className='w-4 h-4' />
                    </button>
                  </div>
                </div>
                <ClickCatcher className='mt-5 min-w-0 break-words text-sm sm:text-base [&_a]:underline'>
                  {banner.title && <p className='font-bold text-xl sm:text-2xl mb-0'>{banner.title}</p>}
                  {createdOn && <p className='text-xs opacity-60 mt-1 mb-3'>{createdOn}</p>}
                  <HyloHTML html={banner.text} />
                </ClickCatcher>
                {banner.actionText && banner.actionUrl && (
                  <div className='flex justify-end mt-4'>
                    <Button
                      size='sm'
                      className='bg-selected text-foreground font-bold hover:bg-selected/85'
                      onClick={() => handleAction(banner)}
                    >
                      {banner.actionText}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
