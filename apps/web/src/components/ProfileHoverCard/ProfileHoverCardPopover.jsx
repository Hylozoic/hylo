import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { personUrl, messagePersonUrl } from '@hylo/navigation'
import ProfileCard from 'components/ProfileCard'
import Loading from 'components/Loading'
import useRouteParams from 'hooks/useRouteParams'
import fetchPerson from 'store/actions/fetchPerson'
import personHoverCardQuery from '@graphql/queries/personHoverCardQuery'
import getPerson from 'store/selectors/getPerson'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getRolesForGroup from 'store/selectors/getRolesForGroup'

// After a touch outside closes the card, swallow the click that follows so the tap only
// dismisses the card instead of also activating whatever is under it
const SWALLOW_CLICK_MS = 700

const stopPropagation = e => e.stopPropagation()

/**
 * Popover anchored to an avatar, showing that person's profile card.
 */
export default function ProfileHoverCardPopover ({ personId, anchorRef, currentUser, onClose, onUnavailable, onPointerEnter, onPointerLeave }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { groupSlug } = useRouteParams()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  // Spaces inherit roles from their parent group
  const roleGroupId = group ? (group.parentId || group.id) : null
  const person = useSelector(state => getPerson(state, { personId }))
  const roles = useSelector(state => getRolesForGroup(state, { person: personId, groupId: roleGroupId }))
  const visibleRoles = useMemo(() => roleGroupId ? roles.filter(role => role.common || role.active !== false) : [], [roles, roleGroupId])
  const displayPerson = person?.ref || person
  // Only offer messaging to people the new-message recipient search would offer (never yourself)
  const canMessage = Boolean(displayPerson?.canMessage) && currentUser?.id !== personId

  useEffect(() => {
    // The backend returns no person when the viewer can't see this profile (blocked, no shared group...)
    Promise.resolve(dispatch(fetchPerson(personId, personHoverCardQuery)))
      .then(res => { if (res?.error || (res?.payload?.data && !res.payload.data.person)) onUnavailable() })
      .catch(() => onUnavailable())
  }, [personId])

  const handleViewProfile = useCallback(() => {
    onClose()
    navigate(personUrl(personId, groupSlug))
  }, [personId, groupSlug, navigate, onClose])

  const handleMessage = useCallback(() => {
    onClose()
    navigate(messagePersonUrl(displayPerson))
  }, [displayPerson, navigate, onClose])

  const contentRef = useRef(null)

  // Touch dismissal is handled here rather than by Radix: a touch that starts outside the card
  // and the avatar closes it, and the click that tap would produce is swallowed. Radix's own
  // outside handling is turned off for touch below because on iOS the compatibility events that
  // follow a long press (focus moving to a focusable ancestor, a late pointer/click) would
  // otherwise close the card the moment the finger lifts.
  useEffect(() => {
    let removeSwallow = null
    const handlePointerDown = e => {
      if (e.pointerType === 'mouse') return
      const target = e.target
      if (contentRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      const swallow = clickEvent => {
        clickEvent.preventDefault()
        clickEvent.stopPropagation()
        removeSwallow?.()
      }
      document.addEventListener('click', swallow, true)
      const timer = setTimeout(() => removeSwallow?.(), SWALLOW_CLICK_MS)
      removeSwallow = () => {
        document.removeEventListener('click', swallow, true)
        clearTimeout(timer)
        removeSwallow = null
      }
      onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
    // the swallow listener deliberately outlives the card: it removes itself after the click or timeout
  }, [anchorRef, onClose])

  const handlePointerDownOutside = useCallback(e => {
    const original = e.detail?.originalEvent
    // Touch is handled above; a mouse press on the avatar itself is left to the avatar's click
    if (original?.pointerType !== 'mouse' || anchorRef.current?.contains(original.target)) e.preventDefault()
  }, [anchorRef])

  return (
    <PopoverPrimitive.Root open onOpenChange={isOpen => { if (!isOpen) onClose() }}>
      <PopoverPrimitive.Anchor virtualRef={anchorRef} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side='bottom'
          align='start'
          sideOffset={6}
          collisionPadding={16}
          ref={contentRef}
          onOpenAutoFocus={e => e.preventDefault()}
          onCloseAutoFocus={e => e.preventDefault()}
          // A hover card isn't a focus target: focus moving elsewhere (often a side effect of
          // the touch that opened it) must not close it
          onFocusOutside={e => e.preventDefault()}
          onPointerDownOutside={handlePointerDownOutside}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          // React bubbles events through portals: keep presses and clicks in the card from
          // reaching the avatar's interactive ancestors (post cards, chat rows and their long
          // press, the DM ProfileCardDialog trigger...)
          onClick={stopPropagation}
          onPointerDown={stopPropagation}
          onMouseDown={stopPropagation}
          onTouchStart={stopPropagation}
          onTouchEnd={stopPropagation}
          onContextMenu={stopPropagation}
          // Above the app's modals (z-[1100]) and the popovers inside them (z-[1200])
          className='z-[1250] w-72 max-w-[calc(100vw-32px)] rounded-xl bg-background shadow-2xl overflow-hidden outline-none border border-foreground/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95'
          data-testid='profile-hover-card'
        >
          {displayPerson?.name
            ? (
              <ProfileCard
                person={displayPerson}
                roles={visibleRoles}
                onMessage={canMessage ? handleMessage : undefined}
                onViewProfile={handleViewProfile}
              />
              )
            : <div className='p-8 flex justify-center'><Loading /></div>}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
