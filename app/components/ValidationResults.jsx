function Stat({ label, value, tone }) { return <div className={`stat ${tone || ""}`}><span>{label}</span><strong>{value}</strong></div>; }

export default function ValidationResults({ fileCount, totalRecords, results, onContinue, onReturn }) {
  const issueCount = results.invalidRecords.length;
  return (
    <section className="screen" aria-labelledby="validation-title">
      <div className="screen-heading"><p className="eyebrow">Step 2 of 3</p><h1 id="validation-title">Review data validation</h1><p>We checked every row before including it in your report.</p></div>
      <div className="stats-grid validation-stats">
        <Stat label="Files uploaded" value={fileCount} />
        <Stat label="Records received" value={totalRecords} />
        <Stat label="Valid records" value={results.validRecords.length} tone="success" />
        <Stat label="Invalid records" value={issueCount} tone={issueCount ? "danger" : "success"} />
        <Stat label="Duplicate records" value={results.duplicateRecords} tone={results.duplicateRecords ? "warning" : ""} />
      </div>
      {issueCount ? (
        <div className="panel validation-panel">
          <div className="alert warning"><strong>{issueCount} validation {issueCount === 1 ? "issue needs" : "issues need"} attention</strong><span>Continue with the clean rows, or return to upload a corrected file.</span></div>
          <div className="table-wrap"><table><thead><tr><th>Source file</th><th>Row</th><th>Order number</th><th>Issue</th></tr></thead><tbody>{results.invalidRecords.map((record, index) => <tr key={`${record.sourceFile}-${record.rowNumber}-${record.error}-${index}`}><td>{record.sourceFile}</td><td>{record.rowNumber}</td><td>{record.orderNumber || "—"}</td><td><span className="error-pill">{record.error}</span></td></tr>)}</tbody></table></div>
        </div>
      ) : <div className="alert success large"><strong>All records passed validation</strong><span>Your dataset is ready for the weekly report.</span></div>}
      <div className="actions no-print"><button className="button secondary" onClick={onReturn}>← Return to Upload</button><button className="button primary" disabled={!results.validRecords.length} onClick={onContinue}>{issueCount ? "Exclude Invalid Records and Generate Report" : "Generate Weekly Report"} <span aria-hidden="true">→</span></button></div>
    </section>
  );
}
