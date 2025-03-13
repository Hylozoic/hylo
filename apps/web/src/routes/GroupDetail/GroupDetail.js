import { keyBy } from 'lodash'
import React, { useCallback, useEffect, useMemo } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Tooltip } from 'react-tooltip'
// import PropTypes from 'prop-types'
import { useSelector, useDispatch } from 'react-redux'
import { TextHelpers, WebViewMessageTypes } from '@hylo/shared'
import Avatar from 'components/Avatar'
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
import fetchForCurrentUser from 'store/actions/fetchForCurrentUser'
import { cn, inIframe } from 'util/index'
import { groupUrl, personUrl, removeGroupFromUrl } from 'util/navigation'
import isWebView, { sendMessageToWebView } from 'util/webView'

import {
  createJoinRequest,
  fetchJoinRequests,
  joinGroup
} from './GroupDetail.store'

import g from './GroupDetail.module.scss'
import m from '../MapExplorer/MapDrawer/MapDrawer.module.scss' // eslint-disable-line no-unused-vars

const MAX_DETAILS_LENGTH = 144

function GroupDetail ({ popup = false }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const routeParams = useRouteParams()
  const { t } = useTranslation()

  const currentUser = useSelector(getMe)
  const groupSelector = useSelector(state => getGroupForSlug(state, routeParams.detailGroupSlug || routeParams.groupSlug))
  const group = useMemo(() => presentGroup(groupSelector), [groupSelector])
  const slug = routeParams.detailGroupSlug || routeParams.groupSlug
  const isAboutCurrentGroup = !routeParams.detailGroupSlug || routeParams.groupSlug === routeParams.detailGroupSlug
  const myMemberships = useSelector(state => getMyMemberships(state))
  const isMember = useMemo(() => group && currentUser ? myMemberships.find(m => m.group.id === group.id) : false, [group, currentUser, myMemberships])
  const joinRequests = useGetJoinRequests()
  const stewards = group && group.stewards
  const responsibilities = useSelector(state => getResponsibilitiesForGroup(state, { person: currentUser, groupId: group?.id }))
  const responsibilityTitles = useMemo(() => responsibilities.map(r => r.title), [responsibilities])
  const pending = useSelector(state => state.pending[FETCH_GROUP_DETAILS])

  const fetchGroup = useCallback(() => {
    dispatch(fetchGroupDetails({ slug, withWidgets: true, withPrerequisites: !!currentUser }))
  }, [dispatch, slug, currentUser])

  const joinGroupHandler = useCallback(async (groupId, questionAnswers) => {
    await dispatch(joinGroup(groupId, questionAnswers.map(q => ({ questionId: q.questionId, answer: q.answer }))))
    if (isWebView()) {
      sendMessageToWebView(WebViewMessageTypes.JOINED_GROUP, { groupSlug: group.slug })
    }
  }, [dispatch, group])

  const requestToJoinGroup = useCallback((groupId, questionAnswers) => {
    dispatch(createJoinRequest(groupId, questionAnswers.map(q => ({ questionId: q.questionId, answer: q.answer }))))
  }, [dispatch])

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

  const fullPage = !routeParams.detailGroupSlug && !popup

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    if (group) {
      setHeaderDetails({ title: t('About ') + ' ' + group.name, icon: 'Info', info: '', search: true })
    }
  }, [group?.name])

  if (!group && !pending) return <NotFound />
  if (pending) return <Loading />

  const groupsWithPendingRequests = keyBy(joinRequests, 'group.id')

  return (
    <div className={cn('bg-background relative', { [g.fullPage]: fullPage, [g.isAboutCurrentGroup]: isAboutCurrentGroup })}>
      <Helmet>
        <title>{group.name} | Hylo</title>
        <meta name='description' content={TextHelpers.truncateHTML(group.description, MAX_DETAILS_LENGTH)} />
      </Helmet>

      {!isAboutCurrentGroup && (
        <div className={g.groupDetailHeader} style={{ backgroundImage: `url(${group.bannerUrl || DEFAULT_BANNER})` }}>
          {!fullPage && (
            <a className={g.close} onClick={closeDetailModal}><Icon name='Ex' /></a>
          )}
          <div className={g.groupTitleContainer}>
            <img src={group.avatarUrl || DEFAULT_AVATAR} className={g.groupAvatar} />
            <div>
              <div className='text-background text-lg ml-4'>{isAboutCurrentGroup && <span>{t('About')}</span>} {group.name}</div>
              <div className={g.groupContextInfo}>
                <div>
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
                  <span className={g.memberCount}>{group.memberCount} {group.memberCount > 1 ? t('Members') : t('Member')}</span>
                </div>
                <span className={g.groupLocation}>{group.location}</span>
              </div>
            </div>
          </div>
          <div className={g.headerBackground} />
        </div>
      )}

      <div className={g.groupDetailBody}>
        {group.type === GROUP_TYPES.default && defaultGroupBody({ group, isAboutCurrentGroup, t, responsibilityTitles })}
        {group.type === GROUP_TYPES.farm && (
          <FarmGroupDetailBody isMember={isMember} group={group} currentUser={currentUser} routeParams={routeParams} />
        )}
        {isAboutCurrentGroup || group.type === GROUP_TYPES.farm
          ? (
            <div className={g.aboutCurrentGroup}>
              <h3>{group.stewardDescriptorPlural || t('Stewards')}</h3>
              <div className={g.stewards}>
                {stewards.map(p => (
                  <Link to={personUrl(p.id, group.slug)} key={p.id} className={g.steward}>
                    <Avatar avatarUrl={p.avatarUrl} medium className='mx-1' />
                    <span>{p.name}</span>
                  </Link>
                ))}
              </div>
            </div>
            )
          : ''}
        <div className={g.detailSection}>
          <h3>{t('Privacy settings')}</h3>
          <div className={g.privacySetting}>
            <Icon name={visibilityIcon(group.visibility)} className={g.settingIcon} />
            <p>{t(visibilityString(group.visibility))} - {t(visibilityDescription(group.visibility))}</p>
          </div>
          <div className={g.privacySetting}>
            <Icon name={accessibilityIcon(group.accessibility)} className={g.settingIcon} />
            <p>{t(accessibilityString(group.accessibility))} - {t(accessibilityDescription(group.accessibility))}</p>
          </div>
        </div>
        {group.agreements?.length > 0
          ? (
            <div className={cn(g.agreements, g.detailSection)}>
              <h2>{t('Agreements')}</h2>
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
      {isAboutCurrentGroup && group.aboutVideoUri && (
        <GroupAboutVideoEmbed uri={group.aboutVideoUri} className={g.groupAboutVideo} />
      )}
      {isAboutCurrentGroup && (!group.purpose && !group.description) && responsibilityTitles.includes(RESP_ADMINISTRATION)
        ? (
          <div className={g.noDescription}>
            <div>
              <h4>{t('Your group doesn\'t have a purpose or description')}</h4>
              <p>{t('Add a purpose, description, location, and more in your group settings')}</p>
              <Link to={groupUrl(group.slug, 'settings')}>{t('Add a group description')}</Link>
            </div>
          </div>
          )
        : group.purpose || group.description || group.websiteUrl
          ? (
            <div className={cn(g.groupDescription, g.detailSection)}>
              {group.purpose
                ? (
                  <>
                    <h3>{t('Purpose')}</h3>
                    <ClickCatcher>
                      <HyloHTML element='span' html={TextHelpers.markdown(group.purpose)} />
                    </ClickCatcher>
                  </>
                  )
                : ''}
              {group.description
                ? (
                  <>
                    <h3>{t('Description')}</h3>
                    <ClickCatcher>
                      <HyloHTML element='span' html={TextHelpers.markdown(group.description)} />
                    </ClickCatcher>
                  </>
                  )
                : ''}
              {group.websiteUrl
                ? (
                  <>
                    <h3>{t('Website')}</h3>
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
