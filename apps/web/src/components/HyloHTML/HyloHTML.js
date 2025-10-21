import React from 'react'

export default function HyloHTML ({
  html,
  element = 'div',
  className,
  ...props
}) {
  return (
    React.createElement(
      element,
      {
        ...props,
        className: `global-postContent ${className || ''}`.trim(),
        dangerouslySetInnerHTML: { __html: html }
      }
    )
  )
}
