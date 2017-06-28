/* eslint-disable camelcase */
import React from 'react'
import { FlatList } from 'react-native'
import Comment from '../Comment'
const { func, array } = React.PropTypes
import styles from './Comments.styles'

export default class Comments extends React.Component {
  static propTypes = {
    comments: array,
    fetchComments: func
  }

  render () {
    const {
      comments
    } = this.props

    console.log('rendering comments', comments)

    return <FlatList
      data={comments}
      renderItem={({ item }) => <Comment comment={item} style={styles.commentRow} />}
      keyExtractor={(item, index) => item.id}
    />
  }
}
