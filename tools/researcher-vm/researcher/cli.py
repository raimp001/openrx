from __future__ import annotations

import argparse
import json
import sys
from dataclasses import replace
from pathlib import Path

from researcher.autopilot import (
    DEFAULT_TAO_AUTOPILOT_HEARTBEAT,
    DEFAULT_TAO_AUTOPILOT_JOURNAL,
    DEFAULT_TAO_AUTORESEARCH_DATASET,
    DEFAULT_TAO_AUTORESEARCH_OUTPUT_DIR,
    run_tao_autopilot,
)
from researcher.backtesting import DEFAULT_TAO_BACKTEST_DATASET, DEFAULT_TAO_BACKTEST_OUTPUT, run_tao_backtest
from researcher.dashboard import DEFAULT_TAO_DASHBOARD_OUTPUT, build_tao_dashboard
from researcher.agents import (
    DEFAULT_AGENT_WATCHLIST,
    DEFAULT_SENTIMENT_PATH,
    best_actionable_strategy,
    default_agent_state_path,
    load_agent_watchlist,
    run_agent_trade,
    scan_agent_watchlist,
    select_strategy,
    write_json_report,
)
from researcher.exchange import (
    SUPPORTED_EXCHANGES,
    ExchangeAPIError,
    ExchangeConfigurationError,
    create_exchange_client,
)
from researcher.improvement import (
    DEFAULT_TAO_IMPROVEMENT_OUTPUT_DIR,
    DEFAULT_TAO_IMPROVEMENT_REPORT,
    DEFAULT_TAO_IMPROVEMENT_STATE,
    PromotionPolicy,
    resolve_promoted_paper_config,
    run_tao_improvement_cycle,
)
from researcher.prompts import available_prompts, render_prompt, write_prompt
from researcher.reporting import note_template, render_company_brief, render_ranked_report, write_report
from researcher.scoring import find_company, load_companies, load_weights, rank_companies, score_company
from researcher.tao_bot import (
    DEFAULT_TAO_CONFIG,
    DEFAULT_TAO_OUTPUT_DIR,
    reconcile_tao_pending_order,
    default_tao_state_path,
    load_tao_bot_config,
    run_tao_bot,
    scan_tao_markets,
    set_tao_kill_switch,
)
from researcher.trading import DEFAULT_STRATEGY_PATH, LIVE_TRADING_ACK, load_strategy, run_trading_bot


DEFAULT_COMPANIES = Path("data/companies.json")
DEFAULT_WEIGHTS = Path("data/weights.json")
DEFAULT_RANK_OUTPUT = Path("output/ranked_watchlist.md")
DEFAULT_CLI_DESCRIPTION = "Founder and company research workflow."


