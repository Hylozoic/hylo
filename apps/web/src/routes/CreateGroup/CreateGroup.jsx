import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import CreateGroupForm from './CreateGroupForm'

// The standalone /create-group route. Everywhere inside the app opens
// CreateGroupModal instead; this page exists for direct links and for anyone
// arriving without app chrome around them.
export default function CreateGroup () {
  const { t } = useTranslation()
  const { setHeaderDetails } = useViewHeader()

  useEffect(() => {
    setHeaderDetails({ title: t('Create a new group'), icon: '', info: '', backButton: true, mobileBackButton: true, search: false })
  }, [])

  return (
    <div className='CreateGroupContainer w-full h-full overflow-y-auto flex justify-center px-4 py-10'>
      <div className='CreateGroupInnerContainer w-full max-w-screen-sm'>
        <CreateGroupForm footerClassName='mt-8 mb-10' />
      </div>
    </div>
  )
}
