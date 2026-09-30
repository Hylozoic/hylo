import updateUserSettings from 'store/actions/updateUserSettings'

/**
 * The browser's IANA timezone (for example 'Europe/Berlin'), or null when it can't tell.
 * The mobile app's WebView runs this same code.
 */
export function browserTimezone () {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return typeof timezone === 'string' && timezone.length > 0 && timezone.length <= 64 ? timezone : null
  } catch (e) {
    return null
  }
}

/**
 * D41: saves the browser's timezone on the account, so email digests arrive in the
 * person's local morning. Called with the Me from the login or session check
 * response; saves only when the timezone changed. Never throws: without it, digests
 * keep their old send time.
 */
export function syncTimezone (dispatch, me) {
  if (!me?.id) return null
  const timezone = browserTimezone()
  if (!timezone || me.settings?.timezone === timezone) return null
  return Promise.resolve(dispatch(updateUserSettings({ settings: { timezone } })))
    .catch(() => null)
}
