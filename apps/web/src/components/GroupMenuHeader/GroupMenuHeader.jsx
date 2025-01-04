import { ChevronRight, ChevronDown, UsersRound } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import GroupDetail from 'routes/GroupDetail'
import { Popover, PopoverTrigger, PopoverContent } from 'components/ui/popover'
import { DEFAULT_BANNER, DEFAULT_AVATAR } from 'store/models/Group'
import { bgImageStyle } from 'util/index'
import { groupUrl } from 'util/navigation'

export default function GroupMenuHeader ({
  group
}) {
  const { t } = useTranslation()
  const avatarUrl = group.avatarUrl || DEFAULT_AVATAR
  const bannerUrl = group.bannerUrl || DEFAULT_BANNER
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [textColor, setTextColor] = useState('background')

  useEffect(() => {
    // Detect the color of the banner and set the text color accordingly
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.src = bannerUrl
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0, img.width, img.height)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      const data = imageData.data
      let r, g, b, avg
      let colorSum = 0

      for (let x = 0, len = data.length; x < len; x += 4) {
        r = data[x]
        g = data[x + 1]
        b = data[x + 2]
        avg = Math.floor((r + g + b) / 3)
        colorSum += avg
      }

      const brightness = Math.floor(colorSum / (img.width * img.height))
      setTextColor(brightness > 128 ? 'foreground' : 'background')
    }
  }, [bannerUrl])

  return (
    <div className='relative flex flex-col justify-end p-2 bg-cover h-[190px] shadow-md' data-testid='group-header'>
      <div className='absolute inset-0 bg-cover' style={{ ...bgImageStyle(bannerUrl), opacity: 0.7 }} />
      <div className='relative flex flex-row items-center text-background'>
        <img src={avatarUrl} alt='Group Avatar' className='rounded-lg h-10 w-10 mr-2 shadow-md' />
        <div className={`flex flex-col flex-1 text-${textColor} drop-shadow-md`}>
          <h1 className={`text-xl font-bold m-0 text-${textColor}`}>{group.name}</h1>
          <span className='text-xs align-middle'>
            <UsersRound className='w-4 h-4 inline mr-1 align-bottom' />
            <Link className={`text-${textColor} underline`} to={groupUrl(group.slug, 'members', {})}>{t('{{count}} Members', { count: group.memberCount })}</Link>
          </span>
        </div>
        <Popover onOpenChange={setDetailsOpen} open={detailsOpen}>
          <PopoverTrigger>
            {detailsOpen ? <ChevronDown className={`text-${textColor}`} /> : <ChevronRight className={`text-${textColor}`} />}
          </PopoverTrigger>
          <PopoverContent side='bottom' align='end' alignOffset={-10} className='!p-0 !w-[340px] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto overflow-x-hidden'>
            <GroupDetail group={group} popup />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}