"""Standalone TAO Trader entrypoint."""

from researcher.cli import main as _main


def main() -> None:
    _main(prog="tao-trader", description="Standalone TAO trading and research app.")


__all__ = ["main"]
