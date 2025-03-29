import { DndContext, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import update from 'immutability-helper'
import { Trash } from 'lucide-react'
import React, { forwardRef, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import PropTypes from 'prop-types'
import Icon, { IconWithRef } from 'components/Icon'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import SettingsControl from 'components/SettingsControl'
import {
  updateGroupSettings
} from '../GroupSettings.store'
import SaveButton from '../SaveButton'

import classes from '../GroupSettings.module.scss'
import styles from './AgreementsTab.module.scss'

const { object } = PropTypes

const emptyAgreement = {
  description: '',
  title: ''
}

function AgreementsTab (props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [agreements, setAgreements] = useState([])
  const [changed, setChanged] = useState(false)
  const [error, setError] = useState(null)
  const [dragIndex, setDragIndex] = useState(null)

  const { group } = props

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: `${t('Group Settings')} > ${t('Agreements')}`,
      icon: 'Settings',
      info: ''
    })
  }, [])

  useEffect(() => {
    setAgreements(group?.agreements || [])
    setChanged(false)
    setError(null)
  }, [group])

  const validate = () => {
    let errorString = ''

    agreements.forEach(a => {
      const { title } = a
      if (title.length < 2) {
        errorString += t('Title needs to be at least two characters long.') + ' \n'
      }
    })
    setError(errorString)
  }

  const save = async () => {
    setChanged(false)
    dispatch(updateGroupSettings(group.id, { agreements }))
  }

  const addAgreement = () => {
    setAgreements([...agreements].concat({ ...emptyAgreement, order: agreements.length }))
  }

  const deleteAgreement = (i) => () => {
    if (window.confirm(t('Are you sure you want to delete this agreement?'))) {
      const newAgreements = [...agreements]
      newAgreements.splice(i, 1)
      setChanged(true)
      setAgreements(newAgreements)
    }
  }

  const updateAgreement = (i) => (key) => (v) => {
    let value = typeof (v.target) !== 'undefined' ? v.target.value : v
    const agreement = { ...agreements[i] }

    if (key === 'order') {
      value = parseInt(value)
    }

    agreement[key] = value
    const newAgreements = [...agreements]
    newAgreements[i] = agreement
    setChanged(true)
    setAgreements(newAgreements)
    validate()
  }

  const handleDragStart = useCallback((event) => {
    setDragIndex(event.active.data.current.sortable.index)
  }, [])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event

    if (active.id !== over.id) {
      setAgreements((prevAgreements) => {
        setChanged(true)
        return update(prevAgreements, {
          $splice: [
            [active.data.current.sortable.index, 1],
            [over.data.current.sortable.index, 0, prevAgreements[active.data.current.sortable.index]]
          ]
        })
      })
    }
    setDragIndex(null)
  }, [])

  if (!group) return <Loading />

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={agreements} strategy={verticalListSortingStrategy}>
        <div className={classes.groupSettings}>
          <h1>{t('Group Agreements')}</h1>
          <p>{t('groupAgreementsDescription')}</p>
          <p className='text-error mb-8'>{t('groupAgreementsWarning')}</p>
          <div>
            {agreements.map((agreement, i) => (
              <AgreementRowDraggable
                key={i}
                index={i}
                dragging={i === dragIndex}
                agreement={agreement}
                onChange={updateAgreement(i)}
                onDelete={deleteAgreement(i)}
                // reorderAgreement={reorderAgreement}
              />
            ))}
          </div>
          <div className='focus:text-foreground text-base border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground w-full block transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex items-center justify-center gap-2' onClick={addAgreement}>
            <h4>{t('Add Agreement')}</h4>
            <Icon name='Circle-Plus' className={styles.addButtonIcon} />
          </div>

          <SaveButton save={save} changed={changed} error={error} />
        </div>
      </SortableContext>

      <DragOverlay>
        {dragIndex !== null
          ? (
            <AgreementRow
              agreement={agreements[dragIndex]}
              index={dragIndex}
              onChange={updateAgreement(dragIndex)}
              onDelete={deleteAgreement(dragIndex)}
            />)
          : null}
      </DragOverlay>
    </DndContext>
  )
}

function AgreementRowDraggable ({
  agreement,
  index,
  onChange,
  onDelete,
  reorderAgreement,
  dragging
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: agreement.id,
    transition: {
      duration: 150, // milliseconds
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform && { ...transform, scaleY: 1 }),
    transition,
    opacity: dragging ? 0 : 1
  }

  return (
    <AgreementRow
      ref={setNodeRef}
      {...{ agreement, attributes, index, onChange, onDelete, reorderAgreement, dragging, listeners, setActivatorNodeRef, style }}
    />
  )
}

function exampleText (t) {
  const exampleString = [
    t('Example: "I will not spread misinformation"'),
    t('Example: "I will only post content relevant to this group"'),
    t('Example: "I promise to be kind to other members"'),
    t('Example: "I will not troll or be intentionally divisive"'),
    t('Example: "I will contribute positive and generative energy to discussions"')
  ]

  const randomString = Math.floor(Math.random() * exampleString.length)

  return exampleString[randomString]
}

const AgreementRow = forwardRef(({ children, ...props }, ref) => {
  const {
    agreement,
    attributes,
    index,
    onChange,
    onDelete,
    listeners,
    setActivatorNodeRef,
    style
  } = props

  const { t } = useTranslation()
  const { description, title } = agreement

  const viewCount = parseInt(index) + 1

  return (
    <div className='border-2 border-foreground/20 p-4 background-black/10 rounded-lg border-dashed relative mb-8' ref={ref} style={style}>
      <div className='text-foreground flex justify-between mb-8'>
        <strong className='flex justify-center items-center w-[20px] h-[20px] rounded-xl text-sm bg-foreground text-background'>{viewCount}</strong>
        <div className='flex items-center gap-2'>
          <Trash onClick={onDelete} className='h-[20px] cursor-pointer' />
          <IconWithRef name='Draggable' className='h-[20px] cursor-grab' {...listeners} {...attributes} ref={setActivatorNodeRef} />
        </div>
      </div>
      <SettingsControl
        label={t('Agreement')}
        onChange={onChange('title')}
        placeholder={exampleText(t)}
        value={title}
      />
      <SettingsControl
        label={t('Description')}
        onChange={onChange('description')}
        placeholder={t('Describe the agreement and what the group expects from its members')}
        type='textarea'
        value={description}
        minRows={3}
      />
    </div>
  )
})

AgreementsTab.propTypes = {
  group: object
}

export default AgreementsTab
