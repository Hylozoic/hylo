import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
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
export const INVALID_INVITE_TOAST_ID = 'invalid-invite'

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
  const dispatch = useDispatch()
  const signupComplete = useSelector(getSignupComplete)
  const myMemberships = useSelector(getMyMemberships)
  const [redirectTo, setRedirectTo] = useState()
  const { t } = useTranslation()
  const routeParams = useParams()
  const location = useLocation()

  useEffect(() => {
    (async function () {
      const invitationToken = getQuerystringParam('token', location)
      const accessCode = routeParams.accessCode

      try {
        if (every(isEmpty, { invitationToken, accessCode })) {
          throw new Error(t('Please provide either a token query string parameter or accessCode route param'))
        }

        // Check if the invitation is valid and get group info
        const result = await dispatch(checkInvitation({ invitationToken, accessCode }))
        const checkResult = result?.payload?.data?.checkInvitation ?? result?.payload?.getData?.()

        if (!checkResult?.valid) {
          throw new Error(t('Invalid invitation'))
        }

        const { email, groupId, groupSlug, isSpace, parentGroupSlug } = checkResult

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
          setRedirectTo({ to: queryString ? `${spaceDest}?${queryString}` : spaceDest })
          return
        }

        const destinationSlug = (isSpace && parentGroupSlug && !isParentMember)
          ? parentGroupSlug
          : groupSlug

        if (signupComplete) {
          // Redirect authenticated users to the group about page with invitation params.
          // Space invites for non-parent-members go to the parent group's join page.
          setRedirectTo({ to: buildAboutRedirectUrl(destinationSlug, accessCode, invitationToken) })
        } else {
          // Redirect non-authenticated users to signup, then back to group about page
          const returnToUrl = buildAboutRedirectUrl(destinationSlug, accessCode, invitationToken)
          dispatch(setReturnToPath(returnToUrl))
          const inviteEmail = invitationToken && (email || getQuerystringParam('email', location))
          setRedirectTo({ to: SIGNUP_PATH, state: inviteEmail ? { email: inviteEmail } : undefined })
        }
      } catch (error) {
        if (signupComplete) {
          // GroupDetail repeats this toast (same id) from the router state: the Toaster
          // remounts while a group the user is not a member of is loading.
          toast.error(t('Sorry, your invitation to this group is expired, has already been used, or is invalid. Please contact a group Host for another one.'), { id: INVALID_INVITE_TOAST_ID })
          const joinGroupSlug = routeParams.joinGroupSlug || routeParams.groupSlug
          setRedirectTo({
            to: joinGroupSlug ? groupUrl(joinGroupSlug, 'about') : baseUrl({}),
            state: { invalidInvite: true }
          })
        } else {
          setRedirectTo({ to: `${SIGNUP_PATH}?error=invite-expired` })
        }
      }
    })()
  }, [])

  if (redirectTo) return <Navigate to={redirectTo.to} state={redirectTo.state} replace />

  return <><Loading /></>
}
