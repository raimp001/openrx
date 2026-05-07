export const hereditaryRiskPathways = {
  HEREDITARY: ["hereditary cancer risk"],
  BRCA: ["breast", "ovarian", "pancreatic", "prostate"],
  BRCA1: ["breast", "ovarian", "pancreatic", "prostate"],
  BRCA2: ["breast", "ovarian", "pancreatic", "prostate", "melanoma"],
  MLH1: ["colorectal", "endometrial", "ovarian", "gastric", "urinary_tract"],
  MSH2: ["colorectal", "endometrial", "ovarian", "gastric", "urinary_tract"],
  MSH6: ["colorectal", "endometrial", "ovarian"],
  PMS2: ["colorectal", "endometrial"],
  EPCAM: ["colorectal", "endometrial"],
  APC: ["colorectal"],
  MUTYH: ["colorectal"],
  PALB2: ["breast", "pancreatic"],
  ATM: ["breast", "pancreatic"],
  CHEK2: ["breast", "colorectal"],
  HOXB13: ["prostate"],
  TP53: ["breast", "sarcoma", "brain", "adrenal", "leukemia"],
  PTEN: ["breast", "thyroid", "endometrial", "colorectal", "renal"],
  STK11: ["colorectal", "pancreatic", "gastric", "breast", "gynecologic"],
  CDH1: ["gastric", "breast"],
} as const

export type HereditaryRiskGene = keyof typeof hereditaryRiskPathways

export function normalizeGene(value: string): HereditaryRiskGene | null {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (normalized in hereditaryRiskPathways) return normalized as HereditaryRiskGene
  if (normalized === "BRCAMUTATION" || normalized === "BRCACARRIER") return "BRCA"
  if (normalized === "LYNCH" || normalized === "LYNCHSYNDROME") return "MLH1"
  if (normalized === "FAP") return "APC"
  return null
}

const LYNCH_GENES: HereditaryRiskGene[] = ["MLH1", "MSH2", "MSH6", "PMS2", "EPCAM"]

export function getPathwaysForGenes(genes: string[]): string[] {
  const pathways = new Set<string>()
  for (const gene of genes) {
    const upper = gene.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (upper === "LYNCH" || upper === "LYNCHSYNDROME") {
      for (const lg of LYNCH_GENES) {
        hereditaryRiskPathways[lg].forEach((pathway) => pathways.add(pathway))
      }
      continue
    }
    const normalized = normalizeGene(gene)
    if (!normalized) continue
    hereditaryRiskPathways[normalized].forEach((pathway) => pathways.add(pathway))
  }
  return Array.from(pathways).sort()
}
