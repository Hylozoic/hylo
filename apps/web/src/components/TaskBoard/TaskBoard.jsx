import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  closestCorners,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { Plus, Users } from 'lucide-react'
import { postUrl } from '@hylo/navigation'
import Loading from 'components/Loading'
import {
  createTask,
  createTaskStatus,
  deleteTaskStatus,
  fetchTaskBoard,
  moveTask,
  updateTaskStatus
} from 'store/actions/taskActions'
import { cn } from 'util/index'
import { boardProgress, columnOfTask, locateTask, moveTaskOnBoard, toggleDoneTarget } from './boardState'
import TaskColumn, { COLUMN_DROP_PREFIX } from './TaskColumn'
import { TaskCardFace } from './TaskCard'

const MOUSE_ACTIVATION = { distance: 5 }
const TOUCH_ACTIVATION = { delay: 180, tolerance: 8 }

const columnsFromResult = result =>
  (result?.payload?.data?.group?.taskStatuses || []).map(status => ({ ...status, tasks: status.tasks || [] }))

/**
 * The kanban board for a group's (or space's) Tasks view. Each column is a status; dragging a
 * card to another column changes the task's status, and dragging within a column reorders it.
 *
 * The board keeps its own copy of the columns and cards so a drag can update the screen
 * straight away; it reloads from the server after a failed change and whenever a post
 * opened over the board is closed (its status may have been changed there).
 */
