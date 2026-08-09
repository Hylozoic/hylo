import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Maximize2, Minimize2, Minus, Plus, Users } from 'lucide-react'
import { personUrl } from '@hylo/navigation'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import { runSkillsGraph } from './MemberSkillsGraphGenerator'
import { analyzeSkills, buildGraphNodes, smartThreshold } from './buildGraphData'
import { cn } from 'util/index'

// Bipartite skills constellation: members and the skills they share attract
// each other, so people cluster near their skills and skills sit between
// their people. The header dropdown sets how many people a skill needs
// before it earns a node — "1 person" shows everything, the smart default
// picks whatever keeps the simulation fluid.
export default function MemberSkillsGraph ({ members, loading, slug, onSkillClick }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const graphInstanceRef = useRef(null)
  const [userThreshold, setUserThreshold] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [building, setBuilding] = useState(false)

  // The ORM selector hands us a fresh members array whenever any Person
  // changes (e.g. the role-filtered directory fetch below the map), so key
  // the graph data on content — the map ignores directory filters
  const membersKey = useMemo(
    () => members.map(m => `${m.id}:${(m.skills || []).map(s => s.name).join('|')}`).join(','),
    [members]
  )
  const stableMembers = useMemo(() => members, [membersKey])

  const { skillGroups, thresholdOptions } = useMemo(() => analyzeSkills(stableMembers), [stableMembers])
  const autoThreshold = useMemo(() => smartThreshold(thresholdOptions), [thresholdOptions])
  const threshold = userThreshold || autoThreshold
  const { nodes, links } = useMemo(
    () => buildGraphNodes(stableMembers, skillGroups, threshold),
    [stableMembers, skillGroups, threshold]
  )

  // Latest-callback refs: the parent's handlers change identity with the
  // querystring, which must not tear down and rebuild the canvas graph
  const handlersRef = useRef({})
  handlersRef.current = {
    onSkillClick,
    onPersonClick: node => navigate(personUrl(node.personId, slug))
  }

  useEffect(() => {
    if (graphInstanceRef.current) {
      graphInstanceRef.current.destroy()
      graphInstanceRef.current = null
    }

    const el = containerRef.current
    if (!el || !nodes.length || !links.length) return

    // Two frames of headroom so the spinner paints before the synchronous
    // layout settle blocks the main thread on big graphs
    setBuilding(true)
    let cancelled = false
    let raf2 = 0
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (cancelled) return
        while (el.firstChild) {
          el.removeChild(el.firstChild)
        }
        graphInstanceRef.current = runSkillsGraph(el, nodes, links, {
          onSkillClick: skillName => handlersRef.current.onSkillClick?.(skillName),
          onPersonClick: node => handlersRef.current.onPersonClick(node),
          freeWheelZoom: expanded
        })
        setBuilding(false)
      })
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf1)
      if (raf2) window.cancelAnimationFrame(raf2)
      if (graphInstanceRef.current) {
        graphInstanceRef.current.destroy()
        graphInstanceRef.current = null
      }
    }
  }, [nodes, links, expanded])

  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expanded])

  if (!loading && !skillGroups.length) return null

  const thresholdLabel = (option) =>
    option === 1 ? t('1 person') : t('{{count}}+ people', { count: option })

  return (
    <div
      className={cn(expanded ? 'fixed inset-0 z-[100] bg-background flex flex-col p-3' : 'mt-3 mb-2')}
      data-testid='member-skills-graph'
    >
      <div className='flex items-center justify-between bg-card rounded-t-xl border-b border-foreground/10 px-3 py-2'>
        <h2 className='m-0 text-sm font-semibold text-foreground'>{t('Skill map')}</h2>
        <div className={cn('flex items-center gap-2', loading && 'invisible')}>
          <Dropdown
            id='skills-graph-threshold'
            alignRight
            toggleChildren={
              <span
                data-testid='skills-threshold-button'
                title={t('Minimum people per skill')}
                className='flex items-center gap-1 border-2 border-foreground/20 rounded-lg p-2 text-sm text-foreground/70 cursor-pointer transition-colors hover:text-foreground hover:border-foreground/40'
              >
                <Users className='w-4 h-4 opacity-70' />
                <span className='whitespace-nowrap'>{thresholdLabel(threshold)}</span>
                <Icon name='ArrowDown' className='opacity-60' />
              </span>
          }
            items={thresholdOptions.map(option => ({
              key: option.threshold,
              label: (
                <span className='flex items-center justify-between gap-4 w-full'>
                  <span>{thresholdLabel(option.threshold)}</span>
                  <span className='rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums'>
                    {option.skillCount}
                  </span>
                </span>
              ),
              onClick: () => setUserThreshold(option.threshold)
            }))}
          />
        </div>
      </div>
      <div
        className={cn(
          'relative w-full',
          expanded
            ? 'flex-1 min-h-0'
            // Phones get a roughly square map whatever the skill count — the taller
            // sizes below push everything else off the screen. Enlarge is right there.
            : cn('h-[300px]', loading || nodes.length >= 60
              ? 'sm:h-[560px]'
              : nodes.length < 12 ? 'sm:h-[300px]' : nodes.length < 30 ? 'sm:h-[380px]' : 'sm:h-[460px]')
        )}
      >
        <div
          ref={containerRef}
          className='w-full h-full bg-card bg-[url("/network-map-bg.png")] bg-no-repeat bg-cover rounded-b-xl overflow-hidden shadow-2xl'
        />
        <button
          type='button'
          onClick={() => setExpanded(!expanded)}
          title={expanded ? t('Close') : t('Enlarge map')}
          aria-label={expanded ? t('Close') : t('Enlarge map')}
          data-testid='skills-enlarge-button'
          className='absolute top-3 left-3 flex items-center justify-center rounded-lg border-2 border-foreground/20 bg-card/90 backdrop-blur p-2 text-foreground/70 cursor-pointer transition-colors hover:text-foreground hover:bg-foreground/5'
        >
          {expanded ? <Minimize2 className='w-4 h-4' /> : <Maximize2 className='w-4 h-4' />}
        </button>
        {(loading || building) && (
          <div className='absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-b-xl bg-card'>
            <Loading type='inline' />
            <span className='text-sm text-foreground/60'>{t('Loading skills map')}</span>
          </div>
        )}
        {!loading && !building && (
          <div className='absolute bottom-3 right-3 flex flex-col rounded-lg border-2 border-foreground/20 bg-card/90 backdrop-blur overflow-hidden'>
            <button
              type='button'
              onClick={() => graphInstanceRef.current?.zoomBy(1.4)}
              aria-label={t('Zoom in')}
              title={t('Zoom in')}
              className='p-2 text-foreground/70 transition-colors hover:text-foreground hover:bg-foreground/5'
            >
              <Plus className='w-4 h-4' />
            </button>
            <div className='h-px bg-foreground/20' />
            <button
              type='button'
              onClick={() => graphInstanceRef.current?.zoomBy(1 / 1.4)}
              aria-label={t('Zoom out')}
              title={t('Zoom out')}
              className='p-2 text-foreground/70 transition-colors hover:text-foreground hover:bg-foreground/5'
            >
              <Minus className='w-4 h-4' />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
