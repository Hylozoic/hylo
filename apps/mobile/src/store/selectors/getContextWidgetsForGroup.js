import { WidgetHelpers } from "@hylo/shared"
import { ALL_GROUPS_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG } from "urql-shared/presenters/GroupPresenter"
const { getStaticMenuWidgets } = WidgetHelpers

export default function getContextWidgetsForGroup (group){
  if (!group) return []
  if ([ALL_GROUPS_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG].includes(group.slug)){
    return getStaticMenuWidgets({ isPublic: group.slug === PUBLIC_CONTEXT_SLUG, isMyContext: group.slug === MY_CONTEXT_SLUG, isAllContext: group.slug === ALL_GROUPS_CONTEXT_SLUG, profileUrl: '' })
  }
  return group?.contextWidgets || []
}
