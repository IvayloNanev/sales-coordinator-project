import { useState } from "react";

const formatPeriod = (startDate, endDate) => {
  if (!startDate || !endDate) return "Waiting for valid dates";
  const format = (value) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  return `${format(startDate)} – ${format(endDate)}`;
};

export default function ReportSetup({ startDate, endDate, files, validation, totalRecords, isValidating, onFiles, onRemove, onProduceResults }) {
  const [fileNotice, setFileNotice] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const filesReady = files.length > 0;
  const periodReady = Boolean(startDate && endDate && startDate <= endDate);
  const validationReady = Boolean(validation && validation.validRecords.length);
  const ready = filesReady && periodReady && validationReady && !isValidating;
  const flaggedRows = validation
    ? new Set(validation.invalidRecords.map((record) => `${record.sourceFile}-${record.rowNumber}`)).size
    : 0;

  const addSelectedFiles = async (incoming) => {
    const csvFiles = incoming.filter((file) => file.name.toLowerCase().endsWith(".csv"));
    await onFiles(csvFiles);
    setFileNotice(csvFiles.length
      ? `${csvFiles.length} CSV ${csvFiles.length === 1 ? "file" : "files"} added and checked automatically.`
      : "No CSV files were added. Choose files ending in .csv.");
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
    <div className="intake-layout">
      <section className="panel intake-upload" aria-labelledby="files-title">
        <div className="intake-heading">
          <p className="eyebrow">Weekly sales intake</p>
          <h1 id="files-title">Drop the files.<br />Get the results.</h1>
          <p>Add every store CSV at once. Salescraft reads the date range, reviews every row automatically, and gets your clean report ready.</p>
        </div>
        <label
          className={`drop-zone hero-drop-zone${isDragging ? " dragging" : ""}${filesReady ? " has-files" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setIsDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false); }}
          onDrop={handleDrop}
        >
          <span className="upload-icon" aria-hidden="true">{isValidating ? "···" : filesReady ? "✓" : "⇧"}</span>
          <strong>{isDragging ? "Drop CSV files here" : isValidating ? "Reading and validating…" : filesReady ? `${files.length} ${files.length === 1 ? "file" : "files"} ready` : "Drag & drop store CSVs"}</strong>
          <span>{filesReady ? "Drop more files or click to browse" : "or click to choose multiple files"}</span>
          <input type="file" accept=".csv,text/csv" multiple onChange={(event) => { addSelectedFiles([...event.target.files]); event.currentTarget.value = ""; }} />
        </label>
        {fileNotice && <div className={`file-notice ${filesReady ? "success" : "warning"}`} role="status"><span aria-hidden="true">{filesReady ? "✓" : "!"}</span>{fileNotice}</div>}
        <div className="sample-callout">
          <div><strong>Want to see it in action?</strong><p>Load the three included store files.</p></div>
          <button type="button" onClick={loadSamples}>Use sample files</button>
        </div>
      </section>

      <aside className="intake-status" aria-label="Automatic data review">
        {!validation || isValidating ? (
          <div className="review-waiting-card panel">
            <span className="status-icon" aria-hidden="true">{isValidating ? "···" : "1"}</span>
            <div><p className="eyebrow">Automatic review</p><h2>{isValidating ? "Checking your data…" : "Your data card will appear here."}</h2><p>{isValidating ? "Reading dates, totals, duplicates, and row-level errors." : "Drop your CSV files to see a complete quality summary."}</p></div>
          </div>
        ) : (
          <section className={`data-review-card panel${flaggedRows ? " has-errors" : " all-clear"}`} aria-labelledby="data-review-title">
            <header className="data-review-head">
              <div><p className="eyebrow">Automatic review complete</p><h2 id="data-review-title">{flaggedRows ? "Data ready—with flags" : "All data looks clean"}</h2></div>
              <span className={`review-badge ${flaggedRows ? "warning" : "success"}`}>{flaggedRows ? `${flaggedRows} flagged` : "Passed"}</span>
            </header>

            <dl className="data-facts">
              <div><dt>Files</dt><dd>{files.length}</dd></div>
              <div><dt>Rows received</dt><dd>{totalRecords}</dd></div>
              <div><dt>Valid rows</dt><dd>{validation.validRecords.length}</dd></div>
              <div className={flaggedRows ? "fact-error" : ""}><dt>Flagged rows</dt><dd>{flaggedRows}</dd></div>
              <div className={validation.duplicateRecords ? "fact-warning" : ""}><dt>Duplicates</dt><dd>{validation.duplicateRecords}</dd></div>
              <div><dt>Date range</dt><dd className="fact-date">{formatPeriod(startDate, endDate)}</dd></div>
            </dl>

            <div className="review-files">
              <small>Source files</small>
              <ul>{files.map((file) => <li key={`${file.name}-${file.lastModified}`}><span><b>CSV</b><span>{file.name}</span><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></span><button type="button" onClick={() => onRemove(file)} aria-label={`Remove ${file.name}`}>×</button></li>)}</ul>
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
          </section>
        )}
        <button className="button primary full continue-button" type="button" disabled={!ready} onClick={onProduceResults}>Produce results <span aria-hidden="true">→</span></button>
        {!ready && <p className="disabled-hint">Upload at least one CSV with valid dated rows to continue.</p>}
      </aside>
    </div>
  );
}
