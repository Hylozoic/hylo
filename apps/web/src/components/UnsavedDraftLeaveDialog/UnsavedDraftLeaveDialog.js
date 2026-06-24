import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'

/**
 * Shared confirm dialog for leaving a compose surface with unsaved draft content.
 * Primary action is Save draft (accent); Discard is destructive and sits to its left.
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
  discardLabel = 'Discard'
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className='fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm' />
        <Dialog.Content className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
          <div className='bg-background text-foreground rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4'>
            <Dialog.Title className='text-lg font-semibold'>{title}</Dialog.Title>
            <Dialog.Description className='text-sm text-foreground/70'>{description}</Dialog.Description>
            <div className='flex flex-row flex-nowrap items-center justify-between gap-2 sm:gap-3'>
              <button
                type='button'
                className='rounded-lg min-w-0 flex-1 px-2 py-2 sm:px-4 text-xs sm:text-sm border border-foreground/20 hover:bg-foreground/10 transition-colors text-center leading-snug whitespace-normal'
                onClick={onContinueEditing}
              >
                {continueEditingLabel}
              </button>
              <div className='flex flex-row shrink-0 gap-2 sm:gap-3'>
                <button
                  type='button'
                  className='rounded-lg shrink-0 whitespace-nowrap px-2 py-2 sm:px-4 text-xs sm:text-sm text-white bg-destructive hover:bg-destructive/80 transition-colors'
                  onClick={onDiscard}
                >
                  {discardLabel}
                </button>
                <button
                  type='button'
                  autoFocus
                  className='rounded-lg shrink-0 whitespace-nowrap px-2 py-2 sm:px-4 text-xs sm:text-sm font-medium text-foreground bg-selected hover:bg-selected/90 transition-colors'
                  onClick={onSaveDraft}
                >
                  {saveDraftLabel}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
