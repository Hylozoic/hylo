import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Maximize2, Minimize2, Users } from 'lucide-react'
import { personUrl } from '@hylo/navigation'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import { runSkillsGraph } from './MemberSkillsGraphGenerator'
import { analyzeSkills, buildGraphNodes, smartThreshold } from './buildGraphData'
import { cn } from 'util/index'

// Bipartite skills constellation: members and the skills they share attract
// each other, so people cluster near their skills and skills sit between
// their people. The header dropdown sets how many people a skill needs
// before it earns a node — "1 person" shows everything, the smart default
// picks whatever keeps the simulation fluid.
export default function MemberSkillsGraph ({ members, slug, onSkillClick }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const graphInstanceRef = useRef(null)
  const [userThreshold, setUserThreshold] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const { skillGroups, thresholdOptions } = useMemo(() => analyzeSkills(members), [members])
  const autoThreshold = useMemo(() => smartThreshold(thresholdOptions), [thresholdOptions])
  const threshold = userThreshold || autoThreshold
  const { nodes, links } = useMemo(
    () => buildGraphNodes(members, skillGroups, threshold),
    [members, skillGroups, threshold]
  )

  const handlePersonClick = useCallback(node => {
    navigate(personUrl(node.personId, slug))
  }, [navigate, slug])

  useEffect(() => {
    if (graphInstanceRef.current) {
      graphInstanceRef.current()
      graphInstanceRef.current = null
    }

    if (containerRef.current && nodes.length && links.length) {
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild)
      }

      const { destroy } = runSkillsGraph(containerRef.current, nodes, links, { onSkillClick, onPersonClick: handlePersonClick })
      graphInstanceRef.current = destroy
    }

    return () => {
      if (graphInstanceRef.current) {
        graphInstanceRef.current()
        graphInstanceRef.current = null
      }
    }
  }, [nodes, links, onSkillClick, handlePersonClick, expanded])

  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expanded])

  if (!skillGroups.length) return null

  const thresholdLabel = (option) =>
    option === 1 ? t('1 person') : t('{{count}}+ people', { count: option })

  return (
    <div
      className={cn(expanded ? 'fixed inset-0 z-[100] bg-background flex flex-col p-3' : 'mb-2')}
      data-testid='member-skills-graph'
    >
      <div className='flex items-center justify-between bg-card rounded-t-xl border-b border-foreground/10 px-3 py-2'>
        <h2 className='m-0 text-sm font-semibold text-foreground'>{t('Skill map')}</h2>
        <div className='flex items-center gap-2'>
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
          <button
            type='button'
            onClick={() => setExpanded(!expanded)}
            title={expanded ? t('Close') : t('Enlarge map')}
            aria-label={expanded ? t('Close') : t('Enlarge map')}
            data-testid='skills-enlarge-button'
            className='flex items-center justify-center border-2 border-foreground/20 rounded-lg p-2 text-foreground/70 cursor-pointer transition-colors hover:text-foreground hover:border-foreground/40'
          >
            {expanded ? <Minimize2 className='w-4 h-4' /> : <Maximize2 className='w-4 h-4' />}
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className={cn(
          'w-full bg-card bg-[url("/network-map-bg.png")] bg-no-repeat bg-cover rounded-b-xl shadow-2xl',
          expanded
            ? 'flex-1 min-h-0'
            : nodes.length < 12 ? 'h-[300px]' : nodes.length < 30 ? 'h-[380px]' : nodes.length < 60 ? 'h-[460px]' : 'h-[560px]'
        )}
      />
    </div>
  )
}
