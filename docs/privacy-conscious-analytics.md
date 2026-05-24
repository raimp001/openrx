# Privacy-conscious workflow analytics

OpenRx records only workflow events needed to understand whether a user reached a useful next step.

## Allowed events

`chat_started`, `answer_generated`, `source_opened`, `screening_started`, `screening_completed`, `care_plan_created`, `provider_search_started`, `provider_saved`, `message_drafted`, `wallet_connected`, `tip_started`, `tip_completed`, `tip_failed`, and `red_flag_triggered`.

## Allowed metadata

Only `origin`, `surface`, `category`, `status`, `count`, `amount`, and `has_sources` may be persisted with an event. Events receive a session-scoped pseudonymous identifier.

## Excluded by design

Clinical free text, names, phone numbers, MRNs, insurance identifiers, Social Security numbers, wallet addresses, and full addresses are not accepted as event metadata. Care Plan demo storage remains local to the browser and should contain only concise action summaries.

## Wallet and chain boundary

Wallet connection is optional. Optional support payments may create a Base transaction, but OpenRx must not write prompts, clinical recommendations, or patient identifiers on-chain.
