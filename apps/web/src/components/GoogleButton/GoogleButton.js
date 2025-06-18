import { cn } from 'util/index'
import React from 'react'
import { useTranslation } from 'react-i18next'

export default function GoogleButton ({
  onClick,
  signUp,
  className = ''
}) {
  const { t } = useTranslation()
  const label = t('Continue with Google')

  return (
    <a
      aria-label={label}
      tabIndex={0}
      className={cn(
        'flex items-center justify-center scale-100 hover:scale-105 transition-all cursor-pointer no-underline bg-[rgba(62,130,247,1)] text-white h-10 rounded-md whitespace-nowrap px-[15px] pl-[10px] transition-all duration-250 ease-in-out w-full hover:bg-[rgba(62,130,247,0.8)] hover:text-white focus:text-white',
        className
      )}
      onClick={onClick}
    >
      <div className='bg-white h-6 rounded-[24px] w-6 mr-3'>
        <img
          src='assets/btn_google_light_normal_ios.svg'
          className='m-0 border-0 h-6 relative top-0 left-0 rounded-[24px]'
          alt='Google icon'
        />
      </div>
      {label}
    </a>
  )
}
