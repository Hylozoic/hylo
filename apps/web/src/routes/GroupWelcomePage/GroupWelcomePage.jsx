import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
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
    <div className='p-4'>
      <HyloHTML html={group.welcomePage} />
    </div>
  )
}

export default GroupWelcomePage
