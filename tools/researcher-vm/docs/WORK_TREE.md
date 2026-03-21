# Work Tree

The system works best when treated as an operator loop instead of a one-shot bot.

## Work Tree

```mermaid
flowchart TD
    A["Research Universe<br/>data/companies.json"] --> B["Score + Rank<br/>python -m researcher rank"]
    C["Sentiment Snapshot<br/>data/sentiment_feed.json"] --> D["Committee Scan<br/>python -m researcher agent-scan"]
    B --> D
    E["Venue State<br/>accounts + agent_state"] --> D
    D --> F["Select Best Style<br/>trend / breakout / mean_reversion / sentiment"]
    F --> G["Preview Order<br/>exchange preview"]
    G --> H["Paper or Live Trade<br/>agent-trade"]
    H --> I["Update Shared Position State"]
    I --> J["Post-Trade Review"]
    J --> K["Adjust Sentiment / Config / Research"]
    K --> A
    K --> C
```

## Operator Sequence

1. Refresh research only when thesis evidence changes.
2. Refresh sentiment whenever the market regime changes.
3. Run a scan before any trade.
4. Prefer the highest-edge style, not the style you happen to like.
5. Review the trade and feed the result back into config and sentiment.

## Missing Work Tree Pieces

- no automated daily sentiment refresh job
- no scheduled style review job
- no PnL feedback step that automatically adjusts confidence in each style
- no archive of old sentiment snapshots for regime comparison
