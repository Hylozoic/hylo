import React from 'react'
import FlagGroupContent from './FlagGroupContent'
import ReactDOM from 'react-dom'

/**
 * Mount the flag dialog on document.body. Dialog hosts such as
 * #post-dialog-content use transform + overflow, which traps position:fixed
 * and clips this form (submit and the lower agreement lists disappear).
 */
export default function FlagGroupContentPortal (props) {
  if (typeof document === 'undefined') return null
  return ReactDOM.createPortal(
    <FlagGroupContent {...props} />,
    document.body
  )
}
