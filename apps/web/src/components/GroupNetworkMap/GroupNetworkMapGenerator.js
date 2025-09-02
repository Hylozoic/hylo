import { groupUrl } from '@hylo/navigation'
import { DEFAULT_AVATAR } from 'store/models/Group'
import * as d3 from 'd3'
import { cn } from 'util/index'

export function runForceGraph (
  container,
  linksData,
  nodesData
) {
  const links = linksData.map((d) => Object.assign({}, d))
  const nodes = nodesData.map((d) => Object.assign({}, d))

  const containerRect = container.getBoundingClientRect()
  const height = containerRect.height
  const width = containerRect.width

  const drag = (simulation) => {
    const dragstarted = (event, d) => {
      if (!event.active) simulation.alphaTarget(0.1).restart()
      d.fx = d.x
      d.fy = d.y
    }

    const dragged = (event, d) => {
      d.fx = event.x
      d.fy = event.y
    }

    const dragended = (event, d) => {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    return d3
      .drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended)
  }

  const wrap = (text, width) => {
    text.each(function () {
      const text = d3.select(this)
      const words = text.text().split(/\s+/).reverse()
      let word
      let line = []
      let lineNumber = 0
      const lineHeight = 1.1 // ems
      const y = text.attr('y')
      const dy = parseFloat(text.attr('dy')) || 0
      let tspan = text.text(null).append('tspan').attr('x', 0).attr('y', y).attr('dy', dy + 'em')
      // eslint-disable-next-line no-cond-assign
      while (word = words.pop()) {
        line.push(word)
        tspan.text(line.join(' '))
        if (tspan.node().getComputedTextLength() > width) {
          line.pop()
          tspan.text(line.join(' '))
          line = [word]
          tspan = text.append('tspan').attr('x', 0).attr('y', y).attr('dy', `${++lineNumber * lineHeight + dy}em`).text(word)
        }
      }
    })
  }

  const simulation = d3
    .forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id))
    .force('charge', d3.forceManyBody().strength(-600))
    .force('collide', d3.forceCollide().radius(52))
    .force('center', d3.forceCenter(0, 0))
    .force('x', d3.forceX(width / 4).strength(0.5))
    .force('y', d3.forceY(height / 4).strength(0.7))

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', [-width / 2, -height / 2, width, height])
    .call(d3.zoom().on('zoom', function (event) {
      // TODO: More testing. Disabling zoom for now.
      // svg.attr('transform', event.transform)
    }))

  const defs = svg.append('defs')

  // Get HSL values from CSS variables 
  const accentHSL = 'hsl(var(--accent))'
  const focusHSL = 'hsl(var(--focus))'
  const peerHSL = '#10B981'

  // Parent relationship arrowhead (accent color)
  defs.append('marker')
    .attr('id', 'parent-marker')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 13)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 5)
    .attr('markerHeight', 8)
    .attr('xoverflow', 'visible')
    .append('svg:path')
    .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
    .attr('fill', accentHSL)
    .style('stroke', 'none')

  // Child relationship arrowhead (focus color)
  defs.append('marker')
    .attr('id', 'child-marker')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 13)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 5)
    .attr('markerHeight', 8)
    .attr('xoverflow', 'visible')
    .append('svg:path')
    .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
    .attr('fill', focusHSL)
    .style('stroke', 'none')

  // Peer relationship marker (bidirectional circle)
  defs.append('marker')
    .attr('id', 'peer-marker')
    .attr('viewBox', '-6 -6 12 12')
    .attr('refX', 0)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .append('circle')
    .attr('r', 3)
    .attr('fill', peerHSL)
    .style('stroke', '#065F46')
    .style('stroke-width', 1)

  defs.append('clipPath')
    .attr('id', 'group-avatar-clip')
    .append('circle')
    .attr('r', 20)
    .attr('cx', 20)
    .attr('cy', 20)

  // Create tooltip element for peer relationships
  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'network-map-tooltip')
    .style('position', 'absolute')
    .style('visibility', 'hidden')
    .style('background', 'hsl(var(--background))')
    .style('border', '1px solid hsl(var(--border))')
    .style('border-radius', '4px')
    .style('padding', '8px 12px')
    .style('font-size', '12px')
    .style('color', 'hsl(var(--foreground))')
    .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
    .style('z-index', '1000')
    .style('max-width', '200px')
    .style('word-wrap', 'break-word')

  const linkGroup = svg.append('g')

  // Create visible links
  const link = linkGroup
    .selectAll('polyline.visible-link')
    .data(links)
    .join('polyline')
    .attr('class', 'visible-link')
    .attr('stroke', d => {
      switch (d.type) {
        case 'parent': return accentHSL
        case 'child': return focusHSL
        case 'peer': return peerHSL
        default: return '#BBB'
      }
    })
    .attr('stroke-opacity', d => d.type === 'peer' ? 0.8 : 0.7)
    .attr('stroke-width', d => d.type === 'peer' ? 3 : 2)
    .attr('stroke-dasharray', d => d.type === 'peer' ? '5,5' : 'none')
    .attr('marker-mid', d => {
      switch (d.type) {
        case 'parent': return 'url(#parent-marker)'
        case 'child': return 'url(#child-marker)'
        case 'peer': return 'url(#peer-marker)'
        default: return 'url(#parent-marker)'
      }
    })
    .attr('fill', 'none')
    .style('pointer-events', 'none') // Disable mouse events on visible links

  // Create invisible wider links for better hover detection
  const hoverLink = linkGroup
    .selectAll('polyline.hover-link')
    .data(links)
    .join('polyline')
    .attr('class', 'hover-link')
    .attr('stroke', 'transparent')
    .attr('stroke-width', 12) // Much wider hitbox
    .attr('fill', 'none')
    .style('cursor', d => d.type === 'peer' && d.description ? 'help' : 'default')
    .on('mouseover', function(event, d) {
      if (d.type === 'peer' && d.description) {
        tooltip
          .style('visibility', 'visible')
          .html(`<strong>Peer Relationship:</strong><br/>${d.description}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')
      }
    })
    .on('mousemove', function(event, d) {
      if (d.type === 'peer' && d.description) {
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')
      }
    })
    .on('mouseout', function() {
      tooltip.style('visibility', 'hidden')
    })

  const images = svg.append('g')
    .selectAll('circle')
    .data(nodes)
    .enter()
    .append('a')
    .attr('xlink:href', d => groupUrl(d.slug))
    .append('image')
    .attr('x', 0)
    .attr('y', 0)
    .attr('xlink:href', d => d.avatarUrl ? d.avatarUrl : DEFAULT_AVATAR)
    .attr('clip-path', 'url(#group-avatar-clip)')
    .attr('transform', d => `translate(${d.x - 20}, ${d.y - 20})`)
    .attr('height', 40)
    .attr('width', 40)
    .call(drag(simulation))

  // Get computed colors from the document
  const getComputedColor = (colorVar) => {
    // Create a temporary element to compute the style
    const tempEl = document.createElement('div')
    tempEl.className = colorVar
    document.body.appendChild(tempEl)
    const color = window.getComputedStyle(tempEl).color
    document.body.removeChild(tempEl)
    return color
  }

  // Get the colors for styling
  const foregroundColor = getComputedColor('text-foreground')
  const foregroundColorMuted = getComputedColor('text-foreground/50')
  const accentColor = getComputedColor('text-accent')
  const focusColor = getComputedColor('text-focus')
  const peerColor = '#10B981' // Keep existing green for peer relationships

  const label = svg.append('g')
    .selectAll('text')
    .data(nodes)
    .enter()
    .append('a')
    .attr('xlink:href', d => groupUrl(d.slug))
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('y', d => 35)
    .text(d => { return d.name })
    .attr('class', d => {
      return cn(
        'drop-shadow',
        d.index === 0
          ? 'text-base font-bold'
          : 'text-xs font-normal'
      )
    })
    // Use the computed colors
    .style('fill', d => d.index === 0 ? foregroundColor : foregroundColorMuted)
    .call(wrap, 150)
    .call(drag(simulation))

  // Run the simulation without rendering to reduce animation time
  simulation.tick(250)

  simulation.on('tick', () => {
    // center the root node
    nodes[0].x = 0
    nodes[0].y = 0

    // update link positions
    const updateLinkPositions = function (d) {
      return d.source.x + ',' + d.source.y + ' ' +
        (d.source.x + d.target.x) / 2 + ',' + (d.source.y + d.target.y) / 2 + ' ' +
        d.target.x + ',' + d.target.y
    }
    
    link.attr('points', updateLinkPositions)
    hoverLink.attr('points', updateLinkPositions)

    // update image positions
    images
      .attr('transform', d => `translate(${d.x - 20}, ${d.y - 20})`)

    // update label positions
    label
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
  })

  // Add legend in bottom left corner
  const legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${-width / 2 + 20}, ${height / 2 - 100})`)

  const legendData = [
    { type: 'parent', label: 'Parent Group', color: accentHSL, marker: 'parent-marker' },
    { type: 'child', label: 'Child Group', color: focusHSL, marker: 'child-marker' },
    { type: 'peer', label: 'Peer Group', color: peerHSL, marker: 'peer-marker' }
  ]

  // Legend background
  legend.append('rect')
    .attr('x', -10)
    .attr('y', -10)
    .attr('width', 140)
    .attr('height', 80)
    .attr('fill', 'hsl(var(--background))')
    .attr('stroke', 'hsl(var(--border))')
    .attr('stroke-width', 1)
    .attr('rx', 4)
    .attr('opacity', 0.9)

  // Legend items
  const legendItem = legend.selectAll('.legend-item')
    .data(legendData)
    .enter()
    .append('g')
    .attr('class', 'legend-item')
    .attr('transform', (d, i) => `translate(0, ${i * 20})`)

  // Legend lines
  legendItem.append('line')
    .attr('x1', 0)
    .attr('y1', 10)
    .attr('x2', 20)
    .attr('y2', 10)
    .attr('stroke', d => d.color)
    .attr('stroke-width', d => d.type === 'peer' ? 3 : 2)
    .attr('stroke-dasharray', d => d.type === 'peer' ? '3,3' : 'none')
    .attr('marker-end', d => `url(#${d.marker})`)

  // Legend text
  legendItem.append('text')
    .attr('x', 30)
    .attr('y', 10)
    .attr('dy', '0.35em')
    .style('font-size', '12px')
    .style('fill', 'hsl(var(--foreground))')
    .text(d => d.label)

  return {
    destroy: () => {
      simulation.stop()
      // Clean up tooltip
      tooltip.remove()
    },
    nodes: () => {
      return svg.node()
    }
  }
}
