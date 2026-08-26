import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'

import HyloEditor from 'components/HyloEditor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select'
import { cn } from 'util/index'

/** Shared track settings fields for create and edit space flows. */
export default function TrackSettingsFields ({
  actionDescriptor,
  setActionDescriptor,
  actionDescriptorPlural,
  setActionDescriptorPlural,
  completionRole,
  setCompletionRole,
  publishedAt,
  setPublishedAt,
  roles,
  completionMessageEditorRef,
  groupIds = [],
  editorKey = 'new',
  initialCompletionMessage = ''
}) {
  const { t } = useTranslation()

  const selectedCompletionRole = useMemo(
    () => (completionRole?.id ? roles.find(role => String(role.id) === String(completionRole.id)) : null),
    [completionRole, roles]
  )

  return (
    <div className='flex flex-col gap-3 border-t-2 border-foreground/10 pt-3 mt-1'>
      <h3 className='text-base font-semibold'>{t('Track Settings')}</h3>

      <div className='flex flex-col relative border-2 border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input rounded-tr-md rounded-br-md rounded-bl-md mb-2 mt-10'>
        <h3 className='px-2 py-1 text-xs text-foreground/60 absolute -top-[36px] -translate-x-[2px] bg-input rounded-t-md border-t-2 border-x-2 border-transparent border-b-0 group-focus-within:text-foreground/80 group-focus-within:border-t-focus group-focus-within:border-x-focus transition-colors duration-200'>
          {t('Completion Message')}
        </h3>
        <HyloEditor
          key={`track-completion-${editorKey}`}
          containerClassName='mt-2'
          contentHTML={initialCompletionMessage}
          className='h-full p-2 border-border border-2 border-dashed min-h-20 mt-1'
          extendedMenu
          groupIds={groupIds}
          placeholder={t('This message will be shown to members who complete the track')}
          ref={completionMessageEditorRef}
          showMenu
          type='trackCompletionMessage'
        />
      </div>

      <div>
        <label className='text-sm text-foreground/70'>{t('Completion badge or role')}</label>
        <div className='flex flex-row items-center relative p-1 border-transparent transition-all duration-200 group focus-within:border-focus mt-1'>
          <Select
            onValueChange={(roleId) => {
              if (roleId === 'none') {
                setCompletionRole(null)
                return
              }
              const role = roles.find(r => String(r.id) === String(roleId))
              if (role) setCompletionRole(role)
            }}
            value={completionRole?.id ? String(completionRole.id) : 'none'}
          >
            <SelectTrigger className='w-fit border-2 bg-input border-foreground/30 rounded-md p-2 text-base'>
              <SelectValue>
                {selectedCompletionRole ? `${selectedCompletionRole.emoji} ${selectedCompletionRole.name}` : t('None')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className='z-[1200]'>
              <SelectItem value='none'>{t('None')}</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={String(role.id)}>
                  {role.emoji} {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 focus-within:border-focus'>
          <div className='text-xs text-foreground/50 w-[90px]'>{t('Unit term')}</div>
          <input
            className='p-2 border-none bg-transparent w-full outline-none'
            maxLength='40'
            name='actionDescriptor'
            onChange={e => setActionDescriptor(e.target.value)}
            value={actionDescriptor}
            type='text'
          />
        </div>
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 focus-within:border-focus'>
          <div className='text-xs text-foreground/50 w-[90px]'>{t('Unit term plural')}</div>
          <input
            className='p-2 border-none bg-transparent w-full outline-none'
            maxLength='40'
            name='actionDescriptorPlural'
            onChange={e => setActionDescriptorPlural(e.target.value)}
            value={actionDescriptorPlural}
            type='text'
          />
        </div>
      </div>

      <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2'>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            className={cn('p-2 rounded-md transition-colors', publishedAt ? 'bg-foreground/10' : 'bg-accent text-white')}
            onClick={() => setPublishedAt(null)}
          >
            <EyeOff className='w-5 h-5' />
          </button>
          <button
            type='button'
            className={cn('p-2 rounded-md transition-colors', publishedAt ? 'bg-accent text-white' : 'bg-foreground/10')}
            onClick={() => setPublishedAt(new Date().toISOString())}
          >
            <Eye className='w-5 h-5' />
          </button>
          <span>{publishedAt ? t('Published') : t('Unpublished')}</span>
        </div>
      </div>
    </div>
  )
}