export default function TaskBoard ({ group, routeParams, currentUser, canManageColumns }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const groupId = group?.id

  const [columns, setColumns] = useState(null)
  const [mineOnly, setMineOnly] = useState(false)
  const [error, setError] = useState(false)
  const [activeTask, setActiveTask] = useState(null)
  const dragStart = useRef(null)
  const loadSeq = useRef(0)

  const load = useCallback(async () => {
    if (!groupId) return
    const seq = ++loadSeq.current
    try {
      const result = await dispatch(fetchTaskBoard(groupId, mineOnly ? currentUser?.id : null))
      if (seq !== loadSeq.current) return
      if (result?.error) throw new Error('board failed to load')
      setColumns(columnsFromResult(result))
      setError(false)
    } catch (e) {
      if (seq === loadSeq.current) setError(true)
    }
  }, [dispatch, groupId, mineOnly, currentUser?.id])

  useEffect(() => { load() }, [load])

  // A post dialog opened over the board can change a task; reload when it closes
  const postOpen = /\/post\/\d+/.test(location.pathname)
  const wasPostOpen = useRef(postOpen)
  useEffect(() => {
    if (wasPostOpen.current && !postOpen) load()
    wasPostOpen.current = postOpen
  }, [postOpen, load])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: MOUSE_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_ACTIVATION })
  )

  /** Saves a move that is already shown on screen; reloads the board if the server refuses it. */
  const saveMove = useCallback(async (taskId, columnId, index) => {
    try {
      const result = await dispatch(moveTask({
        postId: taskId,
        groupId,
        taskStatusId: columnId,
        // With "My tasks" on, the cards shown are only part of the column, so their
        // positions say nothing about the whole column: the task goes to the bottom.
        index: mineOnly ? undefined : index
      }))
      if (result?.error) throw new Error('move failed')
    } catch (e) {
      load()
    }
  }, [dispatch, groupId, mineOnly, load])

  const columnIdFromDrop = useCallback((over, current) => {
    if (!over) return null
    const id = String(over.id)
    if (id.startsWith(COLUMN_DROP_PREFIX)) return id.slice(COLUMN_DROP_PREFIX.length)
    return columnOfTask(current, id)?.id || null
  }, [])

  const handleDragStart = useCallback(({ active }) => {
    const id = String(active.id)
    dragStart.current = { columns, location: locateTask(columns, id) }
    setActiveTask(columnOfTask(columns, id)?.tasks.find(task => task.id === id) || null)
  }, [columns])

  // While dragging over another column, show the card there so the column makes room for it
  const handleDragOver = useCallback(({ active, over }) => {
    if (!over) return
    setColumns(current => {
      const taskId = String(active.id)
      const from = columnOfTask(current, taskId)
      const toId = columnIdFromDrop(over, current)
      if (!from || !toId || from.id === toId) return current
      const to = current.find(column => column.id === toId)
      const overIndex = to.tasks.findIndex(task => task.id === String(over.id))
      return moveTaskOnBoard(current, taskId, toId, overIndex < 0 ? to.tasks.length : overIndex)
    })
  }, [columnIdFromDrop])

  const handleDragEnd = useCallback(({ active, over }) => {
    const start = dragStart.current
    dragStart.current = null
    setActiveTask(null)
    if (!start) return
    if (!over) {
      setColumns(start.columns)
      return
    }

    const taskId = String(active.id)
    let next = columns
    const toId = columnIdFromDrop(over, next)
    const here = locateTask(next, taskId)
    if (!toId || !here) return

    // Dropped on another card: take that card's place
    const overId = String(over.id)
    if (!overId.startsWith(COLUMN_DROP_PREFIX) && overId !== taskId) {
      const target = locateTask(next, overId)
      if (target) next = moveTaskOnBoard(next, taskId, target.columnId, target.index)
    } else if (here.columnId !== toId) {
      next = moveTaskOnBoard(next, taskId, toId)
    }

    const end = locateTask(next, taskId)
    setColumns(next)
    if (start.location && end.columnId === start.location.columnId && end.index === start.location.index) return
    saveMove(taskId, end.columnId, end.index)
  }, [columns, columnIdFromDrop, saveMove])

  const handleDragCancel = useCallback(() => {
    if (dragStart.current) setColumns(dragStart.current.columns)
    dragStart.current = null
    setActiveTask(null)
  }, [])

  const handleToggleDone = useCallback((task) => {
    const target = toggleDoneTarget(columns, task.id)
    if (!target) return
    // Completed tasks go to the top of the done column; reopened ones to the bottom of the first
    const index = target.category === 'done' ? 0 : target.tasks.length
    setColumns(moveTaskOnBoard(columns, task.id, target.id, index))
    saveMove(task.id, target.id, index)
  }, [columns, saveMove])

  const handleOpenTask = useCallback((task) => {
    navigate(postUrl(task.id, routeParams) + location.search)
  }, [navigate, routeParams, location.search])

  const handleAddTask = useCallback(async (column, title) => {
    const result = await dispatch(createTask({ groupId, title, taskStatusId: column.id }))
    const task = result?.payload?.data?.createPost
    if (!task) {
      load()
      return
    }
    setColumns(current => current.map(c => c.id === column.id
      ? { ...c, tasks: [...c.tasks, task], tasksTotal: (c.tasksTotal || 0) + 1 }
      : c))
  }, [dispatch, groupId, load])

  const handleRename = useCallback(async (column, name) => {
    setColumns(current => current.map(c => c.id === column.id ? { ...c, name } : c))
    const result = await dispatch(updateTaskStatus({ id: column.id, name }))
    if (result?.error) load()
  }, [dispatch, load])

  const handleSetCategory = useCallback(async (column, category) => {
    setColumns(current => current.map(c => c.id === column.id ? { ...c, category } : c))
    const result = await dispatch(updateTaskStatus({ id: column.id, category }))
    if (result?.error) load()
  }, [dispatch, load])

  const handleDeleteColumn = useCallback(async (column) => {
    const count = column.tasksTotal || 0
    const message = count > 0
      ? t('Delete "{{name}}"? Its {{count}} tasks will move to the first column.', { name: column.name, count })
      : t('Delete "{{name}}"?', { name: column.name })
    if (!window.confirm(message)) return
    await dispatch(deleteTaskStatus(column.id))
    load()
  }, [dispatch, load, t])

  const handleAddColumn = useCallback(async () => {
    await dispatch(createTaskStatus({ groupId, name: t('New column') }))
    load()
  }, [dispatch, groupId, load, t])

  const progress = useMemo(() => boardProgress(columns || []), [columns])
  const doneColumns = useMemo(() => (columns || []).filter(c => c.category === 'done').length, [columns])

  if (error && !columns) {
    return (
      <div className='flex flex-col items-center gap-2 py-10 text-foreground/70'>
        <div>{t('Couldn\'t load the board')}</div>
        <button type='button' onClick={load} className='border border-foreground/30 rounded-md px-3 py-1 bg-transparent text-foreground cursor-pointer'>{t('Try again')}</button>
      </div>
    )
  }
  if (!columns) return <Loading />

  const pill = active => cn(
    'h-7 px-2.5 rounded-md border-none text-xs font-bold cursor-pointer',
    active ? 'bg-foreground/20 text-foreground' : 'bg-transparent text-foreground/60 hover:text-foreground'
  )
  const noTasksOfMine = mineOnly && progress.total === 0
  // In a space the board shows who is on the project, linking to the space's Members view
  const membersUrl = group?.type === 'space' && group.memberCount > 0 && /\/tasks(\/|$)/.test(location.pathname)
    ? location.pathname.replace(/\/tasks(\/.*)?$/, '/members')
    : null

  return (
    <div data-testid='task-board' className='flex flex-col flex-1 min-h-0 gap-3'>
      <div className='flex items-center gap-3 flex-wrap'>
        <div className='flex items-center gap-2' data-testid='task-board-progress'>
          <div className='w-28 h-1.5 rounded-full bg-foreground/15 overflow-hidden'>
            <div
              className='h-full bg-selected transition-all'
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
          <span className='text-xs font-bold text-foreground/60'>
            {t('{{done}} of {{total}} done', { done: progress.done, total: progress.total })}
          </span>
        </div>
        {membersUrl && (
          <Link
            to={membersUrl}
            data-testid='task-board-members'
            className='flex items-center gap-1 text-xs font-bold text-foreground/60 hover:text-foreground'
          >
            <Users className='w-3.5 h-3.5' />
            {t('{{count}} members', { count: group.memberCount })}
          </Link>
        )}
        {currentUser && (
          <div className='ml-auto inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-foreground/20 bg-background'>
            <button type='button' data-testid='task-board-everyone' className={pill(!mineOnly)} onClick={() => setMineOnly(false)}>{t('Everyone')}</button>
            <button type='button' data-testid='task-board-mine' className={pill(mineOnly)} onClick={() => setMineOnly(true)}>{t('My tasks')}</button>
          </div>
        )}
      </div>

      {noTasksOfMine
        ? (
          <div className='flex flex-col items-center gap-2 py-10 text-center'>
            <div className='font-bold text-foreground'>{t('Nothing on your plate here')}</div>
            <div className='text-sm text-foreground/60 max-w-xs'>{t('Open any task and choose “I’ll take this” to put it on your list.')}</div>
            <button type='button' onClick={() => setMineOnly(false)} className='border border-foreground/30 rounded-md px-3 py-1 bg-transparent text-foreground cursor-pointer text-sm font-bold'>
              {t('See everyone’s tasks')}
            </button>
          </div>
          )
        : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className='flex flex-row items-start gap-3 flex-1 min-h-0 overflow-x-auto pb-2'>
              {columns.map(column => (
                <TaskColumn
                  key={column.id}
                  column={column}
                  canManage={!!canManageColumns}
                  canDelete={columns.length > 1 && !(column.category === 'done' && doneColumns === 1)}
                  canChangeCategory={!(column.category === 'done' && doneColumns === 1)}
                  canAdd={!!currentUser && !mineOnly}
                  onRename={name => handleRename(column, name)}
                  onSetCategory={category => handleSetCategory(column, category)}
                  onDelete={() => handleDeleteColumn(column)}
                  onAddTask={title => handleAddTask(column, title)}
                  onOpenTask={handleOpenTask}
                  onToggleDone={handleToggleDone}
                />
              ))}
              {canManageColumns && (
                <button
                  type='button'
                  data-testid='task-board-add-column'
                  onClick={handleAddColumn}
                  className='flex items-center gap-1.5 shrink-0 h-10 px-3 rounded-xl border border-dashed border-foreground/30 bg-transparent text-sm font-bold text-foreground/60 hover:text-foreground hover:border-foreground/60 cursor-pointer'
                >
                  <Plus className='w-4 h-4' />{t('Add column')}
                </button>
              )}
            </div>
            <DragOverlay>
              {activeTask && (
                <TaskCardFace
                  task={activeTask}
                  isDone={columnOfTask(columns, activeTask.id)?.category === 'done'}
                  dragging
                  className='w-[254px]'
                />
              )}
            </DragOverlay>
          </DndContext>
          )}
    </div>
  )
}
