import React from 'react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { POST_TYPES } from 'store/models/Post'
import { cn } from 'util/index'

export default function PostTypeSelect ({ allowedPostTypes, className, includeChat = false, postType, setPostType }) {
  const { t } = useTranslation()

  let postTypes = Object.keys(POST_TYPES).filter(type => type !== 'action')
  if (!includeChat) {
    postTypes = postTypes.filter(type => type !== 'chat')
  }
  // null = all types; empty array = none (except keep current selection visible)
  if (allowedPostTypes != null) {
    postTypes = postTypes.filter(type => allowedPostTypes.includes(type))
    // Keep the current type selectable if it falls outside the allowed set
    if (postType && !postTypes.includes(postType)) {
      postTypes = [...postTypes, postType]
    }
  }

  // The trigger shows only the type's name; the open list adds each type's
  // one-line description underneath it
  return (
    <Select value={postType} onValueChange={setPostType}>
      <SelectTrigger className={cn('w-fit py-1 h-8 border-2', className)}>
        <SelectValue placeholder={t('Select a post type')}>{postType ? t(postType) : undefined}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {postTypes.map((type) => (
          <SelectItem key={type} value={type} textValue={t(type)}>
            <span className='flex flex-col'>
              <span>{t(type)}</span>
              {POST_TYPES[type]?.description && (
                <span className='text-xs text-foreground-muted' data-testid={`post-type-description-${type}`}>
                  {t(POST_TYPES[type].description)}
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
