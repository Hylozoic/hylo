import React from 'react'
import { View, Image, Text } from 'react-native'
import ImagePicker from 'components/ImagePicker'
import Button from 'components/Button'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import styles from './SignupFlow2.styles'

export default class SignupFlow2 extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      localUri: null,
      imagePickerPending: false
    }
  }

  onChoice ({ local, remote }) {
    this.props.changeSetting('avatarUrl')(remote)
    this.setState({ localUri: local })
  }

  render () {
    const { currentUser, saveAndNext, avatarUrl } = this.props
    const { localUri, imagePickerPending } = this.state
    const imageSource = localUri
      ? { uri: localUri }
      : avatarUrl && { uri: avatarUrl }

    const imagePickerChildren = imageSource && !imagePickerPending
      ? <Image style={styles.image} source={imageSource} />
      : (
        <View style={styles.imagePickerBackground}>
          {imagePickerPending ? <Loading /> : <Icon name='AddImage' style={styles.cameraIcon} />}
        </View>
        )

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Upload a Photo</Text>
        </View>
        <View style={styles.content}>
          <ImagePicker
            type='userAvatar'
            cameraType='front'
            id={currentUser.id}
            onChoice={choice => this.onChoice(choice)}
            onPendingChange={pending => this.setState({ imagePickerPending: pending })}
            children={imagePickerChildren}
          /> 
        </View>
        <View style={styles.footer}>
          <Button
            style={styles.continueButton}
            text='Continue'
            onPress={saveAndNext}
          />
        </View>
      </View>
    )
  }
}
