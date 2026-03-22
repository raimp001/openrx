"use client"

import { useState } from "react"
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
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import { OpsBadge, OpsEmptyState, OpsMetricCard, OpsPanel, OpsTabButton } from "@/components/ui/ops-primitives"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import { cn } from "@/lib/utils"

type TimeRange = "7d" | "14d" | "30d"

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-sand/40", className)} />
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
      <div className="inline-flex items-center gap-1 rounded-full border border-sand bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-warm-500">
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

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl border border-sand bg-white/95 px-3 py-2 text-xs shadow-soft-card backdrop-blur">
      <p className="text-cloudy">{label}</p>
      <p className="font-semibold text-warm-800">
        {payload[0].value} {unit}
      </p>
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

  const chartData = [...filteredVitals]
    .sort((left, right) => new Date(left.recorded_at).getTime() - new Date(right.recorded_at).getTime())
    .map((vital) => ({
      date: new Date(vital.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      systolic: vital.systolic || null,
      diastolic: vital.diastolic || null,
      glucose: vital.blood_glucose || null,
      hr: vital.heart_rate || null,
      weight: vital.weight_lbs || null,
    }))

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
          title="Vitals cockpit"
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
      <div className="animate-slide-up flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <OpsEmptyState
          icon={Activity}
          title="Vital history starts after record sync"
          description="Connect your health record to track blood pressure, glucose, heart rate, oxygen, and weight trends over time."
        />
        <Link href="/onboarding" className="control-button-primary">
          Get started
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        eyebrow="Preventive monitoring"
        title="Vitals cockpit"
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
          <div className="flex gap-1 rounded-2xl border border-sand bg-white/75 p-1">
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
              <div className="space-y-2 rounded-[24px] border border-soft-red/20 bg-soft-red/5 px-4 py-4 text-sm text-warm-700">
                {highBP ? <p>Average blood pressure is {avgSystolic}/{avgDiastolic} mmHg. The target is below 130/80 mmHg.</p> : null}
                {highGlucose ? <p>Average fasting glucose is {avgGlucose} mg/dL. The target is below 130 mg/dL.</p> : null}
              </div>
            </OpsPanel>
          )}

          {bpReadings.length >= 2 && (
            <OpsPanel
              eyebrow="Trend"
              title="Blood pressure"
              description="Systolic and diastolic stay on the same timeline, with the threshold shown directly on the chart."
              actions={<TrendBadge trend={bpTrend} goodDirection="down" />}
            >
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,35,31,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6C7D75" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#6C7D75" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip unit="mmHg" />} />
                  <ReferenceLine y={130} stroke="#D1495B" strokeDasharray="4 4" strokeWidth={1} />
                  <Line type="monotone" dataKey="systolic" stroke="#D1495B" strokeWidth={2.5} dot={{ r: 3, fill: "#D1495B" }} activeDot={{ r: 5 }} connectNulls />
                  <Line type="monotone" dataKey="diastolic" stroke="#1E88B6" strokeWidth={2.5} dot={{ r: 3, fill: "#1E88B6" }} activeDot={{ r: 5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-cloudy">
                <span className="inline-flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-soft-red/80" /> Systolic</span>
                <span className="inline-flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-soft-blue/80" /> Diastolic</span>
                <span>Dashed line = 130 mmHg target</span>
              </div>
            </OpsPanel>
          )}

          {glucoseReadings.length >= 2 && (
            <OpsPanel
              eyebrow="Trend"
              title="Fasting glucose"
              description="The glucose trend is separated from BP so the patient can read it without mixed scales."
              actions={<TrendBadge trend={glucoseTrend} goodDirection="down" />}
            >
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,35,31,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6C7D75" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#6C7D75" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip unit="mg/dL" />} />
                  <ReferenceLine y={130} stroke="#D97706" strokeDasharray="4 4" strokeWidth={1} />
                  <Line type="monotone" dataKey="glucose" stroke="#D97706" strokeWidth={2.5} dot={{ r: 3, fill: "#D97706" }} activeDot={{ r: 5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
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
                    <tr className="border-b border-sand/60 text-left text-cloudy">
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
                      <tr key={vital.id} className="border-b border-sand/30 text-warm-700 last:border-b-0">
                        <td className="px-4 py-3 font-medium text-warm-800">
                          {new Date(vital.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          <span className="ml-1.5 font-normal text-cloudy">
                            {new Date(vital.recorded_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <OpsBadge tone={vital.source === "clinic" ? "blue" : vital.source === "device" ? "accent" : "terra"}>
                            {vital.source}
                          </OpsBadge>
                        </td>
                        <td className={cn("px-3 py-3 text-right font-semibold", vital.systolic && vital.systolic >= 140 ? "text-soft-red" : "text-warm-800")}>
                          {vital.systolic && vital.diastolic ? `${vital.systolic}/${vital.diastolic}` : "—"}
                        </td>
                        <td className="px-3 py-3 text-right">{vital.heart_rate ?? "—"}</td>
                        <td className={cn("px-3 py-3 text-right font-semibold", vital.blood_glucose && vital.blood_glucose > 130 ? "text-yellow-700" : "text-warm-800")}>
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
          <OpsPanel eyebrow="Signal summary" title="What changed" description="A patient-facing synopsis that explains the numbers without needing chart literacy.">
            <div className="space-y-3 text-sm leading-6 text-warm-600">
              <div className="surface-muted px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-warm-800">Blood pressure</p>
                    <p className="mt-1 text-xs text-cloudy">Average {avgSystolic ?? "--"}/{avgDiastolic ?? "--"} mmHg</p>
                  </div>
                  <TrendBadge trend={bpTrend} goodDirection="down" />
                </div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-warm-800">Glucose</p>
                    <p className="mt-1 text-xs text-cloudy">Average {avgGlucose ?? "--"} mg/dL</p>
                  </div>
                  <TrendBadge trend={glucoseTrend} goodDirection="down" />
                </div>
              </div>
              <div className="surface-muted px-4 py-3">
                <p className="text-sm font-semibold text-warm-800">Source mix</p>
                <p className="mt-1 text-xs text-cloudy">{homeCount} home · {clinicCount} clinic · {deviceCount} device readings</p>
              </div>
            </div>
          </OpsPanel>

          <OpsPanel eyebrow="Ivy assist" title="Guided interpretation" description="Use Ivy when the patient wants help understanding the full pattern, not just the latest reading.">
            <AIAction
              agentId="wellness"
              label="Ivy: analyze vitals"
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
                <div className="text-sm font-semibold text-warm-800">Latest reading</div>
                <div className="mt-1 text-xs text-cloudy">
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
                <div className="text-sm font-semibold text-warm-800">Window coverage</div>
                <div className="mt-1 text-xs text-cloudy">{filteredVitals.length} readings across the last {rangeDays} days.</div>
              </div>
            </div>
          </OpsPanel>
        </div>
      </div>
    </div>
  )
}
