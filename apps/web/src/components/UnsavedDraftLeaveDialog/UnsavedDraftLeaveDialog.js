import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'

/**
 * Shared confirm dialog for leaving a compose surface with unsaved content.
 * Portals to document.body above nested create/edit overlays (z-1100).
 * Save draft is optional so group creation can offer only Continue / Discard.
 */
export default function UnsavedDraftLeaveDialog ({
  open,
  onOpenChange,
  title,
  description,
  onContinueEditing,
  onDiscard,
  onSaveDraft,
  continueEditingLabel = 'Continue editing',
  saveDraftLabel = 'Save',
  discardLabel = 'Discard',
  saveDraftDisabled = false
}) {
  const showSaveDraft = typeof onSaveDraft === 'function'
  const saveIsPrimary = showSaveDraft && !saveDraftDisabled

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-hylo-nested-dialog
          className='fixed inset-0 bg-black/50 z-[1300] backdrop-blur-sm'
        />
        <Dialog.Content
          data-hylo-nested-dialog
          className='fixed inset-0 z-[1300] flex items-center justify-center p-4'
          onOpenAutoFocus={event => {
            if (!saveIsPrimary) event.preventDefault()
          }}
        >
          <div className='bg-background text-foreground rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4'>
            <Dialog.Title className='text-lg font-semibold'>{title}</Dialog.Title>
            <Dialog.Description className='text-sm text-foreground/70'>{description}</Dialog.Description>
            <div className='flex flex-col gap-2'>
              <button
                type='button'
                autoFocus={!saveIsPrimary}
                className='w-full rounded-lg px-4 py-2.5 text-sm border border-foreground/20 hover:bg-foreground/10 transition-colors whitespace-nowrap'
                onClick={onContinueEditing}
              >
                {continueEditingLabel}
              </button>
              <button
                type='button'
                className='w-full rounded-lg px-4 py-2.5 text-sm whitespace-nowrap text-white bg-destructive hover:bg-destructive/80 transition-colors'
                onClick={onDiscard}
              >
                {discardLabel}
              </button>
              {showSaveDraft && (
                <button
                  type='button'
                  autoFocus={saveIsPrimary}
                  disabled={saveDraftDisabled}
                  className='w-full rounded-lg px-4 py-2.5 text-sm whitespace-nowrap font-medium text-foreground bg-selected hover:bg-selected/90 transition-colors disabled:opacity-50 disabled:pointer-events-none'
                  onClick={onSaveDraft}
                >
                  {saveDraftLabel}
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
