export default function ReportSetup({ startDate, endDate, files, onDates, onFiles, onRemove, onValidate }) {
  const ready = startDate && endDate && files.length > 0;
  const loadSamples = async () => {
    const names = ["store-101.csv", "store-102.csv", "store-103.csv"];
    const sampleFiles = await Promise.all(names.map(async (name) => {
      const response = await fetch(`/sample-files/${name}`);
      return new File([await response.blob()], name, { type: "text/csv" });
    }));
    onDates("startDate", "2026-07-06");
    onDates("endDate", "2026-07-10");
    onFiles(sampleFiles);
  };
  return (
    <section className="screen" aria-labelledby="setup-title">
      <div className="screen-heading"><p className="eyebrow">Step 1 of 4</p><h1 id="setup-title">Set up the weekly report</h1><p>Choose the reporting period and add one CSV file for each store.</p></div>
      <div className="setup-grid">
        <div className="panel form-panel">
          <h2>Reporting period</h2>
          <div className="date-grid">
            <label>Start date<input type="date" value={startDate} max={endDate || undefined} onChange={(event) => onDates("startDate", event.target.value)} /></label>
            <label>End date<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => onDates("endDate", event.target.value)} /></label>
          </div>
          <h2>Store files</h2>
          <label className="drop-zone">
            <span className="upload-icon" aria-hidden="true">⇧</span>
            <strong>Choose CSV files</strong>
            <span>Upload multiple store files at once</span>
            <input type="file" accept=".csv,text/csv" multiple onChange={(event) => onFiles([...event.target.files])} />
          </label>
          <p className="helper">Required columns: Date, Store ID, Store name, Order number, Customer name, Product, Product category, Sales region, Quantity sold, Revenue.</p>
          <div className="sample-callout"><div><strong>Need test data?</strong><p>Use the three included store files to preview the full workflow.</p></div><div className="sample-actions"><button type="button" onClick={loadSamples}>Use all 3 samples</button><div className="sample-links" aria-label="Download individual sample files"><a href="/sample-files/store-101.csv" download>101</a><a href="/sample-files/store-102.csv" download>102</a><a href="/sample-files/store-103.csv" download>103</a></div></div></div>
        </div>
        <aside className="panel file-panel" aria-labelledby="selected-files-title">
          <div className="panel-title"><h2 id="selected-files-title">Selected files</h2><span className="count-badge">{files.length}</span></div>
          {files.length ? <ul className="file-list">{files.map((file) => <li key={`${file.name}-${file.lastModified}`}><span className="file-type">CSV</span><div><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></div><button aria-label={`Remove ${file.name}`} onClick={() => onRemove(file)}>×</button></li>)}</ul> : <div className="empty-state"><span aria-hidden="true">▤</span><p>No files selected yet.</p></div>}
          <button className="button primary full" disabled={!ready} onClick={onValidate}>Validate Store Data <span aria-hidden="true">→</span></button>
          {!ready && <p className="disabled-hint">Select a complete period and at least one file to continue.</p>}
        </aside>
      </div>
    </section>
  );
}
