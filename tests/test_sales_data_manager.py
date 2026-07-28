from pathlib import Path
import unittest

import pandas as pd

from sales_data_manager import SalesDataManager


SAMPLE_PATH = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "sample-superstore.csv"
)


class SalesDataManagerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manager = SalesDataManager(SAMPLE_PATH)

    def test_loads_sample_and_derives_fulfillment_days(self):
        self.assertEqual(len(self.manager.df), 9_994)
        self.assertTrue(
            pd.api.types.is_datetime64_any_dtype(
                self.manager.df["Order Date"]
            )
        )
        self.assertEqual(self.manager.df.iloc[0]["Fulfillment Days"], 3)

    def test_filters_by_region_segment_category_and_date(self):
        filtered = self.manager.filter_data(
            region="West",
            category="Technology",
            segment="Consumer",
            start_date="2016-01-01",
            end_date="2016-12-31",
        )
        self.assertFalse(filtered.empty)
        self.assertEqual(set(filtered["Region"]), {"West"})
        self.assertEqual(set(filtered["Category"]), {"Technology"})
        self.assertEqual(set(filtered["Segment"]), {"Consumer"})
        self.assertGreaterEqual(
            filtered["Order Date"].min(),
            pd.Timestamp("2016-01-01"),
        )
        self.assertLessEqual(
            filtered["Order Date"].max(),
            pd.Timestamp("2016-12-31"),
        )

    def test_supports_all_analysis_workflows(self):
        performance = self.manager.performance_summary("Region")
        self.assertEqual(set(performance["Region"]), {
            "Central",
            "East",
            "South",
            "West",
        })
        self.assertTrue(
            (
                self.manager.flag_underperformers()["total_profit"] < 0
            ).all()
        )
        self.assertEqual(
            self.manager.discount_impact().iloc[0]["Discount"],
            0,
        )
        fulfillment = self.manager.fulfillment_analysis("Region")
        self.assertTrue(
            (
                fulfillment["max_fulfillment_days"]
                >= fulfillment["avg_fulfillment_days"]
            ).all()
        )


if __name__ == "__main__":
    unittest.main()
