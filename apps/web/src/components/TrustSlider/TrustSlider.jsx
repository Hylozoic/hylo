/* eslint-disable no-trailing-spaces, eol-last, indent */
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'

export default function TrustSlider ({ value = 0, onChange, disabled = false, label }) {
  const { t } = useTranslation()
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
    <div className='space-y-2'>
      {label && (
        <div className='text-xs text-foreground/70 font-medium'>{label}</div>
      )}

      {/* Slider */}
      <div className='flex items-center gap-3'>
        <span className='text-xs text-foreground/50 w-6'>0</span>
        <div className='flex-1 relative'>
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
        <span className='text-xs text-foreground/50 w-6'>1</span>
      </div>

      {/* Quick action Trust/Skip buttons removed as per design change */}

      {/* Value Display */}
      <div className='text-xs text-foreground/50'>
        {t('Trust level')}: {Math.round(sliderValue * 100)}%
      </div>
    </div>
  )
} 