"use client"

import { cn } from "@/lib/utils"
import {
  Activity, Heart, Weight, Droplets,
  TrendingDown, TrendingUp, Minus, Clock,
  AlertTriangle,
} from "lucide-react"
import { useState } from "react"
import { useLiveSnapshot } from "@/lib/hooks/use-live-snapshot"
import AIAction from "@/components/ai-action"
import { AppPageHeader } from "@/components/layout/app-page"
import Link from "next/link"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts"

type TimeRange = "7d" | "14d" | "30d"

// ── Skeleton ────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-sand/40", className)} />
}

// ── Trend badge ─────────────────────────────────────────────
function TrendBadge({ t, goodDirection }: { t: "up" | "down" | "stable"; goodDirection: "down" | "up" }) {
  if (t === "stable") return (
    <div className="flex items-center gap-0.5 text-warm-400">
      <Minus size={11} />
      <span className="text-[9px] font-semibold">stable</span>
    </div>
  )
  const isGood = t === goodDirection
  return (
    <div className={cn("flex items-center gap-0.5", isGood ? "text-accent" : "text-soft-red")}>
      {t === "up" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      <span className="text-[9px] font-bold">{isGood ? "improving" : "worsening"}</span>
    </div>
  )
}

// ── Custom chart tooltip ─────────────────────────────────────
function ChartTooltip({ active, payload, label, unit }: {
  active?: boolean; payload?: { value: number }[]; label?: string; unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white/95 backdrop-blur border border-sand rounded-xl shadow-soft-card px-3 py-2 text-xs">
      <p className="text-cloudy mb-0.5">{label}</p>
      <p className="font-bold text-warm-800">{payload[0].value} {unit}</p>
    </div>
  )
}

export default function VitalsPage() {
  const { snapshot, loading } = useLiveSnapshot()
  const vitals = snapshot.vitals
  const hasData = !!snapshot.patient
  const [range, setRange] = useState<TimeRange>("14d")

  const rangeDays = range === "7d" ? 7 : range === "14d" ? 14 : 30
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - rangeDays)
  const filteredVitals = vitals.filter((v) => new Date(v.recorded_at) >= cutoff)

  const bpReadings = filteredVitals.filter((v) => v.systolic && v.diastolic)
  const glucoseReadings = filteredVitals.filter((v) => v.blood_glucose)
  const weightReadings = filteredVitals.filter((v) => v.weight_lbs)

  const avgSystolic = bpReadings.length
    ? Math.round(bpReadings.reduce((s, v) => s + (v.systolic || 0), 0) / bpReadings.length)
    : null
  const avgDiastolic = bpReadings.length
    ? Math.round(bpReadings.reduce((s, v) => s + (v.diastolic || 0), 0) / bpReadings.length)
    : null
  const avgGlucose = glucoseReadings.length
    ? Math.round(glucoseReadings.reduce((s, v) => s + (v.blood_glucose || 0), 0) / glucoseReadings.length)
    : null
  const latestWeight = weightReadings.length ? weightReadings[0].weight_lbs : null
  const latestHR = filteredVitals.find((v) => v.heart_rate)?.heart_rate || null
  const latestVital = filteredVitals[0] || null

  function trend(values: number[]): "up" | "down" | "stable" {
    if (values.length < 2) return "stable"
    const half = Math.ceil(values.length / 2)
    const recent = values.slice(0, half)
    const older = values.slice(half)
    const diff = (recent.reduce((a, b) => a + b, 0) / recent.length) - (older.reduce((a, b) => a + b, 0) / older.length)
    if (Math.abs(diff) < 3) return "stable"
    return diff > 0 ? "up" : "down"
  }

  const bpTrend = trend(bpReadings.map((v) => v.systolic || 0))
  const glucoseTrend = trend(glucoseReadings.map((v) => v.blood_glucose || 0))

  // Chart data — chronological
  const chartData = [...filteredVitals]
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map((v) => ({
      date: new Date(v.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      systolic: v.systolic || null,
      diastolic: v.diastolic || null,
      glucose: v.blood_glucose || null,
      hr: v.heart_rate || null,
      weight: v.weight_lbs || null,
    }))

  if (loading) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <div key={i} className="surface-card p-4"><Skeleton className="h-20 w-full" /></div>)}
        </div>
        <div className="surface-card p-5"><Skeleton className="h-48 w-full" /></div>
      </div>
    )
  }

  if (!loading && !hasData) {
    return (
      <div className="animate-slide-up flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-accent/8 flex items-center justify-center">
          <Activity size={28} className="text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-serif text-warm-800">Vital Signs</h1>
          <p className="text-warm-500 mt-1 max-w-sm">Connect your health record to track blood pressure, glucose, heart rate, and more over time.</p>
        </div>
        <Link href="/onboarding" className="px-5 py-2.5 bg-terra text-white text-sm font-semibold rounded-xl hover:bg-terra-dark transition">
          Get Started
        </Link>
      </div>
    )
  }

  // Alert conditions
  const highBP = avgSystolic && avgSystolic >= 140
  const highGlucose = avgGlucose && avgGlucose > 130

  return (
    <div className="animate-slide-up space-y-6">
      <AppPageHeader
        title="Vital Signs"
        description={`${filteredVitals.length} readings in the last ${range}`}
        className="surface-card p-4 sm:p-5"
        actions={
          <>
            <AIAction
              agentId="wellness"
              label="Ivy: Analyze Vitals"
              prompt={`Analyze my vital signs over the last ${range}. BP avg: ${avgSystolic ?? "--"}/${avgDiastolic ?? "--"} mmHg (trend: ${bpTrend}), glucose avg: ${avgGlucose ?? "--"} mg/dL (trend: ${glucoseTrend}), HR: ${latestHR ?? "--"} bpm, weight: ${latestVital?.weight_lbs ?? "--"} lbs. What's improving, what needs attention, and what are 3 specific actions I should take?`}
              context={`${filteredVitals.length} readings, ${range} window`}
            />
            <div className="flex gap-0.5 rounded-xl border border-sand bg-white p-1">
              {(["7d", "14d", "30d"] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    range === r ? "bg-terra text-white" : "text-warm-500 hover:text-warm-700"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </>
        }
      />

      {/* Alerts */}
      {(highBP || highGlucose) && (
        <div className="rounded-2xl border border-soft-red/20 bg-soft-red/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-soft-red" />
            <span className="text-xs font-bold text-soft-red">Values Outside Target Range</span>
          </div>
          <div className="space-y-1 text-xs text-warm-600">
            {highBP && <p>Average blood pressure {avgSystolic}/{avgDiastolic} mmHg — target is below 130/80 mmHg</p>}
            {highGlucose && <p>Average fasting glucose {avgGlucose} mg/dL — target is below 130 mg/dL</p>}
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* BP */}
        <div className={cn("surface-card p-4", highBP && "border-soft-red/20")}>
          <div className="flex items-center justify-between mb-2">
            <Heart size={15} className={highBP ? "text-soft-red" : "text-soft-red/70"} />
            <TrendBadge t={bpTrend} goodDirection="down" />
          </div>
          <div className={cn("text-xl font-bold leading-none", highBP ? "text-soft-red" : "text-warm-800")}>
            {avgSystolic ?? "--"}<span className="text-sm font-normal text-warm-500">/{avgDiastolic ?? "--"}</span>
          </div>
          <div className="text-[10px] text-warm-500 mt-1">Avg Blood Pressure</div>
          <div className="text-[9px] text-cloudy">mmHg · Target &lt;130/80</div>
        </div>

        {/* Glucose */}
        <div className={cn("surface-card p-4", highGlucose && "border-yellow-300/40")}>
          <div className="flex items-center justify-between mb-2">
            <Droplets size={15} className="text-yellow-600" />
            <TrendBadge t={glucoseTrend} goodDirection="down" />
          </div>
          <div className={cn("text-xl font-bold leading-none", highGlucose ? "text-yellow-600" : "text-warm-800")}>
            {avgGlucose ?? "--"}
          </div>
          <div className="text-[10px] text-warm-500 mt-1">Avg Fasting Glucose</div>
          <div className="text-[9px] text-cloudy">mg/dL · Target &lt;130</div>
        </div>

        {/* HR */}
        <div className="surface-card p-4">
          <Activity size={15} className="text-accent mb-2" />
          <div className="text-xl font-bold text-warm-800 leading-none">{latestHR ?? "--"}</div>
          <div className="text-[10px] text-warm-500 mt-1">Heart Rate</div>
          <div className="text-[9px] text-cloudy">bpm · Normal 60–100</div>
        </div>

        {/* Weight */}
        <div className="surface-card p-4">
          <Weight size={15} className="text-soft-blue mb-2" />
          <div className="text-xl font-bold text-warm-800 leading-none">{latestWeight ?? "--"}</div>
          <div className="text-[10px] text-warm-500 mt-1">Weight</div>
          <div className="text-[9px] text-cloudy">lbs · Last recorded</div>
        </div>

        {/* Readings count */}
        <div className="surface-card p-4">
          <Clock size={15} className="text-terra mb-2" />
          <div className="text-xl font-bold text-warm-800 leading-none">{filteredVitals.length}</div>
          <div className="text-[10px] text-warm-500 mt-1">Readings ({range})</div>
          <div className="text-[9px] text-cloudy">
            {filteredVitals.filter((v) => v.source === "home").length} home ·{" "}
            {filteredVitals.filter((v) => v.source === "clinic").length} clinic
          </div>
        </div>
      </div>

      {filteredVitals.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center py-20 text-center gap-3">
          <Activity size={32} className="text-cloudy" />
          <p className="text-sm font-semibold text-warm-600">No readings in the last {range}</p>
          <p className="text-xs text-cloudy">Try expanding the time range or adding new vitals.</p>
        </div>
      ) : (
        <>
          {/* Blood Pressure Chart */}
          {bpReadings.length >= 2 && (
            <div className="surface-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Heart size={14} className="text-soft-red" />
                  <h2 className="text-sm font-bold text-warm-800">Blood Pressure Trend</h2>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-cloudy">
                  <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-full bg-soft-red/70 inline-block" /> Systolic</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-full bg-soft-blue/60 inline-block" /> Diastolic</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,35,31,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6C7D75" }} tickLine={false} axisLine={false} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#6C7D75" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip unit="mmHg" />} />
                  <ReferenceLine y={130} stroke="#D1495B" strokeDasharray="4 4" strokeWidth={1} />
                  <Line type="monotone" dataKey="systolic" stroke="#D1495B" strokeWidth={2} dot={{ r: 3, fill: "#D1495B" }} activeDot={{ r: 5 }} connectNulls />
                  <Line type="monotone" dataKey="diastolic" stroke="#1E88B6" strokeWidth={2} dot={{ r: 3, fill: "#1E88B6" }} activeDot={{ r: 5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-[9px] text-cloudy mt-2 text-center">Dashed line = 130 mmHg target threshold</p>
            </div>
          )}

          {/* Glucose Chart */}
          {glucoseReadings.length >= 2 && (
            <div className="surface-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Droplets size={14} className="text-yellow-600" />
                <h2 className="text-sm font-bold text-warm-800">Fasting Glucose Trend</h2>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,35,31,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6C7D75" }} tickLine={false} axisLine={false} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#6C7D75" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip unit="mg/dL" />} />
                  <ReferenceLine y={130} stroke="#D97706" strokeDasharray="4 4" strokeWidth={1} />
                  <Line type="monotone" dataKey="glucose" stroke="#D97706" strokeWidth={2} dot={{ r: 3, fill: "#D97706" }} activeDot={{ r: 5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Readings table */}
          <div className="surface-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sand/60">
              <h2 className="text-sm font-bold text-warm-800">All Readings</h2>
              <span className="text-[10px] text-warm-500">{filteredVitals.length} readings</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[540px]">
                <thead>
                  <tr className="bg-cream/50">
                    <th className="text-left px-5 py-2.5 font-semibold text-warm-500">Date & Time</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-warm-500">Source</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-warm-500">BP</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-warm-500">HR</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-warm-500">Glucose</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-warm-500">Weight</th>
                    <th className="text-right px-5 py-2.5 font-semibold text-warm-500">SpO₂</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVitals.map((v) => (
                    <tr key={v.id} className="border-t border-sand/40 hover:bg-cream/30 transition">
                      <td className="px-5 py-3 text-warm-800 font-medium">
                        {new Date(v.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        <span className="text-cloudy ml-1.5 font-normal">
                          {new Date(v.recorded_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </td>
                      <td className="text-center px-3 py-3">
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase",
                          v.source === "clinic" ? "bg-soft-blue/10 text-soft-blue" :
                          v.source === "device" ? "bg-accent/10 text-accent" :
                          "bg-sand/50 text-warm-600"
                        )}>
                          {v.source}
                        </span>
                      </td>
                      <td className={cn(
                        "text-right px-3 py-3 font-semibold",
                        v.systolic && v.systolic >= 140 ? "text-soft-red" : "text-warm-800"
                      )}>
                        {v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : "—"}
                      </td>
                      <td className="text-right px-3 py-3 text-warm-700">{v.heart_rate ?? "—"}</td>
                      <td className={cn(
                        "text-right px-3 py-3 font-semibold",
                        v.blood_glucose && v.blood_glucose > 130 ? "text-yellow-600" : "text-warm-800"
                      )}>
                        {v.blood_glucose ?? "—"}
                      </td>
                      <td className="text-right px-3 py-3 text-warm-700">{v.weight_lbs ?? "—"}</td>
                      <td className="text-right px-5 py-3 text-warm-700">
                        {v.oxygen_saturation ? `${v.oxygen_saturation}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* AI Analysis */}
      <AIAction
        agentId="wellness"
        label="Full Wellness Analysis from Ivy"
        prompt={`Analyze all my vital signs over the last ${range} in detail. BP avg ${avgSystolic ?? "--"}/${avgDiastolic ?? "--"} mmHg (trend: ${bpTrend}), glucose avg ${avgGlucose ?? "--"} mg/dL (trend: ${glucoseTrend}), HR ${latestHR ?? "--"} bpm, weight ${latestVital?.weight_lbs ?? "--"} lbs. Based on my conditions, what do these readings mean, what's improving, and what are 3 specific actions I should take this week?`}
        context={`${filteredVitals.length} readings in last ${range}`}
        variant="inline"
        className="bg-terra/5 rounded-2xl border border-terra/10 p-4"
      />
    </div>
  )
}
