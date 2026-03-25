"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"

const data = [
  { month: "Sep", billed: 14200, collected: 11800 },
  { month: "Oct", billed: 18500, collected: 15200 },
  { month: "Nov", billed: 16800, collected: 13400 },
  { month: "Dec", billed: 21300, collected: 17900 },
  { month: "Jan", billed: 19500, collected: 16100 },
  { month: "Feb", billed: 19475, collected: 9115 },
]

export default function RevenueChart() {
  return (
    <div className="bg-surface rounded-2xl border border-border p-5">
      <h3 className="text-sm font-bold text-primary mb-4">
        Revenue (6-Month)
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" minHeight={180}>
          <BarChart data={data} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#162040" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "#5A6B84" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#5A6B84" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                background: "#0C1628",
                border: "1px solid #162040",
                color: "#E2E7EF",
                borderRadius: 12,
                fontSize: 11,
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              }}
              formatter={(value) =>
                `$${Number(value).toLocaleString()}`
              }
            />
            <Bar
              dataKey="billed"
              name="Billed"
              fill="#162040"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="collected"
              name="Collected"
              fill="#C5A04E"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-3 justify-center">
        <span className="flex items-center gap-1.5 text-[10px] text-muted">
          <span className="w-2.5 h-2.5 rounded-sm bg-border" /> Billed
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted">
          <span className="w-2.5 h-2.5 rounded-sm bg-teal" /> Collected
        </span>
      </div>
    </div>
  )
}
