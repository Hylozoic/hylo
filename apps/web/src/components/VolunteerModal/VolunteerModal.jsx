import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { X, UserPlus, Users, Shield } from 'lucide-react'

import getMe from 'store/selectors/getMe'
import { cn } from 'util/index'

export default function VolunteerModal ({ role, isOpen, onClose, onVolunteer, onNominate }) {
  const { t } = useTranslation()
  const currentUser = useSelector(getMe)
  const [selectedUser, setSelectedUser] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [groupMembers, setGroupMembers] = useState([])
  const [volunteerMessage, setVolunteerMessage] = useState('')
  const [nominationMessage, setNominationMessage] = useState('')

  useEffect(() => {
    if (isOpen && role?.group_id) {
      fetchGroupMembers(role.group_id)
    }
  }, [isOpen, role])

  const fetchGroupMembers = async (groupId) => {
    try {
      const response = await fetch(`/noo/group/${groupId}/members`)
      const data = await response.json()
      setGroupMembers(data.members || [])
    } catch (err) {
      console.error('Failed to fetch group members:', err)
    }
  }

  const filteredMembers = groupMembers.filter(member => 
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    member.id !== currentUser?.id
  )

  const handleVolunteer = () => {
    onVolunteer(role.id, volunteerMessage)
    onClose()
  }

  const handleNominate = () => {
    if (selectedUser) {
      onNominate(role.id, selectedUser.id, nominationMessage)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
      <div className='bg-background rounded-lg p-6 w-full max-w-md mx-4'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-lg font-semibold text-foreground flex items-center gap-2'>
            <Shield className='w-5 h-5' />
            {t('Volunteer for Role')}
          </h2>
          <button
            onClick={onClose}
            className='text-foreground/60 hover:text-foreground transition-colors'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='mb-4'>
          <h3 className='font-medium text-foreground mb-2'>{role?.name}</h3>
          {role?.description && (
            <p className='text-sm text-foreground/70 mb-4'>{role.description}</p>
          )}
        </div>

        <div className='space-y-4'>
          {/* Volunteer for yourself */}
          <div className='border border-foreground/20 rounded-lg p-4'>
            <div className='flex items-center gap-3 mb-3'>
              <div className='w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center'>
                <UserPlus className='w-5 h-5 text-white' />
              </div>
              <div>
                <h4 className='font-medium text-foreground'>{t('Volunteer Yourself')}</h4>
                <p className='text-sm text-foreground/60'>{t('Express interest in this role')}</p>
              </div>
            </div>
            
            <div className='mb-3'>
              <label className='block text-sm font-medium text-foreground mb-2'>
                {t('Explain your interest (optional)')}
              </label>
              <textarea
                value={volunteerMessage}
                onChange={(e) => setVolunteerMessage(e.target.value)}
                placeholder={t('Why do you want this role? What would you bring to it?')}
                className='w-full px-3 py-2 border border-foreground/20 rounded bg-background text-foreground placeholder-foreground/50 resize-none'
                rows={3}
              />
            </div>
            
            <button
              onClick={handleVolunteer}
              className='w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors'
            >
              {t('Volunteer')}
            </button>
          </div>

          {/* Nominate someone else */}
          <div className='border border-foreground/20 rounded-lg p-4'>
            <div className='flex items-center gap-3 mb-3'>
              <div className='w-10 h-10 bg-green-500 rounded-full flex items-center justify-center'>
                <Users className='w-5 h-5 text-white' />
              </div>
              <div>
                <h4 className='font-medium text-foreground'>{t('Nominate Someone')}</h4>
                <p className='text-sm text-foreground/60'>{t('Suggest another member for this role')}</p>
              </div>
            </div>

            <div className='mb-3'>
              <input
                type='text'
                placeholder={t('Search members...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='w-full px-3 py-2 border border-foreground/20 rounded bg-background text-foreground placeholder-foreground/50'
              />
            </div>

            {searchTerm && (
              <div className='max-h-32 overflow-y-auto border border-foreground/20 rounded'>
                {filteredMembers.length > 0 ? (
                  filteredMembers.map(member => (
                    <button
                      key={member.id}
                      onClick={() => setSelectedUser(member)}
                      className={cn(
                        'w-full px-3 py-2 text-left hover:bg-foreground/5 transition-colors',
                        selectedUser?.id === member.id && 'bg-blue-500 text-white hover:bg-blue-600'
                      )}
                    >
                      <div className='flex items-center gap-2'>
                        <div className='w-6 h-6 bg-foreground/20 rounded-full flex items-center justify-center'>
                          <span className='text-xs'>{member.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className='text-sm'>{member.name}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className='px-3 py-2 text-sm text-foreground/60'>
                    {t('No members found')}
                  </div>
                )}
              </div>
            )}

            {selectedUser && (
              <div className='mt-3'>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  {t('Explain your nomination (optional)')}
                </label>
                <textarea
                  value={nominationMessage}
                  onChange={(e) => setNominationMessage(e.target.value)}
                  placeholder={t('Why would {{name}} be good for this role?', { name: selectedUser.name })}
                  className='w-full px-3 py-2 border border-foreground/20 rounded bg-background text-foreground placeholder-foreground/50 resize-none'
                  rows={2}
                />
              </div>
            )}

            <button
              onClick={handleNominate}
              disabled={!selectedUser}
              className={cn(
                'w-full py-2 px-4 rounded transition-colors mt-3',
                selectedUser
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-foreground/20 text-foreground/50 cursor-not-allowed'
              )}
            >
              {selectedUser
                ? t('Nominate {{name}}', { name: selectedUser.name })
                : t('Select a member')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
 