import { useState } from "react";

const formatPeriod = (startDate, endDate) => {
  if (!startDate || !endDate) return "Waiting for valid dates";
  const format = (value) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  return `${format(startDate)} – ${format(endDate)}`;
};

export default function ReportSetup({ startDate, endDate, files, validation, totalRecords, intakeAnalysis, report, isValidating, onFiles, onRemove, onProduceResults }) {
  const [fileNotice, setFileNotice] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const filesReady = files.length > 0;
  const periodReady = Boolean(startDate && endDate && startDate <= endDate);
  const validationReady = Boolean(validation && validation.validRecords.length);
  const ready = filesReady && periodReady && validationReady && !isValidating;
  const reviewVisible = Boolean(validation && !isValidating);
  const flaggedRows = validation
    ? new Set(validation.invalidRecords.map((record) => `${record.sourceFile}-${record.rowNumber}`)).size
    : 0;

  const addSelectedFiles = async (incoming) => {
    await onFiles(incoming);
    setFileNotice(incoming.length
      ? `${incoming.length} ${incoming.length === 1 ? "file" : "files"} added and checked automatically.`
      : "No files were selected.");
  };

  const loadSamples = async () => {
    const names = ["store-101.csv", "store-102.csv", "store-103.csv"];
    const sampleFiles = await Promise.all(names.map(async (name) => {
      const response = await fetch(`/sample-files/${name}`);
      return new File([await response.blob()], name, { type: "text/csv" });
    }));
    await addSelectedFiles(sampleFiles);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    addSelectedFiles([...event.dataTransfer.files]);
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
          <p className="eyebrow">Weekly sales intake</p>
          <h1 id="files-title">Drop the files.<br />Get the results.</h1>
          <p>Add files in any format. Salescraft extracts readable sales tables, detects the date range, and flags anything it cannot validate.</p>
        </div>
        <label
          className={`drop-zone hero-drop-zone${isDragging ? " dragging" : ""}${filesReady ? " has-files" : ""}`}
        >
          <span className="upload-icon" aria-hidden="true">{isValidating ? "···" : filesReady ? "✓" : "⇧"}</span>
          <strong>{isDragging ? "Drop any files here" : isValidating ? "Reading and validating…" : filesReady ? `${files.length} ${files.length === 1 ? "file" : "files"} ready` : "Drag & drop any sales files"}</strong>
          <span>{filesReady ? "Drop more files or click to browse" : "or click to choose multiple files"}</span>
          <input type="file" multiple onChange={(event) => { addSelectedFiles([...event.target.files]); event.currentTarget.value = ""; }} />
        </label>
        {fileNotice && <div className={`file-notice ${filesReady ? "success" : "warning"}`} role="status"><span aria-hidden="true">{filesReady ? "✓" : "!"}</span>{fileNotice}</div>}
        <div className="sample-callout">
          <div><strong>Want to see it in action?</strong><p>Load the three included store files.</p></div>
          <button type="button" onClick={loadSamples}>Use sample files</button>
        </div>
      </section>

      {reviewVisible && <aside className="intake-status incoming-audit" aria-label="Automatic incoming data review">
          <section className={`data-review-card panel${flaggedRows ? " has-errors" : " all-clear"}`} aria-labelledby="data-review-title">
            <header className="data-review-head">
              <div><p className="eyebrow">Incoming data control</p><h2 id="data-review-title">{flaggedRows ? "Review complete—with exceptions" : "All incoming data is report-ready"}</h2><p>Source reconciliation, schema coverage, quality controls, and sales values detected before reporting.</p></div>
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

            <section className="incoming-sales-snapshot" aria-labelledby="incoming-sales-title">
              <div className="incoming-section-head"><div><p className="eyebrow">Sales values detected</p><h3 id="incoming-sales-title">What the incoming files contain</h3></div><small>Valid rows only</small></div>
              <dl><div><dt>Revenue</dt><dd>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(report.totalRevenue)}</dd></div><div><dt>Orders</dt><dd>{report.uniqueOrders}</dd></div><div><dt>Units</dt><dd>{report.totalUnits}</dd></div><div><dt>Customers</dt><dd>{report.customerCount}</dd></div><div><dt>Products</dt><dd>{report.products.length}</dd></div><div><dt>Stores / regions</dt><dd>{report.storeCount} / {report.regions.length}</dd></div></dl>
            </section>

            <div className="incoming-audit-grid">
              <section className="source-ledger" aria-labelledby="source-ledger-title">
                <div className="incoming-section-head"><div><p className="eyebrow">Source reconciliation</p><h3 id="source-ledger-title">File-by-file intake</h3></div><small>{intakeAnalysis.files.length} sources</small></div>
                <div className="table-wrap"><table><thead><tr><th>Source</th><th>Extracted</th><th>Valid</th><th>Orders</th><th>Revenue</th><th>Status</th><th /></tr></thead><tbody>{intakeAnalysis.files.map((item, index) => <tr key={`${item.name}-${index}`}><td><span className="source-name"><b>{item.type}</b><span><strong>{item.name}</strong><small>{Math.max(1, Math.round(item.size / 1024))} KB · {item.startDate ? `${item.startDate}—${item.endDate}` : "No date range"}</small></span></span></td><td>{item.extractedRows}</td><td>{item.validRows}</td><td>{item.orders}</td><td>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(item.revenue)}</td><td><span className={`source-status ${item.issues ? "flag" : "pass"}`}>{item.issues ? `${item.issues} issues` : "Ready"}</span></td><td><button type="button" onClick={() => onRemove(files[index])} aria-label={`Remove ${item.name}`}>×</button></td></tr>)}</tbody></table></div>
              </section>

              <section className="schema-audit" aria-labelledby="schema-audit-title">
                <div className="incoming-section-head"><div><p className="eyebrow">CRM hygiene</p><h3 id="schema-audit-title">Required field coverage</h3></div><small>{intakeAnalysis.coverage.filter((field) => field.present === field.total && field.total).length}/{intakeAnalysis.coverage.length} complete</small></div>
                <ul>{intakeAnalysis.coverage.map((field) => { const rate = field.total ? Math.round((field.present / field.total) * 100) : 0; return <li key={field.label}><div><span>{field.label}</span><strong className={rate < 100 ? "coverage-warning" : ""}>{rate}%</strong></div><div><i style={{ width: `${rate}%` }} /></div><small>{field.present} of {field.total} rows populated</small></li>; })}</ul>
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
            <section className="coordinator-readiness" aria-label="Sales coordinator readiness checks"><div><span className={startDate && endDate ? "pass" : "flag"}>{startDate && endDate ? "✓" : "!"}</span><p><strong>Reporting period</strong><small>{startDate && endDate ? "Dates detected and normalized" : "A valid date range is missing"}</small></p></div><div><span className={validation.duplicateRecords ? "flag" : "pass"}>{validation.duplicateRecords ? "!" : "✓"}</span><p><strong>Order identity</strong><small>{validation.duplicateRecords ? `${validation.duplicateRecords} duplicate order rows require attention` : "Order numbers are unique"}</small></p></div><div><span className={report.customerCount ? "pass" : "flag"}>{report.customerCount ? "✓" : "!"}</span><p><strong>Customer records</strong><small>{report.customerCount ? `${report.customerCount} customer accounts detected` : "Customer attribution is missing"}</small></p></div><div><span className={validation.validRecords.length ? "pass" : "flag"}>{validation.validRecords.length ? "✓" : "!"}</span><p><strong>Report eligibility</strong><small>{validation.validRecords.length ? `${validation.validRecords.length} rows will flow into results` : "No valid rows can be reported"}</small></p></div></section>
          </section>
        <button className="button primary full continue-button" type="button" disabled={!ready} onClick={onProduceResults}>Produce results <span aria-hidden="true">→</span></button>
        {!ready && <p className="disabled-hint">Upload at least one file with a readable sales table and valid dated rows to continue.</p>}
      </aside>}
    </div>
  );
}
