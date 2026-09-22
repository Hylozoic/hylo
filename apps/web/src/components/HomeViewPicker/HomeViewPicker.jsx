import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import GroupViewIcon from 'routes/AuthLayoutRouter/components/ContextMenu/GroupViewIcon'
import SegmentedPicker from 'components/SegmentedPicker/SegmentedPicker'
import { CUSTOM_HOME_VIEW } from 'store/models/GroupView'

// What each of the other menu items is, for when one of them is the home view.
const VIEW_TYPE_DESCRIPTIONS = {
  discussions: 'All your discussions in one place',
  events: 'Everything your group has coming up',
  'requests-and-offers': 'What people need, and what they can offer',
  resources: 'The resources your group has gathered',
  proposals: 'Decisions your group is making together',
  projects: 'The work your group has underway',
  members: 'Everyone who is part of your group'
}

// One control: a segmented toggle whose selection swaps the description beneath it,
// rather than cards each repeating their own explanation. Promoting any other menu
// item to the top makes it the home, so it takes the first segment's place — the
// segments are shortcuts to the top of the menu, not a separate setting.
export default function HomeViewPicker ({ value, onChange, customHomeRow, options: baseOptions }) {
  const { t } = useTranslation()

  const options = useMemo(() => {
    if (!customHomeRow) return baseOptions
    const presented = GroupViewPresenter({ type: customHomeRow.type, name: customHomeRow.name, pageContent: customHomeRow.pageContent })
    const name = customHomeRow.name || displayNameForView(presented, t)
    const description = VIEW_TYPE_DESCRIPTIONS[customHomeRow.type]
    return [
      {
        value: CUSTOM_HOME_VIEW,
        title: name,
        translated: true,
        description: description ? t(description) : t('Members will land on {{name}} when they enter your group.', { name }),
        renderIcon: className => <GroupViewIcon view={presented} className={className} />
      },
      ...baseOptions.slice(1)
    ]
  }, [customHomeRow, t, baseOptions])

  const segments = options.map(option => ({
    value: option.value,
    label: option.translated ? option.title : t(option.title),
    description: option.translated ? option.description : t(option.description),
    icon: option.icon,
    renderIcon: option.renderIcon,
    disabled: option.value === CUSTOM_HOME_VIEW
  }))

  // Container restyled to read like the Additional settings panels
  return <SegmentedPicker value={value} onChange={onChange} options={segments} className='rounded-xl border border-foreground/10 bg-foreground/5 p-2' />
}
