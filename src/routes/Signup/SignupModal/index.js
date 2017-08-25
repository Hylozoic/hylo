import React from 'react'
import ReactCSSTransitionGroup from 'react-addons-css-transition-group'

import CreateCommunity from '../CreateCommunity'
import '../Signup.scss'
export default function SignupModal (props, thing) {
  console.log('SignupModal props', props)
  console.log('SignupModal thing', thing)

  return <ReactCSSTransitionGroup
    transitionName='post-editor'
    transitionAppear
    transitionAppearTimeout={400}
    transitionEnterTimeout={400}
    transitionLeaveTimeout={300}>
    <div
      styleName='signup-modal'
      key='signup-modal'>
      <div styleName='signup-background' className='signup-background' />
      <div styleName='signup-wrapper' className='signup-wrapper'>
        {<props.child />}
      </div>
    </div>
  </ReactCSSTransitionGroup>
}
