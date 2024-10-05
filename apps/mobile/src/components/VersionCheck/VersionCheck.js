import React from 'react'
import { isDev } from 'config'

export default class VersionCheck extends React.PureComponent {
  componentDidMount () {
    !isDev && this.props.checkVersion()
  }

  render () {
    return null
  }
}
