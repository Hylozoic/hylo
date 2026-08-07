import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'
import { CircleDashed, MessageSquareDashed } from 'lucide-react'

const NoPosts = ({ message, className, icon }) => {
  const { t } = useTranslation()
  const tMessage = message || t('Nothing to see here')
  return (
    // col-span-full so this centres across the whole stream: the grid view modes
    // make the container a CSS grid, where an unspanned child sits in column one.
    // It is inert in the list and card views.
    <div className={cn('text-center flex flex-col items-center justify-center w-full col-span-full', className)}>
      {icon === 'message-dashed'
        ? <MessageSquareDashed className='w-12 h-12 opacity-50' />
        : <CircleDashed className='w-12 h-12 opacity-50' />}
      <div><h2 className='opacity-70'>{tMessage}</h2></div>
    </div>
  )
}

export default NoPosts
