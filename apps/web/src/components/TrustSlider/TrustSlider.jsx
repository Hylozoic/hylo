/* eslint-disable no-trailing-spaces, eol-last, indent */
import React, { useState, useEffect } from 'react'
import { cn } from 'util/index'

export default function TrustSlider ({ value = 0, onChange, disabled = false }) {
  const [sliderValue, setSliderValue] = useState(value)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    setSliderValue(value)
  }, [value])

  const handleSliderChange = (event) => {
    const newValue = parseFloat(event.target.value)
    setSliderValue(newValue)
  }

  const handleSliderMouseUp = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (onChange && sliderValue !== value) {
      onChange(sliderValue)
    }
  }

  const handleSliderMouseDown = () => {
    if (!disabled) {
      setIsDragging(true)
    }
  }

  // Removed handleTrustClick and handleSkipClick with buttons

  return (
    <div className='w-full'>
      <input
        type='range'
        min='0'
        max='1'
        step='0.01'
        value={sliderValue}
        onChange={handleSliderChange}
        onMouseDown={handleSliderMouseDown}
        onMouseUp={handleSliderMouseUp}
        onTouchStart={handleSliderMouseDown}
        onTouchEnd={handleSliderMouseUp}
        disabled={disabled}
        className={cn(
          'w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer',
          'slider-thumb:appearance-none slider-thumb:w-4 slider-thumb:h-4 slider-thumb:bg-blue-500 slider-thumb:rounded-full slider-thumb:cursor-pointer',
          'hover:bg-gray-300 transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        style={{
          background: `linear-gradient(to right, #3b82f6 ${sliderValue * 100}%, #e5e7eb ${sliderValue * 100}%)`
        }}
      />
    </div>
  )
}
