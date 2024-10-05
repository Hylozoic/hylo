import React from 'react'
import { Modal, Text, TouchableOpacity, View, FlatList } from 'react-native'
import Icon from 'components/Icon'
import { toUpper, isEmpty, trim } from 'lodash'
import prompt from 'react-native-prompt-android'
import { withTranslation } from 'react-i18next'

class FlagContent extends React.PureComponent {
  state = {
    promptVisible: false,
    highlightRequired: false
  }

  static defaultProps = {
    promptVisible: false,
    highlightRequired: false
  }

  closeModal = () => {
    this.setState({ promptVisible: false, highlightRequired: false })
    if (this.props.onClose) {
      this.props.onClose()
    }
  }

  isOptionalExplanation = (selectedCategory) =>
    (selectedCategory || this.state.selectedCategory) !== 'other'

  submit = (value) => {
    const { submitFlagContent, linkData } = this.props
    const { selectedCategory } = this.state

    if (!this.isOptionalExplanation() && isEmpty(trim(value))) {
      this.setState({ highlightRequired: true })
      this.showPrompt(selectedCategory)
    } else {
      submitFlagContent(selectedCategory, trim(value), linkData)
      this.closeModal()
    }
  }

  cancel = () => {
    this.setState({
      highlightRequired: false
    })
    this.closeModal()
  }

  showPrompt (selectedCategory) {
    this.setState({ selectedCategory })
    const { type = 'content', t } = this.props
    const { highlightRequired } = this.state

    let subtitle = `${t('Why was this')} ${type} '${selectedCategory}'`
    if (!this.isOptionalExplanation(selectedCategory) && highlightRequired) {
      subtitle += t(' (explanation required)')
    }

    prompt(
      'Flag',
      subtitle,
      [
        { text: t('Cancel'), onPress: this.cancel, style: 'cancel' },
        { text: t('Submit'), onPress: value => this.submit(value) }
      ],
      {
        cancelable: false
      }
    )
  }

  render () {
    const { type = 'content', t } = this.props

    const options = [
      { title: t('Inappropriate Content'), id: 'inappropriate' },
      { title: t('Spam'), id: 'spam' },
      { title: t('Offensive'), id: 'offensive' },
      { title: t('Illegal'), id: 'illegal' },
      { title: t('Other'), id: 'other' }
    ]


    return (
      <View>
        <Modal
          transparent
          visible
          onRequestClose={() => this.closeModal()}
        >
          <View style={styles.dialog}>
            <View style={styles.dialogOverlay} />
            <View style={styles.spacer} />
            <View style={styles.dialogContent}>
              <View style={styles.title}>
                <Text style={styles.titleText}>
                  {t('FLAG THIS')} {toUpper(type)}
                </Text>
                <TouchableOpacity onPress={() => this.closeModal()}>
                  <Icon name='Ex' style={styles.icon} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={options}
                renderItem={({ item }) => <FlagOption id={item.id} title={item.title} onPress={() => this.showPrompt(item.id)} />}
                keyExtractor={item => item.id}
              />
            </View>
          </View>
        </Modal>
      </View>
    )
  }
}

export function FlagOption ({ id, title, onPress }) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <Text style={styles.actionText}>{title}</Text>
    </TouchableOpacity>
  )
}

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
    borderColor: '#CCD1D7',
    overflow: 'hidden'
  },
  title: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 60,
    borderColor: '#AAA',
    borderBottomWidth: 0.5
  },
  titleText: {
    fontFamily: 'Circular-Bold',
    color: '#959FAC',
    fontSize: 12,
    flex: 1
  },
  icon: {
    width: 20,
    color: '#959FAC',
    fontSize: 22,
    marginRight: 4
  },
  actionButton: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#CCD1D7'
  },
  actionText: {
    fontFamily: 'Circular-Book',
    color: '#2C405A',
    fontSize: 16
  }
}

export default withTranslation()(FlagContent)
