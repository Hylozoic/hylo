import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'
import { CircleDashed, MessageSquareDashed } from 'lucide-react'

const NoPosts = ({ message, className, icon }) => {
  const { t } = useTranslation()
  const tMessage = message || t('Nothing to see here')
  return (
    <div className={cn('text-center flex flex-col items-center justify-center', className)}>
      {icon === 'message-dashed'
        ? <MessageSquareDashed className='w-12 h-12 opacity-50' />
        : <CircleDashed className='w-12 h-12 opacity-50' />}
      <div><h2 className='opacity-70'>{tMessage}</h2></div>
    </div>
  )
}

export default NoPosts
