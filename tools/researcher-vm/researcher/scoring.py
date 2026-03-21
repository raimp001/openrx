from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

CRITERION_LABELS = {
    "leadership_resilience": "Leadership Resilience",
    "mission_clarity": "Mission Clarity",
    "moat": "Moat",
    "distribution": "Distribution",
    "market_tailwind": "Market Tailwind",
    "financial_strength": "Financial Strength",
    "regulatory_resilience": "Regulatory Resilience",
    "strategic_optionality": "Strategic Optionality",
    "timing": "Timing",
}

DEFAULT_WEIGHTS = {
    "leadership_resilience": 0.20,
    "mission_clarity": 0.10,
    "moat": 0.15,
    "distribution": 0.10,
    "market_tailwind": 0.15,
    "financial_strength": 0.10,
    "regulatory_resilience": 0.08,
    "strategic_optionality": 0.07,
    "timing": 0.05,
}


def load_json(path: str | Path) -> Any:
    file_path = Path(path)
    return json.loads(file_path.read_text(encoding="utf-8"))


def load_companies(path: str | Path) -> list[dict[str, Any]]:
    data = load_json(path)
    if not isinstance(data, list):
        raise ValueError("Company input must be a JSON array.")
    return data


def load_weights(path: str | Path | None = None) -> dict[str, float]:
    if path is None:
        return DEFAULT_WEIGHTS.copy()

    user_weights = load_json(path)
    if not isinstance(user_weights, Mapping):
        raise ValueError("Weights input must be a JSON object.")

    weights = DEFAULT_WEIGHTS.copy()
    for key, value in user_weights.items():
        if key in weights:
            weights[key] = float(value)
    return normalize_weights(weights)


def normalize_weights(weights: Mapping[str, float]) -> dict[str, float]:
    normalized = {}
    total = 0.0

    for key in DEFAULT_WEIGHTS:
        value = float(weights.get(key, DEFAULT_WEIGHTS[key]))
        if value < 0:
            raise ValueError(f"Weight for {key} must be non-negative.")
        normalized[key] = value
        total += value

    if total <= 0:
        raise ValueError("At least one weight must be positive.")

    return {key: value / total for key, value in normalized.items()}


def _coerce_score_entry(
    scorecard: Mapping[str, Any],
    criterion: str,
) -> dict[str, Any]:
    fallback = {
        "score": 5.0,
        "evidence": "No evidence recorded yet. Defaulted to neutral.",
        "defaulted": True,
    }
    entry = scorecard.get(criterion)

    if entry is None:
        return fallback

    if isinstance(entry, (int, float)):
        score = float(entry)
        evidence = ""
    elif isinstance(entry, Mapping):
        score = float(entry.get("score", 5))
        evidence = str(entry.get("evidence", "")).strip()
    else:
        raise ValueError(f"Unsupported score entry for {criterion}: {entry!r}")

    if not 0 <= score <= 10:
        raise ValueError(f"Score for {criterion} must be between 0 and 10.")

    return {
        "score": score,
        "evidence": evidence or "No evidence recorded yet.",
        "defaulted": False,
    }


def score_company(
    company: Mapping[str, Any],
    weights: Mapping[str, float] | None = None,
) -> dict[str, Any]:
    active_weights = normalize_weights(weights or DEFAULT_WEIGHTS)
    scorecard = company.get("scorecard", {})
    if not isinstance(scorecard, Mapping):
        raise ValueError(f"scorecard must be an object for {company.get('name', 'unknown')}.")

    breakdown = []
    defaulted = []
    raw_total = 0.0

    for criterion, weight in active_weights.items():
        entry = _coerce_score_entry(scorecard, criterion)
        contribution = entry["score"] * weight
        raw_total += contribution

        if entry["defaulted"]:
            defaulted.append(criterion)

        breakdown.append(
            {
                "criterion": criterion,
                "label": CRITERION_LABELS[criterion],
                "score": entry["score"],
                "weight": weight,
                "contribution": contribution * 10,
                "evidence": entry["evidence"],
                "defaulted": entry["defaulted"],
            }
        )

    weighted_score = round(raw_total * 10, 1)
    coverage = round((len(active_weights) - len(defaulted)) / len(active_weights), 2)

    return {
        **company,
        "weighted_score": weighted_score,
        "coverage": coverage,
        "conviction": conviction_label(weighted_score, coverage),
        "breakdown": breakdown,
        "research_gaps": defaulted,
    }


def conviction_label(weighted_score: float, coverage: float) -> str:
    if weighted_score >= 82 and coverage >= 0.78:
        return "High-conviction watch"
    if weighted_score >= 72:
        return "Active watch"
    if weighted_score >= 62:
        return "Speculative"
    return "Needs work"


def rank_companies(
    companies: list[Mapping[str, Any]],
    weights: Mapping[str, float] | None = None,
) -> list[dict[str, Any]]:
    scored = [score_company(company, weights) for company in companies]
    ranked = sorted(
        scored,
        key=lambda company: (
            company["weighted_score"],
            company["coverage"],
            _score_lookup(company, "leadership_resilience"),
        ),
        reverse=True,
    )

    for index, company in enumerate(ranked, start=1):
        company["rank"] = index
    return ranked


def find_company(companies: list[Mapping[str, Any]], slug: str) -> dict[str, Any]:
    for company in companies:
        if company.get("slug") == slug:
            return dict(company)
    raise KeyError(f"No company found for slug: {slug}")


def _score_lookup(company: Mapping[str, Any], criterion: str) -> float:
    for entry in company.get("breakdown", []):
        if entry["criterion"] == criterion:
            return float(entry["score"])
    return 0.0
