import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import ProfileCard from 'components/ProfileCard'
import Loading from 'components/Loading'
import fetchPerson from 'store/actions/fetchPerson'
import personHoverCardQuery from '@graphql/queries/personHoverCardQuery'
import getPerson from 'store/selectors/getPerson'
import getMe from 'store/selectors/getMe'
import { personUrl, messagePersonUrl, messagesUrl } from '@hylo/navigation'
import { cn } from 'util/index'

const PULL_THRESHOLD = 100

export default function ProfileCardDialog ({ personId, children, className }) {
  const [open, setOpen] = useState(false)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const person = useSelector(state => getPerson(state, { personId }))
  const currentUser = useSelector(getMe)
  const isCurrentUser = currentUser && currentUser.id === personId

  const contentRef = useRef(null)
  const touchStartY = useRef(null)
  const isDraggingDown = useRef(false)
  const onCloseRef = useRef(null)

  const portalContainer = useMemo(() => document.getElementById('center-column-container'), [])

  const handleClose = useCallback(() => setOpen(false), [])
  onCloseRef.current = handleClose

  useEffect(() => {
    if (open && personId) {
      dispatch(fetchPerson(personId, personHoverCardQuery))
    }
  }, [open, personId])

  // Touch-only pull-to-dismiss (mobile), matching PostDetail pattern
  useEffect(() => {
    if (!open) return
    const el = contentRef.current
    if (!el) return

    const overlay = el.closest('.ProfileCardDialog-Overlay')

    const resetStyles = () => {
      el.style.transform = ''
      el.style.opacity = ''
      el.style.borderRadius = ''
      el.style.willChange = ''
      if (overlay) {
        overlay.style.backgroundColor = ''
        overlay.style.backdropFilter = ''
      }
    }

    const handleTouchStart = (e) => {
      touchStartY.current = e.touches[0].clientY
      isDraggingDown.current = false
      el.style.transition = 'none'
    }

    const handleTouchMove = (e) => {
      if (touchStartY.current === null) return

      const currentY = e.touches[0].clientY
      const rawDelta = currentY - touchStartY.current

      if (rawDelta > 0) {
        e.preventDefault()
        isDraggingDown.current = true
        const dampened = rawDelta * 0.45
        const progress = Math.min(dampened / PULL_THRESHOLD, 1.5)
        const opacity = Math.max(1 - progress * 0.4, 0.3)
        const scale = Math.max(1 - progress * 0.04, 0.92)

        el.style.transform = `translate(-50%, calc(-50% + ${dampened}px)) scale(${scale})`
        el.style.opacity = opacity
        el.style.transformOrigin = 'top center'
        el.style.willChange = 'transform, opacity'

        if (overlay) {
          const overlayOpacity = Math.max(1 - progress * 0.6, 0.1)
          overlay.style.backgroundColor = `rgba(0, 0, 0, ${overlayOpacity * 0.5})`
          overlay.style.backdropFilter = `blur(${Math.max(12 - progress * 8, 0)}px)`
        }
      } else if (isDraggingDown.current) {
        isDraggingDown.current = false
        resetStyles()
      }
    }

    const handleTouchEnd = (e) => {
      if (touchStartY.current === null) return

      if (!isDraggingDown.current) {
        touchStartY.current = null
        isDraggingDown.current = false
        return
      }

      const touchEndY = e.changedTouches[0].clientY
      const rawDelta = touchEndY - touchStartY.current
      const dampened = rawDelta * 0.45

      if (dampened >= PULL_THRESHOLD) {
        el.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out'
        el.style.transform = 'translate(-50%, calc(-50% + 60vh)) scale(0.9)'
        el.style.opacity = '0'
        if (overlay) {
          overlay.style.transition = 'background-color 0.25s ease-out, backdrop-filter 0.25s ease-out'
          overlay.style.backgroundColor = 'transparent'
          overlay.style.backdropFilter = 'blur(0px)'
        }
        setTimeout(() => onCloseRef.current(), 200)
      } else {
        el.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.3s ease'
        if (overlay) {
          overlay.style.transition = 'background-color 0.3s ease, backdrop-filter 0.3s ease'
        }
        resetStyles()
      }

      touchStartY.current = null
      isDraggingDown.current = false
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      resetStyles()
      el.style.transition = ''
      if (overlay) overlay.style.transition = ''
    }
  }, [open, !!person])

  const handleViewProfile = useCallback(() => {
    setOpen(false)
    navigate(personUrl(personId))
  }, [personId, navigate])

  const handleMessage = useCallback(() => {
    setOpen(false)
    if (isCurrentUser) {
      navigate(messagesUrl())
    } else if (person) {
      navigate(messagePersonUrl(person.ref || person))
    }
  }, [person, isCurrentUser, navigate])

  const handleTriggerClick = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
  }, [])

  const displayPerson = person?.ref || person

  return (
    <>
      <span
        onClick={handleTriggerClick}
        className={cn('cursor-pointer', className)}
        role='button'
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTriggerClick(e) }}
      >
        {children}
      </span>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal container={portalContainer}>
          <Dialog.Overlay className='ProfileCardDialog-Overlay bg-darkening/50 dark:bg-darkening/90 absolute left-0 right-0 bottom-0 grid place-items-center overflow-y-auto z-[100] h-full backdrop-blur-sm p-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-200'>
            <Dialog.Content
              ref={contentRef}
              className='ProfileCardDialog-Content w-full max-w-sm bg-background rounded-xl z-[41] outline-none overflow-hidden absolute left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-4 duration-300'
            >
              {/* Close button - positioned over the banner */}
              <Dialog.Close className='absolute right-3 top-3 z-20 rounded-full p-1.5 bg-black/40 hover:bg-black/60 text-white transition-all cursor-pointer border-none'>
                <X className='h-4 w-4' />
                <span className='sr-only'>Close</span>
              </Dialog.Close>

              <Dialog.Title className='sr-only'>
                {displayPerson?.name ? t('{{name}}\'s Profile', { name: displayPerson.name }) : t('Profile')}
              </Dialog.Title>
              <Dialog.Description className='sr-only'>{t('Profile Card')}</Dialog.Description>

              {!displayPerson?.name
                ? (
                  <div className='p-8 flex justify-center'>
                    <Loading />
                  </div>
                  )
                : (
                  <ProfileCard
                    person={displayPerson}
                    showDetails
                    onMessage={!isCurrentUser && displayPerson.canMessage ? handleMessage : undefined}
                    onViewProfile={handleViewProfile}
                  />
                  )}
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
