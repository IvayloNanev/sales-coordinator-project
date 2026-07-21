import { useState } from "react";

export default function ReportSetup({ startDate, endDate, files, onDates, onFiles, onRemove, onValidate }) {
  const [fileNotice, setFileNotice] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const periodReady = Boolean(startDate && endDate && startDate <= endDate);
  const filesReady = files.length > 0;
  const ready = periodReady && filesReady;
  const addSelectedFiles = async (incoming) => {
    const csvFiles = incoming.filter((file) => file.name.toLowerCase().endsWith(".csv"));
    const range = csvFiles.length ? await onFiles(csvFiles) : null;
    setFileNotice(csvFiles.length
      ? range
        ? `${csvFiles.length} CSV ${csvFiles.length === 1 ? "file" : "files"} added. Reporting period set to ${range.startDate} through ${range.endDate}.`
        : `${csvFiles.length} CSV ${csvFiles.length === 1 ? "file" : "files"} added. No valid dates were found, so enter the reporting period manually.`
      : "No CSV files were added. Please choose files ending in .csv.");
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
    <div className="screen">
      <div className="setup-grid">
        <div className="panel form-panel">
          <section className="setup-block upload-block" aria-labelledby="files-title">
            <div className="setup-block-heading"><span className="workflow-number">1</span><div><h2 id="files-title">Add store files</h2><p>Drop your CSVs first. The reporting period will be detected from their Date column.</p></div></div>
            <label
              className={`drop-zone${isDragging ? " dragging" : ""}${filesReady ? " has-files" : ""}`}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setIsDragging(true); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false); }}
              onDrop={handleDrop}
            >
              <span className="upload-icon" aria-hidden="true">{filesReady ? "✓" : "⇧"}</span>
              <strong>{isDragging ? "Drop CSV files here" : files.length === 1 ? files[0].name : files.length > 1 ? `${files.length} CSV files selected` : "Choose or drop CSV files"}</strong>
              <span>{filesReady ? "Drop more files here or click to browse" : "Upload multiple store files at once"}</span>
              <input type="file" accept=".csv,text/csv" multiple onChange={(event) => { addSelectedFiles([...event.target.files]); event.currentTarget.value = ""; }} />
            </label>
            {fileNotice && <div className={`file-notice ${filesReady ? "success" : "warning"}`} role="status"><span aria-hidden="true">{filesReady ? "✓" : "!"}</span>{fileNotice}</div>}
            <p className="helper">Required columns: Date, Store ID, Store name, Order number, Customer name, Product, Product category, Sales region, Quantity sold, Revenue.</p>
            <div className="sample-callout"><div><strong>Need test data?</strong><p>Use the included store files to preview the workflow.</p></div><div className="sample-actions"><button type="button" onClick={loadSamples}>Use all 3 samples</button><div className="sample-links" aria-label="Download individual sample files"><a href="/sample-files/store-101.csv" download>101</a><a href="/sample-files/store-102.csv" download>102</a><a href="/sample-files/store-103.csv" download>103</a></div></div></div>
          </section>
        </div>
        <aside className="panel file-panel" aria-labelledby="selected-files-title">
          <div className="file-review">
            <div className="panel-title"><span className="workflow-number">2</span><div><h2 id="selected-files-title">Review selected files</h2><p>Confirm the files and detected period before validation.</p></div><span className="count-badge">{files.length}</span></div>
            {files.length ? <ul className="file-list">{files.map((file) => <li key={`${file.name}-${file.lastModified}`}><span className="file-type">CSV</span><div><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></div><button aria-label={`Remove ${file.name}`} onClick={() => onRemove(file)}>×</button></li>)}</ul> : <div className="empty-state"><span aria-hidden="true">▤</span><p>Files you add will appear here.</p></div>}
          </div>
          <div className="validation-summary">
            <div className={`detected-period${periodReady ? " ready" : ""}`}>
              <span className="period-icon" aria-hidden="true">{periodReady ? "✓" : "—"}</span>
              <div><small>Detected reporting period</small><strong>{periodReady ? `${startDate} — ${endDate}` : filesReady ? "No valid dates found" : "Waiting for files"}</strong></div>
            </div>
            <details className="date-adjuster" open={filesReady && !periodReady}>
              <summary>{periodReady ? "Adjust dates manually" : "Enter dates manually"}</summary>
              <div className="date-grid">
                <label>Start date<input type="date" value={startDate} max={endDate || undefined} onChange={(event) => onDates("startDate", event.target.value)} /></label>
                <label>End date<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => onDates("endDate", event.target.value)} /></label>
              </div>
            </details>
            <div className="validation-checklist" aria-label="Requirements to validate data">
              <p className={filesReady ? "complete" : "incomplete"}><span aria-hidden="true">{filesReady ? "✓" : "1"}</span><strong>Store CSV files</strong><small>{filesReady ? `${files.length} ${files.length === 1 ? "file" : "files"} ready` : "Upload at least one CSV file"}</small></p>
              <p className={periodReady ? "complete" : "incomplete"}><span aria-hidden="true">{periodReady ? "✓" : "2"}</span><strong>Reporting period</strong><small>{periodReady ? "Detected and ready" : "Valid dates are required"}</small></p>
            </div>
            <button className="button primary full" disabled={!ready} onClick={onValidate}>Validate data <span aria-hidden="true">→</span></button>
            {!ready && <p className="disabled-hint">Complete both steps above to continue.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
