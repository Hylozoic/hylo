import { useEffect } from 'react'
import { useCurrentUser } from 'hooks/useCurrentUser'
import { useCookieConsent } from 'contexts/CookieConsentContext'

/**
 * Component that handles linking cookie consent to users when they log in
 * This component should be rendered in the AuthProvider to automatically
 * link anonymous cookie consent to authenticated users
 */
export default function CookieConsentLinker () {
  const currentUser = useCurrentUser()
  const isAuthenticated = !!currentUser
  const { linkConsentToUser } = useCookieConsent()

  useEffect(() => {
    if (isAuthenticated && currentUser?.id) {
      // Link existing cookie consent to the authenticated user
      linkConsentToUser(currentUser.id).catch(error => {
        console.error('Error linking cookie consent to user:', error)
      })
    }
  }, [isAuthenticated, currentUser?.id, linkConsentToUser])

  // This component doesn't render anything
  return null
}
