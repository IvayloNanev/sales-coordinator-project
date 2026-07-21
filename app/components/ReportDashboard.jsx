import { formatCurrency, generateSummary } from "../../lib/sales";

const MetricCard = ({ label, value, note }) => <article className="metric-card"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;

function DataTable({ title, columns, rows }) {
  return <section className="report-table"><h2>{title}</h2><div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${title}-${index}`}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row[column.key]) : row[column.key]}</td>)}</tr>)}</tbody></table></div></section>;
}

export default function ReportDashboard({ report, startDate, endDate, generatedDate, reportApproved, onApprove, onPrint, onRestart }) {
  const money = (value) => formatCurrency(value);
  return (
    <section className="report-shell" aria-labelledby="report-title">
      <header className="report-heading"><div><p className="eyebrow">Consolidated sales report</p><h1 id="report-title">Weekly Sales Report</h1><p>{startDate} — {endDate}</p></div><div className="generated-meta"><span>Generated</span><strong>{generatedDate}</strong></div></header>
      <div className="metric-grid">
        <MetricCard label="Total revenue" value={money(report.totalRevenue)} note="Valid records only" />
        <MetricCard label="Unique orders" value={report.uniqueOrders.toLocaleString()} />
        <MetricCard label="Units sold" value={report.totalUnits.toLocaleString()} />
        <MetricCard label="Average order value" value={money(report.averageOrderValue)} />
        <MetricCard label="Stores included" value={report.storeCount} />
      </div>
      <div className="insights-grid">
        <MetricCard label="Top-selling product" value={report.topSellingProduct} note="By units sold" />
        <MetricCard label="Highest-revenue product" value={report.highestRevenueProduct} />
        <MetricCard label="Top category" value={report.highestRevenueCategory} />
        <MetricCard label="Top store" value={report.highestRevenueStore} />
        <MetricCard label="Top region" value={report.highestRevenueRegion} />
      </div>
      <section className="summary-card"><span aria-hidden="true">“</span><div><p className="eyebrow">Management summary</p><p>{generateSummary(report, startDate, endDate)}</p></div></section>
      <div className="report-tables">
        <DataTable title="Sales by store" rows={report.stores} columns={[{ key: "storeId", label: "Store ID" }, { key: "storeName", label: "Store name" }, { key: "orders", label: "Orders" }, { key: "units", label: "Units sold" }, { key: "revenue", label: "Revenue", render: money }]} />
        <DataTable title="Sales by region" rows={report.regions} columns={[{ key: "salesRegion", label: "Region" }, { key: "orders", label: "Orders" }, { key: "units", label: "Units sold" }, { key: "revenue", label: "Revenue", render: money }]} />
        <DataTable title="Sales by product category" rows={report.categories} columns={[{ key: "productCategory", label: "Product category" }, { key: "units", label: "Units sold" }, { key: "revenue", label: "Revenue", render: money }]} />
        <DataTable title="Top products" rows={report.topProducts} columns={[{ key: "product", label: "Product" }, { key: "productCategory", label: "Product category" }, { key: "units", label: "Units sold" }, { key: "revenue", label: "Revenue", render: money }]} />
      </div>
      <section className="report-approval panel no-print"><label><input type="checkbox" checked={reportApproved} onChange={(event) => onApprove(event.target.checked)} /><span><strong>I have reviewed and approved this report</strong><small>Approval is required before printing or saving as a PDF.</small></span></label><div><button className="button secondary" onClick={onRestart}>Start New Report</button><button className="button primary" disabled={!reportApproved} onClick={onPrint}>Print or Save as PDF</button></div></section>
    </section>
  );
}
