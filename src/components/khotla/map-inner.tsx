'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Project {
  id: string
  title: string
  budget: string | null
  progress: number
  lat: number
  lng: number
  category: string | null
  status: string | null
}

export function MapInner({
  projects,
  selectedProject,
  onSelectProject,
}: {
  projects: Project[]
  selectedProject: Project | null
  onSelectProject: (p: Project) => void
}) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<L.CircleMarker[]>([])
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const { resolvedTheme } = useTheme()

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [-29.6, 28.2],
      zoom: 8,
      zoomControl: true,
      attributionControl: false,
    })

    tileLayerRef.current = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 19 }
    ).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
    }
  }, [])

  // Switch tile layer on theme change
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current || !resolvedTheme) return

    const isDark = resolvedTheme === 'dark'
    const newUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

    tileLayerRef.current.setUrl(newUrl)
  }, [resolvedTheme])

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return

    // Remove old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const getCategoryColor = (category: string | null) => {
      const colors: Record<string, string> = {
        ROADS: '#F59E0B',
        WATER: '#3B82F6',
        HEALTH: '#EF4444',
        EDUCATION: '#8B5CF6',
        ELECTRICITY: '#FBBF24',
        SANITATION: '#10B981',
      }
      return colors[category || ''] || '#C5A55A'
    }

    projects.forEach(project => {
      const color = getCategoryColor(project.category)
      const radius = 6 + (project.progress / 100) * 8

      const marker = L.circleMarker([project.lat, project.lng], {
        radius,
        fillColor: color,
        color: color,
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.4,
      }).addTo(mapRef.current!)

      marker.bindPopup(`
        <div style="min-width:200px;font-family:system-ui;">
          <h3 style="font-weight:600;margin:0 0 4px;font-size:14px;">${project.title}</h3>
          <div style="display:flex;gap:8px;margin-bottom:6px;">
            <span style="background:${color}20;color:${color};padding:1px 6px;border-radius:3px;font-size:11px;">${project.category}</span>
            <span style="font-size:11px;color:#666;">${project.budget || 'Budget TBD'}</span>
          </div>
          <div style="background:#f0f0f0;border-radius:3px;height:6px;overflow:hidden;">
            <div style="background:${color};height:100%;width:${project.progress}%;border-radius:3px;"></div>
          </div>
          <div style="font-size:11px;color:#666;margin-top:2px;">Progress: ${project.progress}%</div>
        </div>
      `)

      marker.on('click', () => {
        onSelectProject(project)
      })

      markersRef.current.push(marker)
    })
  }, [projects, onSelectProject])

  // Fly to selected project
  useEffect(() => {
    if (!mapRef.current || !selectedProject) return
    mapRef.current.flyTo([selectedProject.lat, selectedProject.lng], 10, { duration: 1 })
  }, [selectedProject])

  return <div ref={mapContainerRef} className="h-full w-full" />
}
