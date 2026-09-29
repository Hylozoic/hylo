import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { bgImageStyle } from 'util/index'
import { DEFAULT_AVATAR, DEFAULT_BANNER } from 'store/models/Group'
import { groupDetailUrl } from '@hylo/navigation'
import RoundImage from 'components/RoundImage'
import Button from 'components/ui/button'
import { Info, DollarSign } from 'lucide-react'
import { useDispatch } from 'react-redux'
import { fetchGroups } from 'store/actions/fetchGroups'
import { SORT_RECENT } from 'hooks/useEnsureSearchedGroups'
import Loading from 'components/Loading'
import Tooltip from 'components/Tooltip'
import useRouteParams from 'hooks/useRouteParams'

// Without a curated list (VITE_FEATURED_GROUP_IDS), show this many of the most recently active listed groups
export const FALLBACK_GROUP_COUNT = 6

export default function FeaturedGroups ({ groupIds = [] }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const [groups, setGroups] = useState([])
  const [pending, setPending] = useState(true)
  const curated = groupIds.length > 0

  useEffect(() => {
    const request = curated
      ? fetchGroups({ groupIds, allowedInPublic: true, pageSize: groupIds.length })
      : fetchGroups({ sortBy: SORT_RECENT, allowedInPublic: true, pageSize: FALLBACK_GROUP_COUNT })

    dispatch(request)
      .then(response => {
        const items = response?.payload?.data?.groups?.items || []
        if (!curated) {
          setGroups(items)
          setPending(false)
          return
        }
        // Create a map of id to group for efficient lookup
        const groupMap = items.reduce((acc, group) => {
          acc[group.id] = group
          return acc
        }, {})
        // Map over groupIds to maintain order
        const orderedGroups = groupIds
          .map(id => groupMap[id])
          .filter(Boolean)
        setGroups(orderedGroups)
        setPending(false)
      })
      .catch(error => {
        console.error('Error fetching groups:', error)
        setPending(false)
      })
  }, []) // Only run on mount

  if (pending) return <Loading />
  if (!groups.length) return null

  return (
    <div className='w-full overflow-hidden mb-4 rounded-lg inset-shadow-lg bg-background py-4 px-0 relative'>
      <div className='flex items-center justify-between'>
        <h2 className='mt-0 font-bold ml-4 text-sm'>{curated ? t('Featured Groups') : t('Recently active groups')}</h2>
        {curated && (
          <>
            <div className='relative group mr-4 w-6 h-6 flex items-center justify-center' data-tooltip-id='featured-groups-info'>
              <Link to={groupDetailUrl('building-hylo', routeParams)}>
                <Info
                  className='w-4 h-4 text-foreground/60'
                />
              </Link>
            </div>
            <Tooltip
              id='featured-groups-info'
              delay={150}
              position='bottom'
              content={() => (
                <div className='text-xs'>
                  {t('To recommend a group to be featured, join building Hylo')}
                </div>
              )}
            />
          </>
        )}
      </div>
      <div className='absolute top-0 right-0 h-full bg-gradient-to-l from-black/20 to-transparent w-[30px] z-10' />
      <div className='absolute top-0 left-0 h-full bg-gradient-to-r from-black/20 to-transparent w-[30px] z-10' />
      <div className='flex overflow-x-auto pb-4 pt-4 pr-4 snap-x snap-mandatory relative z-5'>
        {groups.map(group => (
          <Link to={groupDetailUrl(group.slug, routeParams)} key={group.id}>
            <div
              className='flex-none w-[250px] h-[350px] rounded-lg relative overflow-hidden scale-100 hover:scale-105 transition-all ml-4'
            >
              <div
                style={bgImageStyle(group.bannerUrl || DEFAULT_BANNER)}
                className='absolute inset-0 bg-cover bg-center opacity-70'
              />
              <div className='absolute inset-0 bg-gradient-to-t from-darkening/80 to-transparent' />
              <div className='relative h-full p-4 flex flex-col justify-end'>
                <div className='flex items-start justify-between'>
                  <RoundImage
                    url={group.avatarUrl || DEFAULT_AVATAR}
                    size='100px'
                    square
                    className='shadow-xl'
                  />
                </div>
                <div className='text-white'>
                  <h3 className='text-xl font-bold mb-1 flex items-center gap-2 text-white'>
                    {group.name}
                    {group.paywall && (
                      <>
                        <DollarSign
                          className='w-5 h-5'
                          data-tooltip-id={`paywall-tooltip-${group.id}`}
                          data-tooltip-content={t('This group requires payment to join')}
                        />
                        <Tooltip id={`paywall-tooltip-${group.id}`} />
                      </>
                    )}
                  </h3>
                  <p className='text-sm text-white/80 mb-2'>{group.memberCount} {t('Members')}</p>
                  <p className='text-sm text-white/90 line-clamp-3 mb-4'>{group.description}</p>
                  <Button variant='outline' className='w-full text-center justify-center text-xs p-1 bg-background/40 hover:bg-background/100'>
                    {t('View')}
                  </Button>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