def build_parser(*, prog: str = "researcher", description: str = DEFAULT_CLI_DESCRIPTION) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog=prog,
        description=description,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    rank_parser = subparsers.add_parser("rank", help="Rank the seeded watchlist.")
    rank_parser.add_argument("--input", type=Path, default=DEFAULT_COMPANIES)
    rank_parser.add_argument("--weights", type=Path, default=DEFAULT_WEIGHTS)
    rank_parser.add_argument("--output", type=Path, default=DEFAULT_RANK_OUTPUT)
    rank_parser.add_argument("--universe-name", default="Founder Research Watchlist")
    rank_parser.add_argument("--top", type=int, default=3)
    rank_parser.set_defaults(func=cmd_rank)

    brief_parser = subparsers.add_parser("brief", help="Write a single-company brief.")
    brief_parser.add_argument("slug")
    brief_parser.add_argument("--input", type=Path, default=DEFAULT_COMPANIES)
    brief_parser.add_argument("--weights", type=Path, default=DEFAULT_WEIGHTS)
    brief_parser.add_argument("--output-dir", type=Path, default=Path("output"))
    brief_parser.set_defaults(func=cmd_brief)

    template_parser = subparsers.add_parser("init-note", help="Create a research note template.")
    template_parser.add_argument("slug")
    template_parser.add_argument("--input", type=Path, default=DEFAULT_COMPANIES)
    template_parser.add_argument("--output-dir", type=Path, default=Path("notes"))
    template_parser.add_argument("--force", action="store_true")
    template_parser.set_defaults(func=cmd_init_note)

    prompt_parser = subparsers.add_parser("prompt", help="Print or write one of the operator prompt templates.")
    prompt_parser.add_argument("name", nargs="?", choices=available_prompts())
    prompt_parser.add_argument("--output", type=Path)
    prompt_parser.add_argument("--list", action="store_true")
    prompt_parser.set_defaults(func=cmd_prompt)

    accounts_parser = subparsers.add_parser("accounts", help="List exchange trading accounts.")
    accounts_parser.add_argument("--exchange", choices=SUPPORTED_EXCHANGES, default="coinbase")
    accounts_parser.add_argument("--limit", type=int, default=50)
    accounts_parser.add_argument("--json", action="store_true")
    accounts_parser.set_defaults(func=cmd_accounts)

    preview_parser = subparsers.add_parser("preview-order", help="Preview a market order on the selected exchange.")
    preview_parser.add_argument("--exchange", choices=SUPPORTED_EXCHANGES, default="coinbase")
    preview_parser.add_argument("--product", required=True)
    preview_parser.add_argument("--side", required=True, choices=["BUY", "SELL", "buy", "sell"])
    preview_parser.add_argument("--quote-size")
    preview_parser.add_argument("--base-size")
    preview_parser.add_argument("--retail-portfolio-id")
    preview_parser.set_defaults(func=cmd_preview_order)

    trade_parser = subparsers.add_parser("trade", help="Run the trading bot in paper or live mode.")
    trade_parser.add_argument("--config", type=Path, default=DEFAULT_STRATEGY_PATH)
    trade_parser.add_argument("--exchange", choices=SUPPORTED_EXCHANGES)
    trade_parser.add_argument("--mode", choices=["paper", "live"], default="paper")
    trade_parser.add_argument("--output-dir", type=Path, default=Path("output/trades"))
    trade_parser.add_argument("--live-ack", default="")
    trade_parser.set_defaults(func=cmd_trade)

    agent_scan_parser = subparsers.add_parser("agent-scan", help="Run the committee agents across the watchlist.")
    agent_scan_parser.add_argument("--config", type=Path, default=DEFAULT_AGENT_WATCHLIST)
    agent_scan_parser.add_argument("--input", type=Path, default=DEFAULT_COMPANIES)
    agent_scan_parser.add_argument("--weights", type=Path, default=DEFAULT_WEIGHTS)
    agent_scan_parser.add_argument("--output", type=Path, default=Path("output/agent_scan.json"))
    agent_scan_parser.add_argument("--state", type=Path)
    agent_scan_parser.add_argument("--sentiment", type=Path, default=DEFAULT_SENTIMENT_PATH)
    agent_scan_parser.add_argument("--json", action="store_true")
    agent_scan_parser.set_defaults(func=cmd_agent_scan)

    agent_trade_parser = subparsers.add_parser("agent-trade", help="Let the committee pick and trade a setup.")
    agent_trade_parser.add_argument("--config", type=Path, default=DEFAULT_AGENT_WATCHLIST)
    agent_trade_parser.add_argument("--input", type=Path, default=DEFAULT_COMPANIES)
    agent_trade_parser.add_argument("--weights", type=Path, default=DEFAULT_WEIGHTS)
    agent_trade_parser.add_argument("--strategy")
    agent_trade_parser.add_argument("--mode", choices=["paper", "live"], default="paper")
    agent_trade_parser.add_argument("--output-dir", type=Path, default=Path("output/agent_trades"))
    agent_trade_parser.add_argument("--state", type=Path)
    agent_trade_parser.add_argument("--sentiment", type=Path, default=DEFAULT_SENTIMENT_PATH)
    agent_trade_parser.add_argument("--live-ack", default="")
    agent_trade_parser.set_defaults(func=cmd_agent_trade)

    tao_scan_parser = subparsers.add_parser("tao-scan", help="Scan TAO on Coinbase and Kraken without placing trades.")
    tao_scan_parser.add_argument("--config", type=Path, default=DEFAULT_TAO_CONFIG)
    tao_scan_parser.add_argument("--exchange", choices=["auto", *SUPPORTED_EXCHANGES], default="auto")
    tao_scan_parser.add_argument("--runtime-db", type=Path)
    tao_scan_parser.add_argument("--state", type=Path)
    tao_scan_parser.add_argument("--output", type=Path, default=Path("output/tao_bot/tao_scan.json"))
    tao_scan_parser.add_argument("--json", action="store_true")
    tao_scan_parser.set_defaults(func=cmd_tao_scan)

    tao_trade_parser = subparsers.add_parser("tao-trade", help="Run the dedicated TAO swing bot.")
    tao_trade_parser.add_argument("--config", type=Path, default=DEFAULT_TAO_CONFIG)
    tao_trade_parser.add_argument("--exchange", choices=["auto", *SUPPORTED_EXCHANGES], default="auto")
    tao_trade_parser.add_argument("--mode", choices=["paper", "manual", "live"], default="paper")
    tao_trade_parser.add_argument("--output-dir", type=Path, default=DEFAULT_TAO_OUTPUT_DIR)
    tao_trade_parser.add_argument("--runtime-db", type=Path)
    tao_trade_parser.add_argument("--state", type=Path)
    tao_trade_parser.add_argument("--journal", type=Path)
    tao_trade_parser.add_argument("--improvement-state", type=Path, default=DEFAULT_TAO_IMPROVEMENT_STATE)
    tao_trade_parser.add_argument("--live-ack", default="")
    tao_trade_parser.set_defaults(func=cmd_tao_trade)

    tao_kill_parser = subparsers.add_parser("tao-kill-switch", help="Enable or disable the TAO bot kill switch.")
    tao_kill_parser.add_argument("--config", type=Path, default=DEFAULT_TAO_CONFIG)
    tao_kill_parser.add_argument("--mode", choices=["paper", "manual", "live"], default="paper")
    tao_kill_parser.add_argument("--runtime-db", type=Path)
    tao_kill_parser.add_argument("--state", type=Path)
    tao_kill_parser.add_argument("--disable", action="store_true")
    tao_kill_parser.add_argument("--reason", default="")
    tao_kill_parser.set_defaults(func=cmd_tao_kill_switch)

    tao_reconcile_parser = subparsers.add_parser("tao-reconcile", help="Reconcile a pending TAO order as filled or canceled.")
    tao_reconcile_parser.add_argument("--config", type=Path, default=DEFAULT_TAO_CONFIG)
    tao_reconcile_parser.add_argument("--mode", choices=["paper", "manual", "live"], default="manual")
    tao_reconcile_parser.add_argument("--runtime-db", type=Path)
    tao_reconcile_parser.add_argument("--state", type=Path)
    tao_reconcile_parser.add_argument("--journal", type=Path)
    tao_reconcile_parser.add_argument("--output-dir", type=Path, default=DEFAULT_TAO_OUTPUT_DIR)
    tao_reconcile_parser.add_argument("--status", choices=["filled", "canceled"], required=True)
    tao_reconcile_parser.add_argument("--fill-price")
    tao_reconcile_parser.add_argument("--filled-base-size")
    tao_reconcile_parser.add_argument("--note", default="")
    tao_reconcile_parser.set_defaults(func=cmd_tao_reconcile)

    tao_autopilot_parser = subparsers.add_parser(
        "tao-autopilot",
        help="Run the TAO bot in a persistent autonomous loop.",
    )
    tao_autopilot_parser.add_argument("--config", type=Path, default=DEFAULT_TAO_CONFIG)
    tao_autopilot_parser.add_argument("--exchange", choices=["auto", *SUPPORTED_EXCHANGES], default="auto")
    tao_autopilot_parser.add_argument("--mode", choices=["paper", "manual", "live"], default="paper")
    tao_autopilot_parser.add_argument("--output-dir", type=Path, default=DEFAULT_TAO_OUTPUT_DIR)
    tao_autopilot_parser.add_argument("--runtime-db", type=Path)
    tao_autopilot_parser.add_argument("--state", type=Path)
    tao_autopilot_parser.add_argument("--journal", type=Path)
    tao_autopilot_parser.add_argument("--heartbeat", type=Path, default=DEFAULT_TAO_AUTOPILOT_HEARTBEAT)
    tao_autopilot_parser.add_argument("--loop-journal", type=Path, default=DEFAULT_TAO_AUTOPILOT_JOURNAL)
    tao_autopilot_parser.add_argument("--interval-seconds", type=float, default=900.0)
    tao_autopilot_parser.add_argument("--pending-interval-seconds", type=float, default=60.0)
    tao_autopilot_parser.add_argument("--iterations", type=int)
    tao_autopilot_parser.add_argument("--live-ack", default="")
    tao_autopilot_parser.add_argument("--improvement-state", type=Path, default=DEFAULT_TAO_IMPROVEMENT_STATE)
    tao_autopilot_parser.add_argument("--enable-research", action="store_true")
    tao_autopilot_parser.add_argument("--research-dataset", type=Path, default=DEFAULT_TAO_AUTORESEARCH_DATASET)
    tao_autopilot_parser.add_argument("--research-output-dir", type=Path, default=DEFAULT_TAO_AUTORESEARCH_OUTPUT_DIR)
    tao_autopilot_parser.add_argument("--research-budget-seconds", type=float, default=300.0)
    tao_autopilot_parser.add_argument("--research-max-candidates", type=int, default=128)
    tao_autopilot_parser.add_argument("--research-seed", type=int, default=1337)
    tao_autopilot_parser.add_argument("--research-every", type=int, default=12)
    tao_autopilot_parser.set_defaults(func=cmd_tao_autopilot)

    tao_backtest_parser = subparsers.add_parser(
        "tao-backtest",
        help="Backtest the TAO strategy baseline or a tuned candidate against a candle dataset.",
    )
    tao_backtest_parser.add_argument("--config", type=Path, default=DEFAULT_TAO_CONFIG)
    tao_backtest_parser.add_argument("--dataset", type=Path, default=DEFAULT_TAO_BACKTEST_DATASET)
    tao_backtest_parser.add_argument("--candidate", type=Path)
    tao_backtest_parser.add_argument("--output", type=Path, default=DEFAULT_TAO_BACKTEST_OUTPUT)
    tao_backtest_parser.add_argument("--json", action="store_true")
    tao_backtest_parser.set_defaults(func=cmd_tao_backtest)

    tao_improve_parser = subparsers.add_parser(
        "tao-improve",
        help="Run a TAO strategy search, backtest it, and auto-promote winners to paper only.",
    )
    tao_improve_parser.add_argument("--config", type=Path, default=DEFAULT_TAO_CONFIG)
    tao_improve_parser.add_argument("--dataset", type=Path, default=DEFAULT_TAO_AUTORESEARCH_DATASET)
    tao_improve_parser.add_argument("--output-dir", type=Path, default=DEFAULT_TAO_IMPROVEMENT_OUTPUT_DIR)
    tao_improve_parser.add_argument("--report", type=Path, default=DEFAULT_TAO_IMPROVEMENT_REPORT)
    tao_improve_parser.add_argument("--state", type=Path, default=DEFAULT_TAO_IMPROVEMENT_STATE)
    tao_improve_parser.add_argument("--budget-seconds", type=float, default=300.0)
    tao_improve_parser.add_argument("--max-candidates", type=int, default=128)
    tao_improve_parser.add_argument("--seed", type=int, default=1337)
    tao_improve_parser.add_argument("--min-objective-delta", type=float, default=0.75)
    tao_improve_parser.add_argument("--min-return-pct", type=float, default=0.5)
    tao_improve_parser.add_argument("--min-trades", type=int, default=10)
    tao_improve_parser.add_argument("--max-drawdown-pct", type=float, default=8.0)
    tao_improve_parser.add_argument("--max-drawdown-regression-pct", type=float, default=1.0)
    tao_improve_parser.add_argument("--allow-flat-equity", action="store_true")
    tao_improve_parser.add_argument("--json", action="store_true")
    tao_improve_parser.set_defaults(func=cmd_tao_improve)

    tao_dashboard_parser = subparsers.add_parser(
        "tao-dashboard",
        help="Render a local HTML dashboard from TAO runtime, autopilot, and backtest data.",
    )
    tao_dashboard_parser.add_argument("--mode", choices=["paper", "manual", "live"], default="paper")
    tao_dashboard_parser.add_argument("--runtime-db", type=Path)
    tao_dashboard_parser.add_argument("--autopilot-db", type=Path)
    tao_dashboard_parser.add_argument("--backtest-report", type=Path, default=DEFAULT_TAO_BACKTEST_OUTPUT)
    tao_dashboard_parser.add_argument("--output", type=Path, default=DEFAULT_TAO_DASHBOARD_OUTPUT)
    tao_dashboard_parser.add_argument("--json", action="store_true")
    tao_dashboard_parser.set_defaults(func=cmd_tao_dashboard)

    return parser


