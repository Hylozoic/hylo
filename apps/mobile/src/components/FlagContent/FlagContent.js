import React, { useState } from 'react'
import { Modal, Text, TouchableOpacity, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import prompt from 'react-native-prompt-android'
import { toUpper, isEmpty, trim } from 'lodash'
import { gql, useMutation } from 'urql'
import Icon from 'components/Icon'
import Colors from '../../style/theme-colors'

const flagInappropriateContentMutation = gql`
  mutation FlagInappropriateContentMutation ($category: String, $reason: String, $linkData: LinkDataInput) {
    flagInappropriateContent(data: {category: $category, reason: $reason, linkData: $linkData}) {
      success
    }
  }
`

const FlagContent = ({ onClose, submitFlagContent, linkData, type = 'content' }) => {
  const { t } = useTranslation()
  const [, flagInappropriateContent] = useMutation(flagInappropriateContentMutation)
  const [visible, setVisible] = useState(false)
  const [highlightRequired, setHighlightRequired] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('')

  const closeModal = () => {
    setVisible(false)
    setHighlightRequired(false)
    if (onClose) {
      onClose()
    }
  }

  const isOptionalExplanation = (category) =>
    (category || selectedCategory) !== 'other'

  const submit = (value) => {
    if (!isOptionalExplanation() && isEmpty(trim(value))) {
      setHighlightRequired(true)
      showPrompt(selectedCategory)
    } else {
      flagInappropriateContent({ category: selectedCategory, reason: trim(value), linkData })
      closeModal()
    }
  }

  const showPrompt = (category) => {
    setSelectedCategory(category)

    let subtitle = `${t('Why was this')} ${type} '${category}'`
    if (!isOptionalExplanation(category) && highlightRequired) {
      subtitle += t(' (explanation required)')
    }

    prompt(
      'Flag',
      subtitle,
      [
        { text: t('Cancel'), onPress: closeModal, style: 'cancel' },
        { text: t('Submit'), onPress: value => submit(value) }
      ],
      { cancelable: false }
    )
  }

  const options = [
    { title: t('Inappropriate Content'), id: 'inappropriate' },
    { title: t('Spam'), id: 'spam' },
    { title: t('Offensive'), id: 'offensive' },
    { title: t('Illegal'), id: 'illegal' },
    { title: t('Other'), id: 'other' }
  ]

  return (
    <Modal transparent visible={visible} onRequestClose={closeModal}>
      <View style={styles.dialog}>
        <View style={styles.dialogOverlay} />
        <View style={styles.spacer} />
        <View style={styles.dialogContent}>
          <View style={styles.title}>
            <Text style={styles.titleText}>
              {t('FLAG THIS')} {toUpper(type)}
            </Text>
            <TouchableOpacity onPress={closeModal}>
              <Icon name='Ex' style={styles.icon} />
            </TouchableOpacity>
          </View>
          <FlashList
            data={options}
            renderItem={({ item }) => (
              <FlagOption id={item.id} title={item.title} onPress={() => showPrompt(item.id)} />
            )}
            keyExtractor={item => item.id}
          />
        </View>
      </View>
    </Modal>
  )
}

export const FlagOption = ({ id, title, onPress }) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress}>
    <Text style={styles.actionText}>{title}</Text>
  </TouchableOpacity>
)

const styles = {
  dialog: {
    flex: 1
  },
  dialogOverlay: {
    backgroundColor: 'rgba(44, 64, 90, 0.7)',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  },
  spacer: {
    flex: 1
  },
  dialogContent: {
    height: 362,
    justifyContent: 'flex-end',
    flexDirection: 'column',
    backgroundColor: 'white',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderColor: Colors.mutedForeground,
    overflow: 'hidden'
  },
  title: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 60,
    borderColor: Colors.mutedForeground,
    borderBottomWidth: 0.5
  },
  titleText: {
    fontFamily: 'Circular-Bold',
    color: Colors.mutedForeground,
    fontSize: 12,
    flex: 1
  },
  icon: {
    width: 20,
    color: Colors.mutedForeground,
    fontSize: 22,
    marginRight: 4
  },
  actionButton: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: Colors.mutedForeground
  },
  actionText: {
    fontFamily: 'Circular-Book',
    color: Colors.foreground,
    fontSize: 16
  }
}

export default FlagContent
