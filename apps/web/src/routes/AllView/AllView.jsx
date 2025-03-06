import React, { useMemo, useCallback, useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { capitalize } from 'lodash/fp'
import ContextWidgetPresenter, { humanReadableTypeResolver, isValidChildWidget, translateTitle } from '@hylo/presenters/ContextWidgetPresenter'
import { addQuerystringToPath, baseUrl, widgetUrl } from 'util/navigation'
import fetchContextWidgets from 'store/actions/fetchContextWidgets'
import { getContextWidgets } from 'store/selectors/contextWidgetSelectors'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { RESP_ADMINISTRATION } from 'store/constants'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getMyGroups from 'store/selectors/getMyGroups'
import { createContextWidget, setHomeWidget, updateContextWidget } from 'store/actions/contextWidgets'
import findTopics from 'store/actions/findTopics'
import fetchPeople from 'store/actions/fetchPeople'
import {
  addPostToCollection,
  createCollection,
  removePostFromCollection,
  reorderPostInCollection
} from '../GroupSettings/GroupSettings.store'
import useDebounce from 'hooks/useDebounce'

import Icon from 'components/Icon'
import PostSelector from 'components/PostSelector'
import WidgetIconResolver from 'components/WidgetIconResolver'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList, CommandItem } from 'components/ui/command'
import { Input } from 'components/ui/input'
import Button from 'components/ui/button'
import { Label } from 'components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from 'components/ui/select'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { CustomViewRow } from 'routes/GroupSettings/CustomViewsTab/CustomViewsTab'
import { createTopic } from 'components/CreateTopic/CreateTopic.store'
import { cleanCustomView } from 'util'

// TODO: These constants may belong in a "types" object or similar on ContextWidgetPresenter or CustomViewPresenter
// like ContextWidgetPresenter.types, or as ContextWidgetPresenter, CHAT_TYPE...
const CHAT = 'chat'
const POST = 'post'
const USER = 'user'
const GROUP = 'group'
const CUSTOM_VIEW = 'customView'
const CONTAINER = 'container'

