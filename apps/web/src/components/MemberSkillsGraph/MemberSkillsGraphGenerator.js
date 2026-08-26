import * as d3 from 'd3'

const PERSON_RADIUS = 16
const EDGE_PADDING = 30

// Canvas 2D renderer: one DOM element no matter how many nodes, so huge
// groups stay fluid. The physics is plain d3-force; the canvas transform
// provides pan/zoom; a quadtree provides hover/click hit-testing.
export function runSkillsGraph (container, nodesData, linksData, { onSkillClick, onPersonClick, freeWheelZoom = false } = {}) {
  const links = linksData.map(d => Object.assign({}, d))
  const nodes = nodesData.map(d => Object.assign({}, d))

  const containerRect = container.getBoundingClientRect()
  const height = containerRect.height
  const width = containerRect.width
  const dpr = window.devicePixelRatio || 1

  // The container is a window into a larger world: crowded graphs get room
  // to spread out and the user pans/zooms to explore
  const worldScale = Math.max(1, Math.sqrt(nodes.length / 60))
  const worldWidth = width * worldScale
  const worldHeight = height * worldScale

  // Big graphs settle off-screen and paint once; small ones animate their
  // settle. Avatars load lazily in lite mode, revealed by the spotlight.
  const isLarge = nodes.length > 150
  const personCount = nodes.filter(d => d.type === 'person').length
  const showPersonLabels = personCount <= 80

  const skillRadius = d => 7 + Math.sqrt(d.count || 1) * 3

  // Canvas can't resolve CSS variables, so resolve the theme colors up front
  const rootStyle = window.getComputedStyle(document.documentElement)
  const themeColor = (name, fallback) => {
    const value = rootStyle.getPropertyValue(name).trim()
    return value ? `hsl(${value})` : fallback
  }
  const skillCircleColor = themeColor('--selected', '#69cf94')
  const foregroundColor = themeColor('--foreground', '#2c2c2c')
  const cardColor = themeColor('--card', '#ffffff')
  const mutedColor = themeColor('--muted', '#9ca3af')
  const fontFamily = window.getComputedStyle(container).fontFamily || 'sans-serif'

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  canvas.style.cursor = 'grab'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  let transform = d3.zoomIdentity
  let spotlightId = null
  let spotlightSet = null
  let destroyed = false
  let raf = 0

  const scheduleDraw = () => {
    if (raf || destroyed) return
    raf = window.requestAnimationFrame(() => {
      raf = 0
      draw()
    })
  }

  // Avatars render from pre-clipped sprites; each loads at most once and
  // stays loaded, so the map fills in with faces as it gets explored
  const sprites = new Map()
  const spriteSize = PERSON_RADIUS * 2 * dpr
  const loadAvatar = (d) => {
    if (!d.avatarUrl || sprites.has(d.id)) return
    sprites.set(d.id, null)
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (destroyed) return
      const off = document.createElement('canvas')
      off.width = spriteSize
      off.height = spriteSize
      const octx = off.getContext('2d')
      octx.beginPath()
      octx.arc(spriteSize / 2, spriteSize / 2, spriteSize / 2, 0, Math.PI * 2)
      octx.clip()
      const side = Math.min(img.width, img.height)
      octx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, spriteSize, spriteSize)
      sprites.set(d.id, off)
      scheduleDraw()
    }
    img.src = d.avatarUrl
  }

  if (!isLarge) nodes.forEach(d => { if (d.type === 'person') loadAvatar(d) })

  const neighborIds = new Map(nodes.map(d => [d.id, new Set([d.id])]))

  const simulation = d3
    .forceSimulation(nodes)
    .alphaDecay(isLarge ? 0.05 : 0.0228)
    .force('link', d3.forceLink(links).id(d => d.id).distance(60).strength(0.4))
    .force('charge', d3.forceManyBody().strength(d => d.type === 'skill' ? -220 : -120))
    .force('collide', d3.forceCollide().radius(d => d.type === 'skill' ? skillRadius(d) + 22 : PERSON_RADIUS + 12))
    .force('x', d3.forceX(0).strength(0.06))
    .force('y', d3.forceY(0).strength(0.09))
    .force('center', d3.forceCenter(0, 0))

  links.forEach(l => {
    neighborIds.get(l.source.id)?.add(l.target.id)
    neighborIds.get(l.target.id)?.add(l.source.id)
  })

  const clampToWorld = () => {
    nodes.forEach(d => {
      d.x = Math.max(-worldWidth / 2 + EDGE_PADDING, Math.min(worldWidth / 2 - EDGE_PADDING, d.x))
      d.y = Math.max(-worldHeight / 2 + EDGE_PADDING, Math.min(worldHeight / 2 - EDGE_PADDING, d.y))
    })
  }

  let quadtree = null
  const rebuildQuadtree = () => {
    quadtree = d3.quadtree(nodes, d => d.x, d => d.y)
  }

  const nodeRadius = d => d.type === 'skill' ? skillRadius(d) : PERSON_RADIUS

  // Pointer position (CSS px) -> nearest node in world coordinates
  const findNode = (px, py) => {
    if (!quadtree) return null
    const wx = (px - width / 2 - transform.x) / transform.k
    const wy = (py - height / 2 - transform.y) / transform.k
    const found = quadtree.find(wx, wy, 40)
    if (!found) return null
    const dist = Math.hypot(found.x - wx, found.y - wy)
    return dist <= nodeRadius(found) + 4 ? found : null
  }

  const drawLabel = (text, x, y, size, weight, alpha) => {
    ctx.font = `${weight} ${size}px ${fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = alpha
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.strokeStyle = cardColor
    ctx.strokeText(text, x, y)
    ctx.fillStyle = foregroundColor
    ctx.fillText(text, x, y)
  }

  // The spotlight fades in and out through one global strength value, so
  // every element's alpha derives from it and link strokes stay batched
  // (a per-element opacity tween would force one stroke call per link)
  let spotlightStrength = 0
  let targetStrength = 0
  let fadeRaf = 0
  const fadeTick = () => {
    fadeRaf = 0
    const delta = targetStrength - spotlightStrength
    if (Math.abs(delta) < 0.03) {
      spotlightStrength = targetStrength
      if (targetStrength === 0) {
        spotlightId = null
        spotlightSet = null
      }
    } else {
      spotlightStrength += delta * 0.25
      fadeRaf = window.requestAnimationFrame(fadeTick)
    }
    draw()
  }
  const animateSpotlight = () => {
    if (!fadeRaf && !destroyed) fadeRaf = window.requestAnimationFrame(fadeTick)
  }

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.translate(width / 2 + transform.x, height / 2 + transform.y)
    ctx.scale(transform.k, transform.k)

    const lit = spotlightSet
    const s = lit ? spotlightStrength : 0
    const dimAlpha = 1 - s * (1 - 0.12)

    // Links: one batched path per pass keeps stroke calls cheap
    const linkPass = (subset, alpha) => {
      if (!subset.length) return
      ctx.beginPath()
      subset.forEach(l => {
        ctx.moveTo(l.source.x, l.source.y)
        ctx.lineTo(l.target.x, l.target.y)
      })
      ctx.globalAlpha = alpha
      ctx.strokeStyle = foregroundColor
      ctx.lineWidth = 1.5 / transform.k
      ctx.stroke()
    }
    if (lit) {
      linkPass(links.filter(l => l.source.id !== spotlightId && l.target.id !== spotlightId), 0.15 - s * (0.15 - 0.04))
      linkPass(links.filter(l => l.source.id === spotlightId || l.target.id === spotlightId), 0.15 + s * (0.5 - 0.15))
    } else {
      linkPass(links, 0.15)
    }

    nodes.forEach(d => {
      const alpha = lit && !lit.has(d.id) ? dimAlpha : 1
      if (d.type === 'skill') {
        const r = skillRadius(d)
        ctx.globalAlpha = alpha * 0.25
        ctx.beginPath()
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2)
        ctx.fillStyle = skillCircleColor
        ctx.fill()
        ctx.globalAlpha = alpha
        ctx.lineWidth = 1.5
        ctx.strokeStyle = skillCircleColor
        ctx.stroke()
        drawLabel(d.name, d.x, d.y + r + 4, 11, 600, alpha)
      } else {
        const sprite = sprites.get(d.id)
        if (sprite) {
          ctx.globalAlpha = alpha
          ctx.drawImage(sprite, d.x - PERSON_RADIUS, d.y - PERSON_RADIUS, PERSON_RADIUS * 2, PERSON_RADIUS * 2)
        } else {
          ctx.globalAlpha = alpha * 0.35
          ctx.beginPath()
          ctx.arc(d.x, d.y, PERSON_RADIUS, 0, Math.PI * 2)
          ctx.fillStyle = mutedColor
          ctx.fill()
        }
        ctx.globalAlpha = alpha * 0.4
        ctx.beginPath()
        ctx.arc(d.x, d.y, PERSON_RADIUS, 0, Math.PI * 2)
        ctx.lineWidth = 1
        ctx.strokeStyle = foregroundColor
        ctx.stroke()
        const labelVisible = showPersonLabels || (lit && lit.has(d.id))
        if (labelVisible && transform.k >= 0.6) {
          drawLabel(d.name, d.x, d.y + PERSON_RADIUS + 3, 9, 400, showPersonLabels ? alpha * 0.8 : s * 0.8)
        }
      }
    })

    ctx.globalAlpha = 1
  }

  const ticked = () => {
    clampToWorld()
    scheduleDraw()
  }

  simulation.on('tick', ticked)

  const ticksUntilAlpha = (targetAlpha) =>
    Math.ceil(Math.log(targetAlpha) / Math.log(1 - simulation.alphaDecay()))

  if (isLarge) {
    // Settle the layout synchronously and paint once — animating every
    // frame at this node count is what chokes the page
    simulation.stop()
    simulation.tick(ticksUntilAlpha(simulation.alphaMin()))
    clampToWorld()
  } else {
    // Skip the turbulent opening of the simulation off-screen and animate
    // only the final gentle easing into place
    simulation.stop()
    simulation.tick(ticksUntilAlpha(0.12))
    clampToWorld()
    simulation.restart()
  }
  rebuildQuadtree()
  simulation.on('end', rebuildQuadtree)
  scheduleDraw()

  const zoom = d3.zoom()
    .scaleExtent([Math.min(0.9, 0.9 / worldScale), 4])
    // Inline, plain wheel keeps scrolling the page — zoom needs ctrl/cmd
    // (trackpad pinch sends ctrlKey, so pinch-to-zoom still works).
    // Fullscreen frees the wheel since there's no page behind to scroll.
    .filter(event => {
      if (event.type === 'wheel') {
        return freeWheelZoom || event.ctrlKey || event.metaKey
      }
      return !event.button
    })
    .on('zoom', (event) => {
      transform = event.transform
      scheduleDraw()
    })
  d3.select(canvas).call(zoom)

  // Entering fades the spotlight in, leaving fades it out (the lit set
  // lingers until the fade completes); hopping between nodes swaps the lit
  // set at full strength, which reads as crisp rather than flickery
  const spotlight = (d) => {
    const id = d ? d.id : null
    if (id === spotlightId && targetStrength === (d ? 1 : 0)) return
    if (d) {
      spotlightId = id
      spotlightSet = neighborIds.get(d.id)
      targetStrength = 1
      if (isLarge) {
        nodes.forEach(n => {
          if (n.type === 'person' && spotlightSet.has(n.id)) loadAvatar(n)
        })
      }
    } else {
      targetStrength = 0
    }
    animateSpotlight()
  }

  const onPointerMove = (event) => {
    const rect = canvas.getBoundingClientRect()
    const node = findNode(event.clientX - rect.left, event.clientY - rect.top)
    canvas.style.cursor = node ? 'pointer' : 'grab'
    spotlight(node)
  }

  const onPointerLeave = () => spotlight(null)

  const onClick = (event) => {
    const rect = canvas.getBoundingClientRect()
    const node = findNode(event.clientX - rect.left, event.clientY - rect.top)
    if (!node) return
    if (node.type === 'skill' && onSkillClick) onSkillClick(node.name)
    if (node.type === 'person' && onPersonClick) onPersonClick(node)
  }

  canvas.addEventListener('mousemove', onPointerMove)
  canvas.addEventListener('mouseleave', onPointerLeave)
  canvas.addEventListener('click', onClick)

  // Test hook: node positions in CSS pixels relative to the canvas, so e2e
  // specs can drive real mouse events against specific nodes
  container.__skillMapTest = {
    nodePositions: () => nodes.map(d => ({
      id: d.id,
      type: d.type,
      name: d.name,
      x: d.x * transform.k + transform.x + width / 2,
      y: d.y * transform.k + transform.y + height / 2
    }))
  }

  return {
    zoomBy: (factor) => {
      d3.select(canvas).transition().duration(200).call(zoom.scaleBy, factor)
    },
    destroy: () => {
      destroyed = true
      if (raf) window.cancelAnimationFrame(raf)
      if (fadeRaf) window.cancelAnimationFrame(fadeRaf)
      simulation.stop()
      canvas.removeEventListener('mousemove', onPointerMove)
      canvas.removeEventListener('mouseleave', onPointerLeave)
      canvas.removeEventListener('click', onClick)
      delete container.__skillMapTest
      canvas.remove()
    }
  }
}
