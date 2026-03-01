import Link from "next/link"
import {
  Lock,
  Eye,
  EyeOff,
  Shield,
  Server,
  Bot,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Heart,
} from "lucide-react"

export default function PrivacyExplainedPage() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-cream/90 backdrop-blur-sm border-b border-sand">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-terra to-terra-dark flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 4v16M4 12h16" stroke="#060D1B" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-base font-bold text-warm-800 font-serif">OpenRx</span>
          </Link>
          <Link href="/dashboard" className="text-xs font-semibold text-terra hover:underline">
            Go to Dashboard →
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
            <Lock size={24} className="text-accent" />
          </div>
          <h1 className="text-4xl font-serif text-warm-800">How We Handle Your Data</h1>
          <p className="text-warm-500 mt-4 leading-relaxed">
            Plain English. No legalese. We believe you deserve to know exactly what happens
            to your health information — so here it is.
          </p>
        </div>

        {/* TL;DR */}
        <div className="bg-accent/5 rounded-2xl border border-accent/20 p-6">
          <h2 className="text-sm font-bold text-accent uppercase tracking-widest mb-4 flex items-center gap-2">
            <CheckCircle2 size={14} />
            TL;DR — The Short Version
          </h2>
          <ul className="space-y-2.5">
            {[
              "In demo mode, no personal health data is stored on our servers — everything is sample data.",
              "We never sell your data to anyone, ever.",
              "We never share your data with insurance companies, pharmacies, or advertisers.",
              "Our AI uses your information only to answer your questions, not to train models.",
              "You can use OpenRx without creating an account or providing any personal info.",
              "We are not a HIPAA covered entity — we're a personal tool, not a clinical provider.",
            ].map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm text-warm-700">
                <CheckCircle2 size={14} className="text-accent shrink-0 mt-0.5" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* What We Store */}
        <section>
          <h2 className="text-2xl font-serif text-warm-800 mb-6 flex items-center gap-3">
            <Eye size={20} className="text-terra" />
            What We Store
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-pampas rounded-2xl border border-sand p-5">
              <div className="flex items-center gap-2 mb-3">
                <Server size={14} className="text-terra" />
                <h3 className="text-sm font-bold text-warm-800">Demo Mode (Default)</h3>
              </div>
              <p className="text-xs text-warm-500 mb-3">
                When you use OpenRx without connecting a wallet or creating an account:
              </p>
              <ul className="space-y-1.5">
                {[
                  "All data shown is sample/fictional patient data",
                  "Nothing you type or click is saved to our servers",
                  "Your session data lives only in your browser memory",
                  "Clearing your browser clears everything",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-warm-600">
                    <CheckCircle2 size={11} className="text-accent shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-pampas rounded-2xl border border-sand p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={14} className="text-terra" />
                <h3 className="text-sm font-bold text-warm-800">With Wallet Connected</h3>
              </div>
              <p className="text-xs text-warm-500 mb-3">
                If you optionally connect a Coinbase Smart Wallet:
              </p>
              <ul className="space-y-1.5">
                {[
                  "Your profile preferences (pharmacy, PCP, meds list) are stored encrypted on-chain",
                  "Your wallet address is used as a pseudonymous identifier — not your name",
                  "No PHI (Social Security, insurance ID, diagnosis) is written to the blockchain",
                  "You can disconnect and delete your profile at any time",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-warm-600">
                    <CheckCircle2 size={11} className="text-accent shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* What We Never Do */}
        <section>
          <h2 className="text-2xl font-serif text-warm-800 mb-6 flex items-center gap-3">
            <EyeOff size={20} className="text-soft-red" />
            What We Never Do
          </h2>
          <div className="bg-soft-red/5 rounded-2xl border border-soft-red/10 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "Sell your data to any third party",
                "Share your information with insurance companies",
                "Use your data to train AI models",
                "Track you across websites",
                "Show you targeted health ads",
                "Store your Social Security Number or full insurance ID",
                "Provide your information to employers",
                "Share with pharmaceutical companies",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-warm-700">
                  <XCircle size={13} className="text-soft-red shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How AI Works */}
        <section>
          <h2 className="text-2xl font-serif text-warm-800 mb-6 flex items-center gap-3">
            <Bot size={20} className="text-terra" />
            How Our AI Works
          </h2>
          <div className="space-y-4">
            <div className="bg-pampas rounded-2xl border border-sand p-5">
              <h3 className="text-sm font-bold text-warm-800 mb-2">What AI we use</h3>
              <p className="text-sm text-warm-600 leading-relaxed">
                OpenRx is powered by Claude (made by Anthropic) through the OpenClaw gateway.
                Claude is one of the most privacy-respecting AI systems available — messages
                sent to Claude are not used to train future models by default.
              </p>
            </div>
            <div className="bg-pampas rounded-2xl border border-sand p-5">
              <h3 className="text-sm font-bold text-warm-800 mb-2">What gets sent to AI</h3>
              <p className="text-sm text-warm-600 leading-relaxed">
                When you ask our AI a question, we send only what&apos;s necessary to answer it —
                typically the question text plus minimal context (like your medication names, not
                your full identity). We strip names, dates of birth, and insurance IDs before
                sending. The AI never receives your wallet address or account details.
              </p>
            </div>
            <div className="bg-pampas rounded-2xl border border-sand p-5">
              <h3 className="text-sm font-bold text-warm-800 mb-2">What AI cannot do</h3>
              <ul className="space-y-1.5 mt-2">
                {[
                  "Diagnose medical conditions",
                  "Prescribe or recommend specific treatments",
                  "Access your actual insurance portal or medical records",
                  "See your real lab results (demo mode uses sample data)",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-warm-600">
                    <XCircle size={12} className="text-cloudy shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* HIPAA Note */}
        <section>
          <div className="bg-yellow-900/20 rounded-2xl border border-yellow-700/30 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-yellow-400 mb-2">A Note on HIPAA</h2>
                <p className="text-sm text-warm-600 leading-relaxed">
                  OpenRx is a personal health management tool, not a HIPAA covered entity or business
                  associate. This means HIPAA&apos;s protections don&apos;t technically apply to us the same
                  way they apply to your doctor or hospital. We think that&apos;s actually fine —
                  because our privacy standards are stricter by design. We recommend you treat
                  OpenRx as a personal notebook, not a clinical system: don&apos;t paste in sensitive
                  documents you&apos;d rather keep completely private.
                </p>
                <p className="text-sm text-warm-600 mt-3">
                  <strong className="text-warm-700">Always consult a licensed healthcare provider</strong> for
                  medical decisions. OpenRx provides information and workflow assistance — not medical advice.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Your Rights */}
        <section>
          <h2 className="text-2xl font-serif text-warm-800 mb-6 flex items-center gap-3">
            <Shield size={20} className="text-terra" />
            Your Rights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "Right to Delete",
                desc: "Disconnect your wallet or clear your browser to remove all data. No account = no data on our servers.",
              },
              {
                title: "Right to Opt Out",
                desc: "Use OpenRx entirely in demo mode with no personal data. Every feature works without creating an account.",
              },
              {
                title: "Right to Know",
                desc: "This page exists because we believe transparency isn't optional. If you have questions, contact us.",
              },
            ].map((right) => (
              <div key={right.title} className="bg-pampas rounded-2xl border border-sand p-5">
                <CheckCircle2 size={16} className="text-accent mb-3" />
                <h3 className="text-sm font-bold text-warm-800 mb-1">{right.title}</h3>
                <p className="text-xs text-warm-500 leading-relaxed">{right.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="text-center py-8 border-t border-sand">
          <p className="text-sm text-warm-500">
            Questions about your data?{" "}
            <a href="mailto:privacy@openrx.health" className="text-terra font-semibold hover:underline">
              privacy@openrx.health
            </a>
          </p>
          <p className="text-xs text-cloudy mt-2">Last updated February 2026</p>
        </section>
      </main>

      <footer className="border-t border-sand bg-pampas">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart size={14} className="text-terra" />
            <span className="text-xs text-warm-500">OpenRx &middot; Privacy by design</span>
          </div>
          <Link href="/" className="text-xs text-cloudy hover:text-warm-500 transition">
            ← Back to OpenRx
          </Link>
        </div>
      </footer>
    </div>
  )
}
