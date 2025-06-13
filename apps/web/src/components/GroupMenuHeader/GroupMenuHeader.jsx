import { BadgeInfo, Bell, Settings, Users } from 'lucide-react'
import React, { useState, useEffect, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { RESP_ADMINISTRATION } from 'store/constants'
import { DEFAULT_BANNER, DEFAULT_AVATAR } from 'store/models/Group'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { bgImageStyle } from 'util/index'
import { groupUrl, currentUserSettingsUrl } from 'util/navigation'

export default function GroupMenuHeader ({
  group
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const avatarUrl = group.avatarUrl || DEFAULT_AVATAR
  const bannerUrl = group.bannerUrl || DEFAULT_BANNER
  const [textColor, setTextColor] = useState('background')
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))
  const groupNameRef = React.useRef(null)
  const [showMembers, setShowMembers] = useState(true)
  const [forceUpdate, setForceUpdate] = useState(0)

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

  // Change React.useLayoutEffect to useLayoutEffect
  useLayoutEffect(() => {
    if (groupNameRef.current) {
      const computedLineHeight = parseInt(window.getComputedStyle(groupNameRef.current).lineHeight)
      const elementHeight = groupNameRef.current.clientHeight
      const shouldShowMembers = elementHeight <= computedLineHeight
      // Only update state if it's different to avoid infinite loops
      if (shouldShowMembers !== showMembers) {
        setShowMembers(shouldShowMembers)
      }
    }
  }, [group.id, group.name, forceUpdate, showMembers])

  // Add a second effect to handle potential race conditions
  useEffect(() => {
    // Force a measurement update after a short delay
    const timer = setTimeout(() => {
      setForceUpdate(prev => prev + 1)
    }, 50)
    return () => clearTimeout(timer)
  }, [group.id])

  return (
    <div className='GroupMenuHeader relative flex flex-col justify-end p-2 bg-cover h-[190px] shadow-md' data-testid='group-header'>
      <div className='absolute z-10 inset-0 bg-cover' style={{ ...bgImageStyle(bannerUrl), opacity: 0.4 }} />
      <div className='absolute top-0 left-0 w-full h-full bg-theme-background z-0' />
      <div className='absolute top-2 left-2 z-20'>
        <button onClick={() => { navigate(currentUserSettingsUrl('notifications?group=' + group.id)) }}>
          <Bell className='w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' />
        </button>
      </div>
      {canAdminister && (
        <div className='absolute top-2 right-2 z-20'>
          <button onClick={() => { navigate(groupUrl(group.slug, 'settings', {})) }}>
            <Settings className='w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' />
          </button>
        </div>
      )}
      <div className='relative flex flex-row items-center text-background z-20'>
        <div style={bgImageStyle(avatarUrl)} className='rounded-lg h-10 w-10 mr-2 shadow-md bg-cover bg-center'>
          {group.avatarUrl === DEFAULT_AVATAR &&
            <span className='text-white text-xl flex items-center justify-center uppercase h-full'>
              {group.name.split(/\s+/).length > 1
                ? `${group.name.split(/\s+/)[0].charAt(0)}${group.name.split(/\s+/)[1].charAt(0)}`
                : group.name.charAt(0)}
            </span>}
        </div>
        <div className={`flex flex-col flex-1 text-${textColor} drop-shadow-md overflow-hidden`}>
          <div className='flex items-center'>
            <h1 ref={groupNameRef} className='GroupMenuHeaderName text-xl/5 font-bold m-0 text-white line-clamp-2'>
              {group.name}
            </h1>
          </div>
          {showMembers && (
            <span className='text-xs align-middle text-white'>
              <Users className='w-4 h-4 inline mr-1 align-bottom' />
              <Link className='text-white underline' to={groupUrl(group.slug, 'members', {})}>{t('{{count}} Members', { count: group.memberCount })}</Link>
            </span>
          )}
        </div>
        <BadgeInfo className={`text-${textColor} cursor-pointer w-[20px] h-[20px] text-white hover:scale-110 transition-all`} onClick={() => navigate(groupUrl(group.slug, 'about', {}))} />
      </div>
    </div>
  )
}
