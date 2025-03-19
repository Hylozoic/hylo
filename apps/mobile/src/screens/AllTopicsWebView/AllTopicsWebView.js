import React from 'react'
import { ALL_GROUPS_CONTEXT_SLUG } from '@hylo/shared'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import HyloWebView from 'components/HyloWebView'

export default function AllTopicsWebView () {
  const [{ currentGroup }] = useCurrentGroup()
  const path = currentGroup?.slug === ALL_GROUPS_CONTEXT_SLUG
    ? `/${currentGroup?.slug}/topics`
    : `/groups/${currentGroup?.slug}/topics`

  return (
    <HyloWebView path={path} />
  )
}
