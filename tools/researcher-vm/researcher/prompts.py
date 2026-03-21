from __future__ import annotations

from pathlib import Path


PROMPT_DIR = Path("prompts")

PROMPT_FILES = {
    "master-committee": PROMPT_DIR / "master_committee.md",
    "tao-max-stack": PROMPT_DIR / "tao_max_stack.md",
    "sentiment-refresh": PROMPT_DIR / "sentiment_refresh.md",
    "weekly-style-review": PROMPT_DIR / "weekly_style_review.md",
    "post-trade-review": PROMPT_DIR / "post_trade_review.md",
}


def available_prompts() -> list[str]:
    return sorted(PROMPT_FILES)


def prompt_path(name: str) -> Path:
    try:
        return PROMPT_FILES[name]
    except KeyError as exc:
        choices = ", ".join(available_prompts())
        raise KeyError(f"Unknown prompt: {name}. Choose from {choices}.") from exc


def render_prompt(name: str) -> str:
    path = prompt_path(name)
    return path.read_text(encoding="utf-8")


def write_prompt(name: str, output_path: str | Path) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_prompt(name), encoding="utf-8")
    return path
