import { SmilePlus } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmojiPickerContent, preventFocusSteal } from 'components/EmojiPicker/EmojiPicker'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from 'components/ui/popover'
import useIsFinePointer from 'hooks/useIsFinePointer'
import { cn } from 'util/index'

/**
 * Emoji button for text inputs, using the same icon and picker as reactions.
 * Only shown on mouse/trackpad devices: on touch devices the keyboard has emoji.
 * The trigger never takes focus, so the field being edited keeps its cursor.
 */
export default function EmojiInsertButton ({
  onSelect,
  className,
  iconClassName = 'w-6 h-6',
  dataTestId = 'emoji-insert-button',
  side = 'top',
  align = 'end'
}) {
  const { t } = useTranslation()
  const isFinePointer = useIsFinePointer()
  const [open, setOpen] = useState(false)

  if (!isFinePointer) return null

  const handleEmojiSelect = (data) => {
    setOpen(false)
    if (data?.native) onSelect(data.native)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          aria-label={t('Add emoji')}
          title={t('Add emoji')}
          data-testid={dataTestId}
          // Keep focus (and the cursor) in the field being edited
          onMouseDown={(event) => event.preventDefault()}
          className={cn('shrink-0 flex items-center justify-center cursor-pointer text-foreground/50 hover:text-foreground transition-colors', className)}
        >
          <SmilePlus className={iconClassName} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className='w-auto p-0'
        side={side}
        align={align}
        arrow={false}
        onOpenAutoFocus={preventFocusSteal}
        onCloseAutoFocus={preventFocusSteal}
        onClick={(event) => event.stopPropagation()}
        data-testid={`${dataTestId}-picker`}
      >
        <EmojiPickerContent onEmojiSelect={handleEmojiSelect} />
      </PopoverContent>
    </Popover>
  )
}
