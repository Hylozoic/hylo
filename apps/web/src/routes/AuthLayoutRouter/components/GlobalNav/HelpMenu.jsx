import { BookOpen, Compass, Download, Heart, HelpCircle, MessagesSquare, Shield } from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useIntercom } from 'react-use-intercom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'
import ModalDialog from 'components/ModalDialog'
import { useCookieConsent } from 'contexts/CookieConsentContext'
import updateUserSettings from 'store/actions/updateUserSettings'
import { tourCatalog, isTourAvailable } from 'tours/catalog'
import { driveTour, isTourTestMode } from 'tours/useTour'
import { getCookieConsent } from 'util/cookieConsent'
import { cn } from 'util/index'
import { downloadApp, isCompactLayoutDevice, isMobileDevice } from 'util/mobile'
import isWebView from 'util/webView'

/**
 * The "?" help menu: guided tours for the current view, support, the user
 * guide and other links. Shared by the side rail (GlobalNav) and the top bar
 * (TopNav), so both layouts offer the same help.
 */
export default function HelpMenu ({
  currentUser,
  triggerClassName,
  iconClassName = 'w-5 h-5',
  contentSide = 'right',
  contentAlign = 'start'
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { show: showIntercom } = useIntercom()
  const { showPreferences } = useCookieConsent()
  const [open, setOpen] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const compactLayout = isCompactLayoutDevice()
  // The store links only go anywhere on a phone or tablet, so don't offer the
  // download at all on desktop
  const showAppStoreLink = isMobileDevice() && !isWebView()

  // Every tour is listed; ones whose anchors aren't on the current surface are
  // shown disabled. Availability is a DOM question, so it's measured fresh
  // each time the menu opens
  const allTours = useMemo(() => tourCatalog(t), [t])
  const [availableTourIds, setAvailableTourIds] = useState(() => new Set())
  const handleOpenChange = useCallback((nextOpen) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setAvailableTourIds(new Set(allTours.filter(isTourAvailable).map(tour => tour.id)))
    }
  }, [allTours])

  const toursSeen = currentUser?.settings?.toursSeen
  const handleRunTour = useCallback((tour) => {
    setOpen(false)
    // Let the menu finish closing before the overlay measures the anchors
    setTimeout(() => {
      driveTour(tour.steps, {
        // A finished replay counts as seen, same as an organic run
        onDestroyed: () => {
          if (isTourTestMode()) return
          const seenNow = toursSeen || []
          if (!seenNow.includes(tour.id)) {
            dispatch(updateUserSettings({ settings: { toursSeen: [...seenNow, tour.id] } }))
          }
        }
      })
    }, 150)
  }, [toursSeen, dispatch])

  const handleSupportClick = useCallback(() => {
    const consent = getCookieConsent()
    if (consent && consent.support === false) {
      setShowSupportModal(true)
    } else {
      showIntercom()
    }
  }, [showIntercom])

  return (
    <>
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <button type='button' className={triggerClassName} aria-label={t('Help')} data-tour='help' data-testid='help-menu-trigger'>
            <HelpCircle className={iconClassName} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={contentSide}
          align={contentAlign}
          className={cn(
            'z-[200] bg-card',
            compactLayout
              ? 'min-w-[260px] [&_[role=menuitem]]:py-3 [&_[role=menuitem]]:text-base'
              : 'min-w-[260px] sm:min-w-[200px] [&_[role=menuitem]]:py-3 [&_[role=menuitem]]:text-base sm:[&_[role=menuitem]]:py-1.5 sm:[&_[role=menuitem]]:text-sm'
          )}
        >
          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid='take-a-tour'>
              <Compass className='mr-2 h-4 w-4' />
              <span>{t('Take a tour')} ({availableTourIds.size})</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className='z-[200] bg-card'>
              <DropdownMenuLabel className='text-foreground/60 font-normal'>{t('Tours for this view')}</DropdownMenuLabel>
              {allTours.map(tour => (
                <DropdownMenuItem
                  key={tour.id}
                  disabled={!availableTourIds.has(tour.id)}
                  onClick={() => handleRunTour(tour)}
                >
                  {tour.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSupportClick}>
            <MessagesSquare className='mr-2 h-4 w-4' />
            <span>{t('Feedback & Support')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href='https://hylozoic.gitbook.io/hylo/guides/hylo-user-guide' target='_blank' rel='noreferrer' className='text-foreground hover:text-foreground'>
              <BookOpen className='mr-2 h-4 w-4' />
              <span>{t('User Guide')}</span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href='http://hylo.com/terms/' target='_blank' rel='noreferrer' className='text-foreground hover:text-foreground'>
              <Shield className='mr-2 h-4 w-4' />
              <span>{t('Terms & Privacy')}</span>
            </a>
          </DropdownMenuItem>
          {showAppStoreLink && (
            <DropdownMenuItem onClick={downloadApp}>
              <Download className='mr-2 h-4 w-4' />
              <span>{t('Download App')}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <a href='https://opencollective.com/hylo' target='_blank' rel='noreferrer' className='text-foreground hover:text-foreground'>
              <Heart className='mr-2 h-4 w-4' />
              <span>{t('Contribute to Hylo')}</span>
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Outside the menu: selecting Feedback & Support closes it, and this
          dialog has to outlive that close */}
      {showSupportModal && (
        <ModalDialog
          closeModal={() => setShowSupportModal(false)}
          showModalTitle={false}
          submitButtonAction={() => {
            setShowSupportModal(false)
            showPreferences()
          }}
          submitButtonText={t('Edit Cookie Preferences')}
        >
          <div className='p-4'>
            <h2 className='text-xl font-semibold mb-2'>{t('Support Chat Disabled')}</h2>
            <p className='text-foreground/70 mb-4'>
              {t('To use the support chat you need to enable support cookies in your cookie preferences')}
            </p>
            <p className='text-foreground/70 mb-2'>
              {t('Click below to edit your cookie preferences')}
            </p>
          </div>
        </ModalDialog>
      )}
    </>
  )
}
