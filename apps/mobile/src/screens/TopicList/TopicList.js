import React from 'react'
import { FlatList, Text, View, StyleSheet } from 'react-native'
import { isEmpty } from 'lodash/fp'
import PropTypes from 'prop-types'
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
          <FlatList
            data={topics}
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
