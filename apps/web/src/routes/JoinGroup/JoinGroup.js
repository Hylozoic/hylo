import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate, Navigate, useParams } from 'react-router-dom'
import { every, isEmpty } from 'lodash/fp'
import { baseUrl, groupUrl } from '@hylo/navigation'
import setReturnToPath from 'store/actions/setReturnToPath'
import { DEFAULT_CHAT_TOPIC } from 'store/models/Group'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { getSignupComplete } from 'store/selectors/getAuthState'
import acceptInvitation from 'store/actions/acceptInvitation'
import checkInvitation from 'store/actions/checkInvitation'
import Loading from 'components/Loading'

export const SIGNUP_PATH = '/signup'

export default function JoinGroup (props) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const signupComplete = useSelector(getSignupComplete)
  const [redirectTo, setRedirectTo] = useState()
  const { t } = useTranslation()
  const routeParams = useParams()
  const location = useLocation()

  // This is used in iFrames where we want people to join a group and go directly to a specific page (for OpenTEAM coffee shop for example)
  const redirectToView = getQuerystringParam('redirectToView', location)

  useEffect(() => {
    (async function () {
      try {
        const invitationTokenAndCode = {
          invitationToken: getQuerystringParam('token', location),
          accessCode: routeParams.accessCode
        }
        if (every(isEmpty, invitationTokenAndCode)) {
          throw new Error(t('Please provide either a token query string parameter or accessCode route param'))
        }

        if (signupComplete) {
          const result = await dispatch(acceptInvitation(invitationTokenAndCode))
          const newMembership = result?.payload?.getData()?.membership
          const groupSlug = newMembership?.group?.slug

          if (groupSlug) {
            setRedirectTo(groupUrl(groupSlug, redirectToView || `chat/${DEFAULT_CHAT_TOPIC}`))
          } else {
            throw new Error(t('Join group was unsuccessful'))
          }
        } else {
          const result = await dispatch(checkInvitation(invitationTokenAndCode))
          const isValidInvite = result?.payload?.getData()?.valid

          if (isValidInvite) {
            dispatch(setReturnToPath(location.pathname + location.search))
            setRedirectTo(SIGNUP_PATH)
          } else {
            setRedirectTo(`${SIGNUP_PATH}?error=invite-expired`)
          }
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
