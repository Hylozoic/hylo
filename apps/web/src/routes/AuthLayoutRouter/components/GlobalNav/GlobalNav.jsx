import { cn } from 'util/index'
import { get } from 'lodash/fp'
import { Globe } from 'lucide-react'
import React, { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useIntercom } from 'react-use-intercom'
import { useSelector } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from 'components/ui/popover'
import Badge from 'components/Badge'
import BadgedIcon from 'components/BadgedIcon'
import Icon from 'components/Icon'
import GlobalNavItem from './GlobalNavItem'
import { toggleDrawer, toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import getMyGroups from 'store/selectors/getMyGroups'
import { hyloLogo, publicLogo } from 'util/assets'
import { isMobileDevice, downloadApp } from 'util/mobile'

import styles from './GlobalNav.module.scss'

const MessagesDropdown = React.lazy(() => import('./MessagesDropdown'))
const NotificationsDropdown = React.lazy(() => import('./NotificationsDropdown'))

export default function GlobalNav (props) {
  const { currentUser, onClick } = props
  const { show: showIntercom } = useIntercom()
  const groups = useSelector(getMyGroups)
  const location = useLocation()
  const appStoreLinkClass = isMobileDevice() ? 'isMobileDevice' : 'isntMobileDevice'
  const { t } = useTranslation()

  return (
    <div className={cn('flex flex-col bg-theme-background h-full z-50 items-center pb-0 pt-2')} onClick={onClick}>
      <div className={cn('overflow-y-auto pt-2 flex flex-col items-center pl-5 pr-3 relative bg-theme-background overflow-x-hidden', styles.globalNavContainer)}>
        {/* <div className={styles.drawerToggle} id='toggleDrawer'>
          <button className={styles.drawerToggleButton} onClick={handleToggleDrawer}><Icon name='Hamburger' className={styles.menuIcon} /></button>
          {showMenuBadge && <Badge number='1' className={styles.logoBadge} border />}
        </div> */}
        {/* <Link
          to={baseUrl(pick(['context', 'groupSlug'], routeParams))}
          onClick={handleToggleNavMenu}
          className={cn(styles.currentContext, { [styles.groupMenuOpen]: isNavOpen })}
          id='currentContext'
        >
          <Logo {...{ group, isPublic }} />
          <Title group={group} isPublic={isPublic} isMyHome={isMyHome} />
        </Link> */}
        <GlobalNavItem img={get('avatarUrl', currentUser)} tooltip={t('Your Profile')} url='/my/posts' className={cn('opacity-1')} />

        <Suspense fallback={<GlobalNavItem className={cn('opacity-1')}><BadgedIcon name='Notifications' className={styles.icon} /></GlobalNavItem>}>
          <NotificationsDropdown renderToggleChildren={showBadge =>
            <GlobalNavItem tooltip='Activity' className={cn('opacity-1')}>
              <BadgedIcon name='Notifications' className='!text-primary-foreground cursor-pointer font-md' showBadge={showBadge} />
            </GlobalNavItem>}
          />
        </Suspense>

        <GlobalNavItem tooltip={t('Messages')} url='/messages' className={cn('opacity-1')}>
          <BadgedIcon name='Messages' className='!text-primary-foreground cursor-pointer font-md' />
        </GlobalNavItem>

        <GlobalNavItem tooltip={t('The Commons')} url='/public/stream' className={cn('opacity-1')}>
          <Globe color='hsl(var(--primary-foreground))' />
        </GlobalNavItem>

        {groups.map(group =>
          <GlobalNavItem
            key={group.id}
            badgeCount={group.newPostCount || 0}
            img={group.avatarUrl}
            tooltip={group.name}
            url={`/groups/${group.slug}`}
          />
        )}

        <div className='sticky bottom-0 w-full bg-gradient-to-t from-theme-background/100 to-theme-background/0 h-[40px] z-100'>&nbsp;</div>
      </div>

      <GlobalNavItem url={`${location.pathname}/create`} className={cn('opacity-1')}>
        +
      </GlobalNavItem>

      <Popover>
        <PopoverTrigger>
          <span className='inline-block text-themeForeground border-2 border-themeForeground rounded-xl p-1 w-10 line-height-1'>?</span>
        </PopoverTrigger>
        <PopoverContent side='right' align='start'>
          <ul>
            <li><span className={styles.hoverHighlight} onClick={showIntercom}>{t('Feedback & Support')}</span></li>
            <li><a href='https://hylozoic.gitbook.io/hylo/guides/hylo-user-guide' target='_blank' rel='noreferrer' className={styles.hoverHighlight}>{t('User Guide')}</a></li>
            <li><a href='http://hylo.com/terms/' target='_blank' rel='noreferrer' className={styles.hoverHighlight}>{t('Terms & Privacy')}</a></li>
            <li><span className={cn(styles.hoverHighlight, styles[appStoreLinkClass])} onClick={downloadApp}>{t('Download App')}</span></li>
            <li><a href='https://opencollective.com/hylo' target='_blank' rel='noreferrer' className={styles.hoverHighlight}>{t('Contribute to Hylo')}</a></li>
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}
