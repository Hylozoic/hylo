import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'sonner'
import Button from 'components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'components/ui/dialog'
import { ensureLocationIdIfCoordinate, fetchLocation as fetchLocationAction } from 'components/LocationInput/LocationInput.store'
import { ProfilePhotoPicker } from 'routes/WelcomeWizardRouter/UploadPhoto/UploadPhoto'
import { HomeLocationInput } from 'routes/WelcomeWizardRouter/AddLocation/AddLocation'
import getMe from 'store/selectors/getMe'
import updateUserSettings from 'store/actions/updateUserSettings'
import {
  PROFILE_NUDGE_DISMISSED,
  PROFILE_NUDGE_DONE,
  PROFILE_NUDGE_PENDING,
  getHasOwnPost,
  isMissingPhotoOrLocation,
  isPlaceholderAvatar
} from './profileNudgeState'

// A moment after the post is saved, so the composer can close first
const SHOW_DELAY_MS = 1000

/**
 * Asks once for a photo and a location, after the first post of someone who skipped
 * those welcome steps because they signed up from an invitation (D16). Closing it or
 * choosing Not now remembers the answer in their user settings, as saving does, so it
 * never shows again.
 */
export default function ProfileNudge () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const pending = currentUser?.settings?.profileNudge === PROFILE_NUDGE_PENDING
  const hasOwnPost = useSelector(state => pending && getHasOwnPost(state, currentUser?.id))
  const shouldAsk = pending && hasOwnPost && isMissingPhotoOrLocation(currentUser)

  const [open, setOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [location, setLocation] = useState('')
  const [locationId, setLocationId] = useState(null)
  const answeredRef = useRef(false)

  useEffect(() => {
    if (!shouldAsk || answeredRef.current) return
    const timer = setTimeout(() => setOpen(true), SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [shouldAsk])

  useEffect(() => {
    if (!open || !currentUser) return
    setLocation(currentUser.location || '')
    setLocationId(currentUser.locationObject?.id || null)
  }, [open])

  const fetchLocation = useCallback(loc => dispatch(fetchLocationAction(loc)), [dispatch])

  // If saving the answer fails, the ask stays pending on the server and can come back after a reload
  const answer = useCallback(async (outcome, changes = {}) => {
    answeredRef.current = true
    setOpen(false)
    try {
      const result = await dispatch(updateUserSettings({ ...changes, settings: { profileNudge: outcome } }))
      if (result?.error) throw result.payload
    } catch (error) {
      toast.error(t('There was an error, please try again.'))
    }
  }, [dispatch, t])

  const dismiss = useCallback(() => answer(PROFILE_NUDGE_DISMISSED), [answer])

  const save = useCallback(async () => {
    const changes = {}
    if (avatarUrl) changes.avatarUrl = avatarUrl
    if (location?.trim() && location !== currentUser?.location) {
      changes.location = location
      try {
        changes.locationId = await ensureLocationIdIfCoordinate({ fetchLocation, location, locationId })
      } catch (error) {
        toast.error(t('There was an error, please try again.'))
        return
      }
    }
    return answer(PROFILE_NUDGE_DONE, changes)
  }, [answer, avatarUrl, currentUser?.location, fetchLocation, location, locationId, t])

  if (!currentUser || !pending) return null

  const shownAvatarUrl = avatarUrl || currentUser.avatarUrl
  const canSave = !!avatarUrl || (!!location?.trim() && location !== currentUser.location)

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) dismiss() }}>
      <DialogContent className='max-w-md' data-testid='profile-nudge'>
        <DialogHeader>
          <DialogTitle>{t('Help people recognize you')}</DialogTitle>
          <DialogDescription>
            {t('Add a photo and where you call home, so people in your groups know who they are talking with.')}
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-col items-center gap-6 py-2'>
          {isPlaceholderAvatar(currentUser.avatarUrl) && (
            <ProfilePhotoPicker currentUser={currentUser} avatarUrl={shownAvatarUrl} onUploaded={setAvatarUrl} />
          )}
          {!currentUser.location && (
            <div className='w-full'>
              <HomeLocationInput
                currentUser={currentUser}
                location={location}
                onChange={loc => {
                  setLocation(loc.fullText)
                  setLocationId(loc.id)
                }}
              />
            </div>
          )}
        </div>
        <DialogFooter className='gap-2'>
          <Button variant='outline' onClick={dismiss} data-testid='profile-nudge-not-now'>
            {t('Not now')}
          </Button>
          <Button variant='secondary' onClick={save} disabled={!canSave} data-testid='profile-nudge-save'>
            {t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
