import { useEffect, useRef, useState } from "react";

const formatPeriod = (startDate, endDate) => {
  if (!startDate || !endDate) return "Waiting for valid dates";
  const format = (value) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  return `${format(startDate)} – ${format(endDate)}`;
};

const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
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

export default function ReportSetup({ startDate, endDate, files, validation, totalRecords, intakeAnalysis, isValidating, onFiles, onReplaceFiles, onProduceResults }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingKaggle, setIsLoadingKaggle] = useState(false);
  const [kaggleError, setKaggleError] = useState("");
  const [isSourceEditing, setIsSourceEditing] = useState(false);
  const [isBuildingReport, setIsBuildingReport] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isProcessingValidation, setIsProcessingValidation] = useState(false);
  const validationTitleRef = useRef(null);
  const reviewVisible = Boolean(validation && !isValidating);
  const filesReady = files.length > 0;
  const periodReady = Boolean(startDate && endDate && startDate <= endDate);
  const validationReady = Boolean(validation && validation.validRecords.length);
  const ready = filesReady && periodReady && validationReady && !isValidating;
  const records = validation?.validRecords ?? [];
  const isSalesScopeImport = records.length > 0 && records.every((record) => record.sourceProfile === "SalesScope");
  const primaryFile = intakeAnalysis.files[0] ?? { columnNames: [], previewRows: [] };
  const columnCount = Math.max(0, ...intakeAnalysis.files.map((file) => file.columnCount ?? 0));
  const flaggedRows = validation
    ? new Set(validation.invalidRecords.map((record) => `${record.sourceFile}-${record.rowNumber}`)).size
    : 0;
  const invalidShipDates = records.filter((record) => record.shipDate && record.date && comparableDate(record.shipDate) < comparableDate(record.date)).length;
  const unprofitableRows = records.filter((record) => Number(record.profit) < 0).length;
  const highDiscountRows = records.filter((record) => Number(record.discount) >= 0.4).length;
  const unknownRegions = validation?.dataWarnings?.filter((record) => record.error?.startsWith("Unknown sales region")).length ?? 0;
  const unknownCategories = validation?.dataWarnings?.filter((record) => record.error?.startsWith("Unknown product category")).length ?? 0;
  const optionalMeasureWarnings = validation?.dataWarnings?.length ?? 0;
  const qualityChecks = [
    ["Order and ship dates", invalidShipDates, invalidShipDates ? `${countLabel(invalidShipDates, "row")} has a ship date before its order date` : "No ship dates occur before order dates"],
    ["Regions", unknownRegions, unknownRegions ? `${countLabel(unknownRegions, "unknown value")} excluded` : `${validation?.normalizedRegions ?? 0} aliases normalized to HomePlus regions`],
    ["Categories", unknownCategories, unknownCategories ? `${countLabel(unknownCategories, "unknown value")} excluded` : `${validation?.normalizedCategories ?? 0} aliases normalized to HomePlus categories`],
    ["Duplicate line items", validation?.duplicateRecords ?? 0, validation?.duplicateRecords ? `${countLabel(validation.duplicateRecords, "duplicate")} excluded from reporting` : isSalesScopeImport ? "Repeated order IDs are resolved during import" : "No repeated line-item identifiers were found"],
  ];

  useEffect(() => {
    if (!reviewVisible) return;
    validationTitleRef.current?.focus({ preventScroll: true });
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

  const buildSalesReport = () => {
    if (!ready || isBuildingReport) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setIsBuildingReport(true);
    window.setTimeout(onProduceResults, 520);
  };

  const processSelectedFiles = async (incoming, replaceCurrent = isSourceEditing) => {
    if (!incoming.length || isProcessingValidation) return;
    const scrollTop = window.scrollY;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setIsProcessingValidation(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      await (replaceCurrent ? onReplaceFiles(incoming) : onFiles(incoming));
      setPendingFiles([]);
      setIsSourceEditing(false);
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: scrollTop, behavior: "auto" })));
    } finally {
      setIsProcessingValidation(false);
    }
  };

  const stageSelectedFiles = (incoming) => {
    const selected = incoming.filter((file) => file?.name);
    if (!selected.length) return;
    setPendingFiles((current) => {
      const base = isSourceEditing ? [] : current;
      return [...base, ...selected.filter((file) => !base.some((existing) => existing.name === file.name && existing.size === file.size))];
    });
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    stageSelectedFiles([...event.dataTransfer.files]);
  };

  const loadKaggleDataset = async () => {
    setIsLoadingKaggle(true);
    setIsProcessingValidation(true);
    setKaggleError("");
    try {
      const response = await fetch("/sample-files/sample-superstore.csv");
      if (!response.ok) throw new Error(`Dataset request failed (${response.status})`);
      const dataset = new File(
        [await response.blob()],
        "kaggle-superstore.csv",
        { type: "text/csv" },
      );
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      await (isSourceEditing ? onReplaceFiles([dataset]) : onFiles([dataset]));
      setPendingFiles([]);
      setIsSourceEditing(false);
    } catch (error) {
      setKaggleError(error instanceof Error ? error.message : "Unable to load the Kaggle dataset");
    } finally {
      setIsLoadingKaggle(false);
      setIsProcessingValidation(false);
    }
  };

  return (
    <div
      className={`intake-layout${reviewVisible ? " has-review" : ""}${isDragging ? " page-dragging" : ""}${isBuildingReport ? " report-transitioning" : ""}${isProcessingValidation ? " validation-processing" : ""}`}
      onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setIsDragging(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false); }}
      onDrop={handleDrop}
    >
      <section className={`panel intake-upload${reviewVisible && !isSourceEditing ? " source-complete-panel" : ""}`} aria-labelledby="files-title" aria-busy={isValidating}>
        {reviewVisible && !isSourceEditing ? (
          <div className="completed-source-summary">
            <div>
              <p className="section-number">Source complete</p>
              <h1 id="files-title">{countLabel(files.length, "file")} validated and ready</h1>
              <p>{totalRecords.toLocaleString()} rows checked · {formatPeriod(startDate, endDate)}</p>
            </div>
            <button className="button secondary" type="button" onClick={() => { setPendingFiles([]); setIsSourceEditing(true); }}>Replace source files</button>
          </div>
        ) : <div className="intake-upload-content">
        <div className="intake-heading">
          <p className="issue-line">Sales file automation</p>
          <h1 id="files-title">Turn sales <span className="headline-files">files</span> into <em>validated weekly reports.</em></h1>
          <p>Validate an export, catch reporting issues, and prepare Marcus’s manager-ready weekly numbers.</p>
        </div>
        <div className="upload-workspace">
          <div className="manual-upload-column">
            <label
              className={`drop-zone hero-drop-zone${isDragging ? " dragging" : ""}${pendingFiles.length ? " has-files" : ""}`}
            >
              <span className="upload-icon" aria-hidden="true">{pendingFiles.length ? "✓" : "⇧"}</span>
              <strong>{isDragging ? "Drop supported files here" : pendingFiles.length ? `${countLabel(pendingFiles.length, "file")} selected` : "Choose sales files"}</strong>
              <span>{pendingFiles.length ? pendingFiles.map((file) => file.name).join(", ") : "Drag and drop, or browse CSV, Excel, JSON, TSV, or experimental table-based PDF"}</span>
              <input type="file" multiple accept=".csv,.xlsx,.xls,.xlsm,.ods,.json,.tsv,.tab,.psv,.txt,.dat,.pdf" onChange={(event) => { stageSelectedFiles([...event.target.files]); event.currentTarget.value = ""; }} />
            </label>
            {pendingFiles.length > 0 && <button className="button primary validate-files-button" type="button" onClick={() => processSelectedFiles(pendingFiles)}>Validate data<span aria-hidden="true">→</span></button>}
          </div>
          <div className="upload-support">
            <div className="sample-callout kaggle-callout">
              <div>
                <span className="section-number">Need a sample?</span>
                <strong>Use the verified Superstore dataset</strong>
                {kaggleError && <p className="kaggle-error" role="alert">{kaggleError}</p>}
              </div>
              <div className="sample-actions">
                <button type="button" disabled={isLoadingKaggle || isValidating} onClick={loadKaggleDataset}>
                  {isLoadingKaggle ? "Loading…" : "Load sample"}
                </button>
                <a href="https://www.kaggle.com/datasets/vivek468/superstore-dataset-final" target="_blank" rel="noreferrer" aria-label="View the Superstore dataset on Kaggle">Source</a>
              </div>
            </div>
          </div>
        </div>
        </div>}
        {isValidating && <div className="local-processing-status" role="status"><span aria-hidden="true" />Reading dates and checking every row…</div>}
      </section>
      {isProcessingValidation && <div className="validation-processing-overlay" role="status" aria-live="assertive"><span aria-hidden="true" /><strong>Validation is being processed</strong><small>Checking dates, columns, and every sales row…</small></div>}

      {reviewVisible && <aside className={`intake-status incoming-audit${isBuildingReport ? " report-transitioning" : ""}`} aria-label="Automatic incoming data review">
          <section className={`data-review-card panel${flaggedRows ? " has-errors" : " all-clear"}`} aria-labelledby="data-review-title">
            <header className="data-review-head">
              <div><p className="section-number">Data validation</p><h2 id="data-review-title" ref={validationTitleRef} tabIndex="-1">{flaggedRows ? "Review the flagged rows" : "Sales data is ready"}</h2><p>{flaggedRows ? "Invalid rows will stay out of the report; valid rows can still be analyzed." : "The file passed validation and can be used for weekly or monthly reporting."}</p></div>
              <span className={`review-badge ${flaggedRows ? "warning" : "success"}`}>{flaggedRows ? `${flaggedRows} flagged` : "Passed"}</span>
            </header>

            <section className="validation-command" aria-label="Validation summary">
              <div className="validation-command-stats">
                <p><span>Status</span><strong className={flaggedRows ? "negative" : "positive"}>{flaggedRows ? "Review" : "Ready"}</strong></p>
                <p><span>Rows</span><strong>{totalRecords.toLocaleString()}</strong></p>
                <p><span>Columns</span><strong>{columnCount}</strong></p>
                <p><span>Errors</span><strong className={flaggedRows ? "negative" : ""}>{flaggedRows.toLocaleString()}</strong></p>
                <p><span>Date coverage</span><strong>{formatPeriod(startDate, endDate)}</strong></p>
              </div>
              <button className="button secondary compact-button validation-download-action no-print" type="button" onClick={downloadValidationResults}>Download validation results</button>
            </section>

            <details className="validation-disclosure source-file-summary">
              <summary><span>{intakeAnalysis.files.length === 1 ? "Source file" : "Source files"}</span><small>{countLabel(intakeAnalysis.files.length, "file")} · view details</small></summary>
              <ul>{intakeAnalysis.files.map((item, index) => <li key={`${item.name}-summary-${index}`}><span className="source-file-type">{item.type}</span><div><strong>{item.name}</strong><small>{Math.max(1, Math.round(item.size / 1024)).toLocaleString()} KB · {item.startDate ? `${formatPeriod(item.startDate, item.endDate)} coverage` : "No readable date coverage"}</small></div><span className={`source-status ${item.issues ? "flag" : "pass"}`}>{item.issues ? countLabel(item.issues, "issue") : "Ready"}</span></li>)}</ul>
            </details>

            <details className="validation-disclosure dataset-contents">
              <summary><span>Columns and sample data</span><small>{columnCount} columns · {primaryFile.previewRows.length} preview rows</small></summary>
              <div className="validation-disclosure-body">
              <div className="dataset-contents-head">
                <div><h3>What is inside the uploaded file?</h3><p>Each row represents one product line within an order. An Order ID can appear on multiple rows when a customer bought more than one product.</p></div>
                {flaggedRows ? <div className="file-error-summary has-errors"><span aria-hidden="true">!</span><p><strong>{countLabel(flaggedRows, "row error")}</strong><small>Flagged rows are listed below and excluded from reporting.</small></p></div> : null}
              </div>
              <div className="column-dictionary">
                <div className="incoming-section-head"><h4>Column guide</h4><small>{primaryFile.columnNames.length} names found</small></div>
                <p className="audit-explainer">Every source column is checked for missing values and expected formats. Core fields power Marcus’s report; supporting fields add identifiers, geography, and shipping detail.</p>
                <div className="table-wrap"><table><thead><tr><th>#</th><th>Column name</th><th>Use</th><th>What it contains</th><th>Coverage & format</th><th>Example</th></tr></thead><tbody>{primaryFile.columnNames.map((column, index) => { const profile = primaryFile.columnProfiles?.[index] ?? { populated: 0, total: totalRecords, invalid: 0 }; const missing = isSalesScopeImport ? 0 : profile.total - profile.populated; return <tr key={`${column}-${index}`}><td>{index + 1}</td><td><strong>{column}</strong></td><td><span className={`column-use ${CORE_REPORT_COLUMNS.has(column) ? "core" : "supporting"}`}>{CORE_REPORT_COLUMNS.has(column) ? "Core report" : "Supporting"}</span></td><td>{COLUMN_DETAILS[column] ?? "Additional source value"}</td><td><span className={`column-health ${missing || profile.invalid ? "review" : "pass"}`}>{missing || profile.invalid ? "Review" : "Complete"}</span><small>{profile.populated.toLocaleString()} of {profile.total.toLocaleString()} populated{profile.invalid ? ` · ${profile.invalid.toLocaleString()} invalid` : ""}</small></td><td>{primaryFile.previewRows[0]?.[index] || "—"}</td></tr>; })}</tbody></table></div>
              </div>
              <details className="row-preview">
                <summary><span>Preview the first {primaryFile.previewRows.length} data rows</span><small>Scroll sideways to inspect all {columnCount} columns</small></summary>
                <div className="row-preview-controls"><p>This is a read-only preview of the uploaded source. Long product names may extend the table horizontally.</p><button className="row-preview-close" type="button" aria-label="Close data row preview" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}><span aria-hidden="true">×</span> Close</button></div>
                <div className="table-wrap"><table><thead><tr><th>Row</th>{primaryFile.columnNames.map((column, index) => <th key={`${column}-preview-${index}`}>{column}</th>)}</tr></thead><tbody>{primaryFile.previewRows.map((row, rowIndex) => <tr key={`preview-${rowIndex}`}><td>{rowIndex + 1}</td>{row.map((value, columnIndex) => <td key={`preview-${rowIndex}-${columnIndex}`}>{value || "—"}</td>)}</tr>)}</tbody></table></div>
              </details>
              </div>
            </details>

            {flaggedRows ? (
              <details className="flagged-errors" open>
                <summary><span><b>!</b> Errors need attention</span><small>{validation.invalidRecords.length} {validation.invalidRecords.length === 1 ? "issue" : "issues"}</small></summary>
                <ul>{validation.invalidRecords.slice(0, 8).map((record, index) => <li key={`${record.sourceFile}-${record.rowNumber}-${record.error}-${index}`}><span><strong>{record.sourceFile}</strong><small>Row {record.rowNumber || "—"}{record.orderNumber ? ` · ${record.orderNumber}` : ""}</small></span><em>{record.error}</em></li>)}</ul>
                {validation.invalidRecords.length > 8 && <p>+ {validation.invalidRecords.length - 8} more issues will be excluded from results.</p>}
              </details>
            ) : null}
            <div className="validation-detail-grid">
              <details className="validation-disclosure quality-checks">
                <summary><span>Business-rule checks</span><small>{qualityChecks.filter(([, count]) => !count).length}/{qualityChecks.length} passed</small></summary>
                <div className="validation-disclosure-body">
                <p className="audit-explainer">These checks test relationships and business meaning across fields. Individual column completeness and format are covered in the Column guide.</p>
                <ul>{qualityChecks.map(([label, count, detail]) => <li key={label}><span className={count ? "flag" : "pass"}>{count ? "!" : "✓"}</span><p><strong>{label}</strong><small>{detail}</small></p></li>)}</ul>
              <div className="business-warnings">
                  <p><strong>{unprofitableRows.toLocaleString()} unprofitable line items</strong><span>Valid business results to investigate—not file errors.</span></p>
                  <p><strong>{highDiscountRows.toLocaleString()} line items discounted 40%+</strong><span>Review their effect on sales and margin in the report.</span></p>
                  <p><strong>{optionalMeasureWarnings.toLocaleString()} optional-value warnings</strong><span>Invalid profit or discount values are excluded from those analyses, never treated as zero.</span></p>
                </div>
                </div>
              </details>

              <details className="validation-disclosure reporting-scope">
                <summary><span>Reporting scope</span><small>Supported questions and source limitations</small></summary>
                <div className="validation-disclosure-body">
                <p className="audit-explainer">This separates the questions Marcus can answer with this file from the operational information the source does not contain.</p>
                <div className="reporting-scope-grid">
                  <div className="reporting-readiness"><h4><span aria-hidden="true">✓</span> Supported</h4><ul>{["Weekly and monthly sales", "Prior-period comparisons", "Region and category performance", "Product and customer-segment analysis", "Discount impact on profit", "Order and shipping-time tracking"].map((item) => <li key={item}>{item}</li>)}</ul></div>
                  <div className="dataset-limitations"><h4><span aria-hidden="true">—</span> Not available</h4><ul>{["Order status, returns, or cancellations", "Inventory and stock levels", "Delivery dates or late-delivery flags", "Promotion or campaign names", "Sales representative ownership", "Issue notes and resolution status"].map((item) => <li key={item}>{item}</li>)}</ul></div>
                </div>
                </div>
              </details>
            </div>
          </section>
        <div className="validation-actions no-print">
          <p>{ready ? "Validation is complete. Build the report from the valid rows reviewed above." : "Upload at least one file with a readable sales table and valid dated rows to continue."}</p>
          <button className="button primary validation-primary-action" type="button" aria-busy={isBuildingReport} disabled={!ready || isBuildingReport} onClick={buildSalesReport}>{isBuildingReport ? "Opening report…" : "Build sales report"}<span aria-hidden="true">→</span></button>
        </div>
        {isBuildingReport && <div className="report-build-overlay" role="status"><span>Preparing Marcus’s report…</span></div>}
      </aside>}
    </div>
  );
}
