import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function normalizeWallet(value) {
  return (value || "").trim().toLowerCase()
}

function isoDays(offsetDays) {
  return new Date(Date.now() + offsetDays * 86400000)
}

function makeAvailableSlots(days) {
  return days.map((day) => ({
    day,
    start: "08:30",
    end: "16:30",
  }))
}

async function upsertUserByEmail(input) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) {
    return prisma.user.update({
      where: { email: input.email },
      data: {
        name: input.name,
        role: input.role,
        walletAddress: input.walletAddress ?? existing.walletAddress,
        image: input.image ?? existing.image,
      },
    })
  }

  return prisma.user.create({
    data: input,
  })
}

async function main() {
  const walletAddress = normalizeWallet(
    process.argv[2] || process.env.OPENRX_DEMO_WALLET || process.env.NEXT_PUBLIC_DEVELOPER_WALLET
  )

  if (!walletAddress) {
    throw new Error("Missing demo wallet address. Pass one as an argument or set NEXT_PUBLIC_DEVELOPER_WALLET.")
  }

  const patientEmail = "demo.patient@openrx.health"
  const careTeamEmail = "careteam@openrx.health"
  const pcpEmail = "anita.patel@openrx.health"
  const cardioEmail = "michael.chen@openrx.health"

  const patientUserExisting = await prisma.user.findFirst({
    where: {
      OR: [{ walletAddress }, { email: patientEmail }],
    },
    include: { patientProfile: true },
  })

  const patientUser = patientUserExisting
    ? await prisma.user.update({
        where: { id: patientUserExisting.id },
        data: {
          email: patientEmail,
          name: "Manoj Rai",
          role: "PATIENT",
          walletAddress,
        },
      })
    : await prisma.user.create({
        data: {
          id: "demo-user-patient",
          email: patientEmail,
          name: "Manoj Rai",
          role: "PATIENT",
          walletAddress,
        },
      })

  const pcpUser = await upsertUserByEmail({
    id: "demo-user-pcp",
    email: pcpEmail,
    name: "Anita Patel",
    role: "DOCTOR",
  })

  const cardioUser = await upsertUserByEmail({
    id: "demo-user-cardio",
    email: cardioEmail,
    name: "Michael Chen",
    role: "DOCTOR",
  })

  const careTeamUser = await upsertUserByEmail({
    id: "demo-user-careteam",
    email: careTeamEmail,
    name: "OpenRx Care Team",
    role: "ADMIN",
  })

  const patientProfile = await prisma.patientProfile.upsert({
    where: { userId: patientUser.id },
    update: {
      dateOfBirth: new Date("1975-04-22T00:00:00.000Z"),
      gender: "Male",
      phone: "(503) 555-0188",
      address: "2459 SE Tualatin Valley Hwy, Hillsboro, OR 97123",
      emergencyContact: "Priya Rai ((503) 555-0199)",
      bloodType: "O+",
      allergies: ["Penicillin", "Sulfa antibiotics"],
      insuranceId: "MOD-8821-44012",
      insuranceProvider: "Moda Gold Plus PPO",
    },
    create: {
      id: "demo-profile-patient",
      userId: patientUser.id,
      dateOfBirth: new Date("1975-04-22T00:00:00.000Z"),
      gender: "Male",
      phone: "(503) 555-0188",
      address: "2459 SE Tualatin Valley Hwy, Hillsboro, OR 97123",
      emergencyContact: "Priya Rai ((503) 555-0199)",
      bloodType: "O+",
      allergies: ["Penicillin", "Sulfa antibiotics"],
      insuranceId: "MOD-8821-44012",
      insuranceProvider: "Moda Gold Plus PPO",
    },
  })

  const pcpProfile = await prisma.doctorProfile.upsert({
    where: { userId: pcpUser.id },
    update: {
      specialty: "Internal Medicine",
      licenseNumber: "OR-IM-108244",
      bio: "Primary care physician focused on prevention, diabetes management, and early screening coordination.",
      yearsExperience: 14,
      consultationFee: 195,
      availableSlots: makeAvailableSlots(["Monday", "Tuesday", "Wednesday", "Thursday"]),
      rating: 4.9,
      totalReviews: 184,
      isVerified: true,
      acceptsInsurance: true,
    },
    create: {
      id: "demo-doctor-pcp",
      userId: pcpUser.id,
      specialty: "Internal Medicine",
      licenseNumber: "OR-IM-108244",
      bio: "Primary care physician focused on prevention, diabetes management, and early screening coordination.",
      yearsExperience: 14,
      consultationFee: 195,
      availableSlots: makeAvailableSlots(["Monday", "Tuesday", "Wednesday", "Thursday"]),
      rating: 4.9,
      totalReviews: 184,
      isVerified: true,
      acceptsInsurance: true,
    },
  })

  const cardioProfile = await prisma.doctorProfile.upsert({
    where: { userId: cardioUser.id },
    update: {
      specialty: "Cardiology",
      licenseNumber: "OR-CARD-221904",
      bio: "Cardiologist for imaging coordination, preventive risk review, and fast access consults.",
      yearsExperience: 11,
      consultationFee: 320,
      availableSlots: makeAvailableSlots(["Tuesday", "Thursday", "Friday"]),
      rating: 4.8,
      totalReviews: 129,
      isVerified: true,
      acceptsInsurance: true,
    },
    create: {
      id: "demo-doctor-cardio",
      userId: cardioUser.id,
      specialty: "Cardiology",
      licenseNumber: "OR-CARD-221904",
      bio: "Cardiologist for imaging coordination, preventive risk review, and fast access consults.",
      yearsExperience: 11,
      consultationFee: 320,
      availableSlots: makeAvailableSlots(["Tuesday", "Thursday", "Friday"]),
      rating: 4.8,
      totalReviews: 129,
      isVerified: true,
      acceptsInsurance: true,
    },
  })

  const appointments = [
    {
      id: "demo-appt-followup",
      patientId: patientProfile.id,
      doctorId: pcpProfile.id,
      scheduledAt: isoDays(5),
      duration: 30,
      status: "CONFIRMED",
      type: "Follow-up",
      reason: "Diabetes, blood pressure, and preventive screening review",
      notes: "Review A1C trend, shingles vaccine timing, and colonoscopy referral timing.",
      paymentAmount: 30,
    },
    {
      id: "demo-appt-cardiology",
      patientId: patientProfile.id,
      doctorId: cardioProfile.id,
      scheduledAt: isoDays(16),
      duration: 45,
      status: "PENDING",
      type: "Specialist Visit",
      reason: "Cardiology consult for exertional chest tightness and expedited imaging planning",
      notes: "Cardiology consult arranged after delayed MRI scheduling concern.",
      paymentAmount: 60,
    },
    {
      id: "demo-appt-wellness",
      patientId: patientProfile.id,
      doctorId: pcpProfile.id,
      scheduledAt: isoDays(-32),
      duration: 30,
      status: "COMPLETED",
      type: "Annual Wellness",
      reason: "Annual wellness visit and risk review",
      notes: "Labs ordered. Family history reviewed for hereditary cancer risk and cascade testing discussion.",
      paymentAmount: 0,
    },
  ]

  for (const appointment of appointments) {
    await prisma.appointment.upsert({
      where: { id: appointment.id },
      update: appointment,
      create: appointment,
    })
  }

  const prescriptions = [
    {
      id: "demo-rx-metformin",
      patientId: patientProfile.id,
      doctorId: pcpProfile.id,
      appointmentId: "demo-appt-wellness",
      status: "ACTIVE",
      diagnosis: "Type 2 Diabetes Mellitus",
      notes: "Take with meals. Maintain glucose log.",
      issuedAt: isoDays(-365),
      expiresAt: isoDays(180),
    },
    {
      id: "demo-rx-lisinopril",
      patientId: patientProfile.id,
      doctorId: pcpProfile.id,
      appointmentId: "demo-appt-wellness",
      status: "ACTIVE",
      diagnosis: "Hypertension",
      notes: "Monitor home blood pressure readings weekly.",
      issuedAt: isoDays(-300),
      expiresAt: isoDays(160),
    },
    {
      id: "demo-rx-atorvastatin",
      patientId: patientProfile.id,
      doctorId: pcpProfile.id,
      appointmentId: "demo-appt-wellness",
      status: "ACTIVE",
      diagnosis: "Hyperlipidemia",
      notes: "Repeat lipid panel in 3 months.",
      issuedAt: isoDays(-280),
      expiresAt: isoDays(150),
    },
    {
      id: "demo-rx-cetirizine",
      patientId: patientProfile.id,
      doctorId: pcpProfile.id,
      appointmentId: null,
      status: "ACTIVE",
      diagnosis: "Seasonal allergies",
      notes: "PRN for spring/fall symptoms.",
      issuedAt: isoDays(-180),
      expiresAt: isoDays(120),
    },
  ]

  for (const prescription of prescriptions) {
    await prisma.prescription.upsert({
      where: { id: prescription.id },
      update: prescription,
      create: prescription,
    })
  }

  const medications = [
    {
      id: "demo-med-metformin",
      prescriptionId: "demo-rx-metformin",
      name: "Metformin",
      dosage: "1000mg",
      frequency: "Twice daily with meals",
      duration: "Ongoing",
      instructions: "Take with breakfast and dinner.",
      quantity: 180,
      refills: 2,
    },
    {
      id: "demo-med-lisinopril",
      prescriptionId: "demo-rx-lisinopril",
      name: "Lisinopril",
      dosage: "10mg",
      frequency: "Once daily",
      duration: "Ongoing",
      instructions: "Take each morning.",
      quantity: 90,
      refills: 1,
    },
    {
      id: "demo-med-atorvastatin",
      prescriptionId: "demo-rx-atorvastatin",
      name: "Atorvastatin",
      dosage: "20mg",
      frequency: "Once daily at bedtime",
      duration: "Ongoing",
      instructions: "Bedtime dosing preferred.",
      quantity: 90,
      refills: 3,
    },
    {
      id: "demo-med-cetirizine",
      prescriptionId: "demo-rx-cetirizine",
      name: "Cetirizine",
      dosage: "10mg",
      frequency: "Once daily as needed",
      duration: "Seasonal",
      instructions: "Use during peak allergy periods.",
      quantity: 30,
      refills: 0,
    },
  ]

  for (const medication of medications) {
    await prisma.medication.upsert({
      where: { id: medication.id },
      update: medication,
      create: medication,
    })
  }

  const medicalRecords = [
    {
      id: "demo-record-condition-diabetes",
      patientId: patientProfile.id,
      title: "Type 2 Diabetes Mellitus",
      description: "Status: active",
      recordType: "condition",
      recordDate: new Date("2020-03-10T00:00:00.000Z"),
      attachments: [],
      metadata: { source: "demo_seed" },
    },
    {
      id: "demo-record-condition-hypertension",
      patientId: patientProfile.id,
      title: "Hypertension",
      description: "Status: active",
      recordType: "condition",
      recordDate: new Date("2019-08-15T00:00:00.000Z"),
      attachments: [],
      metadata: { source: "demo_seed" },
    },
    {
      id: "demo-record-condition-hyperlipidemia",
      patientId: patientProfile.id,
      title: "Hyperlipidemia",
      description: "Status: active",
      recordType: "condition",
      recordDate: new Date("2021-01-05T00:00:00.000Z"),
      attachments: [],
      metadata: { source: "demo_seed" },
    },
    {
      id: "demo-record-vax-flu",
      patientId: patientProfile.id,
      title: "Influenza",
      description: "2025 annual flu vaccine completed at CVS Pharmacy.",
      recordType: "vaccination",
      recordDate: isoDays(-150),
      attachments: [],
      metadata: { source: "demo_seed", brand: "Fluzone" },
    },
    {
      id: "demo-record-vax-covid",
      patientId: patientProfile.id,
      title: "COVID-19 Booster",
      description: "Moderna XBB.1.5 booster completed.",
      recordType: "vaccination",
      recordDate: isoDays(-180),
      attachments: [],
      metadata: { source: "demo_seed", brand: "Moderna XBB.1.5" },
    },
    {
      id: "demo-record-referral-cardio",
      patientId: patientProfile.id,
      title: "Dr. Michael Chen",
      description: "Cardiology referral for chest tightness, faster imaging access, and preventive risk review.",
      recordType: "referral",
      recordDate: isoDays(-7),
      attachments: [],
      metadata: { source: "demo_seed", urgency: "routine" },
    },
  ]

  for (const record of medicalRecords) {
    await prisma.medicalRecord.upsert({
      where: { id: record.id },
      update: record,
      create: record,
    })
  }

  const labResults = [
    {
      id: "demo-lab-a1c",
      patientId: patientProfile.id,
      testName: "Hemoglobin A1C",
      testDate: isoDays(-28),
      results: [{ name: "HbA1c", value: "6.8", unit: "%", reference_range: "<5.7 normal", flag: "normal" }],
      normalRange: { hba1c: "<5.7 normal" },
      isAbnormal: false,
      notes: "Well-controlled diabetes. Continue current regimen.",
      orderedBy: "Anita Patel",
    },
    {
      id: "demo-lab-cmp",
      patientId: patientProfile.id,
      testName: "Comprehensive Metabolic Panel",
      testDate: isoDays(-27),
      results: [
        { name: "Glucose", value: "118", unit: "mg/dL", reference_range: "70-99", flag: "high" },
        { name: "Creatinine", value: "0.9", unit: "mg/dL", reference_range: "0.6-1.2", flag: "normal" },
        { name: "ALT", value: "28", unit: "U/L", reference_range: "7-40", flag: "normal" },
      ],
      normalRange: { glucose: "70-99", creatinine: "0.6-1.2", alt: "7-40" },
      isAbnormal: true,
      notes: "Mild fasting glucose elevation consistent with known diabetes.",
      orderedBy: "Anita Patel",
    },
    {
      id: "demo-lab-lipids",
      patientId: patientProfile.id,
      testName: "Lipid Panel",
      testDate: isoDays(-27),
      results: [
        { name: "Total Cholesterol", value: "192", unit: "mg/dL", reference_range: "<200", flag: "normal" },
        { name: "LDL", value: "108", unit: "mg/dL", reference_range: "<100 optimal", flag: "high" },
        { name: "HDL", value: "52", unit: "mg/dL", reference_range: ">40", flag: "normal" },
      ],
      normalRange: { totalCholesterol: "<200", ldl: "<100", hdl: ">40" },
      isAbnormal: true,
      notes: "LDL remains slightly above goal; continue statin and recheck in 3 months.",
      orderedBy: "Anita Patel",
    },
  ]

  for (const lab of labResults) {
    await prisma.labResult.upsert({
      where: { id: lab.id },
      update: lab,
      create: lab,
    })
  }

  const vitals = [
    { id: "demo-vital-1", patientId: patientProfile.id, recordedAt: isoDays(-30), bloodPressure: "128/82", heartRate: 72, temperature: 36.9, oxygenSaturation: 98, weight: 74.4, height: 175, bmi: 24.3, notes: "Annual visit" },
    { id: "demo-vital-2", patientId: patientProfile.id, recordedAt: isoDays(-14), bloodPressure: "132/86", heartRate: 76, temperature: 36.8, oxygenSaturation: 98, weight: 74.0, height: 175, bmi: 24.1, notes: "Home monitor sync" },
    { id: "demo-vital-3", patientId: patientProfile.id, recordedAt: isoDays(-7), bloodPressure: "125/80", heartRate: 70, temperature: 36.7, oxygenSaturation: 99, weight: 73.7, height: 175, bmi: 24.0, notes: "Home monitor sync" },
    { id: "demo-vital-4", patientId: patientProfile.id, recordedAt: isoDays(-1), bloodPressure: "122/78", heartRate: 68, temperature: 36.6, oxygenSaturation: 99, weight: 73.7, height: 175, bmi: 24.0, notes: "Device capture" },
  ]

  for (const vital of vitals) {
    await prisma.vitalSign.upsert({
      where: { id: vital.id },
      update: vital,
      create: vital,
    })
  }

  const messages = [
    {
      id: "demo-message-doctor",
      senderId: pcpUser.id,
      receiverId: patientUser.id,
      content: "Hi Manoj — your latest labs are stable. We will review A1C, blood pressure, and colonoscopy timing at next week’s visit.",
      status: "READ",
      isEncrypted: true,
      attachments: [],
    },
    {
      id: "demo-message-rx",
      senderId: careTeamUser.id,
      receiverId: patientUser.id,
      content: "Reminder: your Lisinopril has 1 refill remaining. Maya can prepare the refill request before your follow-up.",
      status: "SENT",
      isEncrypted: true,
      attachments: [],
    },
    {
      id: "demo-message-imaging",
      senderId: careTeamUser.id,
      receiverId: patientUser.id,
      content: "Rex flagged the imaging delay and routed your cardiology consult to a center with faster MRI availability in Portland.",
      status: "SENT",
      isEncrypted: true,
      attachments: [],
    },
  ]

  for (const message of messages) {
    await prisma.message.upsert({
      where: { id: message.id },
      update: message,
      create: message,
    })
  }

  const notifications = [
    {
      id: "demo-notification-lab",
      userId: patientUser.id,
      type: "LAB_RESULT",
      title: "Lab review ready",
      message: "Your A1C and lipid panel are ready for review before the next visit.",
      isRead: false,
      metadata: { source: "demo_seed" },
    },
    {
      id: "demo-notification-billing",
      userId: patientUser.id,
      type: "GENERAL",
      title: "Billing issue flagged",
      message: "One imaging-related claim needs review. Vera prepared the appeal notes.",
      isRead: false,
      metadata: { source: "demo_seed" },
    },
  ]

  for (const notification of notifications) {
    await prisma.notification.upsert({
      where: { id: notification.id },
      update: notification,
      create: notification,
    })
  }

  const payments = [
    {
      id: "demo-payment-wellness",
      userId: patientUser.id,
      appointmentId: "demo-appt-wellness",
      amount: 275,
      currency: "USDC",
      status: "COMPLETED",
      transactionHash: "0xwellnessdemo000000000000000000000000000000000000000000000000000001",
      network: "base",
      fromAddress: walletAddress,
      toAddress: process.env.OPENRX_TREASURY_WALLET?.trim() || walletAddress,
      metadata: {
        cpt_codes: ["99396", "93000"],
        icd_codes: ["E11.9", "I10"],
        notes: "Annual preventive visit + EKG completed and paid.",
      },
    },
    {
      id: "demo-payment-imaging",
      userId: patientUser.id,
      appointmentId: "demo-appt-cardiology",
      amount: 185,
      currency: "USDC",
      status: "FAILED",
      transactionHash: "0ximagingdemo000000000000000000000000000000000000000000000000000001",
      network: "base",
      fromAddress: walletAddress,
      toAddress: process.env.OPENRX_TREASURY_WALLET?.trim() || walletAddress,
      metadata: {
        cpt_codes: ["75571"],
        icd_codes: ["R07.89", "I10"],
        notes: "Imaging workup failed verification and needs manual billing review.",
      },
    },
  ]

  for (const payment of payments) {
    await prisma.payment.upsert({
      where: { id: payment.id },
      update: payment,
      create: payment,
    })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        walletAddress,
        patientUserId: patientUser.id,
        patientProfileId: patientProfile.id,
        physicians: [pcpProfile.id, cardioProfile.id],
        appointments: appointments.length,
        prescriptions: prescriptions.length,
        labResults: labResults.length,
        vitals: vitals.length,
        messages: messages.length,
        payments: payments.length,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error("Failed to seed demo patient:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
