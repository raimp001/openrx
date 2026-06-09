import { expect, test } from "@playwright/test"
import { matchClinicalTrials } from "@/lib/basehealth"

const originalFetch = globalThis.fetch

test.afterEach(() => {
  globalThis.fetch = originalFetch
})

function study(overrides: Record<string, unknown>) {
  return {
    protocolSection: {
      identificationModule: {
        nctId: "NCT00000000",
        briefTitle: "Placeholder study",
      },
      statusModule: {
        overallStatus: "RECRUITING",
      },
      sponsorCollaboratorsModule: {
        leadSponsor: {
          name: "OpenRx Test Sponsor",
        },
      },
      conditionsModule: {
        conditions: ["General"],
      },
      descriptionModule: {
        briefSummary: "Placeholder summary.",
      },
      designModule: {
        phases: ["Phase 2"],
      },
      contactsLocationsModule: {
        locations: [
          {
            facility: "OpenRx Test Site",
            city: "Hillsboro",
            state: "Oregon",
            zip: "97123",
            country: "United States",
          },
        ],
      },
      eligibilityModule: {
        minimumAge: "18 Years",
        maximumAge: "80 Years",
        sex: "ALL",
      },
      ...overrides,
    },
  }
}

test("trial matching honors age, sex, and ZIP without overstating summary-only matches", async () => {
  const requestedUrls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrls.push(String(input))
    return new Response(
      JSON.stringify({
        studies: [
          study({
            identificationModule: {
              nctId: "NCTDIRECT0001",
              briefTitle: "Colorectal screening navigation study",
            },
            conditionsModule: {
              conditions: ["Non-small Cell Lung Cancer", "Colorectal Cancer"],
            },
          }),
          study({
            identificationModule: {
              nctId: "NCTFEMALE0001",
              briefTitle: "Colorectal prevention study for women",
            },
            conditionsModule: {
              conditions: ["Colorectal Cancer"],
            },
            eligibilityModule: {
              minimumAge: "18 Years",
              maximumAge: "80 Years",
              sex: "FEMALE",
            },
          }),
          study({
            identificationModule: {
              nctId: "NCTSUMMARY0001",
              briefTitle: "Advanced solid tumor study",
            },
            conditionsModule: {
              conditions: ["Non-small Cell Lung Cancer"],
            },
            descriptionModule: {
              briefSummary: "This basket study summary mentions colorectal cancer as one possible cohort.",
            },
          }),
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  }) as typeof fetch

  const matches = await matchClinicalTrials({
    condition: "colorectal cancer",
    age: 45,
    sex: "male",
    zip: "97123",
  })

  expect(requestedUrls[0]).toContain("query.locn=97123")
  expect(matches.map((match) => match.id)).toContain("NCTDIRECT0001")
  expect(matches.map((match) => match.id)).not.toContain("NCTFEMALE0001")

  const direct = matches.find((match) => match.id === "NCTDIRECT0001")
  expect(direct?.fit).toBe("strong")
  expect(direct?.condition).toBe("Colorectal Cancer")

  const summaryOnly = matches.find((match) => match.id === "NCTSUMMARY0001")
  expect(summaryOnly?.fit).toBe("possible")
  expect(summaryOnly?.condition).toBe("colorectal cancer")
  expect(summaryOnly?.reasons.join(" ")).not.toContain("Study focus matches")
})

test("trial matching labels broader candidates when no local study site is found", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes("query.locn=97123")) {
      return new Response(JSON.stringify({ studies: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({
        studies: [
          study({
            identificationModule: {
              nctId: "NCTBROAD0001",
              briefTitle: "Colorectal cancer treatment study",
            },
            conditionsModule: {
              conditions: ["Colorectal Cancer"],
            },
            contactsLocationsModule: {
              locations: [
                {
                  facility: "OpenRx Distant Site",
                  city: "Boston",
                  state: "Massachusetts",
                  zip: "02115",
                  country: "United States",
                },
              ],
            },
          }),
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  }) as typeof fetch

  const matches = await matchClinicalTrials({
    condition: "colorectal cancer",
    age: 45,
    sex: "male",
    zip: "97123",
  })

  expect(matches).toHaveLength(1)
  expect(matches[0].id).toBe("NCTBROAD0001")
  expect(matches[0].fit).toBe("possible")
  expect(matches[0].reasons.join(" ")).toContain("No recruiting study site matched")
})
