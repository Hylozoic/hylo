import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import MetricsPanel from 'components/metrics/MetricsPanel'

/** Platform-wide metrics for Hylo admins. */
export default function PlatformMetrics () {
  const { t } = useTranslation()
  const { setHeaderDetails } = useViewHeader()

  useEffect(() => {
    setHeaderDetails({ title: t('Platform health'), icon: '' })
  }, [setHeaderDetails, t])

  return <MetricsPanel signupMetric />
}
