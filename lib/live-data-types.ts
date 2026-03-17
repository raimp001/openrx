export interface LivePhysician {
  id: string
  email: string
  full_name: string
  specialty: string
  credentials: string
  phone: string
  available_days: string[]
  available_start: string
  available_end: string
}

export interface LivePatient {
  id: string
  full_name: string
  date_of_birth: string
  gender: string
  phone: string
  email: string
  address: string
  insurance_provider: string
  insurance_plan: string
  insurance_id: string
  emergency_contact_name: string
  emergency_contact_phone: string
  medical_history: { condition: string; diagnosed: string; status: string }[]
  allergies: string[]
  primary_physician_id: string
  created_at: string
}

export interface LiveAppointment {
  id: string
  patient_id: string
  physician_id: string
  scheduled_at: string
  duration_minutes: number
  type: string
  status: string
  reason: string
  notes: string
  copay: number
}

export interface LiveClaim {
  id: string
  patient_id: string
  appointment_id: string
  claim_number: string
  status: string
  total_amount: number
  insurance_paid: number
  patient_responsibility: number
  cpt_codes: string[]
  icd_codes: string[]
  date_of_service: string
  submitted_at: string
  resolved_at: string | null
  denial_reason: string | null
  errors_detected: { type: string; description: string; severity: string }[]
  notes: string
}

export interface LivePrescription {
  id: string
  patient_id: string
  physician_id: string
  medication_name: string
  dosage: string
  frequency: string
  start_date: string
  end_date: string | null
  refills_remaining: number
  pharmacy: string
  status: string
  adherence_pct: number
  last_filled: string
  notes: string
}

export interface LivePriorAuth {
  id: string
  patient_id: string
  physician_id: string
  insurance_provider: string
  procedure_code: string
  procedure_name: string
  icd_codes: string[]
  status: string
  urgency: string
  reference_number: string | null
  submitted_at: string | null
  resolved_at: string | null
  denial_reason: string | null
  clinical_notes: string
}

export interface LiveMessage {
  id: string
  patient_id: string
  physician_id: string | null
  sender_type: string
  content: string
  channel: string
  read: boolean
  created_at: string
}

export interface LiveLabResult {
  id: string
  patient_id: string
  physician_id: string
  test_name: string
  category: string
  lab_facility: string
  ordered_at: string
  resulted_at: string | null
  status: string
  results: {
    name: string
    value: string
    unit?: string
    reference_range?: string
    flag: "normal" | "high" | "low" | "critical"
  }[]
  notes: string
}

export interface LiveVital {
  id: string
  patient_id: string
  recorded_at: string
  systolic?: number
  diastolic?: number
  heart_rate?: number
  blood_glucose?: number
  weight_lbs?: number
  oxygen_saturation?: number
  temperature_f?: number
  source: "home" | "clinic" | "device"
}

export interface LiveVaccination {
  id: string
  patient_id: string
  vaccine_name: string
  brand: string
  dose_number: number
  total_doses: number
  administered_at: string | null
  due_at: string | null
  next_due?: string | null
  status: "completed" | "due" | "overdue"
  facility: string
  administered_by: string
  lot_number: string
  site: string
  notes: string
}

export interface LiveReferral {
  id: string
  patient_id: string
  physician_id: string
  referring_physician_id: string
  specialist_name: string
  specialist_specialty: string
  reason: string
  status: "pending" | "scheduled" | "completed" | "cancelled"
  insurance_authorized: boolean
  referred_at: string
  created_at: string
  appointment_at: string | null
  appointment_date: string | null
  specialist_phone: string
  urgency: "routine" | "urgent" | "stat"
  notes: string
}

export interface LiveSnapshot {
  source: "database"
  walletAddress: string | null
  generatedAt: string
  patient: LivePatient | null
  physicians: LivePhysician[]
  appointments: LiveAppointment[]
  claims: LiveClaim[]
  prescriptions: LivePrescription[]
  priorAuths: LivePriorAuth[]
  messages: LiveMessage[]
  labResults: LiveLabResult[]
  vitals: LiveVital[]
  vaccinations: LiveVaccination[]
  referrals: LiveReferral[]
}

export function createEmptyLiveSnapshot(walletAddress?: string | null): LiveSnapshot {
  return {
    source: "database",
    walletAddress: walletAddress || null,
    generatedAt: new Date().toISOString(),
    patient: null,
    physicians: [],
    appointments: [],
    claims: [],
    prescriptions: [],
    priorAuths: [],
    messages: [],
    labResults: [],
    vitals: [],
    vaccinations: [],
    referrals: [],
  }
}

