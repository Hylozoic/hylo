import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import Loading from 'components/Loading'
import MetricsPanel from 'components/metrics/MetricsPanel'

/** A group's own metrics, for its stewards. */
export default function InsightsTab ({ group }) {
  const { t } = useTranslation()
  const { setHeaderDetails } = useViewHeader()

  useEffect(() => {
    setHeaderDetails({
      title: {
        desktop: `${t('Group Settings')} > ${t('Insights')}`,
        mobile: t('Insights')
      },
      icon: 'Settings'
    })
  }, [setHeaderDetails, t])

  if (!group) return <Loading />
  return <MetricsPanel groupId={group.id} />
}