export default function AllViews () {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useParams()

  const isEditing = getQuerystringParam('cme', location) === 'yes'
  const isAddingView = getQuerystringParam('addview', location) === 'yes'
  const orderInFrontOfWidgetId = getQuerystringParam('orderInFrontOfWidgetId', location)
  const parentId = getQuerystringParam('parentId', location)
  const addToEnd = getQuerystringParam('addToEnd', location)

  // Access the current group and its contextWidgets
  const group = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const contextWidgets = useSelector(state => getContextWidgets(state, group))

  const parentWidget = parentId ? contextWidgets.find(widget => widget.id === parentId) : null

  // Determine the rootPath
  const rootPath = baseUrl({ ...routeParams, view: null })

  // Check if the user can administer the group
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))

  useEffect(() => {
    dispatch(fetchContextWidgets(group.id))
  }, [group.id])

  const handleWidgetHomePromotion = useCallback((widget) => {
    if (window.confirm(t('Are you sure you want to set this widget as the home/default widget for this group?'))) {
      dispatch(setHomeWidget({ contextWidgetId: widget.id, groupId: group.id }))
    }
  }, [t, setHomeWidget])

  const handleWidgetUpdate = useCallback((widget) => {
    dispatch(updateContextWidget({
      contextWidgetId: widget.id,
      groupId: group.id,
      data: { parentId: null, addToEnd: true }
    }))
  }, [updateContextWidget])

  // Filter and sort widgets and get them ready for display
  const visibleWidgets = useMemo(() => {
    return contextWidgets.filter(widget => {
      // When not editing only show widgets with a related view or chat room
      if (!isEditing && !widget.view && !widget.customView && widget.type !== 'chat') return false
      // When editing only show widgets that have not already been added
      if (isEditing && widget.order) return false
      // Hide widgets that are not visible to the user
      if (widget.visibility === 'none' || (widget.visibility === 'admin' && !canAdminister)) return false
      return true
    })
      .map(widget => ContextWidgetPresenter(widget))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [contextWidgets, isEditing])

  // Create widget cards
  const widgetCards = useMemo(() => {
    return visibleWidgets.map(widget => {
      // TODO: Integrate into ContextWidgetPresenter as makeUrl() method on presented object (requires shared url makers/helpers)
      const url = widgetUrl({ widget, rootPath, groupSlug: routeParams.groupSlug, context: 'group' })
      const cardContent = (
        <div>
          <h3 className='text-lg font-semibold text-foreground'>
            <WidgetIconResolver widget={widget} />
            <span className='ml-2'>{translateTitle(widget.title, t)}</span>
          </h3>
          {widget.humanReadableType && (
            <span className='text-sm text-foreground'>
              {t('Type')}: {t(capitalize(widget.humanReadableType))}
            </span>
          )}
          {/* {widget?.view && (
            <span className='text-sm block text-foreground'>
              {t('View')}: {t(capitalize(widget.view))}
            </span>
          )} */}
          {isEditing && widget.isValidHomeWidget && (
            <span className='text-sm  block text-foreground'>
              <Icon
                name='Home'
                onClick={(evt) => {
                  evt.stopPropagation()
                  handleWidgetHomePromotion(widget)
                }}
              />
            </span>
          )}
          {isEditing && !widget.order && (
            <span className='text-sm text-foreground block'>
              <Icon
                name='Plus'
                onClick={(evt) => {
                  evt.stopPropagation()
                  handleWidgetUpdate(widget)
                }}
              />
            </span>
          )}
        </div>
      )
      return (
        <div key={widget.id} onClick={() => url ? navigate(url) : null} className={`cursor-pointer relative flex flex-col transition-all bg-card/40 border-2 border-card/30 shadow-md hover:shadow-lg mb-4 hover:z-50 hover:scale-105 duration-400 rounded-lg h-full items-center justify-center ${url ? 'cursor-pointer' : ''}`}>
          <div className='block text-center text-foreground'>
            {cardContent}
          </div>
        </div>
      )
    })
  }, [visibleWidgets, rootPath, routeParams.groupSlug])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: isEditing ? t('Editing Group Menu') : t('All Views'),
      icon: 'Window',
      info: '',
      search: true
    })
  }, [isEditing])

  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4'>
      <div onClick={() => navigate(addQuerystringToPath(location.pathname, { addview: 'yes', cme: 'yes' }))} className='border-2 flex items-center justify-center border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 background-black/10 rounded-lg border-dashed relative'>
        <div className='block text-center'>
          <div>
            <h3 className='text-lg font-semibold  text-foreground m-0'><Icon name='Plus' style={{ fontSize: 30 }} className='text-foreground ml-2' /> {t('Add View')}</h3>
          </div>
        </div>
      </div>
      {widgetCards}
      {isAddingView && <AddViewDialog group={group} orderInFrontOfWidgetId={orderInFrontOfWidgetId} parentId={parentId} addToEnd={addToEnd} parentWidget={parentWidget} />}
    </div>
  )
}

