export const hereditaryRiskPathways = {
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
  if (normalized === "LYNCH") return "MLH1"
  if (normalized === "FAP") return "APC"
  return null
}

export function getPathwaysForGenes(genes: string[]): string[] {
  const pathways = new Set<string>()
  for (const gene of genes) {
    const normalized = normalizeGene(gene)
    if (!normalized) continue
    hereditaryRiskPathways[normalized].forEach((pathway) => pathways.add(pathway))
  }
  return Array.from(pathways).sort()
}
