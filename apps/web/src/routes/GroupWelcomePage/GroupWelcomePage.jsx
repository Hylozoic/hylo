import React, { useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import isMobile from 'ismobilejs'
import { groupUrl } from '@hylo/navigation'
import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import Button from 'components/ui/button'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import getGroupForSlug from 'store/selectors/getGroupForSlug'

function GroupWelcomePage () {
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const { groupSlug } = routeParams
  const group = useSelector(state => getGroupForSlug(state, groupSlug))

  const { setHeaderDetails } = useViewHeader()

  const homeUrl = useMemo(() => {
    const homeView = (group?.homeRoute || '/stream').replace(/^\//, '')
    return groupUrl(groupSlug, homeView)
  }, [group?.homeRoute, groupSlug])

  useEffect(() => {
    setHeaderDetails({
      title: 'Welcome',
      icon: 'Hand',
      search: true
    })
  }, [])

  return (
    <div className='p-4 global-postContent max-w-[750px] mx-auto'>
      <ClickCatcher groupSlug={groupSlug}>
        <HyloHTML html={group.welcomePage} />
      </ClickCatcher>
      {isMobile.any && (
        <div className='flex justify-center mt-8 pb-4'>
          <Button
            variant='secondary'
            className='w-full max-w-sm rounded-md border-highlight'
            asChild
          >
            <Link to={homeUrl}>
              {t('Go to home view')}
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}

export default GroupWelcomePage
