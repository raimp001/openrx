from __future__ import annotations

import unittest

from researcher.cli import build_parser


class TAOTraderEntrypointTests(unittest.TestCase):
    def test_parser_prog_can_be_branded_for_tao_trader(self) -> None:
        parser = build_parser(prog="tao-trader")
        self.assertEqual(parser.prog, "tao-trader")
