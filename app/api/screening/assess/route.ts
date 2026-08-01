import { canUseWalletScopedData, requestWalletProofMatches, requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import {
  assessHealthScreening,
  type ScreeningAssessment,
  type ScreeningFactor,
  type ScreeningInput,
  type ScreeningRecommendation,
} from "@/lib/basehealth"
import {
  buildGuidelineCitationsForRecommendations,
  buildScreeningEvidence,
  type ScreeningEvidenceCitation,
} from "@/lib/screening-evidence"
import type { ScreeningRecommendation as StructuredScreeningRecommendation } from "@/lib/screening/types"
import {
  CARE_SEARCH_PROMPT_ID,
  CARE_SEARCH_PROMPT_IMAGE_PATH,
  CARE_SEARCH_PROMPT_TEXT,
  buildPatientLocalCareQuery,
  searchNpiCareDirectory,
  type CareDirectoryMatch,
  type CareSearchType,
} from "@/lib/npi-care-search"
import { getLiveSnapshotByWallet } from "@/lib/live-data.server"
import { createEmptyLiveSnapshot } from "@/lib/live-data-types"
import { prisma } from "@/lib/db"
import { verifyScreeningAccess } from "@/lib/screening-access"
import { verifyAndRecordPayment } from "@/lib/payments-ledger"
import {
  X402_PAYMENT_HEADER,
  buildX402PaymentRequired,
  decodeXPaymentHeader,
} from "@/lib/x402"