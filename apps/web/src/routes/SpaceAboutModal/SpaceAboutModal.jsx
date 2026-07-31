import { BadgeDollarSign, Users } from 'lucide-react'
import React, { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'

import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import { Dialog, DialogContent, DialogTitle } from 'components/ui/dialog'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import { avatarForView, iconForView } from '@hylo/presenters/GroupViewPresenter'
import fetchForGroup from 'store/actions/fetchForGroup'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { DEFAULT_BANNER, GROUP_ACCESSIBILITY, accessibilityIcon } from 'store/models/Group'
import { bgImageStyle } from 'util/index'

/** One fact in the two-up grid under the description. */
function Fact ({ icon, label, value }) {
  return (
    <div className='flex items-center gap-2.5 rounded-lg border border-foreground/10 bg-background/40 px-3 py-2.5 min-w-0'>
      <span className='shrink-0 text-foreground/60'>{icon}</span>
      <div className='min-w-0'>
        <div className='text-[10px] font-bold uppercase tracking-wider text-foreground/50'>{label}</div>
        <div className='text-sm font-bold text-foreground truncate' title={value}>{value}</div>
      </div>
    </div>
  )
}

/**
 * What a space is for, over whatever you were looking at. A modal rather than a
 * page because it answers a question about the space you are already in — the
 * design's Views list is deliberately omitted, since the menu is the place that
 * lists views.
 */
export default function SpaceAboutModal ({ onClose }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const spaceFullSlug = useEffectiveGroupSlug()
  const spaceGroup = useSelector(state => getGroupForSlug(state, spaceFullSlug))
  const detailsLoaded = spaceGroup?.accessibility != null

  useEffect(() => {
    if (spaceFullSlug && !detailsLoaded) dispatch(fetchForGroup(spaceFullSlug))
  }, [dispatch, spaceFullSlug, detailsLoaded])

  const spaceView = useMemo(() => spaceGroup
    ? { type: 'space', name: spaceGroup.name, icon: spaceGroup.icon, linkedGroup: spaceGroup }
    : null, [spaceGroup])
  const avatar = useMemo(() => avatarForView(spaceView), [spaceView])
  const icon = useMemo(() => iconForView(spaceView), [spaceView])

  const bannerUrl = spaceGroup?.bannerUrl && spaceGroup.bannerUrl !== DEFAULT_BANNER
    ? spaceGroup.bannerUrl
    : null

  const accessLabel = !spaceGroup
    ? ''
    : spaceGroup.paywall
      ? t('Paid')
      : spaceGroup.accessibility === GROUP_ACCESSIBILITY.Open
        ? t('Open')
        : spaceGroup.accessibility === GROUP_ACCESSIBILITY.Restricted
          ? t('Restricted')
          : t('Invite Only')

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose?.() }}>
      {/* p-0 so the banner can run to the edges; the dialog's own close button sits
          over it, which is why the banner carries a scrim */}
      <DialogContent className='max-w-[560px] w-[calc(100%-2rem)] p-0 overflow-hidden gap-0'>
        <DialogTitle className='sr-only'>{t('About')}</DialogTitle>

        {!spaceGroup || !detailsLoaded
          ? <div className='p-10'><Loading /></div>
          : (
            <>
              <div className='relative h-[140px] grid place-items-center overflow-hidden shrink-0'>
                {bannerUrl
                  ? (
                    <>
                      <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bannerUrl)} />
                      <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.6) 100%)' }} />
                    </>
                    )
                  : <div className='absolute inset-0 bg-gradient-to-br from-focus/70 to-selected/70' />}

                <div className='relative z-10 w-[84px] h-[84px] rounded-[22px] grid place-items-center overflow-hidden bg-background/20 backdrop-blur-sm border border-white/25 shadow-lg text-white'>
                  {avatar?.avatarUrl
                    ? <div className='w-full h-full bg-cover bg-center' style={bgImageStyle(avatar.avatarUrl)} />
                    : icon.lucideIcon
                      ? <LucideIcon name={icon.lucideIcon} className='w-10 h-10' fallback={<Icon name={icon.lucideIcon} className='text-4xl' />} />
                      : <Icon name={icon.iconName || 'Shapes'} className='text-4xl' />}
                </div>
              </div>

              <div className='p-7 overflow-y-auto'>
                <h1 className='text-2xl font-bold text-foreground m-0'>{spaceGroup.name}</h1>

                {spaceGroup.purpose && (
                  <p className='text-foreground/80 font-medium mt-2 mb-0'>{spaceGroup.purpose}</p>
                )}

                {spaceGroup.description && (
                  <div className='text-foreground/70 text-sm global-postContent mt-3'>
                    <ClickCatcher groupSlug={spaceFullSlug}>
                      <HyloHTML html={spaceGroup.description} />
                    </ClickCatcher>
                  </div>
                )}

                <div className='grid grid-cols-2 gap-2 mt-5'>
                  <Fact
                    icon={<Users className='w-4 h-4' />}
                    label={t('Members')}
                    value={String(spaceGroup.memberCount || 0)}
                  />
                  <Fact
                    icon={spaceGroup.paywall
                      ? <BadgeDollarSign className='w-4 h-4' />
                      : <Icon name={accessibilityIcon(spaceGroup.accessibility)} />}
                    label={t('Access')}
                    value={accessLabel}
                  />
                </div>
              </div>
            </>
            )}
      </DialogContent>
    </Dialog>
  )
}
