import React, { useRef } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import FastImage from 'react-native-fast-image'
import { GROUP_ACCESSIBILITY } from '@hylo/presenters/GroupPresenter'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { useCreateGroupStore } from './CreateGroupFlow.store'
import Icon from 'components/Icon'
import ItemSelectorModal from 'components/ItemSelectorModal'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'

export default function CreateGroupParentGroups ({ navigation }) {
  const { t } = useTranslation()
  const [{ currentUser }] = useCurrentUser()
  const { groupData, updateGroupData } = useCreateGroupStore()
  const parentGroups = groupData.parentGroups
  const setParentGroups = newParentGroups => updateGroupData({ parentGroups: newParentGroups })
  const clearParentGroups = () => setParentGroups([])
  const memberships = currentUser?.memberships
  const parentGroupOptions = memberships
    .filter(m => m.hasModeratorRole || m.group.accessibility === GROUP_ACCESSIBILITY.Open)
    .map((m) => m.group)
    .sort((a, b) => a.name.localeCompare(b.name))

  const groupSelectorModalRef = useRef(null)

  const isChosen = group => !!parentGroups.find(parentGroup => parentGroup.id === group.id)

  const handleAddGroup = group => {
    if (!isChosen(group)) {
      setParentGroups([...parentGroups, group])
    }
  }

  const handleRemoveGroup = removingGroup => {
    setParentGroups(parentGroups.filter(parentGroup => parentGroup.id !== removingGroup.id))
  }

  // Extra step necessary to reject a default group selection which isn't valid
  // groupData.parentGroups.filter(parentGroup => parentGroupOptions.find(validGroup => parentGroup.id === validGroup.id))

  return (
    <KeyboardFriendlyView className='bg-background p-5 flex-1'>
      <Text className='text-foreground text-xl font-bold pb-2.5'>{t('Is this group a member of other groups?')}</Text>
      <Text className='text-foreground/80 mb-2.5'>{t('Please select below:')}</Text>

      <View className='border border-foreground/20 bg-card rounded-lg p-4'>
        <TouchableOpacity
          className='flex-row justify-between items-center'
          onPress={() => groupSelectorModalRef.current.show()}
        >
          <Text className='text-foreground/90 font-bold'>{t('Parent Groups')}</Text>
          <View className='border border-foreground rounded-full p-1'>
            <Icon className='text-foreground text-xl' name='Plus' />
          </View>
        </TouchableOpacity>

        <ItemSelectorModal
          ref={groupSelectorModalRef}
          title={t('Select Parent Groups')}
          items={parentGroupOptions}
          itemsTransform={(items, searchTerm) => (
            items.filter(item => searchTerm
              ? item.name.toLowerCase().match(searchTerm?.toLowerCase())
              : item
            )
          )}
          chosenItems={parentGroups}
          onItemPress={handleAddGroup}
          searchPlaceholder={t('Search for group by name')}
        />

        {parentGroups.length > 0 && (
          <View className='mt-3 space-y-3'>
            {parentGroups.map(group => (
              <GroupRow group={group} onRemove={handleRemoveGroup} key={group.id} />
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity onPress={clearParentGroups}>
        <Text className='text-foreground font-bold mt-2.5 self-end mr-5'>{t('Clear')}</Text>
      </TouchableOpacity>
    </KeyboardFriendlyView>
  )
}

export function GroupRow ({ group, onRemove }) {
  return (
    <View className='flex-row items-center py-0.5 px-1 gap-1'>
      <FastImage
        source={{ uri: group.avatarUrl }}
        style={{ width: 20, height: 20, borderRadius: 10 }}
        className='mr-3'
      />
      <Text className='flex-1 text-foreground text-base font-bold'>{group.name}</Text>
      {onRemove && (
        <TouchableOpacity
          className='ml-3'
          hitSlop={{ top: 5, right: 5, left: 5, bottom: 5 }}
          onPress={() => onRemove(group)}
        >
          <Icon className='text-foreground/60 text-lg' name='Ex' />
        </TouchableOpacity>
      )}
    </View>
  )
}
