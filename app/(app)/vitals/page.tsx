"use client"

import { currentUser } from "@/lib/current-user"
import { getPatientVitals } from "@/lib/seed-data"
import { cn } from "@/lib/utils"
import {
  Activity, Heart, Thermometer, Weight, Droplets,
  Wind, TrendingDown, TrendingUp, Minus, Clock,
} from "lucide-react"
import { useState } from "react"
import AIAction from "@/components/ai-action"

type TimeRange = "7d" | "14d" | "30d"

export default function VitalsPage() {
  const vitals = getPatientVitals(currentUser.id)
  const [range, setRange] = useState<TimeRange>("14d")

  const rangeDays = range === "7d" ? 7 : range === "14d" ? 14 : 30
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - rangeDays)
  const filteredVitals = vitals.filter((v) => new Date(v.recorded_at) >= cutoff)

  // Calculate averages
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

  function trend(values: number[]): "up" | "down" | "stable" {
    if (values.length < 2) return "stable"
    const recent = values.slice(0, Math.ceil(values.length / 2))
    const older = values.slice(Math.ceil(values.length / 2))
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length
    const diff = avgRecent - avgOlder
    if (Math.abs(diff) < 3) return "stable"
    return diff > 0 ? "up" : "down"
  }

  const bpTrend = trend(bpReadings.map((v) => v.systolic || 0))
  const glucoseTrend = trend(glucoseReadings.map((v) => v.blood_glucose || 0))

  const TrendIcon = ({ t, goodDirection }: { t: "up" | "down" | "stable"; goodDirection: "down" | "up" }) => {
    if (t === "stable") return <Minus size={12} className="text-warm-400" />
    const isGood = t === goodDirection
    return t === "up"
      ? <TrendingUp size={12} className={isGood ? "text-accent" : "text-soft-red"} />
      : <TrendingDown size={12} className={isGood ? "text-accent" : "text-soft-red"} />
  }

  // Simple sparkline using CSS bars
  function Sparkline({ values, maxVal, color }: { values: number[]; maxVal: number; color: string }) {
    const display = values.slice(0, 14).reverse()
    return (
      <div className="flex items-end gap-0.5 h-8" role="img" aria-label="Trend chart">
        {display.map((val, i) => (
          <div
            key={i}
            className={cn("w-2 rounded-t-sm", color)}
            style={{ height: `${Math.max(10, (val / maxVal) * 100)}%` }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-warm-800">Vital Signs</h1>
          <p className="text-sm text-warm-500 mt-1">Track your health metrics over time.</p>
        </div>
        <div className="flex gap-1 bg-pampas rounded-lg border border-sand p-1">
          {(["7d", "14d", "30d"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition",
                range === r ? "bg-terra text-white" : "text-warm-500 hover:text-warm-700"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Blood Pressure */}
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <div className="flex items-center justify-between mb-2">
            <Heart size={16} className="text-soft-red" />
            <TrendIcon t={bpTrend} goodDirection="down" />
          </div>
          <div className="text-lg font-bold text-warm-800">
            {avgSystolic ?? "--"}/{avgDiastolic ?? "--"}
          </div>
          <div className="text-[10px] text-warm-500">Avg Blood Pressure</div>
          <div className="text-[9px] text-cloudy mt-1">mmHg &middot; Target &lt;130/80</div>
          {bpReadings.length > 2 && (
            <div className="mt-2">
              <Sparkline
                values={bpReadings.map((v) => v.systolic || 0)}
                maxVal={180}
                color="bg-soft-red/60"
              />
            </div>
          )}
        </div>

        {/* Blood Glucose */}
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <div className="flex items-center justify-between mb-2">
            <Droplets size={16} className="text-yellow-600" />
            <TrendIcon t={glucoseTrend} goodDirection="down" />
          </div>
          <div className="text-lg font-bold text-warm-800">{avgGlucose ?? "--"}</div>
          <div className="text-[10px] text-warm-500">Avg Fasting Glucose</div>
          <div className="text-[9px] text-cloudy mt-1">mg/dL &middot; Target &lt;130</div>
          {glucoseReadings.length > 2 && (
            <div className="mt-2">
              <Sparkline
                values={glucoseReadings.map((v) => v.blood_glucose || 0)}
                maxVal={200}
                color="bg-yellow-400/60"
              />
            </div>
          )}
        </div>

        {/* Heart Rate */}
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <Activity size={16} className="text-accent mb-2" />
          <div className="text-lg font-bold text-warm-800">{latestHR ?? "--"}</div>
          <div className="text-[10px] text-warm-500">Heart Rate</div>
          <div className="text-[9px] text-cloudy mt-1">bpm &middot; Normal 60-100</div>
        </div>

        {/* Weight */}
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <Weight size={16} className="text-soft-blue mb-2" />
          <div className="text-lg font-bold text-warm-800">{latestWeight ?? "--"}</div>
          <div className="text-[10px] text-warm-500">Weight</div>
          <div className="text-[9px] text-cloudy mt-1">lbs &middot; Last clinic visit</div>
        </div>

        {/* Readings Count */}
        <div className="bg-pampas rounded-2xl p-4 border border-sand">
          <Clock size={16} className="text-terra mb-2" />
          <div className="text-lg font-bold text-warm-800">{filteredVitals.length}</div>
          <div className="text-[10px] text-warm-500">Readings ({range})</div>
          <div className="text-[9px] text-cloudy mt-1">
            {filteredVitals.filter((v) => v.source === "home").length} home &middot;{" "}
            {filteredVitals.filter((v) => v.source === "clinic").length} clinic
          </div>
        </div>
      </div>

      {/* Readings Table */}
      <div className="bg-pampas rounded-2xl border border-sand overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-sand">
          <h2 className="text-sm font-bold text-warm-800">Recent Readings</h2>
          <span className="text-[10px] text-warm-500">{filteredVitals.length} readings</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" role="table">
            <thead>
              <tr className="bg-cream/50 text-warm-500">
                <th className="text-left px-4 py-2 font-semibold">Date</th>
                <th className="text-center px-3 py-2 font-semibold">Source</th>
                <th className="text-right px-3 py-2 font-semibold">BP</th>
                <th className="text-right px-3 py-2 font-semibold">HR</th>
                <th className="text-right px-3 py-2 font-semibold">Glucose</th>
                <th className="text-right px-3 py-2 font-semibold">Weight</th>
                <th className="text-right px-3 py-2 font-semibold">SpO2</th>
                <th className="text-right px-3 py-2 font-semibold">Temp</th>
              </tr>
            </thead>
            <tbody>
              {filteredVitals.map((v) => (
                <tr key={v.id} className="border-t border-sand/50 hover:bg-cream/30 transition">
                  <td className="px-4 py-2.5 text-warm-800 font-medium">
                    {new Date(v.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    <span className="text-cloudy ml-1">
                      {new Date(v.recorded_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </td>
                  <td className="text-center px-3 py-2.5">
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded",
                      v.source === "clinic" ? "bg-soft-blue/10 text-soft-blue" :
                      v.source === "device" ? "bg-accent/10 text-accent" :
                      "bg-warm-100 text-warm-600"
                    )}>
                      {v.source}
                    </span>
                  </td>
                  <td className={cn(
                    "text-right px-3 py-2.5 font-medium",
                    v.systolic && v.systolic >= 140 ? "text-soft-red" : "text-warm-800"
                  )}>
                    {v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : "—"}
                  </td>
                  <td className="text-right px-3 py-2.5 text-warm-800">{v.heart_rate ?? "—"}</td>
                  <td className={cn(
                    "text-right px-3 py-2.5 font-medium",
                    v.blood_glucose && v.blood_glucose > 130 ? "text-yellow-600" : "text-warm-800"
                  )}>
                    {v.blood_glucose ?? "—"}
                  </td>
                  <td className="text-right px-3 py-2.5 text-warm-800">{v.weight_lbs ?? "—"}</td>
                  <td className="text-right px-3 py-2.5 text-warm-800">
                    {v.oxygen_saturation ? `${v.oxygen_saturation}%` : "—"}
                  </td>
                  <td className="text-right px-3 py-2.5 text-warm-800">
                    {v.temperature_f ? `${v.temperature_f}\u00b0F` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Insight */}
      <AIAction
        agentId="wellness"
        label="Ivy's Wellness Analysis"
        prompt="Analyze my vital signs and provide personalized health insights. Include trends, targets for my conditions, and specific recommendations."
        context={`BP avg: ${avgSystolic}/${avgDiastolic} mmHg | Glucose trend: ${glucoseTrend} | Latest weight: ${latestWeight ?? "N/A"} lbs | Data range: ${range}`}
        variant="inline"
        className="bg-terra/5 rounded-2xl border border-terra/10 p-4"
      />
    </div>
  )
}
