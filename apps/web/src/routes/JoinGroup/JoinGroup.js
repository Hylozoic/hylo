import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate, Navigate, useParams } from 'react-router-dom'
import { every, isEmpty } from 'lodash/fp'
import { baseUrl, groupUrl, localSpaceSlug, spaceUrl } from '@hylo/navigation'
import setReturnToPath from 'store/actions/setReturnToPath'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getMyMemberships from 'store/selectors/getMyMemberships'
import { getSignupComplete } from 'store/selectors/getSignupState'
import checkInvitation from 'store/actions/checkInvitation'
import joinSpace from 'store/actions/joinSpace'
import Loading from 'components/Loading'

export const SIGNUP_PATH = '/signup'

/**
 * Build the redirect URL for the group about page with invitation params
 * @param groupSlug {string} the group slug
 * @param accessCode {string|null} the access code if present
 * @param invitationToken {string|null} the invitation token if present
 * @returns {string} the redirect URL with query params
 */
function buildAboutRedirectUrl (groupSlug, accessCode, invitationToken) {
  const baseRedirectUrl = groupUrl(groupSlug, 'about')
  const params = new URLSearchParams()

  if (accessCode) {
    params.set('accessCode', accessCode)
  } else if (invitationToken) {
    params.set('token', invitationToken)
  }

  const queryString = params.toString()
  return queryString ? `${baseRedirectUrl}?${queryString}` : baseRedirectUrl
}

/**
 * Nested space URL so SpaceContent can enter the space (or show SpaceJoinPage
 * if auto-join did not succeed, e.g. a paid space).
 * @param parentGroupSlug {string}
 * @param spaceSlug {string}
 * @returns {string}
 */
function buildSpaceRedirectUrl (parentGroupSlug, spaceSlug) {
  return spaceUrl(parentGroupSlug, localSpaceSlug(parentGroupSlug, spaceSlug))
}

/**
 * JoinGroup route component - validates invitation and redirects.
 * Group invites go to the about page so the user can review and join.
 * Space invites auto-join when the user is already a parent-group member
 * and then open the space. Otherwise they go to the parent group's about page.
 */
export default function JoinGroup (props) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const signupComplete = useSelector(getSignupComplete)
  const myMemberships = useSelector(getMyMemberships)
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

        const { groupId, groupSlug, isSpace, parentGroupSlug } = checkResult

        if (!groupSlug) {
          throw new Error(t('Could not determine group from invitation'))
        }

        const isParentMember = !!(parentGroupSlug && myMemberships.some(m => m.group?.slug === parentGroupSlug))

        if (signupComplete && isSpace && parentGroupSlug && isParentMember) {
          if (groupId) {
            await dispatch(joinSpace(groupId, accessCode, invitationToken)).catch(() => {})
          }
          const spaceDest = buildSpaceRedirectUrl(parentGroupSlug, groupSlug)
          const params = new URLSearchParams()
          if (accessCode) params.set('accessCode', accessCode)
          else if (invitationToken) params.set('token', invitationToken)
          const queryString = params.toString()
          setRedirectTo(queryString ? `${spaceDest}?${queryString}` : spaceDest)
          return
        }

        const destinationSlug = (isSpace && parentGroupSlug && !isParentMember)
          ? parentGroupSlug
          : groupSlug

        if (signupComplete) {
          // Redirect authenticated users to the group about page with invitation params.
          // Space invites for non-parent-members go to the parent group's join page.
          setRedirectTo(buildAboutRedirectUrl(destinationSlug, accessCode, invitationToken))
        } else {
          // Redirect non-authenticated users to signup, then back to group about page
          const returnToUrl = buildAboutRedirectUrl(destinationSlug, accessCode, invitationToken)
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
