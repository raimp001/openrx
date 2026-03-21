# Sentiment Refresh Prompt

Update `data/sentiment_feed.json` for the current market.

Goal:

- produce a fresh, disciplined sentiment snapshot that the trading committee can actually use
- avoid vague tone words; score concrete drivers
- distinguish macro regime, product-specific sentiment, and thesis-level conviction

Use this structure:

1. `market.crypto`
2. `products.<PRODUCT-ID>`
3. `research_slugs.<slug>`

For each entry provide:

- `sentiment_score` on a scale from `-3` to `3`
- `confidence` from `0` to `1`
- `updated_at_utc`
- `signals`
- `summary`

Scoring rules:

- `3`: extremely constructive
- `2`: clearly constructive
- `1`: mildly constructive
- `0`: mixed or neutral
- `-1`: mildly negative
- `-2`: clearly negative
- `-3`: highly stressed or broken

Signals to consider:

- price structure
- flows / ETF / exchange demand
- social / developer / community momentum
- regulation / legal pressure
- founder / leadership execution
- product launches
- macro liquidity

Output contract:

- show the exact JSON patch or replacement
- list 3 facts driving the score
- list 2 reasons the score could be wrong
- say which strategies should benefit: `trend`, `breakout`, `mean_reversion`, `sentiment`
