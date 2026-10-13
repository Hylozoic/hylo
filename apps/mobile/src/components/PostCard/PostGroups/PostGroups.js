import React, { useCallback, useState } from 'react'
import { Text, View, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { isEmpty } from 'lodash/fp'
import useStaticContexts from '@hylo/hooks/useStaticContexts'
import { useChangeToGroup } from 'hooks/useHandleCurrentGroup'
import GroupsList from 'components/GroupsList'
import Icon from 'components/Icon'
import { caribbeanGreen, rhino40 } from '@hylo/presenters/colors'

export default function PostGroups ({
  groups: providedGroups,
  includePublic,
  className,
  style
}) {
  const { t } = useTranslation()
  const { publicContext } = useStaticContexts()
  const [expanded, setExpanded] = useState(false)
  const toggleExpanded = () => setExpanded(!expanded)

  const groups = includePublic ? [...providedGroups, publicContext] : providedGroups

  // don't show if there are no groups or there is exactly 1 group and the flag isn't set
  if (isEmpty(groups)) {
    return null
  }

  return (
    <View className={className} style={[style, expanded && styles.expanded]}>
      <TouchableOpacity onPress={toggleExpanded}>
        <View style={styles.row}>
          <Text style={styles.reminderText}>{t('Posted In')} </Text>
          {!expanded && (
            <GroupsListSummary groups={groups} />
          )}
          <Icon
            name={expanded ? 'ArrowUp' : 'ArrowDown'}
            style={styles.arrowIcon}
          />
        </View>
      </TouchableOpacity>
      {expanded && (
        <GroupsList
          style={[style, { backgroundColor: 'transparent' }]}
          groups={groups}
        />
      )}
    </View>
  )
}

export function GroupsListSummary ({ groups }) {
  const { t } = useTranslation()
  const changeToGroup = useChangeToGroup()
  const changeToFirstGroup = useCallback(
    slug => changeToGroup(groups[0].slug, { confirm: true }),
    [groups[0].slug]
  )
  const moreGroups = groups.length > 1
  const othersText = n => (n === 1 ? t('1 other') : `${n} ${t('others')}`)

  return (
    <View style={[styles.groupList, styles.row]}>
      <TouchableOpacity onPress={changeToFirstGroup}>
        <Text style={styles.linkText} numberOfLines={1}>
          {groups[0].name}
        </Text>
      </TouchableOpacity>
      {moreGroups && (
        <View style={[styles.row]}>
          <Text style={styles.reminderText}> {t('and')} {othersText(groups.length - 1)}</Text>
        </View>
      )}
    </View>
  )
}

const styles = {
  expanded: {
    flexDirection: 'column',
    alignItems: 'stretch'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  groupList: {
    justifyContent: 'flex-start'
  },
  linkText: {
    color: caribbeanGreen,
    fontSize: 12,
    fontFamily: 'Circular-Book'
  },
  arrowIcon: {
    color: rhino40,
    marginLeft: 7,
    fontSize: 16
  },
  reminderText: {
    color: rhino40,
    fontSize: 12,
    fontFamily: 'Circular-Book'
  }
}
