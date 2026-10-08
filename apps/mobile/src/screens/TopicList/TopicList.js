// DEPRECATED: This native screen is no longer used.
// All functionality is now handled by PrimaryWebView displaying the web app.
// Kept for reference only.

import React from 'react'
import { Text, View, StyleSheet } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { isEmpty } from 'lodash/fp'
import TopicRow from './TopicRow'
import { useTranslation } from 'react-i18next'

const TopicList = ({ topics, touchAction }) => {
  const { t } = useTranslation()

  const renderTopicRow = ({ item }) => (
    <TopicRow item={item} onPress={touchAction} />
  )

  return (
    <View style={styles.topicList}>
      {isEmpty(topics)
        ? (
          <Text style={styles.emptyList}>{t('No topics match your search')}</Text>
          )
        : (
          <FlashList
            data={topics}
            estimatedItemSize={50}
            renderItem={renderTopicRow}
            keyboardShouldPersistTaps='handled'
            keyExtractor={(item) => item.id}
          />
          )}
    </View>
  )
}

const styles = StyleSheet.create({
  topicList: {
    paddingVertical: 10,
    paddingHorizontal: 15
  },
  emptyList: {
    fontFamily: 'Circular-Book',
    fontSize: 16
  }
})

export default TopicList
