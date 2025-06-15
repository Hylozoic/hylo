import React from 'react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select'
import { POST_TYPES } from 'store/models/Post'
import { cn } from 'util/index'

export default function PostTypeSelect ({ className, includeChat = false, postType, setPostType }) {
  const { t } = useTranslation()

  const postTypes = Object.keys(POST_TYPES).filter(t => t !== 'action')
  if (!includeChat) {
    postTypes.splice(postTypes.indexOf('chat'), 1)
  }

  return (
    <Select value={postType} onValueChange={setPostType}>
      <SelectTrigger className={cn('w-fit py-1 h-8 border-2', className)}>
        <SelectValue placeholder='Select a post type' />
      </SelectTrigger>
      <SelectContent>
        {postTypes.map((type) => (
          <SelectItem key={type} value={type}>{t(type)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
