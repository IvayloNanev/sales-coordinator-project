import { useState } from "react";
import useChartReveal from "../hooks/useChartReveal";

const formatPeriod = (startDate, endDate) => {
  if (!startDate || !endDate) return "Waiting for valid dates";
  const format = (value) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  return `${format(startDate)} – ${format(endDate)}`;
};

const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

export default function ReportSetup({ startDate, endDate, files, validation, totalRecords, intakeAnalysis, report, isValidating, onFiles, onProduceResults }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingKaggle, setIsLoadingKaggle] = useState(false);
  const [kaggleError, setKaggleError] = useState("");
  const reviewVisible = Boolean(validation && !isValidating);
  const snapshotRevealRef = useChartReveal(reviewVisible);
  const coverageRevealRef = useChartReveal(reviewVisible);
  const filesReady = files.length > 0;
  const periodReady = Boolean(startDate && endDate && startDate <= endDate);
  const validationReady = Boolean(validation && validation.validRecords.length);
  const ready = filesReady && periodReady && validationReady && !isValidating;
  const usesLineItems = Boolean(validation?.validRecords.some((record) => record.lineItemId));
  const flaggedRows = validation
    ? new Set(validation.invalidRecords.map((record) => `${record.sourceFile}-${record.rowNumber}`)).size
    : 0;

  const addSelectedFiles = async (incoming) => {
    await onFiles(incoming);
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
      <section className="panel intake-upload" aria-labelledby="files-title">
        <div className="intake-heading">
          <p className="issue-line">Sales file automation</p>
          <h1 id="files-title">Turn sales files into<br /><em>validated weekly reports.</em></h1>
          <p>Combine multiple sources, catch incomplete or duplicate records, and generate a decision-ready performance report.</p>
        </div>
        <section className="file-guidance" aria-labelledby="file-guidance-title">
          <div className="file-guidance-head">
            <div><p className="section-number">File requirements</p><h2 id="file-guidance-title">Start with the expected sales schema.</h2></div>
          </div>
          <p><strong>Supported formats:</strong> CSV, Excel, JSON, TSV, pipe-delimited text, and table-based PDF.</p>
          <details>
            <summary>View 10 required columns <span aria-hidden="true">+</span></summary>
            <ul>
              {["Date", "Store ID", "Store name", "Order number", "Customer name", "Product", "Product category", "Sales region", "Quantity sold", "Revenue"].map((column) => <li key={column}>{column}</li>)}
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
      </section>

      {reviewVisible && <aside className="intake-status incoming-audit" aria-label="Automatic incoming data review">
          <section className={`data-review-card panel${flaggedRows ? " has-errors" : " all-clear"}`} aria-labelledby="data-review-title">
            <header className="data-review-head">
              <div><p className="section-number">01 / Intake</p><h2 id="data-review-title">{flaggedRows ? "Exceptions found" : "Weekly sales report is ready"}</h2><p>{flaggedRows ? "Flagged rows stay out of the report until corrected." : "Every received row passed the reporting checks and is ready to be included."}</p></div>
              <span className={`review-badge ${flaggedRows ? "warning" : "success"}`}>{flaggedRows ? `${flaggedRows} flagged` : "Passed"}</span>
            </header>

            <dl className="data-facts incoming-facts">
              <div><dt>Files</dt><dd>{files.length}</dd></div>
              <div><dt>Rows received</dt><dd>{totalRecords}</dd></div>
              <div><dt>Valid rows</dt><dd>{validation.validRecords.length}</dd></div>
              <div className={flaggedRows ? "fact-error" : ""}><dt>Flagged rows</dt><dd>{flaggedRows}</dd></div>
              <div className={validation.duplicateRecords ? "fact-warning" : ""}><dt>Duplicates</dt><dd>{validation.duplicateRecords}</dd></div>
              <div><dt>Date range</dt><dd className="fact-date">{formatPeriod(startDate, endDate)}</dd></div>
            </dl>

            <section className="incoming-sales-snapshot chart-reveal" ref={snapshotRevealRef} aria-labelledby="incoming-sales-title">
              <div className="incoming-section-head"><h3 id="incoming-sales-title">The week at a glance</h3><small>Valid rows</small></div>
              <dl><div><dt>Revenue</dt><dd>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(report.totalRevenue)}</dd></div><div><dt>Orders</dt><dd>{report.uniqueOrders}</dd></div><div><dt>Units</dt><dd>{report.totalUnits}</dd></div><div><dt>Customers</dt><dd>{report.customerCount}</dd></div><div><dt>Products</dt><dd>{report.products.length}</dd></div><div><dt>Stores / regions</dt><dd>{report.storeCount} / {report.regions.length}</dd></div></dl>
            </section>

            <div className="incoming-audit-grid">
              <section className="source-ledger" aria-labelledby="source-ledger-title">
                <div className="incoming-section-head"><h3 id="source-ledger-title">Sources</h3><small>{countLabel(intakeAnalysis.files.length, "file")}</small></div>
                <div className="table-wrap"><table><thead><tr><th>Source</th><th>Extracted</th><th>Valid</th><th>Orders</th><th>Revenue</th><th>Status</th></tr></thead><tbody>{intakeAnalysis.files.map((item, index) => <tr key={`${item.name}-${index}`}><td><span className="source-name"><b>{item.type}</b><span><strong>{item.name}</strong><small>{Math.max(1, Math.round(item.size / 1024))} KB · {item.startDate ? `${item.startDate}—${item.endDate}` : "No date range"}</small></span></span></td><td>{item.extractedRows}</td><td>{item.validRows}</td><td>{item.orders}</td><td>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(item.revenue)}</td><td><span className={`source-status ${item.issues ? "flag" : "pass"}`}>{item.issues ? countLabel(item.issues, "issue") : "Ready"}</span></td></tr>)}</tbody></table></div>
              </section>

              <section className="schema-audit chart-reveal" ref={coverageRevealRef} aria-labelledby="schema-audit-title">
                <div className="incoming-section-head"><h3 id="schema-audit-title">Field coverage</h3><small>{intakeAnalysis.coverage.filter((field) => field.present === field.total && field.total).length}/{intakeAnalysis.coverage.length} complete</small></div>
                <ul>{intakeAnalysis.coverage.map((field, index) => { const rate = field.total ? Math.round((field.present / field.total) * 100) : 0; return <li style={{ "--chart-index": index }} key={field.label}><div><span>{field.label}</span><strong className={rate < 100 ? "coverage-warning" : ""}>{rate}%</strong></div><div><i style={{ width: `${rate}%` }} /></div><small>{field.present} of {field.total} rows populated</small></li>; })}</ul>
              </section>
            </div>

            {flaggedRows ? (
              <details className="flagged-errors" open>
                <summary><span><b>!</b> Errors need attention</span><small>{validation.invalidRecords.length} {validation.invalidRecords.length === 1 ? "issue" : "issues"}</small></summary>
                <ul>{validation.invalidRecords.slice(0, 8).map((record, index) => <li key={`${record.sourceFile}-${record.rowNumber}-${record.error}-${index}`}><span><strong>{record.sourceFile}</strong><small>Row {record.rowNumber || "—"}{record.orderNumber ? ` · ${record.orderNumber}` : ""}</small></span><em>{record.error}</em></li>)}</ul>
                {validation.invalidRecords.length > 8 && <p>+ {validation.invalidRecords.length - 8} more issues will be excluded from results.</p>}
              </details>
            ) : (
              <div className="all-clear-strip"><span aria-hidden="true">✓</span><div><strong>No errors found</strong><small>Every row will be included in the report.</small></div></div>
            )}
            <section className="coordinator-readiness" aria-label="Sales coordinator readiness checks"><div><span className={startDate && endDate ? "pass" : "flag"}>{startDate && endDate ? "✓" : "!"}</span><p><strong>Reporting period</strong><small>{startDate && endDate ? "Dates detected and normalized" : "A valid date range is missing"}</small></p></div><div><span className={validation.duplicateRecords ? "flag" : "pass"}>{validation.duplicateRecords ? "!" : "✓"}</span><p><strong>{usesLineItems ? "Line-item identity" : "Order identity"}</strong><small>{validation.duplicateRecords ? `${countLabel(validation.duplicateRecords, usesLineItems ? "duplicate line item" : "duplicate order")} excluded; first valid occurrence kept` : usesLineItems ? "Line items are unique; repeated order IDs are grouped" : "Order numbers are unique"}</small></p></div><div><span className={report.customerCount ? "pass" : "flag"}>{report.customerCount ? "✓" : "!"}</span><p><strong>Customer records</strong><small>{report.customerCount ? `${countLabel(report.customerCount, "customer account")} detected` : "Customer name is required for every row"}</small></p></div><div><span className={validation.validRecords.length ? "pass" : "flag"}>{validation.validRecords.length ? "✓" : "!"}</span><p><strong>Report eligibility</strong><small>{validation.validRecords.length ? `${countLabel(validation.validRecords.length, "row")} will flow into results` : "No valid rows can be reported"}</small></p></div></section>
          </section>
        <button className="button full continue-button" type="button" disabled={!ready} onClick={onProduceResults}><span>Publish weekly report</span><span className="continue-button-icon" aria-hidden="true">→</span></button>
        {!ready && <p className="disabled-hint">Upload at least one file with a readable sales table and valid dated rows to continue.</p>}
      </aside>}
    </div>
  );
}
