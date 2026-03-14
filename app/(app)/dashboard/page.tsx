"use client"

import {
  Calendar, Receipt, Pill, MessageSquare, AlertTriangle,
  ArrowRight, Bot, Send, CheckCircle2, Heart,
  FlaskConical, Activity, Syringe, ArrowRightCircle,
  AlertCircle, Clock, TrendingUp, TrendingDown, Minus,
  Zap, ShieldCheck, RefreshCw,
} from "lucide-react"
import Link from "next/link"
import { getPhysician, priorAuths, getPatientLabResults, getPatientVitals, getPatientVaccinations, getPatientReferrals } from "@/lib/seed-data"
import { currentUser, getMyAppointments, getMyClaims, getMyPrescriptions, getMyMessages } from "@/lib/current-user"
import { cn, formatCurrency, formatTime, formatDate, getStatusColor } from "@/lib/utils"

export default function DashboardPage() {
  const myApts = getMyAppointments().sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  )
  const upcomingApts = myApts.filter(
    (a) => new Date(a.scheduled_at) >= new Date() && a.status !== "completed" && a.status !== "no-show"
  )
  const myRx = getMyPrescriptions().filter((p) => p.status === "active")
  const myClaims = getMyClaims()
  const myMessages = getMyMessages()
  const unreadCount = myMessages.filter((m) => !m.read).length
  const lowAdherenceRx = myRx.filter((p) => p.adherence_pct < 80)
  const myPA = priorAuths.filter((p) => p.patient_id === currentUser.id)
  const pendingPA = myPA.filter((p) => p.status === "pending" || p.status === "submitted")
  const owedAmount = myClaims
    .filter((c) => ["paid", "submitted", "processing", "appealed"].includes(c.status))
    .reduce((sum, c) => sum + c.patient_responsibility, 0)

  // New healthcare data
  const myLabs = getPatientLabResults(currentUser.id)
  const pendingLabs = myLabs.filter((l) => l.status === "pending")
  const abnormalLabCount = myLabs
    .filter((l) => l.status !== "pending")
    .reduce((count, lab) => count + lab.results.filter((r) => r.flag !== "normal").length, 0)
  const myVitals = getPatientVitals(currentUser.id)
  const latestVital = myVitals[0]
  const myVaccinations = getPatientVaccinations(currentUser.id)
  const dueVaccines = myVaccinations.filter((v) => v.status === "due" || v.status === "overdue")
  const myReferrals = getPatientReferrals(currentUser.id)
  const pendingReferrals = myReferrals.filter((r) => r.status === "pending" || r.status === "scheduled")

  // Health engagement score (0-100) based on adherence, lab alerts, pending items
  const avgAdherence = myRx.length > 0
    ? Math.round(myRx.reduce((s, rx) => s + rx.adherence_pct, 0) / myRx.length)
    : 100
  const deductions = (abnormalLabCount * 5) + (dueVaccines.filter(v => v.status === "overdue").length * 8) + (lowAdherenceRx.length * 10)
  const healthScore = Math.max(0, Math.min(100, avgAdherence - deductions))
  const healthScoreLabel = healthScore >= 80 ? "Good" : healthScore >= 60 ? "Fair" : "Needs Attention"
  const healthScoreColor = healthScore >= 80 ? "text-accent" : healthScore >= 60 ? "text-yellow-600" : "text-soft-red"
  const healthScoreBg = healthScore >= 80 ? "bg-accent" : healthScore >= 60 ? "bg-yellow-400" : "bg-soft-red"

  return (
    <div className="animate-slide-up space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-serif text-warm-800">
          Good{" "}
          {new Date().getHours() < 12
            ? "morning"
            : new Date().getHours() < 17
            ? "afternoon"
            : "evening"}
          , {currentUser.full_name.split(" ")[0]}
        </h1>
        <p className="text-sm text-warm-500 mt-1">
          Here&apos;s what&apos;s happening with your health.
        </p>
      </div>

      {/* Proactive AI Nudges */}
      {(() => {
        const nudges: { icon: typeof Zap; color: string; bg: string; text: string; href: string; agent: string }[] = []
        if (lowAdherenceRx.length > 0)
          nudges.push({ icon: Pill, color: "text-soft-red", bg: "bg-soft-red/10", text: `Log today's ${lowAdherenceRx[0].medication_name} dose — adherence is at ${lowAdherenceRx[0].adherence_pct}%`, href: "/prescriptions", agent: "Maya" })
        if (pendingPA.length > 0)
          nudges.push({ icon: ShieldCheck, color: "text-yellow-400", bg: "bg-yellow-900/20", text: `${pendingPA[0].procedure_name} prior auth is ${pendingPA[0].status} — Rex can check the status`, href: "/prior-auth", agent: "Rex" })
        if (dueVaccines.length > 0)
          nudges.push({ icon: Syringe, color: "text-terra", bg: "bg-terra/10", text: `${dueVaccines[0].vaccine_name} is due — Ivy can help you schedule it`, href: "/vaccinations", agent: "Ivy" })
        if (myRx.some((r) => r.refills_remaining <= 2))
          nudges.push({ icon: RefreshCw, color: "text-accent", bg: "bg-accent/10", text: `${myRx.find((r) => r.refills_remaining <= 2)?.medication_name} needs a refill soon`, href: "/prescriptions", agent: "Maya" })
        if (nudges.length === 0) return null
        return (
          <div className="bg-pampas rounded-2xl border border-terra/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-terra" />
              <span className="text-xs font-bold text-warm-800">Your care team flagged {nudges.length} action{nudges.length !== 1 ? "s" : ""} for today</span>
            </div>
            <div className="space-y-2">
              {nudges.map((n, i) => (
                <Link key={i} href={n.href} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-cream/50 transition group">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${n.bg}`}>
                    <n.icon size={13} className={n.color} />
                  </div>
                  <p className="text-xs text-warm-700 flex-1 leading-snug">{n.text}</p>
                  <span className="text-[9px] font-bold text-terra bg-terra/10 px-1.5 py-0.5 rounded shrink-0">{n.agent}</span>
                  <ArrowRight size={12} className="text-cloudy group-hover:text-terra transition shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link
          href="/scheduling"
          className="bg-pampas rounded-2xl p-4 border border-sand hover:border-terra/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-terra/5 transition-all"
        >
          <Calendar size={20} className="text-terra mb-2" />
          <div className="text-lg font-bold text-warm-800">{upcomingApts.length}</div>
          <div className="text-xs text-warm-500">Upcoming Visits</div>
        </Link>
        <Link
          href="/prescriptions"
          className="bg-pampas rounded-2xl p-4 border border-sand hover:border-terra/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-terra/5 transition-all"
        >
          <Pill size={20} className="text-accent mb-2" />
          <div className="text-lg font-bold text-warm-800">{myRx.length}</div>
          <div className="text-xs text-warm-500">Active Medications</div>
        </Link>
        <Link
          href="/lab-results"
          className="bg-pampas rounded-2xl p-4 border border-sand hover:border-terra/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-terra/5 transition-all"
        >
          <FlaskConical size={20} className="text-soft-blue mb-2" />
          <div className="text-lg font-bold text-warm-800">{myLabs.length}</div>
          <div className="text-xs text-warm-500">
            Lab Tests{pendingLabs.length > 0 ? ` (${pendingLabs.length} pending)` : ""}
          </div>
        </Link>
        <Link
          href="/messages"
          className="bg-pampas rounded-2xl p-4 border border-sand hover:border-terra/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-terra/5 transition-all"
        >
          <MessageSquare size={20} className="text-yellow-600 mb-2" />
          <div className="text-lg font-bold text-warm-800">{unreadCount}</div>
          <div className="text-xs text-warm-500">Unread Messages</div>
        </Link>
      </div>

      {/* Health Engagement Score */}
      <div className="bg-pampas rounded-2xl border border-sand p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-terra" />
            <span className="text-xs font-bold text-warm-800">Health Engagement Score</span>
          </div>
          <span className={cn("text-xs font-bold", healthScoreColor)}>{healthScoreLabel}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full h-2 bg-sand/40 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", healthScoreBg)}
                style={{ width: `${healthScore}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-cloudy">Based on adherence, labs & vaccines</span>
              <span className={cn("text-sm font-bold", healthScoreColor)}>{healthScore}/100</span>
            </div>
          </div>
          <div className="flex gap-3 shrink-0 text-center">
            <div>
              <p className={cn("text-base font-bold", avgAdherence >= 80 ? "text-accent" : "text-soft-red")}>{avgAdherence}%</p>
              <p className="text-[9px] text-cloudy">Adherence</p>
            </div>
            {myVaccinations.length > 0 && (
              <div>
                <p className={cn("text-base font-bold", dueVaccines.length === 0 ? "text-accent" : "text-yellow-600")}>
                  {myVaccinations.length - dueVaccines.length}/{myVaccinations.length}
                </p>
                <p className="text-[9px] text-cloudy">Vaccines</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Urgent Alerts Row */}
      {(abnormalLabCount > 0 || dueVaccines.length > 0 || pendingReferrals.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {abnormalLabCount > 0 && (
            <Link href="/lab-results" className="bg-soft-red/5 rounded-2xl border border-soft-red/10 p-4 hover:border-soft-red/20 transition">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-soft-red" />
                <span className="text-xs font-bold text-soft-red">Lab Alert</span>
              </div>
              <p className="text-xs text-warm-600">{abnormalLabCount} abnormal lab value{abnormalLabCount !== 1 ? "s" : ""} found</p>
            </Link>
          )}
          {dueVaccines.length > 0 && (
            <Link href="/vaccinations" className="bg-yellow-50 rounded-2xl border border-yellow-200/50 p-4 hover:border-yellow-300/50 transition">
              <div className="flex items-center gap-2 mb-1">
                <Syringe size={14} className="text-yellow-600" />
                <span className="text-xs font-bold text-yellow-700">Vaccines Due</span>
              </div>
              <p className="text-xs text-warm-600">{dueVaccines.map((v) => v.vaccine_name).join(", ")}</p>
            </Link>
          )}
          {pendingReferrals.length > 0 && (
            <Link href="/referrals" className="bg-soft-blue/5 rounded-2xl border border-soft-blue/10 p-4 hover:border-soft-blue/20 transition">
              <div className="flex items-center gap-2 mb-1">
                <ArrowRightCircle size={14} className="text-soft-blue" />
                <span className="text-xs font-bold text-soft-blue">Referrals</span>
              </div>
              <p className="text-xs text-warm-600">{pendingReferrals.length} specialist visit{pendingReferrals.length !== 1 ? "s" : ""} to schedule or attend</p>
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Upcoming Appointments */}
        <div className="lg:col-span-2 bg-pampas rounded-2xl border border-sand">
          <div className="flex items-center justify-between p-5 border-b border-sand">
            <h2 className="text-base font-serif text-warm-800">My Upcoming Visits</h2>
            <Link
              href="/scheduling"
              className="text-xs font-semibold text-terra flex items-center gap-1 hover:gap-2 transition-all"
            >
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-sand/50">
            {upcomingApts.length === 0 && (
              <div className="p-8 text-center">
                <Calendar size={24} className="text-sand mx-auto mb-2" />
                <p className="text-sm text-warm-500">No upcoming appointments</p>
                <Link href="/providers" className="text-xs text-terra font-semibold mt-1 inline-block">
                  Find a doctor &rarr;
                </Link>
              </div>
            )}
            {upcomingApts.slice(0, 5).map((apt) => {
              const physician = getPhysician(apt.physician_id)
              return (
                <div
                  key={apt.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-cream/50 transition"
                >
                  <div className="text-sm font-semibold text-warm-600 w-16 shrink-0">
                    {formatTime(apt.scheduled_at)}
                  </div>
                  <div
                    className={cn(
                      "w-1.5 h-8 rounded-full shrink-0",
                      apt.status === "completed"
                        ? "bg-accent"
                        : apt.status === "in-progress"
                        ? "bg-terra"
                        : apt.status === "checked-in"
                        ? "bg-yellow-400"
                        : "bg-sand"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-warm-800">
                        {physician?.full_name}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
                          getStatusColor(apt.status)
                        )}
                      >
                        {apt.status}
                      </span>
                    </div>
                    <p className="text-xs text-warm-500 truncate">
                      {apt.reason}
                      {apt.copay > 0 ? ` \u00b7 Est. copay $${apt.copay}` : " \u00b7 $0 copay"}
                    </p>
                    <p className="text-[10px] text-cloudy mt-0.5">{formatDate(apt.scheduled_at)}</p>
                  </div>
                  {apt.type === "telehealth" && (
                    <span className="text-[10px] font-bold text-soft-blue">VIRTUAL</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Latest Vitals */}
          {latestVital && (
            <Link href="/vitals" className="block bg-pampas rounded-2xl border border-sand p-4 hover:border-terra/30 transition">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={14} className="text-accent" />
                <span className="text-xs font-bold text-warm-800">Latest Vitals</span>
                <span className="text-[9px] text-cloudy ml-auto">
                  {new Date(latestVital.recorded_at).toLocaleDateString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {latestVital.systolic && (
                  <div>
                    <p className={cn("text-sm font-bold", latestVital.systolic >= 140 ? "text-soft-red" : "text-warm-800")}>
                      {latestVital.systolic}/{latestVital.diastolic}
                    </p>
                    <p className="text-[9px] text-cloudy">Blood Pressure</p>
                  </div>
                )}
                {latestVital.heart_rate && (
                  <div>
                    <p className="text-sm font-bold text-warm-800">{latestVital.heart_rate} bpm</p>
                    <p className="text-[9px] text-cloudy">Heart Rate</p>
                  </div>
                )}
                {latestVital.blood_glucose && (
                  <div>
                    <p className={cn("text-sm font-bold", latestVital.blood_glucose > 130 ? "text-yellow-600" : "text-warm-800")}>
                      {latestVital.blood_glucose}
                    </p>
                    <p className="text-[9px] text-cloudy">Glucose mg/dL</p>
                  </div>
                )}
                {latestVital.weight_lbs && (
                  <div>
                    <p className="text-sm font-bold text-warm-800">{latestVital.weight_lbs} lbs</p>
                    <p className="text-[9px] text-cloudy">Weight</p>
                  </div>
                )}
              </div>
            </Link>
          )}

          {/* My Medications */}
          <div className="bg-pampas rounded-2xl border border-sand">
            <div className="flex items-center gap-2 p-4 border-b border-sand">
              <Pill size={16} className="text-accent" />
              <h3 className="text-sm font-bold text-warm-800">My Medications</h3>
            </div>
            <div className="divide-y divide-sand/50">
              {myRx.length === 0 && (
                <div className="p-6 text-center text-xs text-warm-500">No active medications</div>
              )}
              {myRx.map((rx) => (
                <div key={rx.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-warm-800">
                      {rx.medication_name} {rx.dosage}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold",
                        rx.adherence_pct >= 90 ? "text-accent" : rx.adherence_pct >= 80 ? "text-warm-600" : "text-soft-red"
                      )}
                    >
                      {rx.adherence_pct}%
                    </span>
                  </div>
                  <p className="text-[10px] text-cloudy">{rx.frequency}</p>
                </div>
              ))}
            </div>
            <Link
              href="/prescriptions"
              className="block text-center py-2.5 border-t border-sand text-xs font-semibold text-terra hover:bg-cream/50 transition"
            >
              View all &rarr;
            </Link>
          </div>

          {/* Alerts */}
          {lowAdherenceRx.length > 0 && (
            <div className="bg-soft-red/5 rounded-2xl border border-soft-red/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-soft-red" />
                <span className="text-xs font-bold text-soft-red">Medication Alert</span>
              </div>
              {lowAdherenceRx.map((rx) => (
                <p key={rx.id} className="text-xs text-warm-600 mt-1">
                  Your {rx.medication_name} adherence is at {rx.adherence_pct}% — try setting a daily reminder.
                </p>
              ))}
            </div>
          )}

          {/* Pending Prior Auths */}
          {pendingPA.length > 0 && (
            <div className="bg-yellow-50 rounded-2xl border border-yellow-200/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} className="text-yellow-600" />
                <span className="text-xs font-bold text-yellow-700">Pending Approvals</span>
              </div>
              {pendingPA.map((pa) => (
                <p key={pa.id} className="text-xs text-warm-600 mt-1">
                  {pa.procedure_name} — waiting on {pa.insurance_provider}
                </p>
              ))}
            </div>
          )}

          {/* Emergency Card */}
          <Link
            href="/emergency-card"
            className="block bg-soft-red/5 rounded-2xl border border-soft-red/10 p-4 hover:bg-soft-red/10 transition"
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={14} className="text-soft-red" />
              <span className="text-xs font-bold text-warm-800">Emergency Card</span>
            </div>
            <p className="text-[10px] text-warm-500">
              Quick-access card with your allergies, meds, and emergency contacts.
            </p>
          </Link>

          {/* Ask AI */}
          <Link
            href="/chat"
            className="block bg-terra/5 rounded-2xl border border-terra/10 p-4 hover:bg-terra/10 transition"
          >
            <div className="flex items-center gap-2 mb-1">
              <Bot size={16} className="text-terra" />
              <span className="text-sm font-bold text-warm-800">Need help?</span>
            </div>
            <p className="text-xs text-warm-500">
              Ask your AI care team about appointments, medications, bills, or anything health-related.
            </p>
          </Link>
        </div>
      </div>

      {/* AI Care Team Activity */}
      <div className="bg-pampas rounded-2xl border border-sand">
        <div className="flex items-center justify-between p-4 border-b border-sand">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-terra" />
            <h3 className="text-sm font-bold text-warm-800">Your AI Care Team</h3>
          </div>
          <Link href="/chat" className="text-xs font-semibold text-terra flex items-center gap-1 hover:gap-2 transition-all">
            Talk to them <ArrowRight size={12} />
          </Link>
        </div>
        <div className="divide-y divide-sand/50">
          {[
            // Dynamically synthesise activity from real patient data
            ...(lowAdherenceRx.length > 0 ? [{
              icon: Pill,
              color: "text-yellow-600",
              bg: "bg-yellow-50",
              action: "Adherence alert",
              detail: `${lowAdherenceRx[0].medication_name} adherence is ${lowAdherenceRx[0].adherence_pct}% — below target`,
              agent: "Maya",
              href: "/prescriptions",
              time: "Today",
            }] : [{
              icon: Pill,
              color: "text-accent",
              bg: "bg-accent/5",
              action: "Medications on track",
              detail: `All ${myRx.length} active medications at target adherence`,
              agent: "Maya",
              href: "/prescriptions",
              time: "Today",
            }]),
            ...(abnormalLabCount > 0 ? [{
              icon: FlaskConical,
              color: "text-soft-red",
              bg: "bg-soft-red/5",
              action: "Lab results need attention",
              detail: `${abnormalLabCount} abnormal result${abnormalLabCount > 1 ? "s" : ""} in recent labs — review recommended`,
              agent: "Maya",
              href: "/lab-results",
              time: "Today",
            }] : myLabs.length > 0 ? [{
              icon: FlaskConical,
              color: "text-soft-blue",
              bg: "bg-soft-blue/5",
              action: "Lab results reviewed",
              detail: `Latest panel complete — all results within normal range`,
              agent: "Maya",
              href: "/lab-results",
              time: "Recent",
            }] : []),
            ...(upcomingApts.length > 0 ? [{
              icon: Calendar,
              color: "text-soft-blue",
              bg: "bg-soft-blue/5",
              action: "Appointment reminder",
              detail: `${getPhysician(upcomingApts[0].physician_id)?.full_name ?? "Upcoming visit"} on ${formatDate(upcomingApts[0].scheduled_at)}`,
              agent: "Cal",
              href: "/scheduling",
              time: formatDate(upcomingApts[0].scheduled_at),
            }] : []),
            ...(pendingPA.length > 0 ? [{
              icon: ShieldCheck,
              color: "text-yellow-600",
              bg: "bg-yellow-50",
              action: "Prior auth pending",
              detail: `${pendingPA[0].procedure_name} awaiting ${pendingPA[0].insurance_provider}`,
              agent: "Rex",
              href: "/prior-auth",
              time: "Active",
            }] : []),
            ...(dueVaccines.length > 0 ? [{
              icon: Syringe,
              color: "text-yellow-600",
              bg: "bg-yellow-50",
              action: `Vaccine${dueVaccines.length > 1 ? "s" : ""} recommended`,
              detail: `${dueVaccines.slice(0, 2).map(v => v.vaccine_name).join(", ")} due for your age group`,
              agent: "Ivy",
              href: "/vaccinations",
              time: dueVaccines.some(v => v.status === "overdue") ? "Overdue" : "Due",
            }] : []),
            ...(pendingReferrals.length > 0 ? [{
              icon: ArrowRightCircle,
              color: "text-terra",
              bg: "bg-terra/5",
              action: "Referral in progress",
              detail: `${pendingReferrals[0].specialist_specialty} referral is ${pendingReferrals[0].status}`,
              agent: "Atlas",
              href: "/referrals",
              time: "Active",
            }] : []),
            ...(myClaims.filter(c => c.status === "denied").length > 0 ? [{
              icon: Receipt,
              color: "text-soft-red",
              bg: "bg-soft-red/5",
              action: "Claim denied",
              detail: `${myClaims.filter(c => c.status === "denied").length} claim${myClaims.filter(c => c.status === "denied").length > 1 ? "s" : ""} denied — may be eligible for appeal`,
              agent: "Vera",
              href: "/billing",
              time: "Action needed",
            }] : []),
          ].slice(0, 6).map((item, i) => (
            <Link key={i} href={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-cream/30 transition">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", item.bg)}>
                <item.icon size={14} className={item.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-warm-800">{item.action}</span>
                  <span className="text-[9px] font-bold text-terra bg-terra/10 px-1.5 py-0.5 rounded">{item.agent}</span>
                </div>
                <p className="text-[11px] text-warm-500 mt-0.5 truncate">{item.detail}</p>
              </div>
              <span className="text-[10px] text-cloudy shrink-0">{item.time}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
