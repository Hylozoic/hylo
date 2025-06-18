import React, { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import FeaturedGroups from './FeaturedGroups'
import GroupSearch from './GroupSearch'
import { ALL_VIEW } from 'util/constants'

export default function GroupExplorer ({
  currentUser,
  currentUserHasMemberships
}) {
  const { t } = useTranslation()
  const [viewFilter, setViewFilter] = useState(ALL_VIEW)

  const handleChangeViewFilter = (value) => setViewFilter(value)

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({ title: t('Group Explorer'), icon: 'Groups', info: '', search: true })
  }, [])

  // Building Hylo, Hylo Alliance, Hylo Community Organizers, CTA, PHA ...?
  const featuredGroupIds = ['20866', '36177', '20966', '20828', '39912']

  return (
    <div className='w-full max-w-screen-md mx-auto pt-8 pb-8 min-h-screen'>
      <Helmet>
        <title>{t('Group Explorer')} | Hylo</title>
        <meta name='description' content='Find the others on Hylo' />
      </Helmet>
      <FeaturedGroups groupIds={featuredGroupIds} />
      <GroupSearch viewFilter={viewFilter} changeView={handleChangeViewFilter} />
    </div>
  )
}
