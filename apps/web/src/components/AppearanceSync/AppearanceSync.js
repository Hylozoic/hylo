import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import useAppearance from 'hooks/useAppearance'
import getMe from 'store/selectors/getMe'
import updateUserSettings from 'store/actions/updateUserSettings'
import {
  applyAppearanceToDocument,
  buildLegacyAppearanceMigration,
  getAppearanceFromSettings
} from 'util/appearance'

/**
 * Applies the user's appearance settings to the document and migrates
 * any leftover localStorage appearance prefs into user.settings once.
 */
export default function AppearanceSync () {
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const { theme } = getAppearanceFromSettings(currentUser?.settings)
  const { effectiveColorScheme } = useAppearance()
  const migratedForUserRef = useRef(null)

  useEffect(() => {
    applyAppearanceToDocument(theme, effectiveColorScheme)
  }, [theme, effectiveColorScheme])

  useEffect(() => {
    if (!currentUser?.id) return
    if (migratedForUserRef.current === currentUser.id) return

    migratedForUserRef.current = currentUser.id
    const patch = buildLegacyAppearanceMigration(currentUser.settings)
    if (patch) {
      dispatch(updateUserSettings({ settings: patch }))
    }
  }, [currentUser?.id, currentUser?.settings, dispatch])

  return null
}
