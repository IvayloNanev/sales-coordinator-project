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

      <aside className="intake-status" aria-label="Automatic intake results">
        <div className={`status-card panel${filesReady ? " complete" : ""}`}>
          <span className="status-icon" aria-hidden="true">{filesReady ? "✓" : "1"}</span>
          <div><small>Files received</small><strong>{filesReady ? `${files.length} store ${files.length === 1 ? "file" : "files"}` : "Waiting for upload"}</strong></div>
          {filesReady && <ul className="compact-file-list">{files.map((file) => <li key={`${file.name}-${file.lastModified}`}><span>{file.name}</span><button type="button" onClick={() => onRemove(file)} aria-label={`Remove ${file.name}`}>×</button></li>)}</ul>}
        </div>
        <div className={`status-card panel${periodReady ? " complete" : ""}`}>
          <span className="status-icon" aria-hidden="true">{periodReady ? "✓" : "2"}</span>
          <div><small>Date range detected</small><strong>{formatPeriod(startDate, endDate)}</strong></div>
        </div>
        <div className={`status-card panel${validation ? " complete" : ""}`}>
          <span className="status-icon" aria-hidden="true">{isValidating ? "···" : validation ? "✓" : "3"}</span>
          <div><small>Automatic validation</small><strong>{isValidating ? "Checking every row…" : validation ? `${validation.validRecords.length} of ${totalRecords} rows ready` : "Starts after upload"}</strong></div>
          {validation && <div className="validation-mini"><span>{validation.invalidRecords.length} issues</span><span>{validation.duplicateRecords} duplicates</span></div>}
        </div>
        <button className="button primary full continue-button" type="button" disabled={!ready} onClick={onProduceResults}>Produce results <span aria-hidden="true">→</span></button>
        {!ready && <p className="disabled-hint">Upload at least one CSV with valid dated rows to continue.</p>}
      </aside>
    </div>
  );
}
