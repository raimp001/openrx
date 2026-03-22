-- OpenRx manual runtime + ledger migration
-- Paste this file into the Supabase SQL editor and run it once.
-- This exists because the current Prisma pooler path is not reliably finishing `db:push`.

begin;

create table if not exists public.care_team_agents (
  "id" text not null,
  "name" text not null,
  "role" text not null,
  "status" text not null default 'running',
  "manualStatus" text not null default 'running',
  "unreadCount" integer not null default 0,
  "isCore" boolean not null default false,
  "createdAt" timestamptz(3) not null default now(),
  "updatedAt" timestamptz(3) not null default now(),
  constraint "care_team_agents_pkey" primary key ("id")
);

create index if not exists "care_team_agents_status_idx"
  on public.care_team_agents ("status");

create table if not exists public.care_team_requests (
  "id" text not null,
  "agentId" text not null,
  "agentName" text not null,
  "status" text not null,
  "createdAt" timestamptz(3) not null default now(),
  "updatedAt" timestamptz(3) not null default now(),
  "resolvedAt" timestamptz(3),
  "resolution" text,
  "resolutionNote" text,
  "context" jsonb not null,
  "encryptedContext" jsonb,
  constraint "care_team_requests_pkey" primary key ("id")
);

create index if not exists "care_team_requests_agentId_status_idx"
  on public.care_team_requests ("agentId", "status");

create index if not exists "care_team_requests_status_updatedAt_idx"
  on public.care_team_requests ("status", "updatedAt");

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'care_team_requests_agentId_fkey'
  ) then
    alter table public.care_team_requests
      add constraint "care_team_requests_agentId_fkey"
      foreign key ("agentId")
      references public.care_team_agents("id")
      on delete cascade
      on update cascade;
  end if;
end $$;

create table if not exists public.care_team_audit (
  "id" text not null,
  "requestId" text,
  "action" text not null,
  "actorRole" text not null,
  "actorUserIdHash" text not null,
  "metadataHash" text not null,
  "metadata" jsonb,
  "timestamp" timestamptz(3) not null default now(),
  constraint "care_team_audit_pkey" primary key ("id")
);

create index if not exists "care_team_audit_requestId_idx"
  on public.care_team_audit ("requestId");

create index if not exists "care_team_audit_timestamp_idx"
  on public.care_team_audit ("timestamp");

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'care_team_audit_requestId_fkey'
  ) then
    alter table public.care_team_audit
      add constraint "care_team_audit_requestId_fkey"
      foreign key ("requestId")
      references public.care_team_requests("id")
      on delete set null
      on update cascade;
  end if;
end $$;

create table if not exists public.care_team_rate_limits (
  "key" text not null,
  "startedAt" timestamptz(3) not null,
  "count" integer not null,
  "updatedAt" timestamptz(3) not null default now(),
  constraint "care_team_rate_limits_pkey" primary key ("key")
);

create table if not exists public.openclaw_cron_runs (
  "id" text not null,
  "jobId" text not null,
  "sessionId" text not null,
  "requestedByUserId" text,
  "requestedByRole" text not null,
  "authSource" text not null,
  "dryRun" boolean not null default false,
  "ok" boolean,
  "failureReason" text,
  "httpStatus" integer,
  "idempotencyKey" text,
  "walletAddress" text,
  "message" text not null,
  "triggeredAt" timestamptz(3) not null,
  "responsePayload" jsonb,
  "createdAt" timestamptz(3) not null default now(),
  constraint "openclaw_cron_runs_pkey" primary key ("id")
);

create index if not exists "openclaw_cron_runs_jobId_createdAt_idx"
  on public.openclaw_cron_runs ("jobId", "createdAt");

create index if not exists "openclaw_cron_runs_sessionId_idx"
  on public.openclaw_cron_runs ("sessionId");

create table if not exists public.openclaw_worker_heartbeats (
  "workerId" text not null,
  "workerType" text not null default 'researcher-vm',
  "status" text not null default 'running',
  "metadata" jsonb,
  "lastSeenAt" timestamptz(3) not null default now(),
  "createdAt" timestamptz(3) not null default now(),
  "updatedAt" timestamptz(3) not null default now(),
  constraint "openclaw_worker_heartbeats_pkey" primary key ("workerId")
);

create index if not exists "openclaw_worker_heartbeats_lastSeenAt_idx"
  on public.openclaw_worker_heartbeats ("lastSeenAt");

create table if not exists public.ledger_payments (
  "id" text not null,
  "intentId" text not null,
  "walletAddress" text not null,
  "senderAddress" text,
  "recipientAddress" text not null,
  "category" text not null,
  "description" text not null,
  "expectedAmount" text not null,
  "settledAmount" text,
  "currency" text not null default 'USDC',
  "txHash" text,
  "status" text not null,
  "verificationMessage" text,
  "metadata" jsonb,
  "createdAt" timestamptz(3) not null,
  "verifiedAt" timestamptz(3),
  "refundedAmount" text not null default '0.00',
  constraint "ledger_payments_pkey" primary key ("id")
);

