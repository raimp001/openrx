# Machine Tree

This is the runtime decision tree and state machine behind the bot.

## Decision Tree

```mermaid
flowchart TD
    A["Inputs"] --> B["Research Agent"]
    A --> C["Sentiment Agent"]
    A --> D["Market Agent"]
    A --> E["Allocator Agent"]
    B --> F["Weighted Committee Score"]
    C --> F
    D --> F
    E --> F
    F --> G["Candidate Action<br/>BUY / HOLD / SELL"]
    G --> H["State Agent"]
    G --> I["Risk Agent"]
    H --> J["Final Action"]
    I --> J
    J --> K["Preview"]
    K --> L["Paper Order or Live Order"]
    L --> M["Shared Position State"]
```

## Runtime State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Scan: load data + scan watchlist
    Scan --> Select: rank styles by edge
    Select --> Hold: no actionable edge
    Select --> Preview: actionable edge
    Preview --> Hold: preview errors or risk block
    Preview --> ExecutePaper: paper mode
    Preview --> ExecuteLive: live mode + ack + env
    ExecutePaper --> UpdateState
    ExecuteLive --> UpdateState
    UpdateState --> Review
    Review --> Idle
    Hold --> Idle
```

## Machine Boundaries

- `scoring.py` decides thesis quality.
- `agents.py` decides style and action.
- `exchange.py` chooses the venue adapter.
- `coinbase.py` and `kraken.py` handle API specifics.
- `cli.py` is the operator entry point.

## Missing Machine Pieces

- no explicit backtest engine
- no style-performance memory
- no risk engine for stops, trailing exits, or drawdown halts
- no reconciliation job that compares expected vs actual exchange fills
- no websocket event loop for lower-latency execution
