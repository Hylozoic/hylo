import { useState } from 'react'
import { Alert, Pressable, type PressableProps } from 'react-native'
import * as ImagePickerExpo from 'expo-image-picker'
import { uploadFile } from 'util/upload'

type ImagePickerProps = PressableProps & {
  type: string
  id?: string
  cameraType?: 'front' | 'back'
  onChoice: (result: { local: string, remote: string | null }) => void
  onPendingChange?: (pending: boolean) => void
  children: React.ReactNode
}

export default function ImagePicker ({
  type,
  id = 'new',
  cameraType = 'back',
  onChoice,
  onPendingChange,
  children,
  ...pressableProps
}: ImagePickerProps) {
  const [pending, setPending] = useState(false)

  const setPendingState = (value: boolean) => {
    setPending(value)
    onPendingChange?.(value)
  }

  const handleAsset = async (asset: ImagePickerExpo.ImagePickerAsset) => {
    const file = {
      uri: asset.uri,
      name: asset.fileName ?? 'photo.jpg',
      type: asset.mimeType ?? 'image/jpeg'
    }

    onChoice({ local: asset.uri, remote: null })

    try {
      const result = await uploadFile(type, id, file)
      onChoice({ local: asset.uri, remote: result.url })
    } catch (error) {
      console.warn('Image upload failed:', error)
      Alert.alert('Upload failed', (error as Error).message)
    } finally {
      setPendingState(false)
    }
  }

  const pickFromLibrary = async () => {
    if (pending) return
    const permission = await ImagePickerExpo.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return

    setPendingState(true)
    const result = await ImagePickerExpo.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      copyToCacheDirectory: true,
      quality: 0.9
    })

    if (result.canceled || !result.assets?.[0]) {
      setPendingState(false)
      return
    }

    await handleAsset(result.assets[0])
  }

  const pickFromCamera = async () => {
    if (pending) return
    const permission = await ImagePickerExpo.requestCameraPermissionsAsync()
    if (!permission.granted) return

    setPendingState(true)
    const result = await ImagePickerExpo.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: cameraType === 'front'
        ? ImagePickerExpo.CameraType.front
        : ImagePickerExpo.CameraType.back,
      copyToCacheDirectory: true,
      quality: 0.9
    })

    if (result.canceled || !result.assets?.[0]) {
      setPendingState(false)
      return
    }

    await handleAsset(result.assets[0])
  }

  const showMenu = () => {
    if (pending) return
    Alert.alert('Choose photo', undefined, [
      { text: 'Choose from library', onPress: pickFromLibrary },
      { text: 'Take photo', onPress: pickFromCamera },
      { text: 'Cancel', style: 'cancel' }
    ])
  }

  return (
    <Pressable onPress={showMenu} disabled={pending} {...pressableProps}>
      {children}
    </Pressable>
  )
}
