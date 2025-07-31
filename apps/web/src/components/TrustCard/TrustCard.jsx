/* eslint-disable no-trailing-spaces, eol-last, indent */
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Heart, Shield, Users } from 'lucide-react'

export default function TrustCard ({ role, onTrust }) {
  const { t } = useTranslation()
  const [isExpressing, setIsExpressing] = useState(false)

  const handleTrust = async (value) => {
    if (!role.candidates?.length) return
    
    setIsExpressing(true)
    try {
      await onTrust(role.id, role.candidates[0], value)
    } catch (err) {
      console.error('Failed to express trust:', err)
    } finally {
      setIsExpressing(false)
    }
  }

  if (!role || role.status !== 'pending') return null

  return (
    <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4'>
      <div className='flex items-start gap-3'>
        <div className='w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0'>
          <Shield className='w-5 h-5 text-white' />
        </div>
        
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 mb-2'>
            <h3 className='font-medium text-foreground'>{role.name}</h3>
            <span className='text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full'>
              {t('Pending')}
            </span>
          </div>
          
          {role.description && (
            <p className='text-sm text-foreground/70 mb-3'>{role.description}</p>
          )}
          
          <div className='flex items-center justify-between text-sm text-foreground/60 mb-3'>
            <span>{t('Trust')}: {role.threshold_current} / {role.threshold_required}</span>
            <div className='w-20 bg-gray-200 rounded-full h-2'>
              <div
                className='bg-blue-500 h-2 rounded-full transition-all'
                style={{ width: `${Math.min(100, (role.threshold_current / role.threshold_required) * 100)}%` }}
              />
            </div>
          </div>
          
          {role.candidates?.length > 0 && (
            <div className='mb-3'>
              <p className='text-sm text-foreground/70 mb-2'>
                {t('{{count}} member(s) have volunteered', { count: role.candidates.length })}
              </p>
              <div className='flex items-center gap-2'>
                <Users className='w-4 h-4 text-foreground/50' />
                <span className='text-sm text-foreground/70'>
                  {t('Express your trust to help activate this role')}
                </span>
              </div>
            </div>
          )}
          
          <div className='flex gap-2'>
            <button
              onClick={() => handleTrust(1)}
              disabled={isExpressing}
              className='flex items-center gap-1 px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50'
            >
              <Heart className='w-4 h-4' />
              {t('Trust')}
            </button>
            
            <button
              onClick={() => handleTrust(0)}
              disabled={isExpressing}
              className='flex items-center gap-1 px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50'
            >
              <span className='w-4 h-4'>—</span>
              {t('Skip')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 