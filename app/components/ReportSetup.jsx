import { useEffect, useRef, useState } from "react";
import useChartReveal from "../hooks/useChartReveal";

const formatPeriod = (startDate, endDate) => {
  if (!startDate || !endDate) return "Waiting for valid dates";
  const format = (value) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  return `${format(startDate)} – ${format(endDate)}`;
};

const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
const EXPECTED_REGIONS = new Set(["East", "West", "Central", "South"]);
const EXPECTED_CATEGORIES = new Set(["Furniture", "Office Supplies", "Technology"]);
const CORE_REPORT_COLUMNS = new Set(["Order ID", "Order Date", "Customer Name", "Segment", "Product Name", "Category", "Region", "Quantity", "Sales", "Discount", "Profit"]);
const COLUMN_DETAILS = {
  "Row ID": "Unique identifier for one product line",
  "Order ID": "Order shared by one or more product lines",
  "Order Date": "Date the customer placed the order",
  "Ship Date": "Date the order line was shipped",
  "Ship Mode": "Selected shipping service level",
  "Customer ID": "Unique customer identifier",
  "Customer Name": "Customer’s full name",
  Segment: "Consumer, Corporate, or Home Office",
  Country: "Customer’s country",
  City: "Customer’s city",
  State: "Customer’s state",
  "Postal Code": "Customer’s ZIP code",
  Region: "East, West, Central, or South",
  "Product ID": "Unique product identifier",
  Category: "Furniture, Office Supplies, or Technology",
  "Sub-Category": "More specific product grouping",
  "Product Name": "Full product description",
  Sales: "Sales amount for the line item",
  Quantity: "Number of units sold",
  Discount: "Discount rate, where 0.20 means 20%",
  Profit: "Profit or loss for the line item",
};

const downloadTextFile = (name, content) => {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const comparableDate = (value) => {
  const text = String(value ?? "").trim();
  const usDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usDate) return `${usDate[3]}-${usDate[1].padStart(2, "0")}-${usDate[2].padStart(2, "0")}`;
  return text;
};

