import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { isSandboxMode } from 'sandbox/isSandbox'

export const RECORD_EMAIL_CLICK = 'RECORD_EMAIL_CLICK'

// The tags Hylo's emails add to their links: kind of email, recipient id and group name
export const EMAIL_CLICK_PARAMS = ['ctt', 'cti', 'ctcn']

const EMAIL_TYPE_PATTERN = /^[a-z0-9_]{1,64}$/

export function recordEmailClick (emailType) {
  return {
    type: RECORD_EMAIL_CLICK,
    graphql: {
      query: `
        mutation RecordEmailClick ($emailType: String!) {
          recordEmailClick(emailType: $emailType) {
            success
          }
        }
      `,
      variables: { emailType }
    }
  }
}

export function hasEmailClickParams (search) {
  const params = new URLSearchParams(search || '')
  return EMAIL_CLICK_PARAMS.some(name => params.has(name))
}

/**
 * The query string without the email tags, keeping every other parameter
 * (login tokens, action=unfollow, unsubscribe settings) as it was.
 */
export function stripEmailClickParams (search) {
  const params = new URLSearchParams(search || '')
  EMAIL_CLICK_PARAMS.forEach(name => params.delete(name))
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}

/**
 * Mounted once, in RootRouter, so it runs on public and signed-in pages. When
 * the address has an email's tags, records one click in Hylo's own database
 * (the kind of email; the server takes the person from the session, never from
 * the link, and nothing goes to Mixpanel), then removes just those tags from
 * the address. It strips them again if they come back (for example after
 * signing in to reach the linked page) without recording a second click.
 */
export default function useEmailClickthrough () {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const recorded = useRef(false)

  useEffect(() => {
    if (!hasEmailClickParams(location.search)) return

    const emailType = new URLSearchParams(location.search).get('ctt')
    if (!recorded.current && !isSandboxMode() && EMAIL_TYPE_PATTERN.test(emailType || '')) {
      recorded.current = true
      Promise.resolve(dispatch(recordEmailClick(emailType))).catch(() => {})
    }

    navigate({
      pathname: location.pathname,
      search: stripEmailClickParams(location.search),
      hash: location.hash
    }, { replace: true, state: location.state })
  }, [location.search])
}
