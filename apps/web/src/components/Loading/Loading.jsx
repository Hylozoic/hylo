import { cn } from 'util/index'
import React from 'react'

const TYPE_CLASSES = {
  fullscreen: 'flex justify-center items-center w-full h-screen bg-[hsl(var(--midground))]',
  top: 'text-center w-full pt-[10%] h-full',
  bottom: 'flex justify-center items-center text-center w-full h-[10%] mb-[30px]',
  inline: 'h-[25px] w-[25px]'
}

const DEFAULT_CLASS = 'flex justify-center items-center w-full h-full'

export default function Loading ({ type, className, size, testingLabel = false }) {
  const loadingClass = TYPE_CLASSES[type] || DEFAULT_CLASS
  const finalSize = type === 'inline' ? (size || 25) : (size || 40)

  return (
    <div className={cn(loadingClass, className)} data-testid='loading-container'>
      <SvgLoader size={finalSize} />{testingLabel && <span className='text-sm text-gray-500'>{testingLabel}</span>}
    </div>
  )
}

function SvgLoader ({ size = 40 }) {
  return (
    <div data-testid='loading-indicator'>
      <svg version='1.1' x='0px' y='0px' width={`${size}px`} height={`${size}px`} viewBox='0 0 50 50' role='img' aria-label='loading'>
        <path
          fill='#999999'
          d='M25.251,6.461c-10.318,0-18.683,8.365-18.683,18.683h4.068c0-8.071,6.543-14.615,14.615-14.615V6.461z'
        >
          <animateTransform
            attributeType='xml'
            attributeName='transform'
            type='rotate'
            from='0 25 25'
            to='360 25 25'
            dur='0.6s'
            repeatCount='indefinite'
          />
        </path>
      </svg>
    </div>
  )
}
