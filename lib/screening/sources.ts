import type { GuidelineSource } from "./types"

export const guidelineSources: Record<string, GuidelineSource> = {
  "uspstf-crc-2021": {
    id: "uspstf-crc-2021",
    organization: "USPSTF",
    topic: "Colorectal cancer screening for average-risk adults",
    versionOrDate: "2021-05-18",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening",
    notes: "Average-risk adults 45-75; selective screening 76-85.",
  },
  "uspstf-breast-2024": {
    id: "uspstf-breast-2024",
    organization: "USPSTF",
    topic: "Breast cancer screening for average-risk people assigned female at birth",
    versionOrDate: "2024-04-30",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/breast-cancer-screening",
    notes: "Biennial mammography ages 40-74 for average-risk patients.",
  },
  "uspstf-cervical-2018": {
    id: "uspstf-cervical-2018",
    organization: "USPSTF",
    topic: "Cervical cancer screening",
    versionOrDate: "2018-08-21",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/cervical-cancer-screening",
    notes: "Cytology/HPV intervals ages 21-65 when cervix is present and average-risk.",
  },
  "uspstf-lung-2021": {
    id: "uspstf-lung-2021",
    organization: "USPSTF",
    topic: "Lung cancer screening",
    versionOrDate: "2021-03-09",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/lung-cancer-screening",
    notes: "Annual LDCT ages 50-80 with 20 pack-year history and current smoking or quit within 15 years.",
  },
  "uspstf-prostate-2018": {
    id: "uspstf-prostate-2018",
    organization: "USPSTF",
    topic: "Prostate cancer screening shared decision-making",
    versionOrDate: "2018-05-08",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/prostate-cancer-screening",
    notes: "Individual PSA-based screening decision ages 55-69; recommends against routine screening age 70+.",
  },
  "uspstf-brca-2019": {
    id: "uspstf-brca-2019",
    organization: "USPSTF",
    topic: "BRCA-related cancer risk assessment, counseling, and testing",
    versionOrDate: "2019-08-20",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/brca-related-cancer-risk-assessment-genetic-counseling-and-genetic-testing",
    notes: "Risk assessment and genetic counseling/testing when personal/family history suggests BRCA-related risk.",
  },
  "high-risk-clinician-review": {
    id: "high-risk-clinician-review",
    organization: "Clinician / genetics review",
    topic: "High-risk cancer screening and survivorship pathways",
    versionOrDate: "Pathway-specific",
    url: "https://www.nccn.org/guidelines/category_2",
    notes: "High-risk intervals depend on pedigree, prior findings, and genetics testing — refer to NCCN/ACG/USMSTF guidance and a specialist review rather than a generic interval.",
  },
}

export function getGuidelineSource(sourceId?: string) {
  return sourceId ? guidelineSources[sourceId] : undefined
}
