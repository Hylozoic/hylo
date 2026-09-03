import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { origin } from '@hylo/navigation'
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
    <div className='fixed top-2 left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-1rem)] max-w-md sm:top-4 sm:max-w-lg pointer-events-none'>
      <div className='relative'>
        {visible.map((banner, index) => {
          const isTop = index === 0
          return (
            <div
              key={banner.id}
              aria-hidden={!isTop}
              className={cn(
                'rounded-lg border shadow-lg transition-all',
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
              <div className='flex items-start gap-2 p-3'>
                <ClickCatcher className='flex-1 min-w-0 text-sm sm:text-base [&_a]:underline'>
                  <HyloHTML html={banner.text} />
                </ClickCatcher>
                <div className='flex items-center gap-1 shrink-0'>
                  {banner.actionText && banner.actionUrl && (
                    <Button
                      variant='secondary'
                      size='sm'
                      onClick={() => handleAction(banner)}
                    >
                      {banner.actionText}
                    </Button>
                  )}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
