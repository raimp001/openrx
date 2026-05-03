'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  Activity,
  Droplets,
  Heart,
  Scale,
  Thermometer,
  Wind,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('surface-card', className)}>{children}</div>
}

function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={className}>{children}</div>
}

function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h3 className={className}>{children}</h3>
}

function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={className}>{children}</div>
}

function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]', className)}>{children}</span>
}

interface VitalSign {
  id: string
  recordedAt: string
  bloodPressure?: string
  heartRate?: number
  temperature?: number
  respiratoryRate?: number
  oxygenSaturation?: number
  weight?: number
  height?: number
  bmi?: number
  notes?: string
}

interface HealthMetricsProps {
  patientId: string
  vitalSigns?: VitalSign[]
}

interface MetricCardProps {
  label: string
  value: string | number | null | undefined
  unit: string
  normalRange?: string
  status?: 'normal' | 'warning' | 'critical'
  icon: ReactNode
}

function statusClasses(status: 'normal' | 'warning' | 'critical') {
  if (status === 'critical') {
    return {
      card: 'border-soft-red/20 bg-soft-red/5',
      badge: 'bg-soft-red/12 text-soft-red',
      icon: 'text-soft-red',
      label: 'needs attention',
    }
  }

  if (status === 'warning') {
    return {
      card: 'border-yellow-200/70 bg-yellow-50/60',
      badge: 'bg-yellow-200/60 text-yellow-700',
      icon: 'text-yellow-700',
      label: 'watch closely',
    }
  }

  return {
    card: 'border-accent/15 bg-accent/5',
    badge: 'bg-accent/12 text-accent',
    icon: 'text-accent',
    label: 'within range',
  }
}

function MetricCard({ label, value, unit, normalRange, status = 'normal', icon }: MetricCardProps) {
  const colors = statusClasses(status)

  return (
    <div className={cn('rounded-[24px] border px-4 py-4 shadow-[0_18px_50px_-36px_rgba(17,24,39,0.25)]', colors.card)}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn('inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-white/80 shadow-sm', colors.icon)}>
          {icon}
        </div>
        <Badge className={colors.badge}>{colors.label}</Badge>
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-primary">
          {value ?? '--'}
          <span className="ml-1 text-sm font-normal text-muted">{unit}</span>
        </p>
        {normalRange ? <p className="mt-1 text-xs text-muted">Target: {normalRange}</p> : null}
      </div>
    </div>
  )
}

function getBloodPressureStatus(bp?: string): 'normal' | 'warning' | 'critical' {
  if (!bp) return 'normal'
  const [systolic, diastolic] = bp.split('/').map(Number)
  if (systolic >= 180 || diastolic >= 120) return 'critical'
  if (systolic >= 140 || diastolic >= 90) return 'warning'
  if (systolic < 90 || diastolic < 60) return 'warning'
  return 'normal'
}

function getHeartRateStatus(hr?: number): 'normal' | 'warning' | 'critical' {
  if (!hr) return 'normal'
  if (hr > 150 || hr < 40) return 'critical'
  if (hr > 100 || hr < 60) return 'warning'
  return 'normal'
}

function getOxygenStatus(spo2?: number): 'normal' | 'warning' | 'critical' {
  if (!spo2) return 'normal'
  if (spo2 < 90) return 'critical'
  if (spo2 < 95) return 'warning'
  return 'normal'
}

function getTemperatureStatus(temp?: number): 'normal' | 'warning' | 'critical' {
  if (!temp) return 'normal'
  if (temp >= 40 || temp < 35) return 'critical'
  if (temp >= 38.5 || temp < 36) return 'warning'
  return 'normal'
}

function getBMIStatus(bmi?: number): 'normal' | 'warning' | 'critical' {
  if (!bmi) return 'normal'
  if (bmi >= 40 || bmi < 16) return 'critical'
  if (bmi >= 30 || bmi < 18.5) return 'warning'
  return 'normal'
}

