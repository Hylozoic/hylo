import React, { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Search, UserPlus, Trash2 } from 'lucide-react'
import Loading from 'components/Loading'
import { fetchEmailEnabledTesters, addEmailEnabledTester, removeEmailEnabledTester } from 'store/actions/emailEnabledTesters'
import findMentions from 'store/actions/findMentions'
import isPendingFor from 'store/selectors/isPendingFor'
import getPeopleBySearchTerm from 'store/selectors/getPeopleBySearchTerm'
import getEmailEnabledTesters from 'store/selectors/getEmailEnabledTesters'

export default function StagingEmailTesters () {
  const dispatch = useDispatch()
  const [searchTerm, setSearchTerm] = useState('')

  const testers = useSelector(getEmailEnabledTesters)

  const fetchPending = useSelector(state => isPendingFor(fetchEmailEnabledTesters, state))
  const removePending = useSelector(state => isPendingFor(removeEmailEnabledTester, state))

  const people = useSelector(state => getPeopleBySearchTerm(state, { searchTerm }))

  useEffect(() => {
    dispatch(fetchEmailEnabledTesters())
  }, [dispatch])

  const handleSearchChange = useCallback((e) => {
    const value = e.target.value
    setSearchTerm(value)
    if (value && value.length >= 2) {
      dispatch(findMentions({ autocomplete: value, maxItems: 20 }))
    }
  }, [dispatch])

  const handleAddUser = useCallback(async (user) => {
    if (!user) return
    try {
      await dispatch(addEmailEnabledTester(user.id))
      setSearchTerm('')
    } catch (error) {
      console.error('Error adding email-enabled tester:', error)
    }
  }, [dispatch])

  const handleRemoveUser = useCallback(async (userId) => {
    if (!window.confirm('Are you sure you want to remove this user from the email-enabled testers list?')) {
      return
    }
    try {
      await dispatch(removeEmailEnabledTester(userId))
    } catch (error) {
      console.error('Error removing email-enabled tester:', error)
    }
  }, [dispatch])

  const filteredPeople = people.filter(person => {
    // Exclude users already in the testers list
    return !testers.some(tester => tester.userId === person.id)
  })

  return (
    <div className='p-6 max-w-4xl mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>Email-Enabled Testers</h1>

      <div className='mb-8'>
        <h2 className='text-lg font-semibold mb-4'>Add User</h2>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50 w-5 h-5' />
          <input
            type='text'
            placeholder='Search for user by name...'
            value={searchTerm}
            onChange={handleSearchChange}
            className='w-full pl-10 pr-4 py-2 border border-foreground/20 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary'
          />
        </div>
        {searchTerm && searchTerm.length >= 2 && (
          <div className='mt-2 border border-foreground/20 rounded-md bg-card max-h-60 overflow-y-auto'>
            {filteredPeople.length === 0
              ? <div className='p-4 text-foreground/50 text-center'>No users found</div>
              : (
                <ul className='p-2'>
                  {filteredPeople.slice(0, 10).map(person => {
                    const avatarUrl = person.avatarUrl || person.avatar
                    return (
                      <li
                        key={person.id}
                        onClick={() => handleAddUser(person)}
                        className='p-2 hover:bg-foreground/10 rounded cursor-pointer flex items-center gap-3'
                      >
                        {avatarUrl
                          ? <img src={avatarUrl} alt={person.name} className='w-8 h-8 rounded-full' />
                          : (
                            <div className='w-8 h-8 rounded-full bg-foreground/20 flex items-center justify-center'>
                              <UserPlus className='w-4 h-4' />
                            </div>
                            )}
                        <span className='text-foreground'>{person.name}</span>
                      </li>
                    )
                  })}
                </ul>
                )}
          </div>
        )}
      </div>

      <div>
        <h2 className='text-lg font-semibold mb-4'>Current Email-Enabled Testers</h2>
        {fetchPending
          ? <Loading />
          : testers.length === 0
            ? (
              <div className='text-foreground/50 p-4 border border-foreground/20 rounded-md'>
                No email-enabled testers configured. Add users above to enable email testing for them.
              </div>
              )
            : (
              <div className='border border-foreground/20 rounded-md'>
                <ul className='divide-y divide-foreground/10'>
                  {testers.map(tester => {
                    const user = tester.user?.ref || tester.user
                    const avatarUrl = user?.avatarUrl || user?.avatar
                    const userName = user?.name || `User ${tester.userId}`
                    return (
                      <li key={tester.id} className='p-4 flex items-center justify-between hover:bg-foreground/5'>
                        <div className='flex items-center gap-3'>
                          {avatarUrl
                            ? <img src={avatarUrl} alt={userName} className='w-10 h-10 rounded-full' />
                            : (
                              <div className='w-10 h-10 rounded-full bg-foreground/20 flex items-center justify-center'>
                                <UserPlus className='w-5 h-5' />
                              </div>
                              )}
                          <div>
                            <div className='font-medium text-foreground'>{userName}</div>
                            {tester.createdAt && (
                              <div className='text-sm text-foreground/50'>
                                Added {new Date(tester.createdAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveUser(tester.userId)}
                          disabled={removePending}
                          className='p-2 text-destructive hover:bg-destructive/10 rounded transition-colors'
                          title='Remove from email-enabled testers'
                        >
                          <Trash2 className='w-5 h-5' />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
              )}
      </div>
    </div>
  )
}
