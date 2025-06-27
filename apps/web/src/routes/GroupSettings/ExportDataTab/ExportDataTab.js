import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FileDown } from 'lucide-react'
import Loading from 'components/Loading'
import Button from 'components/ui/button'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import fetch from 'isomorphic-fetch'
import { getHost } from 'store/middleware/apiMiddleware'

export default function ExportDataTab (props) {
  const [clicked, setClicked] = useState(false)
  const [status, setStatus] = useState(null)
  const group = props.group
  const { t } = useTranslation()

  const success = () => setStatus(t('You should receive an email with the member export in a few minutes'))
  const failure = () => {
    setClicked(false)
    setStatus(t('Oh no, something went wrong! Check your internet connection and try again'))
  }
  const handleClick = (e) => {
    e.preventDefault()
    setClicked(true)
    triggerMemberExport(group.id, success, failure)
  }

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: {
        desktop: `${t('Group Settings')} > ${t('Export Data')}`,
        mobile: t('Export Data')
      },
      icon: 'Settings'
    })
  }, [])

  if (!group) return <Loading />

  return (
    <div>
      <h2 className='text-foreground font-bold mb-2'>{t('Export Data')}</h2>
      <p className='text-foreground/70 mb-4'>{t('This function exports all member data for this group as a CSV file for import into other software.')}</p>
      {status && <p className='text-foreground mb-4'>{status}</p>}
      <Button
        variant='outline'
        disabled={clicked}
        onClick={handleClick}
        className='w-fit'
      >
        <FileDown className='w-4 h-4 mr-2' />
        {t('Export Members')}
      </Button>
    </div>
  )
}

function triggerMemberExport (groupId, success, failure) {
  fetch(`${getHost()}/noo/export/group?groupId=${groupId}&datasets[]=members`)
    .then((res) => {
      const { status } = res
      status === 200 ? success() : failure()
    })
}
