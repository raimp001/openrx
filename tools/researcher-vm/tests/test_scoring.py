import unittest

from researcher.scoring import DEFAULT_WEIGHTS, normalize_weights, rank_companies, score_company


class ScoringTests(unittest.TestCase):
    def test_normalize_weights_sums_to_one(self) -> None:
        normalized = normalize_weights(DEFAULT_WEIGHTS)
        self.assertAlmostEqual(sum(normalized.values()), 1.0)

    def test_missing_criteria_defaults_to_neutral(self) -> None:
        company = {
            "slug": "test",
            "name": "Test Co",
            "scorecard": {
                "leadership_resilience": {"score": 9, "evidence": "Strong founder."}
            },
        }

        scored = score_company(company)

        self.assertGreater(scored["weighted_score"], 0)
        self.assertIn("mission_clarity", scored["research_gaps"])
        self.assertEqual(scored["coverage"], 0.11)

    def test_rank_companies_orders_by_score(self) -> None:
        companies = [
            {
                "slug": "low",
                "name": "Low",
                "scorecard": {key: {"score": 3, "evidence": ""} for key in DEFAULT_WEIGHTS},
            },
            {
                "slug": "high",
                "name": "High",
                "scorecard": {key: {"score": 8, "evidence": ""} for key in DEFAULT_WEIGHTS},
            },
        ]

        ranked = rank_companies(companies)

        self.assertEqual(ranked[0]["slug"], "high")
        self.assertEqual(ranked[0]["rank"], 1)
        self.assertEqual(ranked[1]["rank"], 2)


if __name__ == "__main__":
    unittest.main()
