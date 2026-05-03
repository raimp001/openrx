import { expect, test } from "@playwright/test"
import { assessHealthScreening } from "@/lib/basehealth"
import { parseCareSearchQuery } from "@/lib/npi-care-search"

test("screening engine surfaces age- and sex-appropriate prevention routes", () => {
  const femalePlan = assessHealthScreening({
    age: 58,
    gender: "female",
    bmi: 29,
    smoker: true,
    familyHistory: ["mother had breast cancer at age 44"],
  })
  const femaleNames = femalePlan.recommendedScreenings.map((item) => item.name)

  expect(femaleNames).toEqual(expect.arrayContaining([
    "Blood pressure screening",
    "Depression screening",
    "Hepatitis C screening",
    "HIV screening",
    "Prediabetes and type 2 diabetes screening",
    "Colorectal cancer screening",
    "Breast cancer screening mammogram",
    "Cervical cancer screening",
    "Low-dose CT lung cancer screening",
    "BRCA-related cancer risk assessment",
  ]))

  const malePlan = assessHealthScreening({
    age: 67,
    gender: "male",
    smoker: true,
  })
  const maleNames = malePlan.recommendedScreenings.map((item) => item.name)

  expect(maleNames).toContain("Abdominal aortic aneurysm ultrasound")
  expect(maleNames).toContain("Colorectal cancer screening")
})

test("care search parser routes screening studies to the right local service line", () => {
  const colonoscopy = parseCareSearchQuery("Find colonoscopy near Hillsboro OR")
  expect(colonoscopy.ready).toBe(true)
  expect(colonoscopy.serviceTypes).toContain("provider")
  expect(colonoscopy.specialty).toBe("Gastroenterology")

  const mammogram = parseCareSearchQuery("Find mammogram near Seattle WA")
  expect(mammogram.ready).toBe(true)
  expect(mammogram.serviceTypes).toContain("radiology")
  expect(mammogram.specialty).toBe("Radiology")

  const lab = parseCareSearchQuery("Find a lab near 98101")
  expect(lab.ready).toBe(true)
  expect(lab.serviceTypes).toContain("lab")
})

test("provider onboarding rejects ordering clinicians without regulatory attestations", async ({ request }) => {
  const response = await request.post("/api/admin/applications", {
    data: {
      role: "provider",
      fullName: "Launch Test Physician",
      email: "launch-provider@example.com",
      phone: "5035551010",
      npi: "1234567890",
      licenseNumber: "MD-12345",
      licenseState: "OR",
      orderingCertifyingStatus: "medicare-approved",
      specialtyOrRole: "Internal Medicine",
      servicesSummary: "Preventive care and screening orders.",
      city: "Hillsboro",
      state: "OR",
      zip: "97123",
    },
  })

  expect(response.status()).toBe(400)
  const payload = (await response.json()) as { error?: string }
  expect(payload.error?.toLowerCase()).toContain("attest")
})
