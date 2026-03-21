import tempfile
import unittest
from pathlib import Path

from researcher.prompts import available_prompts, render_prompt, write_prompt


class PromptTests(unittest.TestCase):
    def test_available_prompts_includes_master_committee(self) -> None:
        prompts = available_prompts()
        self.assertIn("master-committee", prompts)
        self.assertIn("tao-max-stack", prompts)
        self.assertIn("sentiment-refresh", prompts)

    def test_render_prompt_contains_repo_specific_instructions(self) -> None:
        prompt = render_prompt("master-committee")
        self.assertIn("data/agent_watchlist.json", prompt)
        self.assertIn("agent-scan", prompt)

    def test_tao_max_stack_prompt_enforces_spot_only_constraints(self) -> None:
        prompt = render_prompt("tao-max-stack")
        self.assertIn("Trade `TAO` spot only.", prompt)
        self.assertIn("No leverage.", prompt)
        self.assertIn("net TAO accumulated over time", prompt)

    def test_write_prompt_writes_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "master_committee.md"
            written = write_prompt("master-committee", output_path)
            self.assertEqual(written, output_path)
            self.assertTrue(output_path.exists())
            self.assertIn("portfolio committee", output_path.read_text(encoding="utf-8").lower())


if __name__ == "__main__":
    unittest.main()