def cmd_rank(args: argparse.Namespace) -> int:
    companies = load_companies(args.input)
    weights = load_weights(args.weights if args.weights.exists() else None)
    ranked = rank_companies(companies, weights)
    report = render_ranked_report(ranked, args.universe_name)
    report_path = write_report(args.output, report)

    print(f"Wrote {report_path}")
    for company in ranked[: args.top]:
        print(
            f"{company['rank']}. {company['name']} ({company.get('ticker', '-')}) "
            f"{company['weighted_score']}/100 [{company['conviction']}]"
        )
    return 0


def cmd_brief(args: argparse.Namespace) -> int:
    companies = load_companies(args.input)
    weights = load_weights(args.weights if args.weights.exists() else None)
    company = find_company(companies, args.slug)
    scored = score_company(company, weights)
    scored["rank"] = _rank_lookup(companies, weights, args.slug)
    report_path = args.output_dir / f"{args.slug}_brief.md"
    write_report(report_path, render_company_brief(scored))
    print(f"Wrote {report_path}")
    return 0


def cmd_init_note(args: argparse.Namespace) -> int:
    companies = load_companies(args.input)
    company = find_company(companies, args.slug)
    output_path = args.output_dir / f"{args.slug}.md"
    if output_path.exists() and not args.force:
        raise SystemExit(f"{output_path} already exists. Use --force to overwrite.")
    write_report(output_path, note_template(company))
    print(f"Wrote {output_path}")
    return 0


