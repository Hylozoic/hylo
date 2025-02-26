import { cn } from 'util/index'
import { get } from 'lodash/fp'
import { Globe } from 'lucide-react'
import React, { Suspense, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useIntercom } from 'react-use-intercom'
import { useSelector } from 'react-redux'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from 'components/ui/popover'
import BadgedIcon from 'components/BadgedIcon'
import CreateMenu from 'components/CreateMenu'
import GlobalNavItem from './GlobalNavItem'
import getMyGroups from 'store/selectors/getMyGroups'
import { isMobileDevice, downloadApp } from 'util/mobile'

import styles from './GlobalNav.module.scss'

const NotificationsDropdown = React.lazy(() => import('./NotificationsDropdown'))

export default function GlobalNav (props) {
  const { currentUser, onClick } = props
  const { show: showIntercom } = useIntercom()
  const groups = useSelector(getMyGroups)
  const appStoreLinkClass = isMobileDevice() ? 'isMobileDevice' : 'isntMobileDevice'
  const { t } = useTranslation()
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    const totalItems = 4 + groups.length + 2 // fixed items + groups + plus & help buttons
    let currentCount = 0
    
    const interval = setInterval(() => {
      if (currentCount >= totalItems) {
        clearInterval(interval)
        return
      }
      currentCount++
      setVisibleCount(currentCount)
    }, 50) // 50ms between each item

    return () => clearInterval(interval)
  }, [groups.length])

  const isVisible = (index) => {
    return index < visibleCount ? 'animate-slide-up invisible' : 'opacity-0'
  }

  return (
    <div className={cn('flex flex-col bg-theme-background h-full z-50 items-center pb-0 pt-2')} onClick={onClick}>
      <div className={cn('overflow-y-auto pt-2 flex flex-col items-center pl-5 pr-3 relative bg-theme-background overflow-x-hidden', styles.globalNavContainer)}>
        <GlobalNavItem 
          img={get('avatarUrl', currentUser)} 
          tooltip={t('Your Profile')} 
          url='/my/posts' 
          className={isVisible(0)}
        />

        <Suspense fallback={<GlobalNavItem className={isVisible(1)}><BadgedIcon name='Notifications' className={styles.icon} /></GlobalNavItem>}>
          <NotificationsDropdown renderToggleChildren={showBadge =>
            <GlobalNavItem 
              tooltip='Activity' 
              className={isVisible(1)}
            >
              <BadgedIcon name='Notifications' className='!text-primary-foreground cursor-pointer font-md' showBadge={showBadge} />
            </GlobalNavItem>}
          />
        </Suspense>

        <GlobalNavItem 
          tooltip={t('Messages')} 
          url='/messages' 
          className={isVisible(2)}
        >
          <BadgedIcon name='Messages' className='!text-primary-foreground cursor-pointer font-md' showBadge={currentUser.unseenThreadCount && currentUser.unseenThreadCount > 0} />
        </GlobalNavItem>

        <GlobalNavItem 
          tooltip={t('The Commons')} 
          url='/public/stream' 
          className={isVisible(3)}
        >
          <Globe color='hsl(var(--primary-foreground))' />
        </GlobalNavItem>

        {groups.map((group, index) =>
          <GlobalNavItem
            key={group.id}
            badgeCount={group.newPostCount || 0}
            img={group.avatarUrl}
            tooltip={group.name}
            url={`/groups/${group.slug}`}
            className={isVisible(4 + index)}
          />
        )}

        <div className='sticky bottom-0 w-full bg-gradient-to-t from-theme-background/100 to-theme-background/0 h-[40px] z-100'>&nbsp;</div>
      </div>

      <Popover>
        <PopoverTrigger>
          <div className={cn('bg-primary relative transition-colors ease-in-out duration-250 flex flex-col items-center justify-center w-14 h-14 min-h-10 rounded-lg drop-shadow-md hover:opacity-100 scale-90 hover:scale-125 hover:drop-shadow-lg hover:my-1 text-3xl mb-4', isVisible(4 + groups.length))}>
            <span className='inline-block text-themeForeground p-1 w-10 line-height-1'>+</span>
          </div>
        </PopoverTrigger>
        <PopoverContent side='right' align='center'>
          <CreateMenu />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger>
          <span className={cn('inline-block text-themeForeground border-2 border-themeForeground rounded-xl p-1 w-10 line-height-1', isVisible(4 + groups.length + 1))}>?</span>
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
