import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import useDebounce from 'hooks/useDebounce'
import { addQuerystringToPath } from 'util/navigation'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import fetchPeople from 'store/actions/fetchPeople'
import Avatar from 'components/Avatar'
import Button from 'components/Button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'components/ui/command'



function EditGroupChat() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const debouncedSearch = useDebounce(searchTerm, 300)

  const isNewGroupChat = getQuerystringParam('edit-group-chat', location) === 'yes'
  const groupChatSlug = getQuerystringParam('edit-group-chat', location) && !isNewGroupChat

  useEffect(() => {
    async function getPeople () {
      if (!debouncedSearch) return

      setIsLoading(true)
      try {
        const response = await dispatch(fetchPeople({
          autocomplete: debouncedSearch,
          first: 20
        }))
        setSuggestions(response?.payload?.data?.groups.items[0]?.members?.items.map(item => item) || [])
      } catch (error) {
        console.error('Error fetching users:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getPeople()
  }, [debouncedSearch, dispatch])

  const [members, setMembers] = useState([])

  const handleSave = () => {
    // navigate(addQuerystringToPath(location.pathname))
  }

  const textOptions = {
    searchPlaceholder: t('user-search-placeholder'),
    noResults: t('No members match'),
    heading: t('Members')
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
      <div className='bg-white rounded-lg shadow-lg p-6 w-full max-w-md'>
        <div className='text-lg font-semibold mb-4'>{isNewGroupChat ? t('Create Group Chat') : t('Edit Group Chat')}</div>
        <div className='min-h-[25rem]'>
        <Command className='rounded-lg border shadow-md'>
          <CommandInput
            placeholder={textOptions.searchPlaceholder}
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {isLoading
              ? <CommandEmpty>{t('Loading...')}</CommandEmpty>
              : suggestions.length === 0
                ? <CommandEmpty>{textOptions.noResults}</CommandEmpty>
                : <CommandGroup heading={textOptions.heading}>
                  {suggestions.map((suggest) => (
                    <CommandItem
                      key={suggestion.id}
                      value={suggestion.name}
                      onSelect={(value) => {
                        setSelectedItem(suggestion)
                      }}
                    >
                      <span>{suggestion.name}</span>
                    </CommandItem>
                  ))}
                  </CommandGroup>}
          </CommandList>
        </Command>
          <div className='overflow-y-auto max-h-[300px] border rounded p-2'>
            {members.map((member) => (
              <div key={member.id} className='py-2 px-3 hover:bg-gray-100 rounded'>
                {member.name}
              </div>
            ))}
          </div>
        </div>

        <div className='flex justify-end gap-1 mt-4'>
          <Button
            variant='secondary'
            onClick={() => navigate(addQuerystringToPath(location.pathname))}
            className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600'
          >
            {t('Close')}
          </Button>
          <Button
            variant='primary'
            onClick={handleSave}
            className='bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600'
          >
            {t('Save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default EditGroupChat
