import { useState } from "react";
import { formatCurrency, generateSummary } from "../../lib/sales";

const MetricCard = ({ label, value, note, featured }) => <article className={`metric-card${featured ? " featured" : ""}`}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;

function DataTable({ columns, rows, label }) {
  return <div className="table-wrap"><table><caption className="sr-only">{label} sales breakdown</caption><thead><tr>{columns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row[column.key]) : row[column.key]}</td>)}</tr>)}</tbody></table></div>;
}

export default function ReportDashboard({ report, startDate, endDate, generatedDate, onDownload, onRestart }) {
  const [view, setView] = useState("stores");
  const money = (value) => formatCurrency(value);
  const views = {
    stores: { label: "Stores", rows: report.stores, columns: [{ key: "storeId", label: "ID" }, { key: "storeName", label: "Store" }, { key: "orders", label: "Orders" }, { key: "units", label: "Units" }, { key: "revenue", label: "Revenue", render: money }] },
    regions: { label: "Regions", rows: report.regions, columns: [{ key: "salesRegion", label: "Region" }, { key: "orders", label: "Orders" }, { key: "units", label: "Units" }, { key: "revenue", label: "Revenue", render: money }] },
    categories: { label: "Categories", rows: report.categories, columns: [{ key: "productCategory", label: "Category" }, { key: "orders", label: "Orders" }, { key: "units", label: "Units" }, { key: "revenue", label: "Revenue", render: money }] },
    products: { label: "Top products", rows: report.topProducts, columns: [{ key: "product", label: "Product" }, { key: "productCategory", label: "Category" }, { key: "units", label: "Units" }, { key: "revenue", label: "Revenue", render: money }] },
  };
  const maxRevenue = Math.max(...report.stores.map((store) => store.revenue), 1);

  return (
    <section className="report-shell" aria-labelledby="report-title">
      <header className="report-heading"><div><p className="eyebrow">Consolidated sales report</p><h3 id="report-title">The week at a glance</h3><p>{startDate} — {endDate}</p></div><div className="generated-meta"><span>Generated</span><strong>{generatedDate}</strong></div></header>
      <div className="metric-grid">
        <MetricCard featured label="Total revenue" value={money(report.totalRevenue)} note="Valid records only" />
        <MetricCard label="Unique orders" value={report.uniqueOrders.toLocaleString()} />
        <MetricCard label="Units sold" value={report.totalUnits.toLocaleString()} />
        <MetricCard label="Avg. order value" value={money(report.averageOrderValue)} />
        <MetricCard label="Stores included" value={report.storeCount} />
      </div>
      <div className="report-story">
        <section className="performance-chart" aria-labelledby="performance-title"><div className="card-heading"><div><p className="eyebrow">Store performance</p><h4 id="performance-title">Revenue by location</h4></div><span>{report.storeCount} locations</span></div><div className="bars">{report.stores.map((store, index) => <div className="bar-row" key={store.storeId}><span>{String(index + 1).padStart(2, "0")}</span><strong>{store.storeName}</strong><div><i style={{ width: `${(store.revenue / maxRevenue) * 100}%` }} /></div><b>{money(store.revenue)}</b></div>)}</div></section>
        <aside className="summary-card"><span className="quote">“</span><p className="eyebrow">Management brief</p><p>{generateSummary(report, startDate, endDate)}</p><div><span><small>Top product</small><strong>{report.highestRevenueProduct}</strong></span><span><small>Top region</small><strong>{report.highestRevenueRegion}</strong></span></div></aside>
      </div>
      <section className="breakdown-card"><div className="breakdown-head"><div><p className="eyebrow">Deep dive</p><h4>Sales breakdown</h4></div><div className="tabs" role="tablist" aria-label="Report breakdown">{Object.entries(views).map(([key, item]) => <button type="button" role="tab" aria-selected={view === key} className={view === key ? "active" : ""} onClick={() => setView(key)} key={key}>{item.label}</button>)}</div></div><DataTable rows={views[view].rows} columns={views[view].columns} label={views[view].label} /></section>
      <section className="report-actions no-print"><div><span className="ready-dot" /><div><strong>Your report is ready</strong><small>Print it, export the clean data, or begin again.</small></div></div><div><button className="button ghost" onClick={onRestart}>New report</button><button className="button secondary" onClick={() => window.print()}>Print report</button><button className="button primary" onClick={onDownload}>Download CSV <span>↓</span></button></div></section>
    </section>
  );
}
