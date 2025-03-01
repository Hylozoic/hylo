import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { launchImageLibrary, launchCamera } from 'react-native-image-picker'
import uploadAction from 'store/actions/upload'
import Icon from 'components/Icon'
import PopupMenuButton from 'components/PopupMenuButton'

/*
  Example usage:

  <ImagePicker
    title='Pick an image'
    type='userAvatar'
    onChoice={({ local, remote }) => console.log('chosen', {local, remote})}
    onPendingChange={pending => this.setState({imagePickerPending: pending})}>
    {state.imagePickerPending ? showOneThing : showAnother}
  </ImagePicker>

  NOTE: `onChoice` will be called twice, once with only a `local` image URI. and a second
  time with a value also for `remote` which indicates that uploading to the server has completed.
  `pending` will remain true until the upload is complete.
*/

export default function ImagePicker (props) {
  const { onPendingChange, style, iconStyle, iconStyleLoading, disabled } = props
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const [pending, providedSetPending] = useState(false)

  const setPending = newPending => {
    providedSetPending(newPending)
    onPendingChange && onPendingChange(newPending)
  }

  const showPicker = async () => {
    if (pending) return

    setPending(true)
    await showImagePicker({
      ...props,
      upload: (type, id, file) => dispatch(uploadAction(type, id, file)),
      includeExif: true,
      onCancel: () => setPending(false),
      onComplete: () => setPending(false)
    })
  }

  const showPickerCamera = async () => {
    if (pending) return

    setPending(true)
    await showImagePickerCamera({
      ...props,
      includeExif: true,
      compressImageQuality: 0.99,
      onCancel: () => setPending(false),
      onComplete: () => setPending(false)
    })
  }
  const MenuElement = (disabled || pending)
    ? View
    : PopupMenuButton

  const imagePickerOptions = [
    [t('Choose from library'), showPicker],
    [t('Take photo'), showPickerCamera]
  ]

  return (
    <MenuElement actions={imagePickerOptions} style={style}>
      {!props.children && props.renderPicker && props.renderPicker(pending)}
      {!props.renderPicker && (props.children || (
        <Icon name='AddImage' style={[styles.icon, pending ? iconStyleLoading : iconStyle]} />
      ))}
    </MenuElement>
  )
}

export async function showImagePickerCamera (params) {
  return showImagePicker({ pickerFunc: launchCamera, ...params })
}

export async function showImagePicker ({
  pickerFunc = launchImageLibrary,
  onChoice,
  onCancel,
  onError,
  onComplete,
  type,
  id = 'new',
  upload,
  selectionLimit = 1,
  cameraType = 'back'
}) {
  const pickerOptions = {
    selectionLimit,
    mediaType: 'photo',
    cameraType
  }

  pickerFunc(pickerOptions, async result => {
    if (result.didCancel) {
      onCancel && onCancel()
    } else if (result.error) {
      onError && onError(result.error)
    } else {
      const { assets } = result
      let fileUploaders = []

      assets.forEach(asset => {
        fileUploaders = [
          ...fileUploaders,
          (async () => {
            const file = {
              uri: asset.uri,
              name: asset.fileName,
              type: asset.type
            }

            onChoice && onChoice({ local: asset.uri, remote: null })

            const response = await upload(type, id, file)
            const { payload, error } = response

            if (error) {
              onError && onError(payload.message, { local: asset.uri, remote: null })
            } else {
              onChoice && onChoice({ local: asset.uri, remote: payload.url })
            }
          })()
        ]
      })

      const uploadedFiles = await Promise.all(fileUploaders)

      onComplete && onComplete(uploadedFiles)
    }
  })
}

const styles = {
  icon: {
    fontSize: 36
  }
}