def cmd_prompt(args: argparse.Namespace) -> int:
    if args.list:
        for name in available_prompts():
            print(name)
        return 0
    if not args.name:
        raise SystemExit("Provide a prompt name or use --list.")
    if args.output is not None:
        path = write_prompt(args.name, args.output)
        print(f"Wrote {path}")
        return 0
    print(render_prompt(args.name))
    return 0


def cmd_accounts(args: argparse.Namespace) -> int:
    client = create_exchange_client(args.exchange)
    accounts = client.list_accounts(limit=args.limit)

    if args.json:
        print(json.dumps(accounts, indent=2, sort_keys=True))
        return 0

    for account in accounts.get("accounts", []):
        balance = account.get("available_balance", {})
        hold = account.get("hold", {})
        print(
            f"{account.get('currency', '-')}: available={balance.get('value', '0')} "
            f"hold={hold.get('value', '0')} type={account.get('type', '-')}"
        )
    return 0


def cmd_preview_order(args: argparse.Namespace) -> int:
    if not args.quote_size and not args.base_size:
        raise SystemExit("Provide --quote-size or --base-size.")
    client = create_exchange_client(args.exchange)
    preview = client.preview_market_order(
        args.product,
        args.side,
        quote_size=args.quote_size,
        base_size=args.base_size,
        retail_portfolio_id=args.retail_portfolio_id,
    )
    print(json.dumps(preview, indent=2, sort_keys=True))
    return 0


