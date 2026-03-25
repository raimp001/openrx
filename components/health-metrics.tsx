'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={className}>{children}</div>
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
  return <span className={`inline-flex items-center rounded px-2 py-0.5 ${className || ''}`}>{children}</span>
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
  icon: string
}

function MetricCard({ label, value, unit, normalRange, status = 'normal', icon }: MetricCardProps) {
  const statusColors = {
    normal: 'bg-accent/10 border-accent/20 text-accent',
    warning: 'bg-yellow-50 border-yellow-200/70 text-yellow-700',
    critical: 'bg-soft-red/10 border-soft-red/20 text-soft-red',
  }

  const badgeColors = {
    normal: 'bg-accent/15 text-accent',
    warning: 'bg-yellow-200/60 text-yellow-700',
    critical: 'bg-soft-red/15 text-soft-red',
  }

  return (
    <div className={`rounded-lg border p-4 ${statusColors[status]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <Badge className={`text-xs ${badgeColors[status]}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      </div>
      <div className="mt-2">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold text-primary">
          {value ?? '--'}
          <span className="ml-1 text-sm font-normal text-muted">{unit}</span>
        </p>
        {normalRange && (
          <p className="mt-1 text-xs text-muted">Normal: {normalRange}</p>
        )}
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
      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-primary">Health Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border border-border/70 bg-surface/60 p-4">
                <div className="mb-2 h-4 w-3/4 rounded bg-border/70" />
                <div className="h-8 w-1/2 rounded bg-border/70" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-primary">Health Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-soft-red">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!latest) {
    return (
      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-primary">Health Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-muted">
            No vital signs recorded yet. Schedule an appointment to get your health metrics tracked.
          </p>
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

  return (
    <Card className="surface-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-primary">Health Metrics</CardTitle>
        <span className="text-sm text-muted">Last recorded: {recordedDate}</span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard
            label="Blood Pressure"
            value={latest.bloodPressure}
            unit="mmHg"
            normalRange="90-120 / 60-80"
            status={getBloodPressureStatus(latest.bloodPressure)}
            icon="❤️"
          />
          <MetricCard
            label="Heart Rate"
            value={latest.heartRate}
            unit="bpm"
            normalRange="60-100"
            status={getHeartRateStatus(latest.heartRate)}
            icon="💓"
          />
          <MetricCard
            label="Temperature"
            value={latest.temperature}
            unit="°C"
            normalRange="36.1-37.2"
            status={getTemperatureStatus(latest.temperature)}
            icon="🌡️"
          />
          <MetricCard
            label="O₂ Saturation"
            value={latest.oxygenSaturation}
            unit="%"
            normalRange="95-100"
            status={getOxygenStatus(latest.oxygenSaturation)}
            icon="🫁"
          />
          <MetricCard
            label="Resp. Rate"
            value={latest.respiratoryRate}
            unit="breaths/min"
            normalRange="12-20"
            status="normal"
            icon="💨"
          />
          <MetricCard
            label="BMI"
            value={latest.bmi?.toFixed(1)}
            unit="kg/m²"
            normalRange="18.5-24.9"
            status={getBMIStatus(latest.bmi)}
            icon="⚖️"
          />
        </div>

        {vitalSigns.length > 1 && (
          <div className="mt-6">
            <h4 className="mb-3 text-sm font-medium text-secondary">Recent Trend (Last 5 readings)</h4>
            <div className="space-y-2">
              {vitalSigns.slice(0, 5).map((vs) => (
                <div
                  key={vs.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-surface/60 p-2 text-sm"
                >
                  <span className="text-muted">
                    {new Date(vs.recordedAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-4 text-secondary">
                    {vs.bloodPressure && <span>BP: {vs.bloodPressure}</span>}
                    {vs.heartRate && <span>HR: {vs.heartRate}</span>}
                    {vs.oxygenSaturation && <span>SpO₂: {vs.oxygenSaturation}%</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default HealthMetrics
