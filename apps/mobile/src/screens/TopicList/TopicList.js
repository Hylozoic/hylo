import React from 'react'
import { FlatList, Text, View } from 'react-native'
import { isEmpty } from 'lodash/fp'
import { array, func } from 'prop-types'
import TopicRow from './TopicRow'
import styles from './TopicList.styles'
import { withTranslation } from 'react-i18next'

class TopicList extends React.Component {
  static propTypes = {
    touchAction: func,
    topics: array
  }

  renderTopicRow = ({ item }) => <TopicRow item={item} onPress={this.props.touchAction} />

  render () {
    const { topics, t } = this.props

    return (
      <View style={styles.topicList}>
        {isEmpty(topics)
          ? <Text style={styles.emptyList}>{t('No topics match your search')}</Text>
          : <FlatList
              data={topics}
              renderItem={this.renderTopicRow}
              keyboardShouldPersistTaps='handled'
              keyExtractor={i => i.id}
            />}
      </View>
    )
  }
}

export default withTranslation()(TopicList)
