import React, { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import ExplorerBanner from './ExplorerBanner'
import GroupViewFilter from './GroupViewFilter'
import GroupSearch from './GroupSearch'
import { ALL_VIEW } from 'util/constants'

export default function GroupExplorer ({
  currentUser,
  currentUserHasMemberships
}) {
  const [viewFilter, setViewFilter] = useState(ALL_VIEW)

  const handleChangeViewFilter = (value) => setViewFilter(value)

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({ title: '', icon: '', info: '', search: false })
  }, [])

  return (
    <>
      <Helmet>
        <title>Group Explorer | Hylo</title>
        <meta name='description' content='Find the others on Hylo' />
      </Helmet>
      <ExplorerBanner />
      <GroupViewFilter viewFilter={viewFilter} changeView={handleChangeViewFilter} />
      <GroupSearch viewFilter={viewFilter} />
    </>
  )
}