def cmd_trade(args: argparse.Namespace) -> int:
    strategy = load_strategy(args.config)
    if args.exchange:
        strategy = replace(strategy, exchange=args.exchange)
    client = create_exchange_client(strategy.exchange)
    report, path = run_trading_bot(
        client,
        strategy,
        mode=args.mode,
        output_dir=args.output_dir,
        live_ack=args.live_ack,
    )

    decision = report["decision"]
    print(f"Exchange: {report['exchange']}")
    print(f"Mode: {report['mode']}")
    print(f"Action: {decision['action']}")
    print(f"Reason: {decision['reason']}")
    print(f"Wrote {path}")
    if args.mode == "live":
        print("Live trading was enabled. Review the JSON report carefully.")
    else:
        print(f"Paper mode only. Use --mode live --live-ack {LIVE_TRADING_ACK} to submit real orders.")
    return 0


def cmd_agent_scan(args: argparse.Namespace) -> int:
    strategies = load_agent_watchlist(args.config)
    state_path = args.state or default_agent_state_path("paper")
    reports = scan_agent_watchlist(
        strategies,
        companies_path=args.input,
        weights_path=args.weights if args.weights.exists() else None,
        state_path=state_path,
        sentiment_path=args.sentiment,
    )

    write_json_report(args.output, reports)
    if args.json:
        print(json.dumps(reports, indent=2, sort_keys=True))
        print(f"Wrote {args.output}")
        return 0

    for report in reports:
        decision = report["decision"]
        print(
            f"{report['strategy']['name']} [{report['exchange']} {report['strategy']['style']}]: {decision['action']} "
            f"(edge={decision['edge_score']}, score={decision['total_score']}, confidence={decision['confidence']})"
        )
        print(f"  reason: {decision['reason']}")
    print(f"Wrote {args.output}")
    return 0