export default function ReportSetup({ startDate, endDate, files, validation, totalRecords, intakeAnalysis, report, isValidating, onFiles, onProduceResults }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingKaggle, setIsLoadingKaggle] = useState(false);
  const [kaggleError, setKaggleError] = useState("");
  const [isSourceEditing, setIsSourceEditing] = useState(false);
  const reviewVisible = Boolean(validation && !isValidating);
  const validationReportRef = useRef(null);
  const previousReviewVisible = useRef(false);
  const snapshotRevealRef = useChartReveal(reviewVisible);
  const filesReady = files.length > 0;
  const periodReady = Boolean(startDate && endDate && startDate <= endDate);
  const validationReady = Boolean(validation && validation.validRecords.length);
  const ready = filesReady && periodReady && validationReady && !isValidating;
  const records = validation?.validRecords ?? [];
  const primaryFile = intakeAnalysis.files[0] ?? { columnNames: [], previewRows: [] };
  const columnCount = Math.max(0, ...intakeAnalysis.files.map((file) => file.columnCount ?? 0));
  const flaggedRows = validation
    ? new Set(validation.invalidRecords.map((record) => `${record.sourceFile}-${record.rowNumber}`)).size
    : 0;
  const invalidShipDates = records.filter((record) => record.shipDate && record.date && comparableDate(record.shipDate) < comparableDate(record.date)).length;
  const unknownRegions = records.filter((record) => record.salesRegion && !EXPECTED_REGIONS.has(record.salesRegion)).length;
  const unknownCategories = records.filter((record) => record.productCategory && !EXPECTED_CATEGORIES.has(record.productCategory)).length;
  const unprofitableRows = records.filter((record) => Number(record.profit) < 0).length;
  const highDiscountRows = records.filter((record) => Number(record.discount) >= 0.4).length;
  const qualityChecks = [
    ["Order and ship dates", invalidShipDates, invalidShipDates ? `${countLabel(invalidShipDates, "row")} has a ship date before its order date` : "No ship dates occur before order dates"],
    ["Regions", unknownRegions, unknownRegions ? `${countLabel(unknownRegions, "row")} uses an unknown region` : "Only East, West, Central, and South are present"],
    ["Categories", unknownCategories, unknownCategories ? `${countLabel(unknownCategories, "row")} uses an unknown category` : "Only Furniture, Office Supplies, and Technology are present"],
    ["Duplicate line items", validation?.duplicateRecords ?? 0, validation?.duplicateRecords ? `${countLabel(validation.duplicateRecords, "duplicate")} excluded from reporting` : "No repeated line-item identifiers were found"],
  ];

  useEffect(() => {
    const justOpened = reviewVisible && !previousReviewVisible.current;
    previousReviewVisible.current = reviewVisible;
    if (!justOpened || !validationReportRef.current) return undefined;

    const timer = window.setTimeout(() => {
      const target = validationReportRef.current;
      if (!target) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const destination = window.scrollY + target.getBoundingClientRect().top - 84;
      if (reduceMotion) {
        window.scrollTo({ top: destination, behavior: "auto" });
        return;
      }

      const start = window.scrollY;
      const distance = destination - start;
      const duration = 900;
      const startedAt = window.performance.now();
      const guideToReport = (now) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        window.scrollTo(0, start + distance * eased);
        if (progress < 1) window.requestAnimationFrame(guideToReport);
      };
      window.requestAnimationFrame(guideToReport);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [reviewVisible]);

  const downloadValidationResults = () => {
    const rows = [
      ["Check", "Status", "Details"],
      ...qualityChecks.map(([label, count, detail]) => [label, count ? "Review" : "Passed", detail]),
      ["Unprofitable line items", "Business warning", `${unprofitableRows} rows should be reviewed in the report`],
      ["Discounts of 40% or more", "Business warning", `${highDiscountRows} rows should be reviewed for margin impact`],
    ];
    downloadTextFile("sales-data-validation.csv", rows.map((row) => row.map(csvCell).join(",")).join("\r\n"));
  };

  const addSelectedFiles = async (incoming) => {
    await onFiles(incoming);
    setIsSourceEditing(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    addSelectedFiles([...event.dataTransfer.files]);
  };

  const loadKaggleDataset = async () => {
    setIsLoadingKaggle(true);
    setKaggleError("");
    try {
      const response = await fetch("/sample-files/sample-superstore.csv");
      if (!response.ok) throw new Error(`Dataset request failed (${response.status})`);
      const dataset = new File(
        [await response.blob()],
        "kaggle-superstore.csv",
        { type: "text/csv" },
      );
      await addSelectedFiles([dataset]);
    } catch (error) {
      setKaggleError(error instanceof Error ? error.message : "Unable to load the Kaggle dataset");
    } finally {
      setIsLoadingKaggle(false);
    }
  };

  return (
    <div
      className={`intake-layout${reviewVisible ? " has-review" : ""}${isDragging ? " page-dragging" : ""}`}
      onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setIsDragging(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false); }}
      onDrop={handleDrop}
    >
      <section className={`panel intake-upload${reviewVisible && !isSourceEditing ? " validation-background" : ""}`} aria-labelledby="files-title">
        <div className="intake-upload-content" inert={reviewVisible && !isSourceEditing}>
        <div className="intake-heading">
          <p className="issue-line">Sales file automation</p>
          <h1 id="files-title">Turn sales files into<br /><em>validated weekly reports.</em></h1>
          <p>Combine multiple sources, catch incomplete or duplicate records, and generate a decision-ready performance report.</p>
        </div>
        <section className="file-guidance" aria-labelledby="file-guidance-title">
          <div className="file-guidance-head">
            <div><p className="section-number">File requirements</p><h2 id="file-guidance-title">Start with the expected sales schema.</h2></div>
          </div>
          <p><strong>Best formats:</strong> CSV or Excel exports from your order system.</p>
          <details>
            <summary>View Marcus’s reporting fields <span aria-hidden="true">+</span></summary>
            <ul>
              {["Order date", "Order ID", "Customer", "Segment", "Product", "Category", "Region", "Quantity", "Sales", "Discount", "Profit"].map((column) => <li key={column}>{column}</li>)}
            </ul>
          </details>
        </section>
        <label
          className={`drop-zone hero-drop-zone${isDragging ? " dragging" : ""}${filesReady ? " has-files" : ""}`}
        >
          <span className="upload-icon" aria-hidden="true">{isValidating ? "···" : filesReady ? "✓" : "⇧"}</span>
          <strong>{isDragging ? "Drop supported files here" : isValidating ? "Reading and validating…" : filesReady ? `${countLabel(files.length, "file")} ready` : "Drag & drop supported sales files"}</strong>
          <span>{filesReady ? "Drop more files or click to browse" : "or click to choose multiple files"}</span>
          <input type="file" multiple accept=".csv,.xlsx,.xls,.xlsm,.ods,.json,.tsv,.tab,.psv,.txt,.dat,.pdf" onChange={(event) => { addSelectedFiles([...event.target.files]); event.currentTarget.value = ""; }} />
        </label>
        <div className="sample-callout kaggle-callout">
          <div>
            <strong>Try the verified Kaggle Superstore dataset</strong>
            <p>Loads the bundled 9,994-row snapshot from vivek468/superstore-dataset-final.</p>
            {kaggleError && <p className="kaggle-error" role="alert">{kaggleError}</p>}
          </div>
          <div className="sample-actions">
            <button type="button" disabled={isLoadingKaggle || isValidating} onClick={loadKaggleDataset}>
              {isLoadingKaggle ? "Loading…" : "Load Kaggle dataset"}
            </button>
            <a href="https://www.kaggle.com/datasets/vivek468/superstore-dataset-final" target="_blank" rel="noreferrer" aria-label="View the Superstore dataset on Kaggle">Source</a>
          </div>
        </div>
        </div>
        {reviewVisible && !isSourceEditing && <div className="validation-source-overlay no-print"><span>Source validation complete</span></div>}
      </section>

      {reviewVisible && <aside ref={validationReportRef} className="intake-status incoming-audit" aria-label="Automatic incoming data review">
          <section className={`data-review-card panel${flaggedRows ? " has-errors" : " all-clear"}`} aria-labelledby="data-review-title">
            <header className="data-review-head">
              <div><p className="section-number">01 / Data validation</p><h2 id="data-review-title">{flaggedRows ? "Order-data exceptions found" : "Superstore order data is ready"}</h2><p>{flaggedRows ? "Rows with missing or invalid order values stay out of the report." : "The historical order records passed validation and are ready for weekly or monthly analysis."}</p></div>
              <span className={`review-badge ${flaggedRows ? "warning" : "success"}`}>{flaggedRows ? `${flaggedRows} flagged` : "Passed"}</span>
            </header>

            <section className="source-file-summary" aria-labelledby="source-file-summary-title">
              <div className="incoming-section-head"><h3 id="source-file-summary-title">{intakeAnalysis.files.length === 1 ? "Source file" : "Source files"}</h3><small>{countLabel(intakeAnalysis.files.length, "file")}</small></div>
              <ul>{intakeAnalysis.files.map((item, index) => <li key={`${item.name}-summary-${index}`}><span className="source-file-type">{item.type}</span><div><strong>{item.name}</strong><small>{Math.max(1, Math.round(item.size / 1024)).toLocaleString()} KB · {item.startDate ? `${formatPeriod(item.startDate, item.endDate)} coverage` : "No readable date coverage"}</small></div><span className={`source-status ${item.issues ? "flag" : "pass"}`}>{item.issues ? countLabel(item.issues, "issue") : "Ready"}</span></li>)}</ul>
            </section>

            <section className="dataset-contents" aria-labelledby="dataset-contents-title">
              <div className="dataset-contents-head">
                <div><p className="section-number">02 / File contents</p><h3 id="dataset-contents-title">What is inside the uploaded file?</h3><p>Each of the {totalRecords.toLocaleString()} rows represents one product line within an order. An Order ID can appear on multiple rows when a customer bought more than one product.</p></div>
                {flaggedRows ? <div className="file-error-summary has-errors"><span aria-hidden="true">!</span><p><strong>{countLabel(flaggedRows, "row error")}</strong><small>Flagged rows are listed below and excluded from reporting.</small></p></div> : null}
              </div>
              <div className="dataset-counts" aria-label="Dataset dimensions"><p><strong>{totalRecords.toLocaleString()}</strong><span>Data rows</span></p><p><strong>{columnCount}</strong><span>Named columns</span></p></div>
              <div className="column-dictionary">
                <div className="incoming-section-head"><h4>Column guide</h4><small>{primaryFile.columnNames.length} names found</small></div>
                <p className="audit-explainer">All 21 source columns are checked for missing values and expected formats. Core fields power Marcus’s weekly report; supporting fields add identifiers, geography, and shipping detail.</p>
                <div className="table-wrap"><table><thead><tr><th>#</th><th>Column name</th><th>Use</th><th>What it contains</th><th>Coverage & format</th><th>Example</th></tr></thead><tbody>{primaryFile.columnNames.map((column, index) => { const profile = primaryFile.columnProfiles?.[index] ?? { populated: 0, total: totalRecords, invalid: 0 }; const missing = profile.total - profile.populated; return <tr key={`${column}-${index}`}><td>{index + 1}</td><td><strong>{column}</strong></td><td><span className={`column-use ${CORE_REPORT_COLUMNS.has(column) ? "core" : "supporting"}`}>{CORE_REPORT_COLUMNS.has(column) ? "Core report" : "Supporting"}</span></td><td>{COLUMN_DETAILS[column] ?? "Additional source value"}</td><td><span className={`column-health ${missing || profile.invalid ? "review" : "pass"}`}>{missing || profile.invalid ? "Review" : "Complete"}</span><small>{profile.populated.toLocaleString()} of {profile.total.toLocaleString()} populated{profile.invalid ? ` · ${profile.invalid.toLocaleString()} invalid` : ""}</small></td><td>{primaryFile.previewRows[0]?.[index] || "—"}</td></tr>; })}</tbody></table></div>
              </div>
              <details className="row-preview">
                <summary><span>Preview the first {primaryFile.previewRows.length} data rows</span><small>Scroll sideways to inspect all {columnCount} columns +</small></summary>
                <div className="row-preview-controls"><p>This is a read-only preview of the uploaded source. Long product names may extend the table horizontally.</p><button className="row-preview-close" type="button" aria-label="Close data row preview" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}><span aria-hidden="true">×</span> Close</button></div>
                <div className="table-wrap"><table><thead><tr><th>Row</th>{primaryFile.columnNames.map((column, index) => <th key={`${column}-preview-${index}`}>{column}</th>)}</tr></thead><tbody>{primaryFile.previewRows.map((row, rowIndex) => <tr key={`preview-${rowIndex}`}><td>{rowIndex + 1}</td>{row.map((value, columnIndex) => <td key={`preview-${rowIndex}-${columnIndex}`}>{value || "—"}</td>)}</tr>)}</tbody></table></div>
              </details>
            </section>

            <section className="incoming-sales-snapshot chart-reveal" ref={snapshotRevealRef} aria-labelledby="incoming-sales-title">
              <div className="incoming-section-head"><div><h3 id="incoming-sales-title">Business snapshot</h3><p>Use these totals to confirm this is the dataset and reporting scope you expected.</p></div><small>All report-ready rows</small></div>
              <dl><div><dt>Revenue</dt><dd>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(report.totalRevenue)}</dd></div><div><dt>Orders</dt><dd>{report.uniqueOrders}</dd></div><div><dt>Units</dt><dd>{report.totalUnits}</dd></div><div><dt>Customers</dt><dd>{report.customerCount}</dd></div><div><dt>Products</dt><dd>{report.products.length}</dd></div><div><dt>Regions</dt><dd>{report.regions.length}</dd></div></dl>
            </section>

            {flaggedRows ? (
              <details className="flagged-errors" open>
                <summary><span><b>!</b> Errors need attention</span><small>{validation.invalidRecords.length} {validation.invalidRecords.length === 1 ? "issue" : "issues"}</small></summary>
                <ul>{validation.invalidRecords.slice(0, 8).map((record, index) => <li key={`${record.sourceFile}-${record.rowNumber}-${record.error}-${index}`}><span><strong>{record.sourceFile}</strong><small>Row {record.rowNumber || "—"}{record.orderNumber ? ` · ${record.orderNumber}` : ""}</small></span><em>{record.error}</em></li>)}</ul>
                {validation.invalidRecords.length > 8 && <p>+ {validation.invalidRecords.length - 8} more issues will be excluded from results.</p>}
              </details>
            ) : null}
            <section className="validation-detail-grid">
              <section className="quality-checks" aria-labelledby="quality-checks-title">
                <div className="incoming-section-head"><h3 id="quality-checks-title">Business-rule checks</h3><small>{qualityChecks.filter(([, count]) => !count).length}/{qualityChecks.length} passed</small></div>
                <p className="audit-explainer">These checks test relationships and business meaning across fields. Individual column completeness and format are covered in the Column guide.</p>
                <ul>{qualityChecks.map(([label, count, detail]) => <li key={label}><span className={count ? "flag" : "pass"}>{count ? "!" : "✓"}</span><p><strong>{label}</strong><small>{detail}</small></p></li>)}</ul>
                <div className="business-warnings">
                  <p><strong>{unprofitableRows.toLocaleString()} unprofitable line items</strong><span>Valid business results to investigate—not file errors.</span></p>
                  <p><strong>{highDiscountRows.toLocaleString()} line items discounted 40%+</strong><span>Review their effect on sales and margin in the report.</span></p>
                </div>
              </section>

              <section className="reporting-scope" aria-labelledby="reporting-scope-title">
                <div className="incoming-section-head"><h3 id="reporting-scope-title">Reporting scope</h3><small>Based on available columns</small></div>
                <p className="audit-explainer">This separates the questions Marcus can answer with this file from the operational information the source does not contain.</p>
                <div className="reporting-scope-grid">
                  <div className="reporting-readiness"><h4><span aria-hidden="true">✓</span> Supported</h4><ul>{["Weekly and monthly sales", "Prior-period comparisons", "Region and category performance", "Product and customer-segment analysis", "Discount impact on profit", "Order and shipping-time tracking"].map((item) => <li key={item}>{item}</li>)}</ul></div>
                  <div className="dataset-limitations"><h4><span aria-hidden="true">—</span> Not available</h4><ul>{["Order status, returns, or cancellations", "Inventory and stock levels", "Delivery dates or late-delivery flags", "Promotion or campaign names", "Sales representative ownership", "Issue notes and resolution status"].map((item) => <li key={item}>{item}</li>)}</ul></div>
                </div>
              </section>
            </section>
          </section>
        <div className="validation-actions no-print">
          <button className="button ghost" type="button" onClick={() => setIsSourceEditing(true)}>Change source file</button>
          <button className="button ghost" type="button" onClick={downloadValidationResults}>Download validation results</button>
          <button className="button full continue-button" type="button" disabled={!ready} onClick={onProduceResults}><span>Build sales report</span><span className="continue-button-icon" aria-hidden="true">→</span></button>
        </div>
        {!ready && <p className="disabled-hint">Upload at least one file with a readable sales table and valid dated rows to continue.</p>}
      </aside>}
    </div>
  );
}
