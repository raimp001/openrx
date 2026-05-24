export type RedFlagCategory =
  | "cardiopulmonary_emergency"
  | "stroke_symptoms"
  | "severe_bleeding"
  | "suicide_crisis"
  | "syncope"
  | "neutropenic_fever"
  | "acute_neurologic_deficit"
  | "pregnancy_emergency"

export interface RedFlagResult {
  category: RedFlagCategory
  label: string
  emergencyMessage: string
  crisisResource?: string
}

const RULES: Array<{ category: RedFlagCategory; label: string; test: RegExp; message: string; crisisResource?: string }> = [
  {
    category: "cardiopulmonary_emergency",
    label: "Chest pain or severe trouble breathing",
    test: /\b(chest (?:pain|pressure|tightness)|severe shortness of breath|can(?:not|'t) breathe|difficulty breathing)\b/i,
    message: "Chest pain or severe trouble breathing can be an emergency. Call 911 or go to the nearest emergency department now.",
  },
  {
    category: "stroke_symptoms",
    label: "Possible stroke symptoms",
    test: /\b(face droop|facial droop|slurred speech|trouble speaking|stroke symptoms?|one[- ]sided weakness|sudden numbness)\b/i,
    message: "Possible stroke symptoms need emergency evaluation. Call 911 now; do not wait for online guidance.",
  },
  {
    category: "severe_bleeding",
    label: "Severe bleeding",
    test: /\b(heavy bleeding|severe bleeding|vomiting blood|throwing up blood|coughing blood|blood won't stop|bleeding won'?t stop)\b/i,
    message: "Severe bleeding can be an emergency. Call 911 or go to the nearest emergency department now.",
  },
  {
    category: "suicide_crisis",
    label: "Thoughts of self-harm",
    test: /\b(suicid(?:e|al)|kill(?:ing)? myself|hurt(?:ing)? myself|harm(?:ing)? myself|end my life|take my life|self[- ]harm)\b/i,
    message: "You deserve immediate support. Call or text 988 now. If you may act on these thoughts or are in immediate danger, call 911 or go to the nearest emergency department.",
    crisisResource: "tel:988",
  },
  {
    category: "syncope",
    label: "Fainting or passing out",
    test: /\b(syncope|fainted|fainting|passed out|loss of consciousness)\b/i,
    message: "Fainting or loss of consciousness may need emergency evaluation. If this is happening now, is new, or comes with other severe symptoms, call 911 or go to an emergency department.",
  },
  {
    category: "neutropenic_fever",
    label: "Fever during chemotherapy or neutropenia",
    test: /\b(neutropeni(?:a|c)|on chemo(?:therapy)?|receiving chemo(?:therapy)?)\b[^.!?\n]{0,50}\b(fever|temperature|100\.4)\b|\b(fever|temperature|100\.4)\b[^.!?\n]{0,50}\b(neutropeni(?:a|c)|on chemo(?:therapy)?|receiving chemo(?:therapy)?)\b/i,
    message: "Fever during chemotherapy or known neutropenia may need urgent medical care. Contact the oncology team immediately; if you cannot reach them promptly or feel very ill, go to an emergency department.",
  },
  {
    category: "acute_neurologic_deficit",
    label: "New neurologic symptoms",
    test: /\b(new (?:weakness|paralysis|vision loss|confusion)|sudden (?:weakness|confusion|vision loss)|acute neurologic)\b/i,
    message: "New neurologic symptoms can be an emergency. Call 911 now if symptoms are sudden or severe.",
  },
  {
    category: "pregnancy_emergency",
    label: "Pregnancy warning signs",
    test: /\b(pregnan(?:t|cy)|postpartum)\b[^.!?\n]{0,60}\b(heavy bleeding|severe pain|chest pain|shortness of breath|faint(?:ing|ed)|passed out)\b|\b(heavy bleeding|severe pain|chest pain|shortness of breath|faint(?:ing|ed)|passed out)\b[^.!?\n]{0,60}\b(pregnan(?:t|cy)|postpartum)\b/i,
    message: "Serious symptoms during pregnancy or after delivery require prompt medical evaluation. Call your obstetric clinician immediately or go to an emergency department; call 911 for severe symptoms.",
  },
]

export function detectRedFlagText(text: string): RedFlagResult | null {
  const cleaned = text.trim()
  if (!cleaned) return null
  const match = RULES.find((rule) => rule.test.test(cleaned))
  return match
    ? {
        category: match.category,
        label: match.label,
        emergencyMessage: match.message,
        crisisResource: match.crisisResource,
      }
    : null
}

export function emergencyResponse(result: RedFlagResult): string {
  return [
    "Urgent safety guidance",
    result.emergencyMessage,
    "",
    "What to do now",
    result.category === "suicide_crisis"
      ? "- Call or text [988](tel:988) for immediate crisis support. Call 911 if there is immediate danger."
      : "- Call [911](tel:911) or go to the nearest emergency department now if symptoms are happening now or severe.",
    "- OpenRx will not treat this as routine screening or scheduling.",
    "",
    "Safety note",
    "This is a safety escalation, not a diagnosis. Please do not delay urgent medical care while using this app.",
  ].join("\n\n")
}
