import React from 'react'
import { groupUrl } from 'util/navigation'
import { DEFAULT_AVATAR } from 'store/models/Group'
import { useNavigate } from 'react-router-dom'
import Button from 'components/ui/Button'
import RoundImage from 'components/RoundImage'

export default ({ group }) => {
  const navigate = useNavigate()

  return (
    <Button
      variant='outline'
      onClick={() => navigate(groupUrl(group.slug))}
      className='flex items-center gap-2'
    >
      <RoundImage url={group.avatarUrl || DEFAULT_AVATAR} small />
      <span>{group.name}</span>
    </Button>
  )
}
