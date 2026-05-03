"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  Clock,
  Droplets,
  Heart,
  Minus,
  TrendingDown,
  TrendingUp,
  Weight,
} from "lucide-react"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsEmptyState, OpsMetricCard, OpsPanel, OpsTabButton } from "@/components/ui/ops-primitives"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn } from "@/lib/utils"

type TimeRange = "7d" | "14d" | "30d"

type TrendPoint = {
  label: string
  values: Record<string, number | null>
}

type TrendLine = {
  key: string
  label: string
  color: string
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-border/40", className)} />
}

function TrendBadge({
  trend,
  goodDirection,
}: {
  trend: "up" | "down" | "stable"
  goodDirection: "down" | "up"
}) {
  if (trend === "stable") {
    return (
      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-muted">
        <Minus size={11} /> stable
      </div>
    )
  }

  const improving = trend === goodDirection
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold",
        improving
          ? "border-accent/20 bg-accent/10 text-accent"
          : "border-soft-red/20 bg-soft-red/10 text-soft-red"
      )}
    >
      {trend === "up" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {improving ? "improving" : "worsening"}
    </div>
  )
}

function SparklineChart({
  data,
  lines,
  threshold,
  thresholdLabel,
  unit,
}: {
  data: TrendPoint[]
  lines: TrendLine[]
  threshold?: number
  thresholdLabel?: string
  unit: string
}) {
  const width = 1000
  const height = 220
  const topPadding = 18
  const bottomPadding = 34
  const leftPadding = 20
  const rightPadding = 16
  const plotWidth = width - leftPadding - rightPadding
  const plotHeight = height - topPadding - bottomPadding

  const numericValues = data.flatMap((point) =>
    lines.flatMap((line) => {
      const value = point.values[line.key]
      return typeof value === "number" ? [value] : []
    })
  )

  if (data.length < 2 || numericValues.length < 2) {
    return (
      <div className="rounded-[22px] border border-border/60 bg-white/72 px-4 py-5 text-sm text-muted">
        More readings are needed before OpenRx can draw a reliable trend.
      </div>
    )
  }

  const minValue = Math.min(...numericValues)
  const maxValue = Math.max(...numericValues)
  const span = Math.max(maxValue - minValue, 12)
  const chartMin = Math.max(0, minValue - span * 0.18)
  const chartMax = maxValue + span * 0.18
  const valueRange = Math.max(chartMax - chartMin, 1)

  const toX = (index: number) => leftPadding + (plotWidth * index) / Math.max(data.length - 1, 1)
  const toY = (value: number) => topPadding + plotHeight - ((value - chartMin) / valueRange) * plotHeight

  const pathFor = (line: TrendLine) => {
    const points = data
      .map((point, index) => {
        const value = point.values[line.key]
        return typeof value === "number" ? `${index === 0 ? "M" : "L"}${toX(index)} ${toY(value)}` : null
      })
      .filter(Boolean)
      .join(" ")
    return points
  }

  const lastValues = lines.map((line) => {
    const lastPoint = [...data].reverse().find((point) => typeof point.values[line.key] === "number")
    return {
      ...line,
      value: lastPoint?.values[line.key] ?? null,
    }
  })

  return (
    <div className="rounded-[24px] border border-border/60 bg-white/72 px-3 py-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full" role="img" aria-label={`Trend chart in ${unit}`}>
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = topPadding + plotHeight * ratio
          return <line key={ratio} x1={leftPadding} y1={y} x2={width - rightPadding} y2={y} stroke="rgba(20,35,31,0.08)" strokeDasharray="4 8" />
        })}
        {threshold !== undefined ? (
          <line
            x1={leftPadding}
            y1={toY(threshold)}
            x2={width - rightPadding}
            y2={toY(threshold)}
            stroke="rgba(185,28,28,0.92)"
            strokeDasharray="8 8"
            strokeWidth="2"
          />
        ) : null}
        {lines.map((line) => (
          <path
            key={line.key}
            d={pathFor(line)}
            fill="none"
            stroke={line.color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {lines.flatMap((line) =>
          data.flatMap((point, index) => {
            const value = point.values[line.key]
            if (typeof value !== "number") return []
            return [
              <circle key={`${line.key}-${index}`} cx={toX(index)} cy={toY(value)} r="4.5" fill={line.color} stroke="white" strokeWidth="2" />,
            ]
          })
        )}
        {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((index) => (
          <text
            key={index}
            x={toX(index)}
            y={height - 8}
            textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
            fontSize="12"
            fill="#526173"
          >
            {data[index]?.label}
          </text>
        ))}
        {threshold !== undefined && thresholdLabel ? (
          <text x={width - rightPadding} y={toY(threshold) - 8} textAnchor="end" fontSize="11" fill="#B91C1C">
            {thresholdLabel}
          </text>
        ) : null}
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted">
        {lastValues.map((line) => (
          <span key={line.key} className="inline-flex items-center gap-2">
            <span className="h-2 w-5 rounded-full" style={{ backgroundColor: line.color }} />
            {line.label} · {line.value ?? "—"} {unit}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function VitalsPage() {
  const { snapshot, loading } = useLiveSnapshot()
  const vitals = snapshot.vitals
  const hasData = Boolean(snapshot.patient)
  const [range, setRange] = useState<TimeRange>("14d")

  const rangeDays = range === "7d" ? 7 : range === "14d" ? 14 : 30
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - rangeDays)
  const filteredVitals = vitals.filter((vital) => new Date(vital.recorded_at) >= cutoff)

  const bpReadings = filteredVitals.filter((vital) => vital.systolic && vital.diastolic)
  const glucoseReadings = filteredVitals.filter((vital) => vital.blood_glucose)
  const weightReadings = filteredVitals.filter((vital) => vital.weight_lbs)

  const avgSystolic = bpReadings.length
    ? Math.round(bpReadings.reduce((sum, vital) => sum + (vital.systolic || 0), 0) / bpReadings.length)
    : null
  const avgDiastolic = bpReadings.length
    ? Math.round(bpReadings.reduce((sum, vital) => sum + (vital.diastolic || 0), 0) / bpReadings.length)
    : null
  const avgGlucose = glucoseReadings.length
    ? Math.round(glucoseReadings.reduce((sum, vital) => sum + (vital.blood_glucose || 0), 0) / glucoseReadings.length)
    : null
  const latestWeight = weightReadings.length ? weightReadings[0].weight_lbs : null
  const latestHR = filteredVitals.find((vital) => vital.heart_rate)?.heart_rate || null
  const latestVital = filteredVitals[0] || null

  const trend = (values: number[]): "up" | "down" | "stable" => {
    if (values.length < 2) return "stable"
    const half = Math.ceil(values.length / 2)
    const recent = values.slice(0, half)
    const older = values.slice(half)
    const recentAvg = recent.reduce((sum, value) => sum + value, 0) / recent.length
    const olderAvg = older.reduce((sum, value) => sum + value, 0) / older.length
    const diff = recentAvg - olderAvg
    if (Math.abs(diff) < 3) return "stable"
    return diff > 0 ? "up" : "down"
  }

  const bpTrend = trend(bpReadings.map((vital) => vital.systolic || 0))
  const glucoseTrend = trend(glucoseReadings.map((vital) => vital.blood_glucose || 0))

  const chartData = useMemo(
    () =>
      [...filteredVitals]
        .sort((left, right) => new Date(left.recorded_at).getTime() - new Date(right.recorded_at).getTime())
        .map((vital) => ({
          label: new Date(vital.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          values: {
            systolic: vital.systolic || null,
            diastolic: vital.diastolic || null,
            glucose: vital.blood_glucose || null,
            hr: vital.heart_rate || null,
            weight: vital.weight_lbs || null,
          },
        })),
    [filteredVitals]
  )

  const highBP = Boolean(avgSystolic && avgSystolic >= 140)
  const highGlucose = Boolean(avgGlucose && avgGlucose > 130)
  const homeCount = filteredVitals.filter((vital) => vital.source === "home").length
  const clinicCount = filteredVitals.filter((vital) => vital.source === "clinic").length
  const deviceCount = filteredVitals.filter((vital) => vital.source === "device").length

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <AppPageHeader
          eyebrow="Preventive monitoring"
          title="Vitals"
          description="Trend lines, out-of-range alerts, and source confidence in one view so the patient knows what changed and what to act on next."
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <OpsBadge tone="blue">Loading readings</OpsBadge>
              <OpsBadge tone="terra">Syncing patient snapshot</OpsBadge>
            </div>
          }
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="surface-card p-5">
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.55fr_0.95fr]">
          <div className="surface-card p-5"><Skeleton className="h-[38rem] w-full" /></div>
          <div className="surface-card p-5"><Skeleton className="h-[38rem] w-full" /></div>
        </div>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="animate-slide-up space-y-6">
        <AppPageHeader
          eyebrow="Preventive monitoring"
          title="Vitals"
          description="Connect your health record to track blood pressure, glucose, heart rate, oxygen, and weight trends over time."
        />
        <div className="flex min-h-[36vh] flex-col items-center justify-center gap-4 text-center">
          <OpsEmptyState
            icon={Activity}
            title="Vital history starts after record sync"
            description="Once records are connected, this page shows trend lines, out-of-range alerts, and source confidence."
          />
          <Link href="/onboarding" className="control-button-primary">
            Get started
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Preventive monitoring"
        title="Vitals"
        description="Trend lines, out-of-range alerts, and source confidence in one view so the patient knows what changed and what to act on next."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <OpsBadge tone={highBP || highGlucose ? "red" : "accent"}>
              {highBP || highGlucose ? "outside target" : "within target"}
            </OpsBadge>
            <OpsBadge tone="blue">{filteredVitals.length} readings in {range}</OpsBadge>
            <OpsBadge tone="terra">last sync {latestVital ? new Date(latestVital.recorded_at).toLocaleDateString() : "pending"}</OpsBadge>
          </div>
        }
        actions={
          <div className="flex gap-1 rounded-2xl border border-border bg-white/75 p-1">
            {(["7d", "14d", "30d"] as TimeRange[]).map((value) => (
              <OpsTabButton key={value} active={range === value} onClick={() => setRange(value)}>
                {value}
              </OpsTabButton>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OpsMetricCard
          label="Blood pressure"
          value={`${avgSystolic ?? "--"}/${avgDiastolic ?? "--"}`}
          detail="Average across the selected range."
          icon={Heart}
          tone={highBP ? "red" : "blue"}
        />
        <OpsMetricCard
          label="Glucose"
          value={avgGlucose ? `${avgGlucose}` : "--"}
          detail="Average fasting glucose in mg/dL."
          icon={Droplets}
          tone={highGlucose ? "gold" : "accent"}
        />
        <OpsMetricCard
          label="Heart rate"
          value={latestHR ? `${latestHR}` : "--"}
          detail="Latest recorded beats per minute."
          icon={Activity}
          tone="terra"
        />
        <OpsMetricCard
          label="Weight"
          value={latestWeight ? `${latestWeight}` : "--"}
          detail="Most recent pounds logged."
          icon={Weight}
          tone="blue"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_0.95fr]">
        <div className="space-y-4">
          {(highBP || highGlucose) && (
            <OpsPanel
              eyebrow="Alert review"
              title="Values outside target"
              description="This panel only appears when the rolling averages drift above target, so the patient sees the problem before reading the charts."
            >
              <div className="space-y-2 rounded-[24px] border border-soft-red/20 bg-soft-red/5 px-4 py-4 text-sm text-primary">
                {highBP ? <p>Average blood pressure is {avgSystolic}/{avgDiastolic} mmHg. The target is below 130/80 mmHg.</p> : null}
                {highGlucose ? <p>Average fasting glucose is {avgGlucose} mg/dL. The target is below 130 mg/dL.</p> : null}
              </div>
            </OpsPanel>
          )}

          {bpReadings.length >= 2 && (
            <OpsPanel
              eyebrow="Trend"
              title="Blood pressure"
              description="Systolic and diastolic stay on the same timeline, with the target shown directly on the chart."
              actions={<TrendBadge trend={bpTrend} goodDirection="down" />}
            >
              <SparklineChart
                data={chartData}
                lines={[
                  { key: "systolic", label: "Systolic", color: "#B91C1C" },
                  { key: "diastolic", label: "Diastolic", color: "#1D4ED8" },
                ]}
                threshold={130}
                thresholdLabel="130 target"
                unit="mmHg"
              />
            </OpsPanel>
          )}

          {glucoseReadings.length >= 2 && (
            <OpsPanel
              eyebrow="Trend"
              title="Fasting glucose"
              description="Glucose is separated from BP so the patient can read it without mixed scales or extra chart chrome."
              actions={<TrendBadge trend={glucoseTrend} goodDirection="down" />}
            >
              <SparklineChart
                data={chartData}
                lines={[{ key: "glucose", label: "Glucose", color: "#B45309" }]}
                threshold={130}
                thresholdLabel="130 target"
                unit="mg/dL"
              />
            </OpsPanel>
          )}

          <OpsPanel
            eyebrow="History"
            title="All readings"
            description="A compact review table for the selected time window."
          >
            {filteredVitals.length === 0 ? (
              <OpsEmptyState
                icon={Clock}
                title={`No readings in the last ${range}`}
                description="Expand the time range or connect a device source to build a trend line."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[640px] w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-muted">
                      <th className="px-4 py-3 font-semibold">Date & time</th>
                      <th className="px-3 py-3 text-center font-semibold">Source</th>
                      <th className="px-3 py-3 text-right font-semibold">BP</th>
                      <th className="px-3 py-3 text-right font-semibold">HR</th>
                      <th className="px-3 py-3 text-right font-semibold">Glucose</th>
                      <th className="px-3 py-3 text-right font-semibold">Weight</th>
                      <th className="px-4 py-3 text-right font-semibold">SpO₂</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVitals.map((vital) => (
                      <tr key={vital.id} className="border-b border-border/30 text-primary last:border-b-0">
                        <td className="px-4 py-3 font-medium text-primary">
                          {new Date(vital.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          <span className="ml-1.5 font-normal text-muted">
                            {new Date(vital.recorded_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <OpsBadge tone={vital.source === "clinic" ? "blue" : vital.source === "device" ? "accent" : "terra"}>
                            {vital.source}
                          </OpsBadge>
                        </td>
                        <td className={cn("px-3 py-3 text-right font-semibold", vital.systolic && vital.systolic >= 140 ? "text-soft-red" : "text-primary")}>
                          {vital.systolic && vital.diastolic ? `${vital.systolic}/${vital.diastolic}` : "—"}
                        </td>
                        <td className="px-3 py-3 text-right">{vital.heart_rate ?? "—"}</td>
                        <td className={cn("px-3 py-3 text-right font-semibold", vital.blood_glucose && vital.blood_glucose > 130 ? "text-yellow-700" : "text-primary")}>
                          {vital.blood_glucose ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-right">{vital.weight_lbs ?? "—"}</td>
                        <td className="px-4 py-3 text-right">{vital.oxygen_saturation ? `${vital.oxygen_saturation}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </OpsPanel>
        </div>

        <div className="space-y-4">
          <OpsPanel eyebrow="Signal summary" title="What changed" description="A patient-facing synopsis that explains the numbers without requiring chart literacy.">
            <div className="space-y-3 text-sm leading-6 text-secondary">
              <div className="surface-muted px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-primary">Blood pressure</p>
                    <p className="mt-1 text-xs text-muted">Average {avgSystolic ?? "--"}/{avgDiastolic ?? "--"} mmHg</p>
                  </div>
                  <TrendBadge trend={bpTrend} goodDirection="down" />
                </div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-primary">Glucose</p>
                    <p className="mt-1 text-xs text-muted">Average {avgGlucose ?? "--"} mg/dL</p>
                  </div>
                  <TrendBadge trend={glucoseTrend} goodDirection="down" />
                </div>
              </div>
              <div className="surface-muted px-4 py-3">
                <p className="text-sm font-semibold text-primary">Source mix</p>
                <p className="mt-1 text-xs text-muted">{homeCount} home · {clinicCount} clinic · {deviceCount} device readings</p>
              </div>
            </div>
          </OpsPanel>

          <OpsPanel eyebrow="Guided review" title="Explain these trends" description="Use this when the patient wants help understanding the full pattern, not just the latest reading.">
            <AIAction
              agentId="wellness"
              label="Analyze vitals"
              prompt={`Analyze my vital signs over the last ${range}. BP avg: ${avgSystolic ?? "--"}/${avgDiastolic ?? "--"} mmHg (trend: ${bpTrend}), glucose avg: ${avgGlucose ?? "--"} mg/dL (trend: ${glucoseTrend}), HR: ${latestHR ?? "--"} bpm, weight: ${latestVital?.weight_lbs ?? "--"} lbs. What's improving, what needs attention, and what are 3 specific actions I should take?`}
              context={`${filteredVitals.length} readings, ${range} window`}
            />
            <AIAction
              agentId="wellness"
              label="Full wellness analysis"
              prompt={`Analyze all my vital signs over the last ${range} in detail. BP avg ${avgSystolic ?? "--"}/${avgDiastolic ?? "--"} mmHg (trend: ${bpTrend}), glucose avg ${avgGlucose ?? "--"} mg/dL (trend: ${glucoseTrend}), HR ${latestHR ?? "--"} bpm, weight ${latestVital?.weight_lbs ?? "--"} lbs. Based on my conditions, what do these readings mean, what's improving, and what are 3 specific actions I should take this week?`}
              context={`${filteredVitals.length} readings in last ${range}`}
              variant="inline"
            />
          </OpsPanel>

          <OpsPanel eyebrow="Record freshness" title="Capture cadence" description="How current the monitored data is and whether the feed looks stale.">
            <div className="space-y-3">
              <div className="surface-muted px-4 py-3">
                <div className="text-sm font-semibold text-primary">Latest reading</div>
                <div className="mt-1 text-xs text-muted">
                  {latestVital
                    ? new Date(latestVital.recorded_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "No data yet."}
                </div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="text-sm font-semibold text-primary">Window coverage</div>
                <div className="mt-1 text-xs text-muted">{filteredVitals.length} readings across the last {rangeDays} days.</div>
              </div>
            </div>
          </OpsPanel>
        </div>
      </div>
    </div>
  )
}