def cmd_agent_trade(args: argparse.Namespace) -> int:
    strategies = load_agent_watchlist(args.config)
    state_path = args.state or default_agent_state_path(args.mode)

    if args.strategy:
        strategy = select_strategy(strategies, args.strategy)
    else:
        reports = scan_agent_watchlist(
            strategies,
            companies_path=args.input,
            weights_path=args.weights if args.weights.exists() else None,
            state_path=state_path,
            sentiment_path=args.sentiment,
        )
        strategy = best_actionable_strategy(reports, strategies)

    report, path = run_agent_trade(
        strategy,
        companies_path=args.input,
        weights_path=args.weights if args.weights.exists() else None,
        mode=args.mode,
        output_dir=args.output_dir,
        live_ack=args.live_ack,
        state_path=state_path,
        sentiment_path=args.sentiment,
    )

    decision = report["decision"]
    print(f"Strategy: {report['strategy']['name']} ({report['exchange']} {report['product_id']})")
    print(f"Mode: {report['mode']}")
    print(f"Action: {decision['action']}")
    print(f"Reason: {decision['reason']}")
    print(f"Wrote {path}")
    if args.mode == "live":
        print("Live trading was enabled. Review the JSON report carefully.")
    else:
        print(f"Paper mode only. Use --mode live --live-ack {LIVE_TRADING_ACK} to submit real orders.")
    return 0


def cmd_tao_scan(args: argparse.Namespace) -> int:
    config = load_tao_bot_config(args.config)
    state_path = args.state or args.runtime_db or default_tao_state_path("paper")
    report = scan_tao_markets(
        config,
        exchange=args.exchange,
        state_path=state_path,
    )
    write_json_report(args.output, report)
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
        print(f"Wrote {args.output}")
        return 0

    print(f"Selected exchange: {report.get('selected_exchange') or '-'}")
    print(f"Selected action: {report.get('selected_action', 'HOLD')}")
    for venue in report["venues"]:
        print(
            f"{venue['exchange']}: {venue['action']} "
            f"(setup={venue.get('setup', 'none')}, score={venue.get('selection_score', '0')})"
        )
        print(f"  reason: {venue['reason']}")
    print(f"Wrote {args.output}")
    return 0


def cmd_tao_trade(args: argparse.Namespace) -> int:
    config = load_tao_bot_config(args.config)
    paper_candidate = None
    if args.mode == "paper":
        config, paper_candidate = resolve_promoted_paper_config(config, state_path=args.improvement_state)
    state_path = args.state or args.runtime_db or default_tao_state_path(args.mode)
    journal_path = args.journal or args.runtime_db
    report, path = run_tao_bot(
        config,
        mode=args.mode,
        output_dir=args.output_dir,
        state_path=state_path,
        journal_path=journal_path,
        exchange=args.exchange,
        live_ack=args.live_ack,
    )

    decision = report["decision"]
    print(f"Exchange: {report.get('exchange') or '-'}")
    print(f"Mode: {report['mode']}")
    if paper_candidate is not None:
        print(f"Paper strategy: promoted candidate ({paper_candidate.get('source')})")
    print(f"Action: {decision['action']}")
    print(f"Reason: {decision['reason']}")
    if args.mode in {"manual", "live"} and report.get("pending_order"):
        pending = report["pending_order"]
        print(f"Pending: {pending['phase']} ({pending['submission_mode']})")
    elif decision["action"] == "BUY":
        print(
            f"Entry: {decision['order']['entry_price']} stop={decision['order']['stop_price']} "
            f"tp1={decision['order']['take_profit_1']} tp2={decision['order']['take_profit_2']}"
        )
    elif decision["action"] == "SELL":
        print(f"Exit: {decision['exit_price']} ({decision['setup']})")
    print(f"Wrote {path}")
    if args.mode == "live":
        print("Live trading was enabled. Review the JSON report carefully.")
    elif args.mode == "manual":
        print("Manual mode only. Reconcile the pending order after you fill or cancel it.")
    else:
        print(f"Paper mode only. Use --mode live --live-ack {LIVE_TRADING_ACK} to submit real orders.")
    return 0


