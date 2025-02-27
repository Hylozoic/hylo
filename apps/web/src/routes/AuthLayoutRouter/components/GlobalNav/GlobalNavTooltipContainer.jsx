import React from 'react'

/**
 * Container for global navigation tooltips with gradient fade
 */
function GlobalNavTooltipContainer({ children }) {
  return (
    <div className='relative h-full'>
      <div className='absolute inset-0 overflow-hidden'>
        {children}
      </div>
      <div
        className='absolute bottom-0 left-0 right-0 h-32 pointer-events-none'
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,1) 100%)'
        }}
      />
    </div>
  )
}

export default GlobalNavTooltipContainer
