import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { trim } from 'lodash/fp'
import useDebounce from 'hooks/useDebounce'
import { addQuerystringToPath, groupChatUrl } from 'util/navigation'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getMe from 'store/selectors/getMe'
import fetchPeople from 'store/actions/fetchPeople'
import fetchRecentContacts from 'store/actions/fetchRecentContacts'
import { createGroup } from 'components/CreateGroup/CreateGroup.store'
import Avatar from 'components/Avatar'
import Button from 'components/Button'
import { Input } from 'components/ui/input'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'components/ui/command'
import { getContactsList, getContactsSearch } from 'routes/Messages/Messages.store'

function EditGroupChat() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const currentUser = useSelector(state => getMe(state))
  const contacts = useSelector(state => getContactsList(state))
  const [selectedMembers, setSelectedMembers] = useState([])
  const [groupChatName, setGroupChatName] = useState('')

  const [searchTerm, setSearchTerm] = useState('')

  const suggestions = useMemo(() => {
    return contacts.filter(contact => !selectedMembers.some(member => member.id === contact.id))
  }, [contacts, selectedMembers])

  const dmName = useMemo(() => {
    if (selectedMembers.length !== 1) return null
    const ids = [currentUser.id, selectedMembers[0].id].sort()
    return `dm-${ids[0]}-${ids[1]}`
  }, [selectedMembers])
  
  const [isLoading, setIsLoading] = useState(false)

  const debouncedSearch = useDebounce(searchTerm, 300)

  const isNewGroupChat = getQuerystringParam('edit-group-chat', location) === 'yes'
  const groupChatSlug = getQuerystringParam('edit-group-chat', location) && !isNewGroupChat

  // Load recent contacts on mount
  useEffect(() => {
    dispatch(fetchRecentContacts())
  }, [dispatch])

  // Handle search
  useEffect(() => {
    async function getPeople() {
      if (!debouncedSearch) {
        return
      }

      setIsLoading(true)
      try {
        const response = await dispatch(fetchPeople({
          autocomplete: debouncedSearch,
          first: 20
        }))
        const people = response?.payload?.data?.people?.items || []
      } catch (error) {
        console.error('Error fetching users:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getPeople()
  }, [debouncedSearch, dispatch, selectedMembers])

  const handleSelectMember = (person) => {
    setSelectedMembers(prev => [...prev, person])
    setSearchTerm('')
  }

  const handleRemoveMember = (personId) => {
    setSelectedMembers(prev => prev.filter(p => p.id !== personId))
  }

  const isValid = () => {
    return selectedMembers.length > 0 && (dmName || groupChatName).trim().length > 0
  }

  const handleSubmit = () => {
    if (isNewGroupChat && isValid()) {
      let name = dmName || groupChatName
      name = typeof name === 'string' ? trim(name) : name
      const slug = crypto.randomUUID()+ '-gc'
      dispatch(createGroup({
        accessibility: 0,
        name,
        slug,
        members: selectedMembers.map(member => member.id),
        type: 'groupchat',
        visibility: 0
      }))
        .then(({ error }) => {
          if (error) {
            setState(prev => ({
              ...prev,
              error: t('There was an error, please try again.')
            }))
          } else {
            navigate(groupChatUrl(slug)) // fix this for groupchats
          }
        })
    }
  }

  const onSubmit = () => {
    let { accessibility, name, parentGroups, purpose, slug, visibility } = state
    name = typeof name === 'string' ? trim(name) : name

    if (isValid()) {
      dispatch(createGroup({ accessibility, name, slug, parentIds: parentGroups.map(g => g.id), purpose, visibility }))
        .then(({ error }) => {
          if (error) {
            setState(prev => ({
              ...prev,
              error: t('There was an error, please try again.')
            }))
          } else {
            dispatch(push(groupUrl(slug)))
          }
        })
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
      <div className='bg-white rounded-lg shadow-lg p-6 w-full max-w-md'>
        <div className='text-lg font-semibold mb-4'>
          {isNewGroupChat ? t('Create Group Chat') : t('Edit Group Chat')}
        </div>
        <input
          type="text"
          disabled={!!dmName}
          value={dmName ? `${currentUser.name} - ${selectedMembers[0].name}` : groupChatName}
          onChange={(e) => !dmName && setGroupChatName(e.target.value)}
          placeholder={t('Chat Name')}
          className="w-full mb-4 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className='min-h-[20rem]'>
          {/* Selected Members */}
          <div className='mb-4 flex flex-wrap gap-2 max-h-[200px] overflow-y-auto'>
            {selectedMembers.map((member) => (
              <div 
                key={member.id} 
                className='flex items-center gap-2 bg-gray-100 rounded-full py-1 px-3'
              >
                <Avatar avatarUrl={member.avatarUrl} medium />
                <span>{member.name}</span>
                <button
                  onClick={() => handleRemoveMember(member.id)}
                  className='text-gray-500 hover:text-gray-700'
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Search Input and Results */}
          <Command className='rounded-lg border shadow-md'>
            <CommandInput
              placeholder={t('Search people')}
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              {isLoading ? (
                <CommandEmpty>{t('Loading...')}</CommandEmpty>
              ) : suggestions.length === 0 ? (
                <CommandEmpty>{t('No people found')}</CommandEmpty>
              ) : (
                <CommandGroup heading={t('Suggestions')}>
                  {suggestions.map((person) => (
                    <CommandItem
                      key={person.id}
                      value={person.name}
                      onSelect={() => handleSelectMember(person)}
                    >
                      <div className='flex items-center gap-2'>
                        <Avatar avatarUrl={person.avatarUrl} medium />
                        <span>{person.name}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>

        <div className='flex justify-end gap-2 mt-4'>
          <Button
            variant='secondary'
            onClick={() => navigate(addQuerystringToPath(location.pathname))}
          >
            {t('Cancel')}
          </Button>
          <Button
            variant='primary'
            onClick={handleSubmit}
            disabled={selectedMembers.length === 0}
          >
            {t('Save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default EditGroupChat