def cmd_tao_kill_switch(args: argparse.Namespace) -> int:
    config = load_tao_bot_config(args.config)
    state_path = args.state or args.runtime_db or default_tao_state_path(args.mode)
    state, path = set_tao_kill_switch(
        state_path,
        config,
        enabled=not args.disable,
        reason=args.reason,
    )
    print(f"Kill switch: {'enabled' if state['manual_kill_switch'] else 'disabled'}")
    print(f"Reason: {state['manual_kill_reason']}")
    print(f"Wrote {path}")
    return 0


def cmd_tao_reconcile(args: argparse.Namespace) -> int:
    config = load_tao_bot_config(args.config)
    state_path = args.state or args.runtime_db or default_tao_state_path(args.mode)
    journal_path = args.journal or args.runtime_db
    report, path = reconcile_tao_pending_order(
        state_path,
        config,
        status=args.status,
        fill_price=args.fill_price,
        filled_base_size=args.filled_base_size,
        journal_path=journal_path,
        output_dir=args.output_dir,
        note=args.note,
    )
    print(f"Status: {args.status}")
    print(f"Reason: {report['decision']['reason']}")
    print(f"Wrote {path}")
    return 0


def cmd_tao_autopilot(args: argparse.Namespace) -> int:
    config = load_tao_bot_config(args.config)
    state_path = args.state or args.runtime_db or default_tao_state_path(args.mode)
    journal_path = args.journal or args.runtime_db
    heartbeat_path = args.runtime_db or args.heartbeat
    loop_journal_path = args.runtime_db or args.loop_journal
    summary, path = run_tao_autopilot(
        config,
        mode=args.mode,
        output_dir=args.output_dir,
        state_path=state_path,
        journal_path=journal_path,
        exchange=args.exchange,
        live_ack=args.live_ack,
        improvement_state_path=args.improvement_state,
        interval_seconds=args.interval_seconds,
        pending_interval_seconds=args.pending_interval_seconds,
        iterations=args.iterations,
        heartbeat_path=heartbeat_path,
        loop_journal_path=loop_journal_path,
        enable_research=args.enable_research,
        research_dataset=args.research_dataset,
        research_output_dir=args.research_output_dir,
        research_budget_seconds=args.research_budget_seconds,
        research_max_candidates=args.research_max_candidates,
        research_seed=args.research_seed,
        research_every=args.research_every,
    )
    print(f"Status: {summary['status']}")
    print(f"Iterations: {summary['iterations_completed']}")
    if summary.get("last_trade_action"):
        print(f"Last action: {summary['last_trade_action']}")
        print(f"Reason: {summary.get('last_trade_reason') or '-'}")
    if summary.get("paper_candidate_source"):
        print(
            f"Paper strategy: {summary['paper_candidate_source']}"
            f" ({summary.get('paper_candidate_exchange') or 'n/a'})"
        )
    if summary.get("last_research"):
        research = summary["last_research"]
        print(f"Research: {research['status']}")
        if research["status"] == "completed":
            best_result = research.get("best_result", {})
            print(f"Objective: {best_result.get('objective_score', '-')}")
    if summary.get("last_error"):
        print(f"Last error: {summary['last_error']}")
    print(f"Wrote {path}")
    if args.iterations is None:
        print("Autopilot runs until interrupted. Use the TAO kill switch to block new entries.")
    return 0


