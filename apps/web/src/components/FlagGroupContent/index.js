import React from 'react'
import FlagGroupContent from './FlagGroupContent'
import ReactDOM from 'react-dom'
import { rootDomId } from 'client/util'

const FlagGroupContentPortal = function (props) {
  const container = document.getElementById('post-dialog-content') || document.getElementById(rootDomId)
  return ReactDOM.createPortal(
    <FlagGroupContent {...props} />,
    container
  )
}

export default FlagGroupContentPortal
