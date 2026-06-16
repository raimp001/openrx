import OpenAI from "openai"

export type OpenAIClinicalMode =
  | "off"
  | "api_baa"
  | "chatgpt_for_clinicians"
  | "chatgpt_for_healthcare"

export interface OpenAIHealthcareConfig {
  apiKeyConfigured: boolean
  baaEnabled: boolean
  clinicalMode: OpenAIClinicalMode
  apiPhiAllowed: boolean
  clinicianModel: string
  disabledReason?: string
}

export interface ClinicalModelAvailability {
  anthropicConfigured: boolean
  liveModelConfigured: boolean
  providerLabel: string
  openai: OpenAIHealthcareConfig
}

const DEFAULT_OPENAI_CLINICIAN_MODEL = "gpt-4o-mini"

function truthy(value?: string): boolean {
  const normalized = value?.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

function normalizeClinicalMode(value: string | undefined, baaEnabled: boolean): OpenAIClinicalMode {
  const normalized = value?.trim().toLowerCase().replace(/-/g, "_")
  if (
    normalized === "api_baa" ||
    normalized === "chatgpt_for_clinicians" ||
    normalized === "chatgpt_for_healthcare" ||
    normalized === "off"
  ) {
    return normalized
  }

  // A signed OpenAI API BAA is the deployment switch for backend PHI use.
  // ChatGPT for Clinicians/Healthcare are separate ChatGPT workspace products.
  return baaEnabled ? "api_baa" : "off"
}

export function resolveOpenAIHealthcareConfig(
  env: Record<string, string | undefined> = process.env
): OpenAIHealthcareConfig {
  const apiKeyConfigured = Boolean(env.OPENAI_API_KEY?.trim())
  const baaEnabled = truthy(env.OPENRX_OPENAI_BAA_ENABLED) || truthy(env.OPENAI_BAA_ENABLED)
  const clinicalMode = normalizeClinicalMode(env.OPENRX_OPENAI_CLINICAL_MODE, baaEnabled)
  const apiPhiAllowed = apiKeyConfigured && baaEnabled && clinicalMode === "api_baa"
  const clinicianModel = env.OPENRX_OPENAI_CLINICIAN_MODEL?.trim() || DEFAULT_OPENAI_CLINICIAN_MODEL

  let disabledReason: string | undefined
  if (!apiKeyConfigured) {
    disabledReason = "OPENAI_API_KEY is not configured."
  } else if (!baaEnabled) {
    disabledReason = "OpenAI API key is present, but OPENRX_OPENAI_BAA_ENABLED is not true."
  } else if (clinicalMode !== "api_baa") {
    disabledReason = "Selected OpenAI clinical mode is a ChatGPT workspace product, not backend API PHI use."
  }

  return {
    apiKeyConfigured,
    baaEnabled,
    clinicalMode,
    apiPhiAllowed,
    clinicianModel,
    ...(disabledReason ? { disabledReason } : {}),
  }
}

export function createOpenAIClinicalClient(
  env: Record<string, string | undefined> = process.env
): OpenAI | null {
  const config = resolveOpenAIHealthcareConfig(env)
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (!config.apiPhiAllowed || !apiKey) return null
  return new OpenAI({ apiKey })
}

export function resolveClinicalModelAvailability(
  env: Record<string, string | undefined> = process.env
): ClinicalModelAvailability {
  const anthropicConfigured = Boolean(env.ANTHROPIC_API_KEY?.trim())
  const openai = resolveOpenAIHealthcareConfig(env)
  const liveModelConfigured = anthropicConfigured || openai.apiPhiAllowed
  const providerLabel = anthropicConfigured
    ? "Anthropic Claude"
    : openai.apiPhiAllowed
      ? `OpenAI API (${openai.clinicianModel}, BAA-gated)`
      : "not-configured"

  return {
    anthropicConfigured,
    liveModelConfigured,
    providerLabel,
    openai,
  }
}
