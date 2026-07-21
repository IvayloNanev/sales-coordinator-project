import { useState } from "react";

export default function ReportSetup({ startDate, endDate, files, onDates, onFiles, onRemove }) {
  const [fileNotice, setFileNotice] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const periodReady = Boolean(startDate && endDate && startDate <= endDate);
  const filesReady = files.length > 0;
  const addSelectedFiles = (incoming) => {
    const csvFiles = incoming.filter((file) => file.name.toLowerCase().endsWith(".csv"));
    onFiles(csvFiles);
    setFileNotice(csvFiles.length ? `${csvFiles.length} CSV ${csvFiles.length === 1 ? "file" : "files"} added successfully.` : "No CSV files were added. Please choose files ending in .csv.");
  };
  const loadSamples = async () => {
    const names = ["store-101.csv", "store-102.csv", "store-103.csv"];
    const sampleFiles = await Promise.all(names.map(async (name) => {
      const response = await fetch(`/sample-files/${name}`);
      return new File([await response.blob()], name, { type: "text/csv" });
    }));
    onDates("startDate", "2026-07-06");
    onDates("endDate", "2026-07-10");
    addSelectedFiles(sampleFiles);
  };
  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    addSelectedFiles([...event.dataTransfer.files]);
  };
  return (
    <section className="screen" aria-labelledby="setup-title">
      <div className="screen-heading"><p className="eyebrow">Step 1 of 3</p><h1 id="setup-title">Set up the weekly report</h1><p>Choose the reporting period and add one CSV file for each store.</p></div>
      <div className="setup-grid">
        <div className="panel form-panel">
          <div className="section-title"><div><h2>Reporting period <span className="required-badge">Required</span></h2><p>Select both dates before store data can be validated.</p></div></div>
          <div className="date-grid">
            <label>Start date<input type="date" value={startDate} max={endDate || undefined} onChange={(event) => onDates("startDate", event.target.value)} /></label>
            <label>End date<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => onDates("endDate", event.target.value)} /></label>
          </div>
          <h2>Store files</h2>
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
            <input type="file" accept=".csv,text/csv" multiple onChange={(event) => addSelectedFiles([...event.target.files])} />
          </label>
          {fileNotice && <div className={`file-notice ${filesReady ? "success" : "warning"}`} role="status"><span aria-hidden="true">{filesReady ? "✓" : "!"}</span>{fileNotice}</div>}
          <p className="helper">Required columns: Date, Store ID, Store name, Order number, Customer name, Product, Product category, Sales region, Quantity sold, Revenue.</p>
          <div className="sample-callout"><div><strong>Need test data?</strong><p>Use the three included store files to preview the full workflow.</p></div><div className="sample-actions"><button type="button" onClick={loadSamples}>Use all 3 samples</button><div className="sample-links" aria-label="Download individual sample files"><a href="/sample-files/store-101.csv" download>101</a><a href="/sample-files/store-102.csv" download>102</a><a href="/sample-files/store-103.csv" download>103</a></div></div></div>
        </div>
        <aside className="panel file-panel" aria-labelledby="selected-files-title">
          <div className="panel-title"><h2 id="selected-files-title">Selected files</h2><span className="count-badge">{files.length}</span></div>
          {files.length ? <ul className="file-list">{files.map((file) => <li key={`${file.name}-${file.lastModified}`}><span className="file-type">CSV</span><div><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></div><button aria-label={`Remove ${file.name}`} onClick={() => onRemove(file)}>×</button></li>)}</ul> : <div className="empty-state"><span aria-hidden="true">▤</span><p>No files selected yet.</p></div>}
          <div className="validation-checklist" aria-label="Requirements to validate data">
            <p className={periodReady ? "complete" : "incomplete"}><span aria-hidden="true">{periodReady ? "✓" : "1"}</span><strong>Reporting period</strong><small>{periodReady ? `${startDate} to ${endDate}` : "Select a start date and end date"}</small></p>
            <p className={filesReady ? "complete" : "incomplete"}><span aria-hidden="true">{filesReady ? "✓" : "2"}</span><strong>Store CSV files</strong><small>{filesReady ? `${files.length} ${files.length === 1 ? "file" : "files"} ready` : "Upload at least one CSV file"}</small></p>
          </div>
          <p className="menu-hint">When both requirements are complete, choose <strong>Validate</strong> or <strong>Report</strong> from the menu above.</p>
        </aside>
      </div>
    </section>
  );
}
