import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import getGroupForSlug from 'store/selectors/getGroupForSlug'

function GroupWelcomePage () {
  const routeParams = useRouteParams()
  const { groupSlug } = routeParams
  const group = useSelector(state => getGroupForSlug(state, groupSlug))

  const { setHeaderDetails } = useViewHeader()

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
    </div>
  )
}

export default GroupWelcomePage
