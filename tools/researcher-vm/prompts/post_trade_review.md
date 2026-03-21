# Post Trade Review Prompt

Review the last executed trade report and judge process quality.

Use:

- the latest file in `output/agent_trades/`
- `data/agent_watchlist.json`
- `data/sentiment_feed.json`
- the relevant company entry in `data/companies.json`

Questions to answer:

1. Was the chosen style appropriate for the regime?
2. Was sentiment fresh enough and directionally useful?
3. Did research quality actually support the trade?
4. Was sizing justified?
5. Did the state and risk agents help or just delay?
6. What exact config change would improve the next decision?

Output format:

- Trade summary
- What was correct
- What was weak
- What should change in config
- What should change in sentiment process
- Whether this trade should be repeated in the same conditions
