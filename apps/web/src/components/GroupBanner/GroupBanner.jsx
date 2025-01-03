import { cn } from 'util'
import { capitalize } from 'lodash'
import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Tooltip } from 'react-tooltip'

import Icon from 'components/Icon'
import PostLabel from 'components/PostLabel'
import useRouteParams from 'hooks/useRouteParams'
import { CONTEXT_MY } from 'store/constants'
import { DEFAULT_BANNER, DEFAULT_AVATAR } from 'store/models/Group'
import { whiteMerkaba, allGroupsBanner, publicGlobe } from 'util/assets'
import { bgImageStyle } from 'util/index'
import { groupUrl, groupDetailUrl } from 'util/navigation'
import PostPrompt from './PostPrompt'

import classes from './GroupBanner.module.scss'

export default function GroupBanner ({
  context,
  currentUserHasMemberships,
  currentUser,
  customActivePostsOnly,
  customPostTypes,
  customViewTopics,
  customViewType,
  label,
  icon,
  group,
  newPost,
  querystringParams,
  isTesting,
  type
}) {
  let bannerUrl, avatarUrl, name, location, subtitle
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const view = routeParams.view
  const isAboutOpen = !!routeParams.detailGroupSlug

  if (context === 'all') {
    name = t('All My Groups')
    avatarUrl = whiteMerkaba
    bannerUrl = allGroupsBanner
    subtitle = currentUser && t('{{count}} Groups', { count: currentUser.memberships.count() })
  } else if (context === 'public') {
    name = t('Public Groups & Posts')
    avatarUrl = publicGlobe
    bannerUrl = allGroupsBanner
    // TODO list count of public posts and public groups in subtitle
    subtitle = t('All Posts Marked Public')
  } else if (context === 'my') {
    name = `${t('My Home')}: ${capitalize(t(view))}`
    avatarUrl = currentUser.avatarUrl || publicGlobe
    bannerUrl = currentUser.bannerUrl || allGroupsBanner
    // These need to be invoked here so that they get picked up by the translation extractor
  } else if (!group) {
    return null
  } else {
    ({ bannerUrl, avatarUrl, location } = group)
    name = ['projects', 'ask-and-offer'].includes(view) ? `${group.name}: ${capitalize(t(view))}` : group.name
  }

  const hasPostPrompt = currentUserHasMemberships && context !== CONTEXT_MY && view !== 'explore'
  const numCustomFilters = customViewType === 'stream' ? (customPostTypes.length + customViewTopics.length + (customActivePostsOnly ? 1 : 0)) : false
  return (
    <div
      className={cn(classes.banner, {
        [classes.allGroups]: context === 'all',
        [classes.hasPostPrompt]: hasPostPrompt
      })}
      data-testid='group-banner'
    >
      <div style={bgImageStyle(bannerUrl || DEFAULT_BANNER)} className={classes.image}>
        <div className={classes.fade}>
          <div className={classes.fade2} />
        </div>

        {group && (
          <div className={classes.right}>
            <Link
              className={cn(classes.about, { [classes.isAboutOpen]: isAboutOpen })}
              to={isAboutOpen ? groupUrl(group.slug, routeParams.view, querystringParams) : groupDetailUrl(group.slug, routeParams, querystringParams)}
            >
              <Icon name='Info' />{t('About us')}
            </Link>
          </div>
        )}

        <div className={classes.header}>
          {icon
            ? (
              <div className={classes.customIcon}>
                <Icon name={icon} />
              </div>
              )
            : (
              <div className={cn(classes.logo, { [classes.allLogo]: context === 'all' })} style={bgImageStyle(avatarUrl || DEFAULT_AVATAR)} />
              )}
          <div className={classes.headerText}>
            <div className={classes.headerContents}>
              <span className={classes.headerName}>{label || name}</span>

              {location && !icon && (
                <div className={classes.headerSubtitle}>
                  <Icon name='Location' className={classes.headerIcon} />
                  {location}
                </div>
              )}

              {customViewType === 'stream'
                ? <div className={classes.numFilters} data-tooltip-content='' data-tooltip-id='feed-banner-tip'>{numCustomFilters} {t('Filters')}</div>
                : customViewType === 'collection'
                  ? <div className={classes.numFilters} data-tooltip-content='' data-tooltip-id='feed-banner-tip'>{t('Collection')}</div>
                  : ''}

              {subtitle && <div className={classes.headerSubtitle}>{subtitle}</div>}
            </div>
          </div>
        </div>
      </div>
      {currentUserHasMemberships &&
        <PostPrompt
          avatarUrl={currentUser.avatarUrl}
          firstName={currentUser.firstName()}
          newPost={newPost}
          querystringParams={querystringParams}
          routeParams={routeParams}
          type={type}
        />}

      {/* The ReactTooltip with dynamic content breaks our snapshots because it uses dynamic classname, so removing in our tests */}
      {!isTesting && (
        <Tooltip
          id='feed-banner-tip'
          style={{ backgroundColor: 'rgba(35, 65, 91, 1.0)' }}
          effect='solid'
          delayShow={0}
          place='bottom'
          content={() => {
            return (customViewType === 'stream'
              ? (
                <div className={classes.customFilters}>
                  <span className={classes.displaying}>
                    {t('Displaying') + ' '};
                    {customActivePostsOnly ? 'active' : ''}
                  </span>

                  {customPostTypes.length === 0 ? t('None') : customPostTypes.map((p, i) => <span key={i} className={classes.postTypelabel}><PostLabel key={p} type={p} className={classes.postType} />{p}s +</span>)}
                  {customViewTopics.length > 0 && <div className={classes.filteredTopics}>{t('filtered by topics:')}</div>}
                  {customViewTopics.length > 0 && customViewTopics.map(t => <span key={t.id} className={classes.filteredTopic}>#{t.name}</span>)}
                </div>
                )
              : ''
            )
          }}
        />
      )}
    </div>
  )
}
