import React from 'react'
import { bgImageStyle, cn } from 'util/index'
import classes from './LoadingItems.module.scss'

export default function LoadingItems () {
  return (
    <div className={classes.loader}>
      <div className={cn(classes.loaderImage)} style={bgImageStyle('/assets/thinking-axolotl.png')} />
      <div className={cn(classes.loaderAnimation)}>
        <svg version='1.1' viewBox='0 0 100 100' enableBackground='new 0 0 0 0'>
          <circle fill='#BBB' stroke='none' cx='6' cy='6' r='6'>
            <animate
              attributeName='opacity'
              dur='1s'
              values='0;1;0'
              repeatCount='indefinite'
              begin='0.1'
            />
          </circle>
          <circle fill='#BBB' stroke='none' cx='26' cy='6' r='6'>
            <animate
              attributeName='opacity'
              dur='1s'
              values='0;1;0'
              repeatCount='indefinite'
              begin='0.2'
            />
          </circle>
          <circle fill='#BBB' stroke='none' cx='46' cy='6' r='6'>
            <animate
              attributeName='opacity'
              dur='1s'
              values='0;1;0'
              repeatCount='indefinite'
              begin='0.3'
            />
          </circle>
        </svg>
      </div>
    </div>
  )
}
