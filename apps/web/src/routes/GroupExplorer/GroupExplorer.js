import React, { useState } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import FeaturedGroups from './FeaturedGroups'
import GroupSearch from './GroupSearch'
import { ALL_VIEW } from 'util/constants'

// Get featured group IDs from environment variable or fallback to default list
const FEATURED_GROUP_IDS = import.meta.env.VITE_FEATURED_GROUP_IDS?.split(',') || []

export default function GroupExplorer ({
  currentUser,
  currentUserHasMemberships
}) {
  const { t } = useTranslation()
  const [viewFilter, setViewFilter] = useState(ALL_VIEW)

  const handleChangeViewFilter = (value) => setViewFilter(value)

  const { setHeaderDetails } = useViewHeader()
  React.useEffect(() => {
    setHeaderDetails({
      title: t('Group Explorer'),
      icon: '',
      info: '',
      search: true
    })
  }, [setHeaderDetails])

  return (
    <div className='w-full max-w-screen-md mx-auto pt-8 pb-8 min-h-screen'>
      <Helmet>
        <title>{t('Group Explorer')} | Hylo</title>
        <meta name='description' content='Find the others on Hylo' />
      </Helmet>
      <FeaturedGroups groupIds={FEATURED_GROUP_IDS} />
      <GroupSearch viewFilter={viewFilter} changeView={handleChangeViewFilter} />
    </div>
  )
}
