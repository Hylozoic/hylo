import { cn } from 'util/index'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import AtAGlanceWidget from 'components/Widget/AtAGlanceWidget'
import EventsWidget from 'components/Widget/EventsWidget'
import OffersAndRequestsWidget from 'components/Widget/OffersAndRequestsWidget'
import ProjectsWidget from 'components/Widget/ProjectsWidget'
import useGetWidgetItems from 'hooks/useGetWidgetItems'
import FarmDetailsWidget from './FarmDetailsWidget'
import FarmOpenToPublic from './FarmOpenToPublic'
import FarmMapWidget from './FarmMapWidget'
import OpportunitiesToCollaborateWidget from './OpportunitiesToCollaborateWidget'
import RichTextWidget from './RichTextWidget'
import useEnsureCurrentGroup from 'hooks/useEnsureCurrentGroup'

import classes from './Widget.module.scss'

/** Renders one farm-profile widget. The name selects the component and its data. */
export default function Widget (props) {
  const { t } = useTranslation()
  const WIDGETS = {
    relevant_requests_offers: {
      title: t('Nearby Relevant Offers and Requests'),
      component: OffersAndRequestsWidget
    },
    relevant_events: {
      title: t('Nearby Relevant Events'),
      component: EventsWidget
    },
    relevant_project_activity: {
      title: t('Recently Active Projects'),
      component: ProjectsWidget
    },
    farm_at_a_glance: {
      title: t('At A Glance'),
      component: AtAGlanceWidget
    },
    farm_details: {
      title: t('Farm Details'),
      component: FarmDetailsWidget
    },
    farm_open_to_public: {
      title: t('Location & Hours'),
      component: FarmOpenToPublic
    },
    farm_map: {
      title: t('Farm Surrounds & Posts'),
      component: FarmMapWidget
    },
    opportunities_to_collaborate: {
      title: t('Opportunities to Collaborate'),
      component: OpportunitiesToCollaborateWidget
    },
    mission: {
      title: null,
      component: RichTextWidget
    }
  }

  const { isVisible, name, posts, isMember, settings = {} } = props
  const routeParams = useParams()
  const { group } = useEnsureCurrentGroup()
  const widgetItems = useGetWidgetItems({ name, group, posts })
  const widget = WIDGETS[name]

  if (!widget || !isVisible || !widgetItems) return null

  return (
    <div className={cn('Widget', classes.widget)}>
      {widget.title && (
        <div className={classes.header}>
          <h3>{widget.title}</h3>
        </div>
      )}
      <div className={classes.content}>
        {React.createElement(widget.component, { items: widgetItems, group, routeParams, settings, isMember: !!isMember })}
      </div>
    </div>
  )
}
