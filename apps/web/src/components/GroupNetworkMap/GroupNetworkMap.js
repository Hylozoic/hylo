import React from 'react'
import { runForceGraph } from './GroupNetworkMapGenerator'
import styles from './GroupNetworkMap.module.scss'
import { cn } from 'util/index'

export default ({ networkData }) => {
  const linksData = networkData?.links || []
  const nodesData = networkData?.nodes || []
  const containerRef = React.useRef(null)
  const graphInstanceRef = React.useRef(null)

  React.useEffect(() => {
    // Clean up previous instance if it exists
    if (graphInstanceRef.current) {
      graphInstanceRef.current()
      graphInstanceRef.current = null
    }

    // Only create a new graph if we have data and a container
    if (containerRef.current && linksData.length && nodesData.length) {
      // Clear any existing content in the container
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild)
      }

      const { destroy } = runForceGraph(containerRef.current, linksData, nodesData)
      graphInstanceRef.current = destroy
    }

    return () => {
      if (graphInstanceRef.current) {
        graphInstanceRef.current()
        graphInstanceRef.current = null
      }
    }
  }, [linksData, nodesData])

  // Always render the container, but with a minimum height when empty
  return (
    <div
      ref={containerRef}
      className={cn(
        'h-full bg-card bg-[url("/network-map-bg.png")] bg-no-repeat bg-cover rounded-xl shadow-2xl',
        {
          'min-h-[300px]': nodesData.length < 5,
          'min-h-[400px]': nodesData.length >= 5 && nodesData.length < 15,
          'min-h-[500px]': nodesData.length >= 15
        },
        styles.container
      )}
    />
  )
}
