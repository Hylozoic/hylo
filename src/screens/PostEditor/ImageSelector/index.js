import React from 'react'
import PopupMenuButton from 'components/PopupMenuButton'
import { Image, View } from 'react-native'
import styles from './ImageSelector.styles'

export default function ImageSelector ({ style, imageUrls = [], onRemove }) {
  return (
    <View style={[styles.container, style]}>
      {imageUrls.map((url, index) => renderImageButton(url, index, onRemove))}
    </View>
  )
}

function renderImageButton (imageUrl, buttonIndex, onRemove) {
  return (
    <PopupMenuButton
      key={imageUrl}
      style={styles.addImageButton}
      actions={[['Remove image', () => onRemove(imageUrl)]]}
      destructiveButtonIndex={0}
    >
      <Image style={styles.addImageButtonImage} source={{ uri: imageUrl }} />
    </PopupMenuButton>
  )
}
