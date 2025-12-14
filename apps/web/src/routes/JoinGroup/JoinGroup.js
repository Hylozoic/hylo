import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate, Navigate, useParams } from 'react-router-dom'
import { every, isEmpty } from 'lodash/fp'
import { baseUrl, groupUrl } from '@hylo/navigation'
import setReturnToPath from 'store/actions/setReturnToPath'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { getSignupComplete } from 'store/selectors/getAuthState'
import checkInvitation from 'store/actions/checkInvitation'
import Loading from 'components/Loading'

export const SIGNUP_PATH = '/signup'

/**
 * Build the redirect URL for the group about page with invitation params
 * @param groupSlug {string} the group slug
 * @param accessCode {string|null} the access code if present
 * @param invitationToken {string|null} the invitation token if present
 * @param email {string|null} the email from the invitation
 * @returns {string} the redirect URL with query params
 */
function buildAboutRedirectUrl (groupSlug, accessCode, invitationToken, email) {
  const baseRedirectUrl = groupUrl(groupSlug, 'about')
  const params = new URLSearchParams()

  if (accessCode) {
    params.set('accessCode', accessCode)
  } else if (invitationToken) {
    params.set('token', invitationToken)
    if (email) {
      params.set('email', email)
    }
  }

  const queryString = params.toString()
  return queryString ? `${baseRedirectUrl}?${queryString}` : baseRedirectUrl
}

/**
 * JoinGroup route component - validates invitation and redirects to group about page
 * Instead of auto-joining, this redirects users to the group's about page
 * where they can review group details and join explicitly
 */
export default function JoinGroup (props) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const signupComplete = useSelector(getSignupComplete)
  const [redirectTo, setRedirectTo] = useState()
  const { t } = useTranslation()
  const routeParams = useParams()
  const location = useLocation()

  useEffect(() => {
    (async function () {
      try {
        const invitationToken = getQuerystringParam('token', location)
        const accessCode = routeParams.accessCode

        if (every(isEmpty, { invitationToken, accessCode })) {
          throw new Error(t('Please provide either a token query string parameter or accessCode route param'))
        }

        // Check if the invitation is valid and get group info
        const result = await dispatch(checkInvitation({ invitationToken, accessCode }))
        const checkResult = result?.payload?.getData()

        if (!checkResult?.valid) {
          throw new Error(t('Invalid invitation'))
        }

        const { groupSlug, email } = checkResult

        if (!groupSlug) {
          throw new Error(t('Could not determine group from invitation'))
        }

        if (signupComplete) {
          // Redirect authenticated users to the group about page with invitation params
          setRedirectTo(buildAboutRedirectUrl(groupSlug, accessCode, invitationToken, email))
        } else {
          // Redirect non-authenticated users to signup, then back to group about page
          const returnToUrl = buildAboutRedirectUrl(groupSlug, accessCode, invitationToken, email)
          dispatch(setReturnToPath(returnToUrl))
          setRedirectTo(SIGNUP_PATH)
        }
      } catch (error) {
        window.alert(t('Sorry, your invitation to this group is expired, has already been used, or is invalid. Please contact a group Host for another one.'))
        navigate(baseUrl({}))
      }
    })()
  }, [])

  if (redirectTo) return <Navigate to={redirectTo} replace />

  return <><Loading /></>
}
