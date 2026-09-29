import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useLocation, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { every, isEmpty } from 'lodash/fp'
import { AnalyticsEvents } from '@hylo/shared'
import { baseUrl, groupUrl, localSpaceSlug, spaceUrl } from '@hylo/navigation'
import setReturnToPath from 'store/actions/setReturnToPath'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getMyMemberships from 'store/selectors/getMyMemberships'
import { getSignupComplete } from 'store/selectors/getSignupState'
import checkInvitation from 'store/actions/checkInvitation'
import checkIsGroupViewable from 'store/actions/checkIsGroupViewable'
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
 * Group invites (and members' personal invite links) go to the about page so the user can
 * review and join, whether or not they are signed in yet; an invalid link sends someone
 * not signed in to signup with the invite-expired message. A member's link that can't be
 * used until later says so instead.
 * Space invites auto-join when the user is already a parent-group member
 * and then open the space. Otherwise they go to the parent group's about page.
 */
export default function JoinGroup (props) {
  const dispatch = useDispatch()
  const signupComplete = useSelector(getSignupComplete)
  const myMemberships = useSelector(getMyMemberships)
  const [redirectTo, setRedirectTo] = useState()
  const [tryLater, setTryLater] = useState(false)
  const { t } = useTranslation()
  const routeParams = useParams()
  const location = useLocation()

  const isGroupViewable = async slug => {
    try {
      const result = await dispatch(checkIsGroupViewable(slug))
      return Boolean(result?.payload?.data?.group ?? result?.payload?.getData?.())
    } catch {
      return false
    }
  }

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

        const { email, groupId, groupSlug, isSpace, parentGroupSlug, isMemberLink } = checkResult

        if (!groupSlug) {
          throw new Error(t('Could not determine group from invitation'))
        }

        dispatch(trackAnalyticsEvent(AnalyticsEvents.INVITE_LINK_OPENED, {
          groupId,
          method: invitationToken ? 'token' : isMemberLink ? 'member' : 'code',
          signedIn: signupComplete
        }))

        // A member's invite link whose daily allowance is used up: nobody joins through it for now
        const isGroupMember = myMemberships.some(m => m.group?.slug === groupSlug)
        if (checkResult.tryLater && !isGroupMember) {
          setTryLater(true)
          return
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

        const aboutUrl = buildAboutRedirectUrl(destinationSlug, accessCode, invitationToken)
        if (signupComplete) {
          // Redirect authenticated users to the group about page with invitation params.
          // Space invites for non-parent-members go to the parent group's join page.
          setRedirectTo({ to: aboutUrl })
        } else {
          // People who aren't signed in see what they're invited to first: the group's about
          // page, with who invited them and a Sign up that keeps the invitation. Signing up by
          // any other way still comes back here.
          dispatch(setReturnToPath(aboutUrl))
          const inviteEmail = invitationToken && (email || getQuerystringParam('email', location))
          setRedirectTo({ to: aboutUrl, state: inviteEmail ? { email: inviteEmail } : undefined })
        }
      } catch (error) {
        if (signupComplete) {
          toast.error(t('Sorry, your invitation to this group is expired, has already been used, or is invalid. Please contact a group Host for another one.'), { id: INVALID_INVITE_TOAST_ID })
          const joinGroupSlug = routeParams.joinGroupSlug || routeParams.groupSlug
          // A group the user can't see renders the layout's NotFound page, which drops
          // the toast. For a visible group GroupDetail repeats the toast (same id) from
          // the router state, because the Toaster remounts while the group loads.
          const canSeeGroup = joinGroupSlug && await isGroupViewable(joinGroupSlug)
          setRedirectTo(canSeeGroup
            ? { to: groupUrl(joinGroupSlug, 'about'), state: { invalidInvite: true } }
            : { to: baseUrl({}) })
        } else {
          setRedirectTo({ to: `${SIGNUP_PATH}?error=invite-expired` })
        }
      }
    })()
  }, [])

  if (redirectTo) return <Navigate to={redirectTo.to} state={redirectTo.state} replace />

  if (tryLater) {
    return (
      <div className='flex flex-col items-center justify-center gap-4 min-h-[50vh] p-4 text-center text-foreground' data-testid='invite-try-later'>
        <h1 className='text-xl font-bold m-0'>{t("This invite link can't be used right now")}</h1>
        <p className='m-0 text-foreground/70 max-w-[480px]'>{t('It has been used as many times as it can be today. Please try again later.')}</p>
        <Link to='/' className='text-accent underline hover:no-underline'>{t('Home')}</Link>
      </div>
    )
  }

  return <><Loading /></>
}
