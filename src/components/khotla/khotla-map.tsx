'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, DollarSign } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

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

export function KhotlaMap() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [MapComponent, setMapComponent] = useState<React.ComponentType<{
    projects: Project[]
    selectedProject: Project | null
    onSelectProject: (p: Project) => void
  }> | null>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        setProjects(data.projects || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    import('./map-inner').then(mod => {
      setMapComponent(() => mod.MapInner)
    })
  }, [])

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card className="bg-content-card border-content-border rounded overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gold" />
                National Transparency Map — Lesotho
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[500px] w-full relative">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Loading map...
                  </div>
                ) : MapComponent ? (
                  <MapComponent
                    projects={projects}
                    selectedProject={selectedProject}
                    onSelectProject={setSelectedProject}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Loading map renderer...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Project List */}
        <div className="lg:col-span-1">
          <Card className="bg-content-card border-content-border rounded">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gold" />
                Infrastructure Projects
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {projects.length} active projects across Lesotho
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[460px] overflow-y-auto space-y-2 p-3">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProject(project)}
                    className={`w-full text-left p-3 rounded transition-colors ${
                      selectedProject?.id === project.id
                        ? 'bg-gold/20 border border-gold/30'
                        : 'bg-content-card border border-content-border hover:bg-content-card-hover'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <h4 className="text-sm font-medium text-foreground leading-tight">{project.title}</h4>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 shrink-0 ml-2"
                        style={{
                          borderColor: getCategoryColor(project.category) + '50',
                          color: getCategoryColor(project.category),
                          backgroundColor: getCategoryColor(project.category) + '15',
                        }}
                      >
                        {project.category}
                      </Badge>
                    </div>
                    {project.budget && (
                      <p className="text-xs text-muted-foreground mb-2">{project.budget}</p>
                    )}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="text-foreground font-medium">{project.progress}%</span>
                      </div>
                      <Progress
                        value={project.progress}
                        className="h-1.5 bg-content-border"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
