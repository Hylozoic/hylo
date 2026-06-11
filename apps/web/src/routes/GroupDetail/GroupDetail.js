import { keyBy } from 'lodash'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Tooltip } from 'react-tooltip'
// import PropTypes from 'prop-types'
import { useSelector, useDispatch } from 'react-redux'
import { TextHelpers, WebViewMessageTypes } from '@hylo/shared'
import Avatar from 'components/Avatar'
import BadgeEmoji from 'components/BadgeEmoji'
import ClickCatcher from 'components/ClickCatcher'
import FarmGroupDetailBody from 'components/FarmGroupDetailBody'
import GroupAboutVideoEmbed from 'components/GroupAboutVideoEmbed'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import SocketSubscriber from 'components/SocketSubscriber'
import Loading from 'components/Loading'
import NotFound from 'components/NotFound'
import { addSkill, removeSkill } from 'components/SkillsSection/SkillsSection.store'
import JoinSection from './JoinSection'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import fetchGroupDetails from 'store/actions/fetchGroupDetails'
import { FETCH_GROUP_DETAILS, RESP_ADMINISTRATION } from 'store/constants'
import {
  accessibilityDescription,
  accessibilityIcon,
  accessibilityString,
  DEFAULT_BANNER,
  DEFAULT_AVATAR,
  GROUP_TYPES,
  visibilityDescription,
  visibilityIcon,
  visibilityString
} from 'store/models/Group'
import presentGroup from 'store/presenters/presentGroup'
import getMe from 'store/selectors/getMe'
import { useGetJoinRequests } from 'hooks/useGetJoinRequests'
import useRouteParams from 'hooks/useRouteParams'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getResponsibilitiesForGroup from 'store/selectors/getResponsibilitiesForGroup'
import getRolesForGroup from 'store/selectors/getRolesForGroup'
import fetchForCurrentUser from 'store/actions/fetchForCurrentUser'
import { cn, inIframe } from 'util/index'
import { groupUrl, personUrl, removeGroupFromUrl } from '@hylo/navigation'
import { isLegacyWebView, sendMessageToWebView } from 'util/webView'

import {
  createJoinRequest,
  fetchJoinRequests,
  joinGroup
} from './GroupDetail.store'

import g from './GroupDetail.module.scss'
import m from '../MapExplorer/MapDrawer/MapDrawer.module.scss' // eslint-disable-line no-unused-vars

const MAX_DETAILS_LENGTH = 144

