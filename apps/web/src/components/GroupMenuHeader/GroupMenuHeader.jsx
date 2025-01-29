import { BadgeInfo, Settings, UsersRound } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { RESP_ADMINISTRATION } from 'store/constants'
import { DEFAULT_BANNER, DEFAULT_AVATAR } from 'store/models/Group'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { bgImageStyle } from 'util/index'
import { groupUrl } from 'util/navigation'
export default function GroupMenuHeader ({
  group
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const avatarUrl = group.avatarUrl || DEFAULT_AVATAR
  const bannerUrl = group.bannerUrl || DEFAULT_BANNER
  const [textColor, setTextColor] = useState('background')
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))

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
    <div className='GroupMenuHeader relative flex flex-col justify-end p-2 bg-cover h-[190px] shadow-md' data-testid='group-header'>
      <div className='absolute inset-0 bg-cover' style={{ ...bgImageStyle(bannerUrl), opacity: 0.5 }} />
      {canAdminister && (
        <div className='absolute top-2 right-2'>
          <button onClick={() => { navigate(groupUrl(group.slug, 'settings', {})) }}>
            <Settings className='w-6 h-6 text-foreground drop-shadow-md' />
          </button>
        </div>
      )}
      <div className='relative flex flex-row items-center text-background'>
        <div style={bgImageStyle(avatarUrl)} className='rounded-lg h-10 w-10 mr-2 shadow-md bg-cover bg-center' />
        <div className={`flex flex-col flex-1 text-${textColor} drop-shadow-md overflow-hidden`}>
          <h1 className='GroupMenuHeaderName text-xl/5 font-bold m-0 text-white'>{group.name}</h1>
          <span className='text-xs align-middle  text-white'>
            <UsersRound className='w-4 h-4 inline mr-1 align-bottom' />
            <Link className='text-white underline' to={groupUrl(group.slug, 'members', {})}>{t('{{count}} Members', { count: group.memberCount })}</Link>
          </span>
        </div>
        <BadgeInfo className={`text-${textColor} cursor-pointer w-[20px] h-[20px]`} onClick={() => navigate(groupUrl(group.slug, 'about', {}))} />
      </div>
    </div>
  )
}
