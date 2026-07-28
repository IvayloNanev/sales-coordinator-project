# Sales Report Assistant

Sales Report Assistant is a local-first React application for consolidating weekly CSV files from multiple stores. It validates every row, identifies missing or invalid values and duplicate orders, excludes invalid records, calculates management metrics, and produces a printable weekly report.

Uploaded sales data is processed only in browser memory. It is not sent to a server or saved after the page is refreshed.

The reusable `SalesDataManager` in `lib/sales.js` supports six Superstore analysis
use cases: CSV loading, multi-field filtering, grouped performance summaries,
underperformer detection, discount-impact analysis, and order-to-ship fulfillment
analysis.

## Install and run

Requirements: Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal. To run the automated utility tests:

```bash
npm test
```

To create a production build:

```bash
npm run build
```

## Required CSV format

Each store file must include these columns:

```text
Date, Store ID, Store name, Order number, Customer name, Product,
Product category, Sales region, Quantity sold, Revenue
```

Column matching ignores capitalization and harmless extra whitespace. Values may use normal CSV quoting. Quantity must be positive, revenue must be zero or greater, and order numbers must be unique across every uploaded file.

## Try the sample files

The `sample-files/` folder contains files for Store 101, Store 102, and Store 103. Select July 6–10, 2026 as the reporting period and upload all three files together, or choose **Use all 3 samples** in the app. They intentionally demonstrate:

- Missing revenue
- Missing sales region
- Invalid quantity
- One order number duplicated across two files

After invalid rows are excluded, the verified sample report contains 25 orders, 99 units, and $21,030 in revenue.

## Workflow

1. Select the reporting period and upload one or more CSV files.
2. Review validation issues and either replace files or exclude invalid rows.
3. Exclude invalid rows and generate the weekly report.
4. Download the cleaned CSV when a corrected working file is useful.
5. Use the browser print dialog to print or save the report as a PDF.

## MVP boundaries

This version intentionally excludes authentication, databases, persistent storage, CRM integrations, email delivery, AI-generated analysis, team accounts, spreadsheet editing, and advanced settings. Reporting-period dates label the report but do not filter uploaded rows. Corrected files are replaced by returning to the upload step, removing the old file, and adding the corrected one.
