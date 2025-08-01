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

  defs.append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 13)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 5)
    .attr('markerHeight', 8)
    .attr('xoverflow', 'visible')
    .append('svg:path')
    .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
    .attr('fill', '#BBB')
    .style('stroke', 'none')

  defs.append('clipPath')
    .attr('id', 'group-avatar-clip')
    .append('circle')
    .attr('r', 20)
    .attr('cx', 20)
    .attr('cy', 20)

  const link = svg
    .append('g')
    .attr('stroke', '#BBB')
    .attr('stroke-opacity', 0.5)
    .selectAll('polyline')
    .data(links)
    .join('polyline')
    .attr('stroke-width', 2)
    .attr('marker-mid', 'url(#arrowhead)')

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

  // Get the foreground colors
  const foregroundColor = getComputedColor('text-foreground')
  const foregroundColorMuted = getComputedColor('text-foreground/50')

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
    link.attr('points', function (d) {
      return d.source.x + ',' + d.source.y + ' ' +
        (d.source.x + d.target.x) / 2 + ',' + (d.source.y + d.target.y) / 2 + ' ' +
        d.target.x + ',' + d.target.y
    })

    // update image positions
    images
      .attr('transform', d => `translate(${d.x - 20}, ${d.y - 20})`)

    // update label positions
    label
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
  })

  return {
    destroy: () => {
      simulation.stop()
    },
    nodes: () => {
      return svg.node()
    }
  }
}
