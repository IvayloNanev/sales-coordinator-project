"""Load, filter, and analyze Sample Superstore sales data with pandas."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd


class SalesDataManager:
    """Provide the six core sales-analysis workflows for a CSV dataset."""

    REQUIRED_COLUMNS = {
        "Order ID",
        "Order Date",
        "Ship Date",
        "Region",
        "Category",
        "Segment",
        "Product Name",
        "Sales",
        "Discount",
        "Profit",
    }

    def __init__(self, csv_path: str | Path):
        try:
            self.df = self._read_csv(csv_path, encoding="utf-8")
        except UnicodeDecodeError:
            self.df = self._read_csv(csv_path, encoding="windows-1252")
        self._validate_columns()
        self.df["Fulfillment Days"] = (
            self.df["Ship Date"] - self.df["Order Date"]
        ).dt.days

    @staticmethod
    def _read_csv(csv_path: str | Path, encoding: str) -> pd.DataFrame:
        return pd.read_csv(
            csv_path,
            encoding=encoding,
            parse_dates=["Order Date", "Ship Date"],
        )

    def _validate_columns(self) -> None:
        missing = sorted(self.REQUIRED_COLUMNS.difference(self.df.columns))
        if missing:
            raise ValueError(
                f"CSV is missing required columns: {', '.join(missing)}"
            )

    def filter_data(
        self,
        region: str | None = None,
        category: str | None = None,
        segment: str | None = None,
        start_date: Any | None = None,
        end_date: Any | None = None,
    ) -> pd.DataFrame:
        """Return rows matching the supplied categorical and date filters."""
        df = self.df.copy()

        if region:
            df = df[df["Region"] == region]
        if category:
            df = df[df["Category"] == category]
        if segment:
            df = df[df["Segment"] == segment]
        if start_date is not None:
            df = df[df["Order Date"] >= pd.to_datetime(start_date)]
        if end_date is not None:
            df = df[df["Order Date"] <= pd.to_datetime(end_date)]

        return df

    def performance_summary(
        self,
        group_by: str = "Region",
        data: pd.DataFrame | None = None,
    ) -> pd.DataFrame:
        """Summarize sales, profit, and distinct orders by a column."""
        df = self.df if data is None else data
        return (
            df.groupby(group_by, dropna=False)
            .agg(
                total_sales=("Sales", "sum"),
                total_profit=("Profit", "sum"),
                order_count=("Order ID", "nunique"),
            )
            .reset_index()
        )

    def flag_underperformers(
        self,
        group_by: str = "Product Name",
        threshold_profit: float = 0,
        data: pd.DataFrame | None = None,
    ) -> pd.DataFrame:
        """Return groups whose total profit falls below the threshold."""
        summary = self.performance_summary(group_by, data)
        return summary[summary["total_profit"] < threshold_profit]

    def discount_impact(
        self,
        data: pd.DataFrame | None = None,
    ) -> pd.DataFrame:
        """Measure sales and profit at each discount level."""
        df = self.df if data is None else data
        return (
            df.groupby("Discount", dropna=False)
            .agg(
                avg_profit=("Profit", "mean"),
                total_profit=("Profit", "sum"),
                total_sales=("Sales", "sum"),
                line_item_count=("Order ID", "size"),
            )
            .reset_index()
            .sort_values("Discount")
        )

    def fulfillment_analysis(
        self,
        group_by: str = "Region",
        data: pd.DataFrame | None = None,
    ) -> pd.DataFrame:
        """Summarize order-to-ship processing time by a column."""
        df = self.df if data is None else data
        return (
            df.groupby(group_by, dropna=False)
            .agg(
                avg_fulfillment_days=("Fulfillment Days", "mean"),
                max_fulfillment_days=("Fulfillment Days", "max"),
                order_count=("Order ID", "nunique"),
            )
            .reset_index()
        )
