import { Dimensions } from 'react-native'
import { black10onRhino } from '@hylo/presenters/colors'

export default imageCount => {
  const containerWidth = Dimensions.get('window').width - 25
  const imageMargin = 5
  const minImageWidth = 100
  const minImageWithMargin = minImageWidth + imageMargin
  const maxImagesPerRow = (containerWidth / minImageWithMargin) > 0
    ? (containerWidth / minImageWithMargin)
    : 1
  const imageWidth = imageCount > maxImagesPerRow
    ? containerWidth / maxImagesPerRow
    : (containerWidth / imageCount)

  return {
    imageGrid: {
      paddingHorizontal: 10
    },
    image: {
      marginRight: imageMargin,
      width: imageWidth,
      height: imageWidth,
      resizeMode: 'cover',
      borderRadius: 4
    },
    imageLoading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: black10onRhino,
      opacity: 0.5
    }
  }
}
