from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_snapshot() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def render_ranked_report(scored_companies: list[dict[str, Any]], universe_name: str) -> str:
    lines = [
        f"# {universe_name}",
        "",
        f"_Snapshot: {utc_snapshot()}_",
        "",
        "This report is a research ranking, not investment advice.",
        "",
        "| Rank | Company | Ticker | Score | Coverage | Conviction |",
        "| --- | --- | --- | --- | --- | --- |",
    ]

    for company in scored_companies:
        lines.append(
            "| {rank} | {name} | {ticker} | {score}/100 | {coverage}% | {conviction} |".format(
                rank=company["rank"],
                name=company["name"],
                ticker=company.get("ticker", "-"),
                score=company["weighted_score"],
                coverage=int(company["coverage"] * 100),
                conviction=company["conviction"],
            )
        )

    top_picks = scored_companies[: min(3, len(scored_companies))]
    if top_picks:
        lines.extend(["", "## Priority Names", ""])
        for company in top_picks:
            lines.extend(_render_company_summary(company))

    lines.extend(["", "## Research Gaps", ""])
    for company in scored_companies:
        if company["research_gaps"]:
            labels = ", ".join(company["research_gaps"])
            lines.append(f"- **{company['name']}**: missing evidence for `{labels}`.")
        else:
            lines.append(f"- **{company['name']}**: no missing rubric fields.")

    return "\n".join(lines) + "\n"


def render_company_brief(company: dict[str, Any]) -> str:
    lines = [
        f"# {company['name']} ({company.get('ticker', '-')})",
        "",
        f"_Snapshot: {utc_snapshot()}_",
        "",
        f"- Rank: {company['rank']}",
        f"- Score: {company['weighted_score']}/100",
        f"- Conviction: {company['conviction']}",
        f"- Coverage: {int(company['coverage'] * 100)}%",
        f"- Founders: {', '.join(company.get('founders', [])) or 'Unknown'}",
        f"- Tags: {', '.join(company.get('tags', [])) or 'None'}",
        "",
        "## Thesis",
        "",
        company.get("one_line_thesis", "No thesis recorded."),
        "",
        "## Why Now",
        "",
        company.get("why_now", "No timing note recorded."),
        "",
        "## Score Breakdown",
        "",
        "| Criterion | Score | Weight | Contribution | Evidence |",
        "| --- | --- | --- | --- | --- |",
    ]

    for item in company["breakdown"]:
        lines.append(
            "| {label} | {score:.1f}/10 | {weight:.0%} | {contribution:.1f} | {evidence} |".format(
                label=item["label"],
                score=item["score"],
                weight=item["weight"],
                contribution=item["contribution"],
                evidence=item["evidence"].replace("|", "/"),
            )
        )

    lines.extend(
        [
            "",
            "## Catalysts",
            "",
            *_bullet_lines(company.get("catalysts", [])),
            "",
            "## Red Flags",
            "",
            *_bullet_lines(company.get("red_flags", [])),
            "",
            "## Diligence Questions",
            "",
            *_bullet_lines(company.get("diligence_questions", [])),
            "",
        ]
    )

    if company["research_gaps"]:
        gaps = ", ".join(company["research_gaps"])
        lines.extend(
            [
                "## Research Gaps",
                "",
                f"- Missing evidence for: `{gaps}`",
                "",
            ]
        )

    return "\n".join(lines)


def write_report(path: str | Path, content: str) -> Path:
    report_path = Path(path)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(content, encoding="utf-8")
    return report_path


def note_template(company: dict[str, Any]) -> str:
    return "\n".join(
        [
            f"# Research Notes: {company['name']}",
            "",
            "## What changed this week?",
            "",
            "- ",
            "",
            "## Primary sources checked",
            "",
            "- Filings / shareholder letters:",
            "- Earnings / governance calls:",
            "- Product docs / protocol docs:",
            "- Regulatory / legal:",
            "",
            "## Evidence that strengthens the thesis",
            "",
            "- ",
            "",
            "## Evidence that weakens the thesis",
            "",
            "- ",
            "",
            "## What must be true in 12-24 months?",
            "",
            "- ",
            "",
            "## Next questions",
            "",
            "- ",
            "",
        ]
    )


def _render_company_summary(company: dict[str, Any]) -> list[str]:
    founders = ", ".join(company.get("founders", [])) or "Unknown"
    lines = [
        f"### {company['rank']}. {company['name']} ({company.get('ticker', '-')})",
        "",
        f"- Founders: {founders}",
        f"- Score: {company['weighted_score']}/100",
        f"- Thesis: {company.get('one_line_thesis', 'No thesis recorded.')}",
        "- Catalysts: "
        + ("; ".join(company.get("catalysts", [])[:3]) or "No catalysts recorded."),
        "- Red flags: "
        + ("; ".join(company.get("red_flags", [])[:3]) or "No red flags recorded."),
        "- Next diligence: "
        + ("; ".join(company.get("diligence_questions", [])[:3]) or "No next questions recorded."),
        "",
    ]
    return lines


def _bullet_lines(items: list[str]) -> list[str]:
    if not items:
        return ["- None recorded."]
    return [f"- {item}" for item in items]
