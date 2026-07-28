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