/** Renders a steward row with role emoji pills (tooltips match Membership / MemberProfile). */
function StewardWithRoles ({ personId, name, avatarUrl, groupId, groupSlug }) {
  const roles = useSelector(state => getRolesForGroup(state, { person: personId, groupId }))
  const visibleRoles = useMemo(
    () => roles.filter(role => role.common || role.active !== false),
    [roles]
  )

  return (
    <div className={g.steward}>
      <Link to={personUrl(personId, groupSlug)} className={g.stewardMain}>
        <Avatar avatarUrl={avatarUrl} medium className='shrink-0' />
        <span className='text-foreground'>{name}</span>
      </Link>
      {visibleRoles.length > 0 && (
        <div className={g.stewardRoles}>
          {visibleRoles.map(role => (
            <BadgeEmoji
              key={`${groupId}-${personId}-${role.common ? 'c' : 'g'}-${role.id}`}
              expanded
              {...role}
              responsibilities={role.responsibilities}
              id={`${groupId}-${personId}-${role.common ? 'c' : 'g'}-${role.id}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GroupDetail ({ forCurrentGroup = false }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const routeParams = useRouteParams()
  const { t } = useTranslation()

  const currentUser = useSelector(getMe)
  const groupSelector = useSelector(state => getGroupForSlug(state, routeParams.detailGroupSlug || routeParams.groupSlug))
  const group = useMemo(() => presentGroup(groupSelector), [groupSelector])
  const slug = routeParams.detailGroupSlug || routeParams.groupSlug
  const isAboutCurrentGroup = forCurrentGroup || routeParams.groupSlug === routeParams.detailGroupSlug
  const myMemberships = useSelector(state => getMyMemberships(state))
  const isMember = useMemo(() => group && currentUser ? myMemberships.find(m => m.group.id === group.id) : false, [group, currentUser, myMemberships])
  const joinRequests = useGetJoinRequests()
  const stewards = group && group.stewards
  const responsibilities = useSelector(state => getResponsibilitiesForGroup(state, { person: currentUser, groupId: group?.id }))
  const responsibilityTitles = useMemo(() => responsibilities.map(r => r.title), [responsibilities])
  const pending = useSelector(state => state.pending[FETCH_GROUP_DETAILS])

  const fetchGroup = useCallback(() => {
    dispatch(fetchGroupDetails({ slug, withContextWidgets: false, withWidgets: true, withPrerequisites: !!currentUser }))
  }, [dispatch, slug, currentUser])

  const joinGroupHandler = useCallback(async (groupId, questionAnswers) => {
    await dispatch(joinGroup(groupId, questionAnswers.map(q => ({ questionId: q.questionId, answer: q.answer }))))
    if (isLegacyWebView()) {
      sendMessageToWebView(WebViewMessageTypes.JOINED_GROUP, { groupSlug: group.slug })
    } else {
      navigate(groupUrl(group.slug))
    }
  }, [dispatch, group])

  const requestToJoinGroup = useCallback((groupId, questionAnswers) => {
    dispatch(createJoinRequest(groupId, questionAnswers.map(q => ({ questionId: q.questionId, answer: q.answer }))))
  }, [dispatch])

  const agreementsSectionRef = useRef(null)
  const [agreementsLinkCopied, setAgreementsLinkCopied] = useState(false)

  const handleCopyAgreementsLink = useCallback(() => {
    const url = `${window.location.origin}${groupUrl(group.slug, 'about')}#agreements`
    navigator.clipboard.writeText(url).then(() => {
      setAgreementsLinkCopied(true)
      window.setTimeout(() => setAgreementsLinkCopied(false), 2500)
    }).catch(() => {})
  }, [group?.slug])

  useEffect(() => {
    if (location.hash !== '#agreements') return
    if (!group?.agreements?.length) return
    const id = window.setTimeout(() => {
      agreementsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
    return () => window.clearTimeout(id)
  }, [location.hash, group?.agreements?.length])

  useEffect(() => {
    dispatch(fetchJoinRequests())
    dispatch(fetchForCurrentUser())
  }, [dispatch])

  useEffect(() => {
    fetchGroup()
  }, [group?.id])

  const closeDetailModal = () => {
    const newUrl = removeGroupFromUrl(window.location.pathname)
    navigate(newUrl)
  }

  const fullPage = !routeParams.detailGroupSlug || forCurrentGroup

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    if (group) {
      setHeaderDetails({ title: t('About {{name}}', { name: group.name }), icon: 'Info', info: '', search: true })
    }
  }, [group?.name])

  if (!group && !pending) return <NotFound />
  if (!group && pending) return <Loading />

  const groupsWithPendingRequests = keyBy(joinRequests, 'group.id')

  return (
    <div className={cn('GroupDetail relative mx-auto', { 'w-full max-w-[750px] my-4': fullPage, 'w-screen-lg': !fullPage, [g.isAboutCurrentGroup]: isAboutCurrentGroup })}>
      <Helmet>
        <title>{group.name} | Hylo</title>
        <meta name='description' content={TextHelpers.truncateHTML(group.description, MAX_DETAILS_LENGTH)} />
      </Helmet>

      {!isAboutCurrentGroup && (
        <div className={cn('w-full py-8 px-2 bg-cover bg-center overflow-hidden relative shadow-xl', { 'rounded-xl': fullPage })} style={{ backgroundImage: `url(${group.bannerUrl || DEFAULT_BANNER})` }}>
          {/* DEPRECATED: Now always show close button when not fullPage */}
          {!fullPage && /* !isWebView() && */ (
            <a className={g.close} onClick={closeDetailModal}><Icon name='Ex' /></a>
          )}
          <div className='bottom-0 right-0 bg-darkening/50 absolute top-0 left-0 z-0' />
          <div className='max-w-screen-lg mx-auto flex items-center justify-center flex-col relative z-10'>
            <img src={group.avatarUrl || DEFAULT_AVATAR} className='w-24 h-24 rounded-xl shadow-xl mt-0 mb-2' />
            <div>
              <div className='text-white font-bold text-2xl text-center'>{isAboutCurrentGroup && <span>{t('About')}</span>} {group.name}</div>
              <div className='text-center'>
                <div className='flex flex-row justify-center gap-1 text-sm text-white/70'>
                  <span className={g.groupPrivacy}>
                    <Icon name={visibilityIcon(group.visibility)} className={g.privacyIcon} />
                    <div className={g.privacyTooltip}>
                      <div>{t(visibilityString(group.visibility))} - {t(visibilityDescription(group.visibility))}</div>
                    </div>
                  </span>
                  <span className={g.groupPrivacy}>
                    <Icon name={accessibilityIcon(group.accessibility)} className={g.privacyIcon} />
                    <div className={g.privacyTooltip}>
                      <div>{t(accessibilityString(group.accessibility))} - {t(accessibilityDescription(group.accessibility))}</div>
                    </div>
                  </span>
                  <span className={g.memberCount}>{t('{{count}} Members', { count: group.memberCount })}</span>
                </div>
                <span className='text-white/70 text-sm'>{group.location}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className='p-4'>
        {group.type === GROUP_TYPES.default && defaultGroupBody({ group, isAboutCurrentGroup, t, responsibilityTitles })}
        {group.type === GROUP_TYPES.farm && (
          <FarmGroupDetailBody isMember={isMember} group={group} currentUser={currentUser} routeParams={routeParams} />
        )}
        {isAboutCurrentGroup || group.type === GROUP_TYPES.farm
          ? (
            <div className='border-2 border-dashed border-foreground/20 rounded-xl p-4 mb-4'>
              <h3 className='text-xl font-bold py-2'>{group.stewardDescriptorPlural || t('Stewards')}</h3>
              <div className={g.stewards}>
                {stewards.map(p => (
                  <StewardWithRoles
                    key={p.id}
                    personId={p.id}
                    name={p.name}
                    avatarUrl={p.avatarUrl}
                    groupId={group.id}
                    groupSlug={group.slug}
                  />
                ))}
              </div>
            </div>
            )
          : ''}
        <div className='border-2 border-dashed border-foreground/20 rounded-xl p-4 mb-4'>
          <h3 className='text-xl font-bold py-2'>{t('Privacy settings')}</h3>
          <div className='flex flex-row gap-2 items-center'>
            <Icon name={visibilityIcon(group.visibility)} className={g.settingIcon} />
            <p>{t(visibilityString(group.visibility))} - {t(visibilityDescription(group.visibility))}</p>
          </div>
          <div className='flex flex-row gap-2 items-center'>
            <Icon name={accessibilityIcon(group.accessibility)} className={g.settingIcon} />
            <p>{t(accessibilityString(group.accessibility))} - {t(accessibilityDescription(group.accessibility))}</p>
          </div>
        </div>
        {group.agreements?.length > 0
          ? (
            <div
              ref={agreementsSectionRef}
              id='agreements'
              className='border-2 border-dashed border-foreground/20 rounded-xl p-4'
            >
              <div className='flex flex-row flex-wrap items-center justify-between gap-2 gap-y-1 mb-2'>
                <h2 className='m-0 text-xl font-bold py-2'>{t('Agreements')}</h2>
                <button
                  type='button'
                  className='inline-flex items-center gap-1.5 text-sm rounded-lg border-2 border-foreground/20 px-2 py-1 hover:border-foreground/50 transition-all hover:cursor-pointer bg-card text-foreground shrink-0'
                  onClick={handleCopyAgreementsLink}
                  aria-label={t('Copy Link')}
                >
                  <Icon name='Copy' className='text-base' />
                  {agreementsLinkCopied ? t('Copied!') : t('Copy Link')}
                </button>
              </div>
              {group.agreements.map((agreement, i) => {
                return (
                  <div key={i}>
                    <strong>{parseInt(i) + 1}) {agreement.title}</strong>
                    <ClickCatcher>
                      <HyloHTML element='span' html={TextHelpers.markdown(agreement.description)} />
                    </ClickCatcher>
                  </div>
                )
              })}
            </div>)
          : ''}
        {!isAboutCurrentGroup
          ? !currentUser
              ? (
                <div className={g.signupButton}>
                  <Link to={'/login?returnToUrl=' + location.pathname} target={inIframe() ? '_blank' : ''} className={g.requestButton}>
                    {t('Signup or Login to connect with')}{' '}
                    <span className={g.requestGroup}>{group.name}</span>
                  </Link>
                </div>)
              : isMember
                ? (
                  <div className={g.existingMember}>
                    {t('You are a member of ')}
                    <Link to={groupUrl(group.slug)}>{group.name}</Link>
                  </div>)
                : (
                  <div>
                    <JoinSection
                      addSkill={addSkill}
                      currentUser={currentUser}
                      fullPage={fullPage}
                      group={group}
                      groupsWithPendingRequests={groupsWithPendingRequests}
                      joinGroup={joinGroupHandler}
                      requestToJoinGroup={requestToJoinGroup}
                      removeSkill={removeSkill}
                      routeParams={routeParams}
                      t={t}
                    />
                  </div>
                  )
          : ''}
      </div>
      <Tooltip
        backgroundColor='rgba(35, 65, 91, 1.0)'
        effect='solid'
        delayShow={0}
        id='join-tip'
      />
      <SocketSubscriber type='group' id={group.id} />
    </div>
  )
}

// GroupDetail.propTypes = {
//   group: PropTypes.object,
//   currentUser: PropTypes.object,
//   fetchGroup: PropTypes.func,
//   fetchJoinRequests: PropTypes.func,
//   joinGroup: PropTypes.func,
//   createJoinRequest: PropTypes.func
// }

const defaultGroupBody = ({ group, isAboutCurrentGroup, responsibilityTitles, t }) => {
  return (
    <>
      {group.aboutVideoUri && (
        <GroupAboutVideoEmbed uri={group.aboutVideoUri} className={g.groupAboutVideo} />
      )}
      {isAboutCurrentGroup && (!group.purpose && !group.description) && responsibilityTitles.includes(RESP_ADMINISTRATION)
        ? (
          <div className={g.noDescription}>
            <div>
              <h4 className='text-xl font-bold py-2'>{t('Your group doesn\'t have a purpose or description')}</h4>
              <p>{t('Add a purpose, description, location, and more in your group settings')}</p>
              <Link to={groupUrl(group.slug, 'settings')}>{t('Add a group description')}</Link>
            </div>
          </div>
          )
        : group.purpose || group.description || group.websiteUrl
          ? (
            <div className='border-2 border-dashed border-foreground/20 rounded-xl p-4 mb-4'>
              {group.purpose
                ? (
                  <>
                    <h3 className='text-xl font-bold py-2'>{t('Purpose')}</h3>
                    <ClickCatcher>
                      <HyloHTML element='span' html={TextHelpers.markdown(group.purpose)} />
                    </ClickCatcher>
                  </>
                  )
                : ''}
              {group.description
                ? (
                  <>
                    <h3 className='text-xl font-bold py-2'>{t('Description')}</h3>
                    <ClickCatcher>
                      <HyloHTML element='span' html={TextHelpers.markdown(group.description)} />
                    </ClickCatcher>
                  </>
                  )
                : ''}
              {group.websiteUrl
                ? (
                  <>
                    <h3 className='text-xl font-bold py-2'>{t('Website')}</h3>
                    <a href={TextHelpers.sanitizeURL(group.websiteUrl)} target='_blank' rel='noopener noreferrer'>{group.websiteUrl}</a>
                  </>
                  )
                : ''}
            </div>
            )
          : ''}
    </>
  )
}

export default GroupDetail