// ── Demo patient snapshot ────────────────────────────────
// Returned when no DATABASE_URL is configured so the app is
// fully navigable during development / demos without a live DB.
export function createDemoSnapshot(walletAddress?: string | null): LiveSnapshot {
  const now = new Date()
  const d = (offsetDays: number) => new Date(now.getTime() + offsetDays * 86400000).toISOString()

  const physicians: LivePhysician[] = [
    {
      id: "dr-patel-001",
      email: "a.patel@openrxclinic.com",
      full_name: "Dr. Anita Patel",
      specialty: "Internal Medicine",
      credentials: "MD, FACP",
      phone: "555-201-0100",
      available_days: ["Monday", "Tuesday", "Wednesday", "Thursday"],
      available_start: "08:00",
      available_end: "17:00",
    },
    {
      id: "dr-chen-002",
      email: "m.chen@openrxclinic.com",
      full_name: "Dr. Michael Chen",
      specialty: "Cardiology",
      credentials: "MD, FACC",
      phone: "555-201-0200",
      available_days: ["Tuesday", "Thursday", "Friday"],
      available_start: "09:00",
      available_end: "16:00",
    },
  ]

  const patient: LivePatient = {
    id: "demo-patient-001",
    full_name: "Manoj Rai",
    date_of_birth: "1975-04-22",
    gender: "Male",
    phone: "(512) 555-0188",
    email: "manoj.rai@openrxhealth.com",
    address: "2847 Burnet Rd, Austin, TX 78757",
    insurance_provider: "Moda Medical / Kaiser Dental",
    insurance_plan: "Moda Gold Plus PPO",
    insurance_id: "MOD-8821-44012",
    emergency_contact_name: "Priya Rai",
    emergency_contact_phone: "(512) 555-0199",
    medical_history: [
      { condition: "Type 2 Diabetes Mellitus", diagnosed: "2020-03-10", status: "active" },
      { condition: "Hypertension", diagnosed: "2019-08-15", status: "active" },
      { condition: "Hyperlipidemia", diagnosed: "2021-01-05", status: "active" },
    ],
    allergies: ["Penicillin", "Sulfa antibiotics"],
    primary_physician_id: "dr-patel-001",
    created_at: d(-180),
  }

  const appointments: LiveAppointment[] = [
    {
      id: "appt-001",
      patient_id: patient.id,
      physician_id: "dr-patel-001",
      scheduled_at: d(5),
      duration_minutes: 30,
      type: "Follow-up",
      status: "confirmed",
      reason: "Diabetes & BP 3-month check",
      notes: "Bring glucose log. A1C draw ordered.",
      copay: 30,
    },
    {
      id: "appt-002",
      patient_id: patient.id,
      physician_id: "dr-chen-002",
      scheduled_at: d(18),
      duration_minutes: 45,
      type: "Specialist Visit",
      status: "pending",
      reason: "Cardiology consult — borderline EKG",
      notes: "Referral from Dr. Patel. Prior auth in progress.",
      copay: 60,
    },
    {
      id: "appt-003",
      patient_id: patient.id,
      physician_id: "dr-patel-001",
      scheduled_at: d(-30),
      duration_minutes: 30,
      type: "Follow-up",
      status: "completed",
      reason: "Annual wellness visit",
      notes: "All vitals reviewed. Labs ordered.",
      copay: 0,
    },
  ]

  const claims: LiveClaim[] = [
    {
      id: "claim-001",
      patient_id: patient.id,
      appointment_id: "appt-003",
      claim_number: "BCB-2026-0044812",
      status: "paid",
      total_amount: 275,
      insurance_paid: 220,
      patient_responsibility: 55,
      cpt_codes: ["99395", "93000"],
      icd_codes: ["E11.9", "I10"],
      date_of_service: d(-30),
      submitted_at: d(-28),
      resolved_at: d(-14),
      denial_reason: null,
      errors_detected: [],
      notes: "Annual preventive visit + EKG",
    },
    {
      id: "claim-002",
      patient_id: patient.id,
      appointment_id: "appt-003",
      claim_number: "BCB-2026-0051203",
      status: "denied",
      total_amount: 185,
      insurance_paid: 0,
      patient_responsibility: 185,
      cpt_codes: ["80053"],
      icd_codes: ["E11.9"],
      date_of_service: d(-30),
      submitted_at: d(-27),
      resolved_at: d(-10),
      denial_reason: "Lab not in network — appeal eligible",
      errors_detected: [
        { type: "out-of-network", description: "LabCorp billed as out-of-network", severity: "high" },
      ],
      notes: "Comprehensive metabolic panel — pending appeal",
    },
  ]

  const prescriptions: LivePrescription[] = [
    {
      id: "rx-001",
      patient_id: patient.id,
      physician_id: "dr-patel-001",
      medication_name: "Metformin",
      dosage: "1000mg",
      frequency: "Twice daily with meals",
      start_date: d(-365),
      end_date: null,
      refills_remaining: 2,
      pharmacy: "CVS Pharmacy #4421 — Austin, TX",
      status: "active",
      adherence_pct: 94,
      last_filled: d(-28),
      notes: "Take with food to reduce GI side effects",
    },
    {
      id: "rx-002",
      patient_id: patient.id,
      physician_id: "dr-patel-001",
      medication_name: "Lisinopril",
      dosage: "10mg",
      frequency: "Once daily",
      start_date: d(-300),
      end_date: null,
      refills_remaining: 1,
      pharmacy: "CVS Pharmacy #4421 — Austin, TX",
      status: "active",
      adherence_pct: 88,
      last_filled: d(-35),
      notes: "Monitor for cough. Report if persistent.",
    },
    {
      id: "rx-003",
      patient_id: patient.id,
      physician_id: "dr-patel-001",
      medication_name: "Atorvastatin",
      dosage: "20mg",
      frequency: "Once daily at bedtime",
      start_date: d(-280),
      end_date: null,
      refills_remaining: 3,
      pharmacy: "CVS Pharmacy #4421 — Austin, TX",
      status: "active",
      adherence_pct: 91,
      last_filled: d(-42),
      notes: "Annual liver function test recommended",
    },
    {
      id: "rx-004",
      patient_id: patient.id,
      physician_id: "dr-patel-001",
      medication_name: "Cetirizine",
      dosage: "10mg",
      frequency: "Once daily as needed",
      start_date: d(-180),
      end_date: d(180),
      refills_remaining: 0,
      pharmacy: "CVS Pharmacy #4421 — Austin, TX",
      status: "active",
      adherence_pct: 78,
      last_filled: d(-60),
      notes: "Seasonal use — spring/fall",
    },
  ]

  const priorAuths: LivePriorAuth[] = [
    {
      id: "pa-001",
      patient_id: patient.id,
      physician_id: "dr-chen-002",
      insurance_provider: "Blue Cross Blue Shield",
      procedure_code: "93306",
      procedure_name: "Echocardiogram with Doppler",
      icd_codes: ["I10", "R00.0"],
      status: "pending",
      urgency: "routine",
      reference_number: "PA-2026-BCBS-00441",
      submitted_at: d(-5),
      resolved_at: null,
      denial_reason: null,
      clinical_notes: "Borderline EKG finding at annual visit. Cardiology consult ordered.",
    },
  ]

  const messages: LiveMessage[] = [
    {
      id: "msg-001",
      patient_id: patient.id,
      physician_id: "dr-patel-001",
      sender_type: "physician",
      content: "Hi Manoj — your latest labs look great. Let's review at your upcoming visit.",
      channel: "portal",
      read: true,
      created_at: d(-14),
    },
    {
      id: "msg-002",
      patient_id: patient.id,
      physician_id: null,
      sender_type: "agent",
      content: "Reminder: your Lisinopril has 1 refill remaining. Would you like me to request a refill from Dr. Patel? — Maya (Rx Manager)",
      channel: "portal",
      read: false,
      created_at: d(-2),
    },
    {
      id: "msg-003",
      patient_id: patient.id,
      physician_id: null,
      sender_type: "agent",
      content: "Your prior authorization for the Echocardiogram (PA-2026-BCBS-00441) was submitted on ${new Date(d(-5)).toLocaleDateString()}. I'll notify you as soon as BCBS responds. — Rex (PA Specialist)",
      channel: "portal",
      read: false,
      created_at: d(-5),
    },
  ]

  const labResults: LiveLabResult[] = [
    {
      id: "lab-001",
      patient_id: patient.id,
      physician_id: "dr-patel-001",
      test_name: "Hemoglobin A1C",
      category: "Endocrinology",
      lab_facility: "LabCorp Austin",
      ordered_at: d(-32),
      resulted_at: d(-28),
      status: "resulted",
      results: [
        { name: "HbA1c", value: "6.8", unit: "%", reference_range: "<5.7% normal, 5.7-6.4% prediabetes", flag: "normal" },
      ],
      notes: "Well-controlled T2DM. Continue current regimen.",
    },
    {
      id: "lab-002",
      patient_id: patient.id,
      physician_id: "dr-patel-001",
      test_name: "Comprehensive Metabolic Panel",
      category: "Chemistry",
      lab_facility: "LabCorp Austin",
      ordered_at: d(-32),
      resulted_at: d(-27),
      status: "resulted",
      results: [
        { name: "Glucose", value: "118", unit: "mg/dL", reference_range: "70-99", flag: "high" },
        { name: "Creatinine", value: "0.9", unit: "mg/dL", reference_range: "0.6-1.2", flag: "normal" },
        { name: "ALT", value: "28", unit: "U/L", reference_range: "7-40", flag: "normal" },
        { name: "Sodium", value: "139", unit: "mEq/L", reference_range: "136-145", flag: "normal" },
        { name: "Potassium", value: "4.1", unit: "mEq/L", reference_range: "3.5-5.1", flag: "normal" },
      ],
      notes: "Fasting glucose mildly elevated. Consistent with known T2DM.",
    },
    {
      id: "lab-003",
      patient_id: patient.id,
      physician_id: "dr-patel-001",
      test_name: "Lipid Panel",
      category: "Cardiology",
      lab_facility: "LabCorp Austin",
      ordered_at: d(-32),
      resulted_at: d(-27),
      status: "resulted",
      results: [
        { name: "Total Cholesterol", value: "192", unit: "mg/dL", reference_range: "<200", flag: "normal" },
        { name: "LDL", value: "108", unit: "mg/dL", reference_range: "<100 optimal", flag: "high" },
        { name: "HDL", value: "52", unit: "mg/dL", reference_range: ">50 women", flag: "normal" },
        { name: "Triglycerides", value: "145", unit: "mg/dL", reference_range: "<150", flag: "normal" },
      ],
      notes: "LDL slightly above optimal for diabetic patient. Continue Atorvastatin.",
    },
  ]

  const vitals: LiveVital[] = [
    { id: "v-001", patient_id: patient.id, recorded_at: d(-30), systolic: 128, diastolic: 82, heart_rate: 72, weight_lbs: 164, oxygen_saturation: 98, temperature_f: 98.4, source: "clinic" },
    { id: "v-002", patient_id: patient.id, recorded_at: d(-14), systolic: 132, diastolic: 86, heart_rate: 76, weight_lbs: 163, blood_glucose: 118, source: "home" },
    { id: "v-003", patient_id: patient.id, recorded_at: d(-7), systolic: 125, diastolic: 80, heart_rate: 70, weight_lbs: 162, blood_glucose: 112, source: "home" },
    { id: "v-004", patient_id: patient.id, recorded_at: d(-1), systolic: 122, diastolic: 78, heart_rate: 68, weight_lbs: 162, blood_glucose: 108, source: "device" },
  ]

  const vaccinations: LiveVaccination[] = [
    {
      id: "vax-001", patient_id: patient.id, vaccine_name: "Influenza", brand: "Fluzone", dose_number: 1, total_doses: 1,
      administered_at: d(-150), due_at: null, next_due: d(215), status: "completed",
      facility: "CVS Pharmacy", administered_by: "Pharmacist", lot_number: "FLU2025-A", site: "Left arm", notes: "",
    },
    {
      id: "vax-002", patient_id: patient.id, vaccine_name: "COVID-19 Booster", brand: "Moderna XBB.1.5", dose_number: 3, total_doses: 3,
      administered_at: d(-180), due_at: null, next_due: null, status: "completed",
      facility: "Austin Public Health", administered_by: "Nurse", lot_number: "MOD-XBB-2025-B", site: "Right arm", notes: "",
    },
    {
      id: "vax-003", patient_id: patient.id, vaccine_name: "Shingrix (Shingles)", brand: "Shingrix", dose_number: 1, total_doses: 2,
      administered_at: null, due_at: d(30), next_due: null, status: "due",
      facility: "", administered_by: "", lot_number: "", site: "", notes: "Recommended age 50+. Schedule with Dr. Patel.",
    },
  ]

  const referrals: LiveReferral[] = [
    {
      id: "ref-001",
      patient_id: patient.id,
      physician_id: "dr-chen-002",
      referring_physician_id: "dr-patel-001",
      specialist_name: "Dr. Michael Chen",
      specialist_specialty: "Cardiology",
      reason: "Borderline EKG — evaluate for structural heart disease. Patient has T2DM and hypertension as additional risk factors.",
      status: "scheduled",
      insurance_authorized: false,
      referred_at: d(-7),
      created_at: d(-7),
      appointment_at: d(18),
      appointment_date: d(18),
      specialist_phone: "555-201-0200",
      urgency: "routine",
      notes: "Prior auth pending (PA-2026-BCBS-00441). Echocardiogram may be ordered during visit.",
    },
  ]

  return {
    source: "database",
    walletAddress: walletAddress || null,
    generatedAt: new Date().toISOString(),
    patient,
    physicians,
    appointments,
    claims,
    prescriptions,
    priorAuths,
    messages,
    labResults,
    vitals,
    vaccinations,
    referrals,
  }
}
