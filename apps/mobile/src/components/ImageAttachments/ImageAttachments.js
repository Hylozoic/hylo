import React from 'react'
import { Dimensions, TouchableHighlight, View } from 'react-native'
import { isEmpty } from 'lodash'
import FastImage from 'react-native-fast-image'
import { ImageViewerButton } from 'components/ImageViewer/ImageViewer'

export default function ImageAttachments ({
  children,
  creator,
  firstImageStyle,
  isFlagged,
  images,
  onlyLongPress,
  onPress,
  style,
  title
}) {
  if (isEmpty(images)) return null

  return (
    <>
      <ImageViewerButton
        images={images}
        title={title}
        creator={creator}
        onlyLongPress={onlyLongPress}
        onPress={onPress}
        style={style}
        renderImages={(pressableHandlersAtIndex, index) => (
          <FastImage
            key={index}
            style={firstImageStyle}
            imageStyle={[styles.backgroundImage]}
            source={{ uri: images[0]?.uri || images[0]?.url }}
          >
            <View style={styles.container}>
              <View>{children}</View>
              <View style={styles.background}>
                {images.slice(1).map((image, index) => (
                  <TouchableHighlight
                    {...pressableHandlersAtIndex(index + 1)}
                    key={index}
                    style={styles.thumbnailWrapper}
                  >
                    <FastImage
                      source={{ uri: image?.uri || image?.url }}
                      style={styles.thumbnail}
                    />
                  </TouchableHighlight>
                ))}
              </View>
            </View>
          </FastImage>
        )}
      />
    </>
  )
}

// this is from fudging and looking at how it turns out. since it's fixed, the
// aspect ratio of the image is slightly different between the stream and post
// details.
const backgroundHeight = Dimensions.get('window').width * 0.62

const styles = {
  container: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: backgroundHeight
  },
  background: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'flex-end'
  },
  backgroundImage: {
    resizeMode: 'cover',
    borderRadius: 10,
    overflow: 'hidden'
  },
  thumbnailWrapper: {
    margin: 8,
    marginLeft: 4
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: 'white'
  }
}