create unique index if not exists "ledger_payments_intentId_key"
  on public.ledger_payments ("intentId");

create unique index if not exists "ledger_payments_txHash_key"
  on public.ledger_payments ("txHash");

create index if not exists "ledger_payments_walletAddress_createdAt_idx"
  on public.ledger_payments ("walletAddress", "createdAt");

create index if not exists "ledger_payments_status_createdAt_idx"
  on public.ledger_payments ("status", "createdAt");

create table if not exists public.ledger_receipts (
  "id" text not null,
  "receiptNumber" text not null,
  "paymentId" text,
  "refundId" text,
  "walletAddress" text not null,
  "kind" text not null,
  "amount" text not null,
  "currency" text not null default 'USDC',
  "txHash" text,
  "issuedAt" timestamptz(3) not null,
  "lineItems" jsonb not null,
  "complianceHash" text not null,
  "attestationId" text,
  constraint "ledger_receipts_pkey" primary key ("id")
);

create unique index if not exists "ledger_receipts_receiptNumber_key"
  on public.ledger_receipts ("receiptNumber");

create index if not exists "ledger_receipts_walletAddress_issuedAt_idx"
  on public.ledger_receipts ("walletAddress", "issuedAt");

create index if not exists "ledger_receipts_paymentId_idx"
  on public.ledger_receipts ("paymentId");

create index if not exists "ledger_receipts_refundId_idx"
  on public.ledger_receipts ("refundId");

create table if not exists public.ledger_attestations (
  "id" text not null,
  "schema" text not null,
  "subjectType" text not null,
  "subjectId" text not null,
  "attestor" text not null,
  "payloadHash" text not null,
  "payload" jsonb not null,
  "chainTxHash" text,
  "createdAt" timestamptz(3) not null,
  constraint "ledger_attestations_pkey" primary key ("id")
);

create index if not exists "ledger_attestations_subjectType_subjectId_idx"
  on public.ledger_attestations ("subjectType", "subjectId");

create index if not exists "ledger_attestations_createdAt_idx"
  on public.ledger_attestations ("createdAt");

create table if not exists public.ledger_refunds (
  "id" text not null,
  "paymentId" text not null,
  "walletAddress" text not null,
  "amount" text not null,
  "currency" text not null default 'USDC',
  "reason" text not null,
  "status" text not null,
  "requestedBy" text not null,
  "approvedBy" text,
  "txHash" text,
  "requestedAt" timestamptz(3) not null,
  "processedAt" timestamptz(3),
  "receiptId" text,
  "attestationId" text,
  constraint "ledger_refunds_pkey" primary key ("id")
);

create index if not exists "ledger_refunds_paymentId_idx"
  on public.ledger_refunds ("paymentId");

create index if not exists "ledger_refunds_walletAddress_requestedAt_idx"
  on public.ledger_refunds ("walletAddress", "requestedAt");

create index if not exists "ledger_refunds_status_requestedAt_idx"
  on public.ledger_refunds ("status", "requestedAt");

create table if not exists public.ledger_entries (
  "id" text not null,
  "eventType" text not null,
  "direction" text not null,
  "accountCode" text not null,
  "amount" text not null,
  "currency" text not null default 'USDC',
  "description" text not null,
  "paymentId" text,
  "refundId" text,
  "receiptId" text,
  "reference" text,
  "metadata" jsonb,
  "createdAt" timestamptz(3) not null,
  constraint "ledger_entries_pkey" primary key ("id")
);

create index if not exists "ledger_entries_createdAt_idx"
  on public.ledger_entries ("createdAt");

create index if not exists "ledger_entries_paymentId_idx"
  on public.ledger_entries ("paymentId");

create index if not exists "ledger_entries_refundId_idx"
  on public.ledger_entries ("refundId");

create index if not exists "ledger_entries_receiptId_idx"
  on public.ledger_entries ("receiptId");

create table if not exists public.treasury_actions (
  "id" text not null,
  "kind" text not null,
  "asset" text not null,
  "amount" text not null,
  "chain" text not null default 'base',
  "tokenAddress" text,
  "fromAddress" text not null,
  "toAddress" text not null,
  "initiatedBy" text not null,
  "reason" text not null,
  "status" text not null,
  "walletId" text,
  "transactionHash" text,
  "privyTransferId" text,
  "metadata" jsonb,
  "errorMessage" text,
  "createdAt" timestamptz(3) not null default now(),
  "updatedAt" timestamptz(3) not null default now(),
  constraint "treasury_actions_pkey" primary key ("id")
);

create index if not exists "treasury_actions_status_createdAt_idx"
  on public.treasury_actions ("status", "createdAt");

create index if not exists "treasury_actions_createdAt_idx"
  on public.treasury_actions ("createdAt");

commit;
