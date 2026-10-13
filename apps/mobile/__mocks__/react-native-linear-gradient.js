import React from 'react'

module.exports = function MockLinearGradient ({ children, ...forwardedProps }) {
  return <div {...forwardedProps}>{children}</div>
}
