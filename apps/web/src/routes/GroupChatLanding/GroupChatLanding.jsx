import EditGroupChat from 'components/EditGroupChat/EditGroupChat'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import getQuerystringParam from 'store/selectors/getQuerystringParam'

export default function GroupChatLanding () {
  const { t } = useTranslation()
  const location = useLocation()
  const isEditGroupChat = getQuerystringParam('edit-group-chat', location)

  return (
    <div className='h-full shadow-md flex flex-col overflow-hidden'>
      <div className='flex flex-col items-center justify-center h-full'>
        <p className='text-gray-600 text-lg mb-4'>
          {t('Select a chat to continue a conversation')}
        </p>
        <p className='text-gray-600 text-lg'>
          {t('Click on the plus sign in the menu to create a group-chat')}
        </p>
        {isEditGroupChat && <EditGroupChat />}
      </div>
    </div>
  )
}
