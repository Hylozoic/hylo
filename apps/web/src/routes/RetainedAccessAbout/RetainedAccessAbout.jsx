import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import Loading from 'components/Loading'
import NotFound from 'components/NotFound'
import RetainedAccessPanel from 'components/RetainedAccessPanel/RetainedAccessPanel'
import fetchRetainedAccessAbout from 'store/actions/fetchRetainedAccessAbout'
import rejoinGroup from 'store/actions/rejoinGroup'
import { groupUrl, localSpaceSlug, spaceHomeRoutePath, spaceUrl } from '@hylo/navigation'

export default function RetainedAccessAbout ({ slug, fallbackUrl }) {
  const dispatch = useDispatch()
  const location = useLocation()
  const navigate = useNavigate()
  const [about, setAbout] = useState()
  const [rejoining, setRejoining] = useState(false)
  const [rejoinError, setRejoinError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setAbout(undefined)
    Promise.resolve(dispatch(fetchRetainedAccessAbout(slug)))
      .then(result => {
        if (!cancelled) setAbout(result?.payload?.data?.retainedAccessAbout || null)
      })
      .catch(() => {
        if (!cancelled) setAbout(null)
      })
    return () => { cancelled = true }
  }, [dispatch, slug])

  const parentGroup = about?.parentGroupSlug
    ? { name: about.parentGroupName, slug: about.parentGroupSlug }
    : null
  const isSpace = about?.type === 'space'
  const canonicalAboutUrl = isSpace && parentGroup
    ? spaceUrl(parentGroup.slug, localSpaceSlug(parentGroup.slug, about.slug), 'about')
    : groupUrl(about?.slug, 'about')

  const handleRejoin = useCallback(async () => {
    if (!about?.id || (isSpace && !about.hasActiveParentMembership)) return
    setRejoinError(false)
    setRejoining(true)
    try {
      await dispatch(rejoinGroup(about.id))
      if (isSpace && parentGroup) {
        const homeRoute = spaceHomeRoutePath({ homeRoute: about.homeRoute })
        navigate(spaceUrl(parentGroup.slug, localSpaceSlug(parentGroup.slug, about.slug), homeRoute))
      } else {
        navigate(`/groups/${about.slug}${about.homeRoute || '/all'}`)
      }
    } catch (error) {
      setRejoinError(true)
    } finally {
      setRejoining(false)
    }
  }, [about, dispatch, isSpace, navigate, parentGroup])

  if (about === undefined) return <Loading />
  if (!about) {
    return fallbackUrl ? <Navigate to={`${fallbackUrl}${location.search}`} replace /> : <NotFound />
  }
  if (location.pathname.replace(/\/$/, '') !== canonicalAboutUrl) {
    return <Navigate to={`${canonicalAboutUrl}${location.search}`} replace />
  }

  return (
    <div className='mx-auto w-full max-w-[750px] p-4 sm:p-6'>
      <div
        className={`mb-5 overflow-hidden rounded-xl bg-cover bg-center px-6 py-12 text-center shadow-xl ${about.bannerUrl ? 'text-white' : 'bg-foreground/5 text-foreground'}`}
        style={about.bannerUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.68)), url(${about.bannerUrl})` } : undefined}
      >
        {about.avatarUrl && <img src={about.avatarUrl} alt='' className='mx-auto mb-3 h-16 w-16 rounded-xl object-cover' />}
        <h1 className='m-0 text-2xl font-bold'>{about.name}</h1>
        {about.purpose && <p className='mb-0 mt-2'>{about.purpose}</p>}
      </div>
      {about.description && (
        <div className='mb-5 text-sm text-foreground/75 global-postContent'>
          <ClickCatcher groupSlug={about.slug}>
            <HyloHTML html={about.description} />
          </ClickCatcher>
        </div>
      )}
      <RetainedAccessPanel
        group={about}
        isSpace={isSpace}
        parentGroup={parentGroup}
        hasActiveParentMembership={about.hasActiveParentMembership}
        onRejoin={handleRejoin}
        rejoining={rejoining}
        error={rejoinError}
      />
    </div>
  )
}
