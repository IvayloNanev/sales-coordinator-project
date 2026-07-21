import { formatCurrency } from "../../lib/sales";

export default function DataApproval({ report, startDate, endDate, approved, onApprove, onDownload, onGenerate, onReturn }) {
  return (
    <section className="screen approval-screen" aria-labelledby="approval-title">
      <div className="screen-heading"><p className="eyebrow">Step 3 of 4</p><h1 id="approval-title">Approve the cleaned data</h1><p>Confirm the final dataset before the report is generated.</p></div>
      <div className="panel approval-card">
        <div className="approval-mark" aria-hidden="true">✓</div>
        <div><p className="eyebrow">Ready for review</p><h2>{report.uniqueOrders} valid orders from {report.storeCount} stores</h2><p>Reporting period: <strong>{startDate}</strong> through <strong>{endDate}</strong></p></div>
        <strong className="approval-revenue">{formatCurrency(report.totalRevenue)}<span>Clean revenue total</span></strong>
      </div>
      <label className="approval-check panel"><input type="checkbox" checked={approved} onChange={(event) => onApprove(event.target.checked)} /><span><strong>I approve this data for report generation</strong><small>I have reviewed the validation results and confirm the cleaned dataset is ready.</small></span></label>
      <div className="actions approval-actions no-print"><button className="button secondary" onClick={onReturn}>← Back to Validation</button><div><button className="button secondary" onClick={onDownload}>Download Cleaned CSV</button><button className="button primary" disabled={!approved} onClick={onGenerate}>Generate Weekly Report <span aria-hidden="true">→</span></button></div></div>
    </section>
  );
}
