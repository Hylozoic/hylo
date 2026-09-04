import { Users } from 'lucide-react'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogTitle } from 'components/ui/dialog'
import CreateGroupForm from './CreateGroupForm'
import { CREATE_GROUP_PARAM } from './createGroupUrl'

// Mounted once by AuthLayoutRouter and opened by the ?createGroup=true param, so
// the page underneath stays rendered and the browser back button closes the modal.
export default function CreateGroupModal () {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const isOpen = new URLSearchParams(location.search).get(CREATE_GROUP_PARAM) === 'true'

  const close = useCallback(() => {
    const params = new URLSearchParams(location.search)
    params.delete(CREATE_GROUP_PARAM)
    params.delete('name')
    params.delete('slug')
    const search = params.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true })
  }, [location.pathname, location.search, navigate])

  const handleOpenChange = useCallback(open => {
    if (!open) close()
  }, [close])

  // Filestack and Add View / Welcome overlays portal to <body>. A modal dialog
  // would treat them as outside and steal focus (the Welcome editor cannot type).
  const keepOpenForExternalOverlays = useCallback(event => {
    const target = event.detail?.originalEvent?.target || event.target
    if (target?.closest?.('[class^="fsp-"], [class*=" fsp-"], [data-hylo-nested-dialog]')) {
      event.preventDefault()
    }
  }, [])

  if (!isOpen) return null

  return (
    <Dialog modal={false} open onOpenChange={handleOpenChange}>
      <DialogContent
        overlayAsDiv
        className='w-[calc(100vw-2rem)] max-w-[620px] max-h-[calc(100vh-5rem)] p-0 gap-0 rounded-2xl flex flex-col [&>button:last-child]:top-4 [&>button:last-child]:right-4'
        onOpenAutoFocus={event => event.preventDefault()}
        onPointerDownOutside={keepOpenForExternalOverlays}
        onInteractOutside={keepOpenForExternalOverlays}
        onFocusOutside={keepOpenForExternalOverlays}
      >
        <div className='flex items-center gap-2 h-12 px-4 border-b border-foreground/10 shrink-0'>
          <Users className='w-5 h-5 text-selected shrink-0' />
          <DialogTitle className='flex-1 text-base font-bold tracking-tight'>{t('Create a group')}</DialogTitle>
        </div>

        <CreateGroupForm
          onClose={close}
          bodyClassName='flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-5 pb-6'
          footerClassName='px-5 py-3.5 border-t border-foreground/10 shrink-0'
        />
      </DialogContent>
    </Dialog>
  )
}