function AddOption ({ title, onClick, description, disabled = false }) {
  return (
    <div onClick={disabled ? null : onClick} className={`p-4 border border-gray-300 rounded-md shadow-sm cursor-pointer hover:bg-gray-50 ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}>
      <div className='flex flex-col'>
        <h3 className='text-lg font-semibold'>{title}</h3>
      </div>
    </div>
  )
}

function AddViewDialog ({ group, orderInFrontOfWidgetId, parentId, addToEnd, parentWidget }) {
  const { t } = useTranslation()
  const location = useLocation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const initialAddChoice = parentWidget?.type === 'chats'
    ? CHAT
    : parentWidget?.type === 'custom-views'
      ? CUSTOM_VIEW
      : null
  const [addChoice, setAddChoice] = useState(initialAddChoice)
  const [selectedItem, setSelectedItem] = useState(null)
  const [widgetData, setWidgetData] = useState({ title: '', visibility: 'all' })
  const [isCreating, setIsCreating] = useState(false)

  const handleReset = () => {
    setAddChoice(null)
    setSelectedItem(null)
    setWidgetData({ title: '', visibility: 'all' })
  }

  const handleCreate = useCallback(async ({ widgetData, selectedItem, addChoice }) => {
    setIsCreating(true)
    let groupTopic
    // if a topic comes here with 'create' as its id, we need to create a groupTopic before we can create the widget
    if (addChoice === CHAT && selectedItem.id === 'create') {
      const response = await dispatch(createTopic(selectedItem.name, group.id))
      groupTopic = response.payload.data.createTopic
    } else if (addChoice === CHAT) {
      groupTopic = selectedItem
    }

    const contextWidgetInput = {
      addToEnd: !orderInFrontOfWidgetId,
      visibility: widgetData.visibility === 'all' ? null : widgetData.visibility,
      type: addChoice === CHAT ? CHAT : null, // The default is for type to be null unless there is a specific need
      title: widgetData.title === '' ? null : widgetData.title,
      icon: null, // TODO CONTEXT: what is required for icons?
      viewGroupId: addChoice === GROUP ? selectedItem.id : null,
      viewPostId: addChoice === POST ? selectedItem.id : null,
      customViewInput: addChoice === CUSTOM_VIEW ? cleanCustomView(selectedItem) : null,
      viewUserId: addChoice === USER ? selectedItem.id : null,
      viewChatId: addChoice === CHAT ? groupTopic.id : null,
      parentId,
      orderInFrontOfWidgetId
    }

    // Widget will be inserted into the menu as a 'loading' widget, and then properly inserted when returned from the db
    try {
      await dispatch(createContextWidget({ data: contextWidgetInput, groupId: group.id }))
      handleReset()
      navigate(addQuerystringToPath(location.pathname, { cme: 'yes' }))
    } catch (error) {
      console.error('Failed to create context widget:', error)
    } finally {
      setIsCreating(false)
    }
  }, [])

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
      <div className='bg-white rounded-lg shadow-lg p-6 w-full max-w-md'>
        <div className='text-lg font-semibold mb-4'>{t('Add {{something}} to Menu', { something: addChoice ? t(capitalize(humanReadableTypeResolver(addChoice))) : 'Something' })}</div>
        <div className='min-h-[25rem]'>
          {!addChoice &&
            <div className='grid grid-cols-2 gap-4'>
              <AddOption
                title={t('Add Container')}
                onClick={() => setAddChoice(CONTAINER)}
                disabled={parentWidget?.id}
              />
              <AddOption
                title={t('Add Chat')}
                onClick={() => setAddChoice(CHAT)}
                disabled={parentId && !isValidChildWidget({ parentWidget, childWidget: { type: CHAT, viewChat: { id: 'fake-id' } } })}
              />
              <AddOption
                title={t('Add Custom View')}
                onClick={() => setAddChoice(CUSTOM_VIEW)}
                description={t('addCustomViewDescription')}
                disabled={parentId && !isValidChildWidget({ parentWidget, childWidget: { customView: { id: 'fake-id' } } })}
              />
              <AddOption
                title={t('Add Member')}
                onClick={() => setAddChoice(USER)}
                disabled={parentId && !isValidChildWidget({ parentWidget, childWidget: { viewUser: { id: 'fake-id' } } })}
              />
              <AddOption
                title={t('Add Group')}
                onClick={() => setAddChoice(GROUP)}
                disabled={parentId && !isValidChildWidget({ parentWidget, childWidget: { viewGroup: { id: 'fake-id' } } })}
              />
              <AddOption
                title={t('Add Post')}
                onClick={() => setAddChoice(POST)}
                disabled={parentId && !isValidChildWidget({ parentWidget, childWidget: { viewPost: { id: 'fake-id' } } })}
              />
            </div>}
          {addChoice && [CHAT, POST, GROUP, USER].includes(addChoice) && (
            <ItemSelector addChoice={addChoice} group={group} selectedItem={selectedItem} setSelectedItem={setSelectedItem} widgetData={widgetData} setWidgetData={setWidgetData} />
          )}
          {addChoice && addChoice === CUSTOM_VIEW && (
            <CustomViewCreator group={group} addChoice={addChoice} selectedItem={selectedItem} setSelectedItem={setSelectedItem} widgetData={widgetData} setWidgetData={setWidgetData} />
          )}
          {addChoice && addChoice === CONTAINER && (
            <ContainerCreator group={group} addChoice={addChoice} widgetData={widgetData} setWidgetData={setWidgetData} />
          )}
        </div>
        <div className='flex justify-end gap-1 mt-4'>
          {addChoice &&
            <Button
              variant='secondary'
              onClick={() => handleReset()}
              className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600'
            >
              {t('Back')}
            </Button>}
          <Button
            variant='secondary'
            onClick={() => navigate(addQuerystringToPath(location.pathname, { cme: 'yes' }))}
            className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600'
          >
            {t('Close')}
          </Button>
          {(selectedItem || addChoice === CONTAINER) &&
            <Button
              variant='primary'
              disabled={isCreating}
              onClick={() => handleCreate({ widgetData, selectedItem, addChoice })}
              className='bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600'
            >
              {isCreating ? t('Creating...') : t('Create')}
            </Button>}
        </div>
      </div>
    </div>
  )
}

function ItemSelector ({ addChoice, group, selectedItem, setSelectedItem, widgetData, setWidgetData }) {
  const [searchTerm, setSearchTerm] = useState('')
  const { t } = useTranslation()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const dispatch = useDispatch()

  const debouncedSearch = useDebounce(searchTerm, 300)
  const groups = useSelector(getMyGroups)

  useEffect(() => {
    async function fetchTopics () {
      if (!debouncedSearch || addChoice !== CHAT) return

      setIsLoading(true)
      try {
        const response = await dispatch(findTopics({
          autocomplete: debouncedSearch,
          groupId: group.id,
          maxItems: 10
        }))
        const result = response?.payload?.data?.groupTopics?.items?.map(item => item.topic)
        if (debouncedSearch.length > 0) result.push({ name: debouncedSearch, id: 'create' })
        setItems(result || [])
      } catch (error) {
        console.error('Error fetching topics:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTopics()
  }, [debouncedSearch, dispatch, addChoice])

  useEffect(() => {
    async function getPeople () {
      if (!debouncedSearch || addChoice !== USER) return

      setIsLoading(true)
      try {
        const response = await dispatch(fetchPeople({
          autocomplete: debouncedSearch,
          groupIds: [group.id],
          first: 20
        }))
        setItems(response?.payload?.data?.groups.items[0]?.members?.items.map(item => item) || [])
      } catch (error) {
        console.error('Error fetching users:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getPeople()
  }, [debouncedSearch, dispatch, addChoice])

  useEffect(() => {
    function filterGroups () {
      if (addChoice === GROUP) setItems(groups || [])

      if (!debouncedSearch || addChoice !== GROUP) return

      setIsLoading(true)
      try {
        const filteredGroups = groups.filter(group =>
          group.name.toLowerCase().includes(debouncedSearch.toLowerCase())
        )
        setItems(filteredGroups || [])
      } catch (error) {
        console.error('Error filtering groups:', error)
      } finally {
        setIsLoading(false)
      }
    }

    filterGroups()
  }, [debouncedSearch, groups, addChoice])

  const textOptions = {
    chat: {
      searchPlaceholder: t('chatTopicSearchPlaceholder'),
      noResults: t('No chat topics found'),
      heading: t('Chat Topics')
    },
    group: {
      searchPlaceholder: t('groupSearchPlaceholder'),
      noResults: t('No groups match'),
      heading: t('Your groups')
    },
    user: {
      searchPlaceholder: t('user-search-placeholder'),
      noResults: t('No members match'),
      heading: t('Members')
    }
  }

  return (
    <div>
      {addChoice === POST && !selectedItem && <PostSelector group={group} onSelectPost={setSelectedItem} />}
      {[CHAT, USER, GROUP].includes(addChoice) && !selectedItem && (
        <Command className='rounded-lg border shadow-md'>
          <CommandInput
            placeholder={textOptions[addChoice].searchPlaceholder}
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {isLoading
              ? <CommandEmpty>{t('Loading...')}</CommandEmpty>
              : items.length === 0
                ? <CommandEmpty>{textOptions[addChoice].noResults}</CommandEmpty>
                : (
                  <CommandGroup heading={textOptions[addChoice].heading}>
                    {items.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.name}
                        onSelect={(value) => {
                          setSelectedItem(item)
                        }}
                      >
                        <span>{item.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>)}
          </CommandList>
        </Command>
      )}
      {selectedItem &&
        <div>
          <div className='mb-4'>
            {addChoice === USER && (
              <>
                <h2>
                  {t('Selected User')}: <span className='font-extrabold'>{selectedItem.name}</span>
                </h2>
                <p className='text-sm text-gray-500'>{t('The name of the widget will be the name of the user')}</p>
              </>
            )}
            {addChoice === POST && (
              <>
                <h2>
                  {t('Selected Post')}: <span className='font-extrabold'>{selectedItem.title}</span> by <span className='font-extrabold'>{selectedItem.creator?.name}</span>
                </h2>
                <p className='text-sm text-gray-500'>{t('The name of the widget will be the title of the post')}</p>
              </>
            )}
            {addChoice === CHAT && (
              <>
                <h2>
                  {t('Selected Chat Topic')}: <span className='font-extrabold'>{selectedItem.name}</span>
                </h2>
                <p className='text-sm text-gray-500'>{t('The name of the widget will be the name of the chat topic')}</p>
              </>
            )}
            {addChoice === GROUP && (
              <>
                <h2>
                  {t('Selected Group')}: <span className='font-extrabold'>{selectedItem.name}</span>
                </h2>
                <p className='text-sm text-gray-500'>{t('The name of the widget will be the name of the group')}</p>
              </>
            )}
          </div>

          <WidgetSettings widgetData={widgetData} setWidgetData={setWidgetData} addChoice={addChoice} />
        </div>}
    </div>
  )
}

function CustomViewCreator ({ group, selectedItem, setSelectedItem, widgetData, setWidgetData, addChoice }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [customView, setCustomView] = useState({
    activePostsOnly: false,
    collectionId: null,
    collection: null,
    defaultSort: 'created',
    defaultViewMode: 'cards',
    externalLink: '',
    icon: 'Public',
    isActive: true,
    name: '',
    order: 1,
    postTypes: [],
    topics: [],
    type: 'externalLink'
  })

  // When the custom view changes, update the selected item
  useEffect(() => {
    setSelectedItem(customView)
  }, [customView, setSelectedItem])

  const handleChange = (key) => (v) => {
    let value = typeof (v.target) !== 'undefined' ? v.target.value : v

    setCustomView(prev => {
      const cv = { ...prev }
      // If changing to collection type, create a new collection
      if (key === 'type' && value === 'collection' && !prev.collectionId) {
        handleCreateCollection(cv)
      }
      // Handle topics special case
      if (key === 'topics') {
        value = value.map(t => ({ name: t.name, id: parseInt(t.id) }))
      }

      // Handle type changes
      if (key === 'type' && value !== cv.type) {
        if (value === 'collection') {
          if (!cv.collection) {
            // Create local collection
            const tempId = `temp-${Date.now()}`
            cv.collectionId = tempId
            cv.collection = {
              id: tempId,
              posts: [],
              name: cv.name || 'New Collection',
              groupId: group.id
            }
          }
        }
        // Streams can't use manual sort order, so revert to created
        if (value === 'stream' && cv.defaultSort === 'order') {
          cv.defaultSort = 'created'
        }
      }

      cv[key] = value
      return cv
    })
  }

  // Collection-related functions
  const handleCreateCollection = async (customViewState) => {
    try {
      const response = await dispatch(createCollection({
        name: customViewState.name || 'New Collection',
        groupId: group.id
      }))

      const collectionId = response?.payload?.data?.createCollection?.id
      if (collectionId) {
        setCustomView(prev => ({
          ...prev,
          collectionId,
          collection: {
            id: collectionId,
            posts: [],
            name: customViewState.name || 'New Collection',
            groupId: group.id
          }
        }))
      }
    } catch (error) {
      console.error('Failed to create collection:', error)
    }
  }

  const handleAddPostToCollection = async (collectionId, postId, post) => {
    try {
      await dispatch(addPostToCollection(collectionId, postId))
      // Update local collection state
      setCustomView(prev => ({
        ...prev,
        collection: {
          ...prev.collection,
          posts: [...(prev.collection?.posts || []), post]
        }
      }))
    } catch (error) {
      console.error('Failed to add post to collection:', error)
    }
  }

  const handleRemovePostFromCollection = async (collectionId, postId) => {
    try {
      await dispatch(removePostFromCollection(collectionId, postId))
      // Update local collection state
      setCustomView(prev => ({
        ...prev,
        collection: {
          ...prev.collection,
          posts: prev.collection.posts.filter(p => p.id !== postId)
        }
      }))
    } catch (error) {
      console.error('Failed to remove post from collection:', error)
    }
  }

  const handleReorderPostInCollection = async (collectionId, postId, newIndex) => {
    try {
      await dispatch(reorderPostInCollection(collectionId, postId, newIndex))
      // Update local collection state
      setCustomView(prev => {
        const posts = [...prev.collection.posts]
        const oldIndex = posts.findIndex(p => p.id === postId)
        const [post] = posts.splice(oldIndex, 1)
        posts.splice(newIndex, 0, post)
        return {
          ...prev,
          collection: {
            ...prev.collection,
            posts
          }
        }
      })
    } catch (error) {
      console.error('Failed to reorder post in collection:', error)
    }
  }

  return (
    <div>
      <h3 className='text-lg font-semibold mb-2'>{t('Custom View')}</h3>
      <CustomViewRow
        {...customView}
        addPostToCollection={handleAddPostToCollection}
        removePostFromCollection={handleRemovePostFromCollection}
        reorderPostInCollection={handleReorderPostInCollection}
        group={group}
        index={0}
        menuCreate
        onChange={handleChange}
      />

      <WidgetSettings
        widgetData={widgetData}
        setWidgetData={setWidgetData}
        addChoice={addChoice}
        a
      />
    </div>
  )
}

function ContainerCreator ({ group, addChoice, widgetData, setWidgetData }) {
  const { t } = useTranslation()
  return (
    <div>
      <h3 className='text-lg font-semibold mb-2'>{t('Container Widget')}</h3>
      <p className='text-sm text-gray-500 mb-4'>{t('containerWidgetSescription')}</p>
      <WidgetSettings widgetData={widgetData} setWidgetData={setWidgetData} addChoice={addChoice} />
    </div>
  )
}

function WidgetSettings ({ setWidgetData, widgetData, addChoice }) {
  const { t } = useTranslation()
  const isContainer = addChoice === CONTAINER
  return (
    <div>
      {isContainer &&
        <div className='grid w-full max-w-sm items-center gap-1.5'>
          {/* not allowing overriding names right now, only showing name field for containers, but could bring back */}
          <Label htmlFor='override-name'>{isContainer ? t('Name') : t('Override Name')}</Label>
          <Input
            id='override-name'
            type='text'
            value={widgetData.title}
            placeholder={isContainer ? t('Name this container widget') : t('Leave this blank if you want to use the default name')}
            onChange={(e) => setWidgetData(prev => ({ ...prev, title: e.target.value }))}
          />
        </div>}
      <div className='grid w-full max-w-sm items-center gap-1.5 mt-4'>
        <Label htmlFor='visibility'>{t('Visibility')}</Label>
        <Select
          value={widgetData.visibility}
          onValueChange={(value) => setWidgetData(prev => ({ ...prev, visibility: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('All members')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='admin'>{t('Admin Only')}</SelectItem>
            <SelectItem value='all'>{t('All members')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

/*
  What stuff needs to be covered for creation?
  icon selection
  widget special title
  type (largely derived)
  visibility
*/