def cmd_tao_backtest(args: argparse.Namespace) -> int:
    config = load_tao_bot_config(args.config)
    report, path = run_tao_backtest(
        config,
        dataset_path=args.dataset,
        output_path=args.output,
        candidate_path=args.candidate,
    )
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
        print(f"Wrote {path}")
        return 0

    selected = report["selected_result"]
    baseline = report["baseline_result"]
    delta = report["delta_vs_baseline"]
    print(f"Dataset: {report['dataset_exchange']} {report['product_id']}")
    print(f"Candidate: {report['selected_candidate_source']}")
    print(
        f"Selected ending equity: {selected['ending_equity']} "
        f"(return={selected['return_pct']}%, max_dd={selected['max_drawdown_pct']}%, trades={selected['trades']})"
    )
    if report["selected_candidate_source"] != "baseline":
        print(
            f"Baseline ending equity: {baseline['ending_equity']} "
            f"(return={baseline['return_pct']}%, max_dd={baseline['max_drawdown_pct']}%, trades={baseline['trades']})"
        )
        print(
            f"Delta vs baseline: equity={delta['ending_equity']} "
            f"objective={delta['objective_score']} drawdown={delta['max_drawdown_pct']}"
        )
    print(f"Wrote {path}")
    return 0


def cmd_tao_improve(args: argparse.Namespace) -> int:
    config = load_tao_bot_config(args.config)
    policy = PromotionPolicy(
        min_objective_delta=args.min_objective_delta,
        min_return_pct=args.min_return_pct,
        min_trades=args.min_trades,
        max_drawdown_pct=args.max_drawdown_pct,
        max_drawdown_regression_pct=args.max_drawdown_regression_pct,
        require_equity_improvement=not args.allow_flat_equity,
    )
    report, path = run_tao_improvement_cycle(
        config,
        dataset_path=args.dataset,
        output_dir=args.output_dir,
        report_path=args.report,
        state_path=args.state,
        budget_seconds=args.budget_seconds,
        max_candidates=args.max_candidates,
        seed=args.seed,
        policy=policy,
    )
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
        print(f"Wrote {path}")
        return 0

    print(f"Status: {report['status']}")
    if report["status"] == "completed":
        promotion = report["promotion"]
        print(f"Promotion: {'applied' if promotion['applied'] else 'rejected'}")
        print(f"Reason: {promotion['reason']}")
        print(
            f"Best result: equity={report['search_best_result']['ending_equity']} "
            f"return={report['search_best_result']['return_pct']}% "
            f"drawdown={report['search_best_result']['max_drawdown_pct']}% "
            f"trades={report['search_best_result']['trades']}"
        )
        active_candidate = report.get("active_paper_candidate")
        print(f"Active paper candidate: {'yes' if active_candidate else 'no'}")
    else:
        print(f"Error: {report.get('error') or 'unknown'}")
    print(f"Wrote {path}")
    return 0


def cmd_tao_dashboard(args: argparse.Namespace) -> int:
    autopilot_db = args.autopilot_db or args.runtime_db or DEFAULT_TAO_AUTOPILOT_HEARTBEAT
    summary, path = build_tao_dashboard(
        mode=args.mode,
        runtime_db=args.runtime_db,
        autopilot_db=autopilot_db,
        backtest_report=args.backtest_report,
        output_path=args.output,
    )
    if args.json:
        print(json.dumps(summary, indent=2, sort_keys=True))
        print(f"Wrote {path}")
        return 0

    print(f"Mode: {summary['mode']}")
    print(f"Equity: {summary['metrics']['equity']}")
    print(f"Pending: {summary['metrics']['pending_status']}")
    print(f"Recent events: {summary['metrics']['journal_events']}")
    print(f"Wrote {path}")
    return 0


def _rank_lookup(companies: list[dict], weights: dict[str, float], slug: str) -> int:
    ranked = rank_companies(companies, weights)
    for company in ranked:
        if company["slug"] == slug:
            return company["rank"]
    raise KeyError(f"No company found for slug: {slug}")


def main(argv: list[str] | None = None, *, prog: str | None = None, description: str = DEFAULT_CLI_DESCRIPTION) -> None:
    parser = build_parser(prog=prog or _default_prog(), description=description)
    args = parser.parse_args(argv)
    try:
        raise SystemExit(args.func(args))
    except (ExchangeAPIError, ExchangeConfigurationError, FileNotFoundError, ValueError) as exc:
        parser.exit(2, f"error: {exc}\n")


def _default_prog() -> str:
    argv0 = Path(sys.argv[0]).name
    if not argv0 or argv0 == "__main__.py":
        return "researcher"
    return argv0
