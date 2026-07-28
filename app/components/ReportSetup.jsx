import { useEffect, useRef, useState } from "react";
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
  const [isSourceEditing, setIsSourceEditing] = useState(false);
  const validationPageRef = useRef(null);
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

  useEffect(() => {
    if (!reviewVisible || isSourceEditing) return undefined;
    const timer = window.setTimeout(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      validationPageRef.current?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [reviewVisible, isSourceEditing]);

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
          <h1 id="files-title">Turn sales files into<br /><em>validated performance reports.</em></h1>
          <p>Drop in sales-related files from different systems, catch incomplete or duplicate records, and generate a decision-ready performance report.</p>
        </div>
        <section className="file-guidance" aria-labelledby="file-guidance-title">
          <div className="file-guidance-head">
            <div><p className="section-number">File requirements</p><h2 id="file-guidance-title">Start with the expected sales schema.</h2></div>
          </div>
          <p><strong>Bring any sales-related file:</strong> spreadsheets, CSV or delimited text, JSON, and table-based PDFs are read directly. Other files are checked and clearly flagged when they do not contain a readable sales table.</p>
          <details>
            <summary>View sales reporting fields <span aria-hidden="true">+</span></summary>
            <ul>
              {["Order date", "Order ID", "Customer", "Segment", "Product", "Category", "Region", "Quantity", "Sales", "Discount", "Profit"].map((column) => <li key={column}>{column}</li>)}
            </ul>
          </details>
        </section>
        <label
          className={`drop-zone hero-drop-zone${isDragging ? " dragging" : ""}${filesReady ? " has-files" : ""}`}
        >
          <span className="upload-icon" aria-hidden="true">{isValidating ? "···" : filesReady ? "✓" : "⇧"}</span>
          <strong>{isDragging ? "Drop sales files here" : isValidating ? "Reading and validating…" : filesReady ? `${countLabel(files.length, "file")} ready` : "Drag & drop sales-related files"}</strong>
          <span>{filesReady ? "Drop more files or click to browse" : "Any file can be selected; readable sales tables will be imported"}</span>
          <input type="file" multiple onChange={(event) => { addSelectedFiles([...event.target.files]); event.currentTarget.value = ""; }} />
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
        {reviewVisible && !isSourceEditing && <div className="validation-source-overlay no-print"><span>Source validation complete</span><button className="button secondary" type="button" onClick={() => setIsSourceEditing(true)}>Change source files</button></div>}
      </section>

      {reviewVisible && <aside ref={validationPageRef} className="intake-status incoming-audit" aria-label="Automatic incoming data review">
          <section className={`data-review-card panel${flaggedRows ? " has-errors" : " all-clear"}`} aria-labelledby="data-review-title">
            <header className="data-review-head">
              <div><p className="section-number">01 / Data validation</p><h2 id="data-review-title">{flaggedRows ? "Order-data exceptions found" : "Superstore order data is ready"}</h2><p>{flaggedRows ? "Rows with missing or invalid order values stay out of the report." : "The historical order records passed validation and are ready for weekly or monthly analysis."}</p></div>
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
              <div className="incoming-section-head"><h3 id="incoming-sales-title">Dataset overview</h3><small>All report-ready rows</small></div>
              <dl><div><dt>Revenue</dt><dd>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(report.totalRevenue)}</dd></div><div><dt>Orders</dt><dd>{report.uniqueOrders}</dd></div><div><dt>Units</dt><dd>{report.totalUnits}</dd></div><div><dt>Customers</dt><dd>{report.customerCount}</dd></div><div><dt>Products</dt><dd>{report.products.length}</dd></div><div><dt>Regions</dt><dd>{report.regions.length}</dd></div></dl>
            </section>

            <div className="incoming-audit-grid">
              <section className="source-ledger" aria-labelledby="source-ledger-title">
                <div className="incoming-section-head"><h3 id="source-ledger-title">Sources</h3><small>{countLabel(intakeAnalysis.files.length, "file")}</small></div>
                <p className="audit-explainer">Each row summarizes one uploaded order file. Rows read is everything extracted from the file; report-ready rows passed the required date, order, customer, product, region, quantity, and sales checks.</p>
                <div className="table-wrap"><table><thead><tr><th>Source file</th><th>Rows read</th><th>Report-ready</th><th>Unique orders</th><th>Total sales</th><th>Validation</th></tr></thead><tbody>{intakeAnalysis.files.map((item, index) => <tr key={`${item.name}-${index}`}><td><span className="source-name"><b>{item.type}</b><span><strong>{item.name}</strong><small>{Math.max(1, Math.round(item.size / 1024))} KB · {item.startDate ? `${item.startDate}—${item.endDate}` : "No date range"}</small></span></span></td><td>{item.extractedRows}</td><td>{item.validRows}</td><td>{item.orders}</td><td>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(item.revenue)}</td><td><span className={`source-status ${item.issues ? "flag" : "pass"}`}>{item.issues ? countLabel(item.issues, "issue") : "Ready"}</span></td></tr>)}</tbody></table></div>
              </section>

              <section className="schema-audit chart-reveal" ref={coverageRevealRef} aria-labelledby="schema-audit-title">
                <div className="incoming-section-head"><h3 id="schema-audit-title">Field coverage</h3><small>{intakeAnalysis.coverage.filter((field) => field.present === field.total && field.total).length}/{intakeAnalysis.coverage.length} complete</small></div>
                <p className="audit-explainer">Coverage shows how many report-ready rows contain each field needed for order tracking, performance comparisons, and discount-profit analysis.</p>
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
            <section className="coordinator-readiness" aria-label="Sales coordinator readiness checks"><div><span className={startDate && endDate ? "pass" : "flag"}>{startDate && endDate ? "✓" : "!"}</span><p><strong>Historical coverage</strong><small>{startDate && endDate ? `${formatPeriod(startDate, endDate)} available for period analysis` : "A valid order-date range is missing"}</small></p></div><div><span className={validation.duplicateRecords ? "flag" : "pass"}>{validation.duplicateRecords ? "!" : "✓"}</span><p><strong>{usesLineItems ? "Line-item identity" : "Order identity"}</strong><small>{validation.duplicateRecords ? `${countLabel(validation.duplicateRecords, usesLineItems ? "duplicate line item" : "duplicate order")} excluded; first valid occurrence kept` : usesLineItems ? "Line items are unique; repeated order IDs are grouped into orders" : "Order IDs are unique"}</small></p></div><div><span className={report.regions.length ? "pass" : "flag"}>{report.regions.length ? "✓" : "!"}</span><p><strong>Regional coverage</strong><small>{report.regions.length ? `${countLabel(report.regions.length, "region")} available for comparison` : "Region is required for performance reporting"}</small></p></div><div><span className={validation.validRecords.length ? "pass" : "flag"}>{validation.validRecords.length ? "✓" : "!"}</span><p><strong>Analysis readiness</strong><small>{validation.validRecords.length ? `${countLabel(validation.validRecords.length, "row")} can be analyzed` : "No valid rows can be reported"}</small></p></div></section>
          </section>
        <button className="button full continue-button" type="button" disabled={!ready} onClick={onProduceResults}><span>Build sales report</span><span className="continue-button-icon" aria-hidden="true">→</span></button>
        {!ready && <p className="disabled-hint">Upload at least one file with a readable sales table and valid dated rows to continue.</p>}
      </aside>}
    </div>
  );
}
