import useChartReveal from "../hooks/useChartReveal";

function Stat({ label, value, tone }) { return <div className={`stat ${tone || ""}`}><span>{label}</span><strong>{value}</strong></div>; }

export default function ValidationResults({ fileCount, totalRecords, results, onContinue, onReturn }) {
  const revealRef = useChartReveal();
  const issueCount = results.invalidRecords.length;
  const cleanRate = totalRecords ? Math.round((results.validRecords.length / totalRecords) * 100) : 0;
  return (
    <div className="validation-content chart-reveal" ref={revealRef}>
      <div className="validation-topline">
        <div><strong>{issueCount ? "Review complete—with a few flags." : "Everything looks clean."}</strong><p>{issueCount ? "Problem rows will stay out of the final report." : "Every received row is ready for reporting."}</p></div>
        <div className="score-ring" style={{ "--score": `${cleanRate * 3.6}deg` }}><span><strong>{cleanRate}%</strong><small>clean</small></span></div>
      </div>
      <div className="stats-grid">
        <Stat label="Files" value={fileCount} />
        <Stat label="Rows received" value={totalRecords} />
        <Stat label="Valid rows" value={results.validRecords.length} tone="success" />
        <Stat label="Issues" value={issueCount} tone={issueCount ? "danger" : "success"} />
        <Stat label="Duplicates" value={results.duplicateRecords} tone={results.duplicateRecords ? "warning" : ""} />
      </div>
      {issueCount ? <details className="issue-drawer"><summary><span><b>{issueCount}</b> validation {issueCount === 1 ? "issue" : "issues"} found</span><small>View details +</small></summary><div className="table-wrap"><table><thead><tr><th>Source file</th><th>Row</th><th>Order</th><th>Issue</th></tr></thead><tbody>{results.invalidRecords.map((record, index) => <tr key={`${record.sourceFile}-${record.rowNumber}-${record.error}-${index}`}><td>{record.sourceFile}</td><td>{record.rowNumber}</td><td>{record.orderNumber || "—"}</td><td><span className="error-pill">{record.error}</span></td></tr>)}</tbody></table></div></details> : <div className="success-strip"><span>✓</span><div><strong>All records passed</strong><small>No exclusions are needed.</small></div></div>}
      <div className="actions no-print"><button className="button ghost" onClick={onReturn}>Review setup</button><button className="button primary" disabled={!results.validRecords.length} onClick={onContinue}>{issueCount ? "Build report with clean rows" : "Build weekly report"}<span aria-hidden="true">↗</span></button></div>
    </div>
  );
}
