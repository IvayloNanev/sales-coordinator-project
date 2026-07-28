"""Run end-to-end SalesDataManager checks against the bundled real CSV."""

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sales_data_manager import SalesDataManager  # noqa: E402


def main() -> None:
    csv_path = ROOT / "data" / "sample-superstore.csv"
    manager = SalesDataManager(csv_path)

    filtered = manager.filter_data(
        region="West",
        start_date="2016-01-01",
        end_date="2016-12-31",
    )
    performance = manager.performance_summary("Region")
    underperformers = manager.flag_underperformers()
    discount_impact = manager.discount_impact()
    fulfillment = manager.fulfillment_analysis("Region")

    assert len(manager.df) == 9_994
    assert not filtered.empty
    assert set(filtered["Region"]) == {"West"}
    assert set(performance["Region"]) == {
        "Central",
        "East",
        "South",
        "West",
    }
    assert (underperformers["total_profit"] < 0).all()
    assert discount_impact.iloc[0]["Discount"] == 0
    assert manager.df["Fulfillment Days"].isna().sum() == 0
    assert (manager.df["Fulfillment Days"] < 0).sum() == 0
    assert manager.df["Fulfillment Days"].min() == 0
    assert manager.df["Fulfillment Days"].max() == 7

    print(f"Rows loaded: {len(manager.df):,}")
    print(f"West rows in 2016: {len(filtered):,}")
    print(f"Regions summarized: {len(performance)}")
    print(f"Underperforming products: {len(underperformers):,}")
    print(f"Discount levels analyzed: {len(discount_impact)}")
    print(
        "Average fulfillment range: "
        f"{fulfillment['avg_fulfillment_days'].min():.2f}–"
        f"{fulfillment['avg_fulfillment_days'].max():.2f} days"
    )
    print("Fulfillment NaN values: 0")
    print("Validation passed")


if __name__ == "__main__":
    main()