export function HealthMetrics({ patientId, vitalSigns: initialVitals }: HealthMetricsProps) {
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>(initialVitals || [])
  const [loading, setLoading] = useState(!initialVitals)
  const [error, setError] = useState<string | null>(null)

  const fetchVitalSigns = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/patients?patientId=${patientId}`)
      if (!response.ok) throw new Error('Failed to fetch vital signs')
      const data = await response.json()
      setVitalSigns(data.vitalSigns || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vital signs')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    if (!initialVitals && patientId) {
      void fetchVitalSigns()
    }
  }, [patientId, initialVitals, fetchVitalSigns])

  const latest = vitalSigns[0]

  if (loading) {
    return (
      <Card>
        <CardHeader className="border-b border-border/50 px-6 py-5">
          <CardTitle className="text-lg font-serif text-primary">Health Metrics</CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse rounded-[22px] border border-border/70 bg-white/70 p-4">
                <div className="mb-3 h-10 w-10 rounded-[14px] bg-border/70" />
                <div className="mb-2 h-3 w-24 rounded bg-border/70" />
                <div className="h-8 w-28 rounded bg-border/70" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="border-b border-border/50 px-6 py-5">
          <CardTitle className="text-lg font-serif text-primary">Health Metrics</CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-6">
          <div className="flex items-start gap-3 rounded-[22px] border border-soft-red/20 bg-soft-red/5 px-4 py-4 text-sm text-soft-red">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!latest) {
    return (
      <Card>
        <CardHeader className="border-b border-border/50 px-6 py-5">
          <CardTitle className="text-lg font-serif text-primary">Health Metrics</CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-8">
          <div className="rounded-[24px] border border-border/70 bg-white/72 px-5 py-8 text-center text-sm text-muted">
            No vital signs recorded yet. Schedule a visit or connect a device feed to build a monitoring history.
          </div>
        </CardContent>
      </Card>
    )
  }

  const recordedDate = new Date(latest.recordedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const attentionCount = [
    getBloodPressureStatus(latest.bloodPressure),
    getHeartRateStatus(latest.heartRate),
    getTemperatureStatus(latest.temperature),
    getOxygenStatus(latest.oxygenSaturation),
    getBMIStatus(latest.bmi),
  ].filter((status) => status !== 'normal').length

  return (
    <Card>
      <CardHeader className="border-b border-border/50 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-serif text-primary">Health Metrics</CardTitle>
            <p className="mt-1 text-sm text-muted">Latest physiologic snapshot from the connected patient record.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={attentionCount ? 'bg-soft-red/12 text-soft-red' : 'bg-accent/12 text-accent'}>
              {attentionCount ? `${attentionCount} items need review` : 'all signals stable'}
            </Badge>
            <Badge className="bg-white/85 text-secondary ring-1 ring-border">{recordedDate}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-6 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Blood Pressure"
            value={latest.bloodPressure}
            unit="mmHg"
            normalRange="90-120 / 60-80"
            status={getBloodPressureStatus(latest.bloodPressure)}
            icon={<Heart size={20} />}
          />
          <MetricCard
            label="Heart Rate"
            value={latest.heartRate}
            unit="bpm"
            normalRange="60-100"
            status={getHeartRateStatus(latest.heartRate)}
            icon={<Activity size={20} />}
          />
          <MetricCard
            label="Temperature"
            value={latest.temperature}
            unit="°C"
            normalRange="36.1-37.2"
            status={getTemperatureStatus(latest.temperature)}
            icon={<Thermometer size={20} />}
          />
          <MetricCard
            label="Oxygen Saturation"
            value={latest.oxygenSaturation}
            unit="%"
            normalRange="95-100"
            status={getOxygenStatus(latest.oxygenSaturation)}
            icon={<Droplets size={20} />}
          />
          <MetricCard
            label="Respiratory Rate"
            value={latest.respiratoryRate}
            unit="breaths/min"
            normalRange="12-20"
            status="normal"
            icon={<Wind size={20} />}
          />
          <MetricCard
            label="BMI"
            value={latest.bmi?.toFixed(1)}
            unit="kg/m²"
            normalRange="18.5-24.9"
            status={getBMIStatus(latest.bmi)}
            icon={<Scale size={20} />}
          />
        </div>

        {vitalSigns.length > 1 ? (
          <div className="rounded-[24px] border border-border/70 bg-white/72 px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-primary">Recent trend</h4>
                <p className="mt-1 text-xs text-muted">The last five readings, ordered most recent first.</p>
              </div>
              <Badge className="bg-accent/10 text-accent">
                <CheckCircle2 size={12} className="mr-1" /> chronology
              </Badge>
            </div>
            <div className="mt-4 space-y-2">
              {vitalSigns.slice(0, 5).map((vs) => (
                <div
                  key={vs.id}
                  className="flex flex-col gap-2 rounded-[20px] border border-border/60 bg-white/80 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between"
                >
                  <span className="text-muted">{new Date(vs.recordedAt).toLocaleDateString()}</span>
                  <div className="flex flex-wrap gap-4 text-secondary">
                    {vs.bloodPressure ? <span>BP: {vs.bloodPressure}</span> : null}
                    {vs.heartRate ? <span>HR: {vs.heartRate}</span> : null}
                    {vs.oxygenSaturation ? <span>SpO₂: {vs.oxygenSaturation}%</span> : null}
                    {vs.temperature ? <span>Temp: {vs.temperature}°C</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default HealthMetrics
