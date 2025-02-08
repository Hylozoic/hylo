import React from 'react'
import { View, ImageBackground, ActivityIndicator } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { isEmpty } from 'lodash/fp'
import PopupMenuButton from 'components/PopupMenuButton'
import stylesGenerator from './ImageSelector.styles'
import { useTranslation } from 'react-i18next'

export default function ImageSelector ({ images = [], onRemove, style }) {
  if (isEmpty(images)) return null

  const { t } = useTranslation()
  const styles = stylesGenerator(images.length)

  const renderImage = ({ item: image, index }) => (
    <PopupMenuButton
      key={index}
      style={styles.imageActionsButton}
      actions={[[t('Remove image'), () => onRemove(image)]]}
      destructiveButtonIndex={0}
    >
      <ImageBackground style={styles.image} source={{ uri: image?.local || image?.url }}>
        {!image?.url && (
          <View style={styles.imageLoading}>
            <ActivityIndicator size='large' />
          </View>
        )}
      </ImageBackground>
    </PopupMenuButton>
  )

  return (
    <FlashList
      data={images}
      estimatedItemSize={100}
      horizontal
      keyExtractor={(_, index) => index}
      renderItem={renderImage}
      style={[styles.imageGrid, style]}
    />
  )
}
