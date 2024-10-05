import React from 'react'
import {
  TextInput,
  TouchableOpacity,
  View,
  Alert
} from 'react-native'
import { bool, func, string } from 'prop-types'
import { throttle } from 'lodash'

import Icon from 'components/Icon'
import { azureRadiance, rhino30 } from 'style/colors'
import styles from './MessageInput.style'
import { withTranslation } from 'react-i18next'

const IS_TYPING_THROTTLE = 3000
const MIN_INPUT_HEIGHT = 22
const MAX_INPUT_HEIGHT = 100

class MessageInput extends React.PureComponent {
  static propTypes = {
    blurOnSubmit: bool,
    multiline: bool,
    onSubmit: func,
    placeholder: string,
    sendIsTyping: func
  }

  constructor () {
    super()
    this.state = {
      inputHeight: MIN_INPUT_HEIGHT,
      submittable: false
    }
  }

  componentDidMount () {
    const { value, setMessage } = this.props
    if (value) setMessage(value)
    const message = value || ''
    this.setState({
      submittable: message.trim().length > 0
    })
  }

  clear = () => {
    this.setState({
      submittable: false
    })
    this.props.setMessage('')
    this.textInput.clear()
  }

  handleChange = text => {
    this.startTyping()
    this.setState({
      submittable: text.trim().length > 0
    })
    this.props.setMessage(text)
  }

  handleContentSizeChange = ({ nativeEvent }) =>
    this.setState({ inputHeight: nativeEvent.contentSize.height })

  handleSubmit = () => {
    const { submittable } = this.state
    const { message, emptyParticipants, t } = this.props
    const canSend = submittable || message.length > 0
    // NOTE: The calling code is responsible for sanitisation.
    if (canSend && !emptyParticipants) {
      this.props.onSubmit(message)
      this.clear()
    }
    if (emptyParticipants) {
      Alert.alert(
        t('Missing message recipient!'),
        t('Click on a user name or user the search bar'),
        [
          { text: t('Ok') }
        ],
        { cancelable: true }
      )
    }
  }

  restrictedHeight = () => Math.min(
    MAX_INPUT_HEIGHT,
    Math.max(MIN_INPUT_HEIGHT, this.state.inputHeight)
  )

  startTyping = throttle(() => this.props.sendIsTyping && this.props.sendIsTyping(), IS_TYPING_THROTTLE)

  render () {
    const inputProps = {
      // Can be overridden by setting on component
      placeholderTextColor: rhino30,
      value: this.props.message,
      ...this.props,

      // Cannot be overridden
      onChangeText: this.handleChange,
      onContentSizeChange: this.handleContentSizeChange,
      underlineColorAndroid: 'transparent',
      ref: ti => { this.textInput = ti },
      style: { ...styles.input, height: this.restrictedHeight() }
    }
    const { style } = this.props
    const { submittable } = this.state
    const iconStyle = { ...styles.sendButton, color: submittable ? azureRadiance : rhino30 }

    return (
      <View style={[styles.container, style]}>
        <TextInput {...inputProps} />
        <TouchableOpacity onPress={this.handleSubmit}>
          <Icon name='Send' style={iconStyle} />
        </TouchableOpacity>
      </View>
    )
  }
}

export default withTranslation()(MessageInput)