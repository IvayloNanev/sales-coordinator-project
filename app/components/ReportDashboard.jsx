import { useState } from "react";
import { formatCurrency, generateSummary } from "../../lib/sales";

const MetricCard = ({ label, value, note, featured }) => <article className={`metric-card${featured ? " featured" : ""}`}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;

function DataTable({ columns, rows, label }) {
  return <div className="table-wrap"><table><caption className="sr-only">{label} sales breakdown</caption><thead><tr>{columns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${label}-${index}`}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row[column.key], row) : row[column.key]}</td>)}</tr>)}</tbody></table></div>;
}

const shortDate = (value) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "—";
const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

function DailyRevenueChart({ days }) {
  const visible = days.slice(-14);
  const max = Math.max(...visible.map((day) => day.revenue), 1);
  return (
    <div className="daily-chart" role="img" aria-label={`Daily revenue for ${visible.length} active sales days`}>
      <div className="daily-bars">{visible.map((day) => <div className="daily-column" key={day.date}><strong>{formatCurrency(day.revenue)}</strong><div><i style={{ height: `${Math.max(5, (day.revenue / max) * 100)}%` }} /></div><span>{shortDate(day.date)}</span><small>{day.orders} ord.</small></div>)}</div>
    </div>
  );
}

function RankedBars({ rows, labelKey, valueKey = "revenue", valueFormatter = formatCurrency }) {
  const visible = rows.slice(0, 6);
  const max = Math.max(...visible.map((row) => row[valueKey]), 1);
  return <div className="ranked-bars">{visible.map((row, index) => <div className="ranked-row" key={`${row[labelKey]}-${index}`}><div><span>{String(index + 1).padStart(2, "0")}</span><strong>{row[labelKey]}</strong><b>{valueFormatter(row[valueKey])}</b></div><div><i style={{ width: `${(row[valueKey] / max) * 100}%` }} /></div></div>)}</div>;
}

function CategoryMix({ categories, totalRevenue }) {
  const colors = ["#17365f", "#b88a35", "#315b84", "#d7b86a", "#6f7f91", "#8a6828"];
  const shares = categories.slice(0, 6).map((category) => totalRevenue ? (category.revenue / totalRevenue) * 100 : 0);
  const stops = shares.map((share, index) => {
    const start = shares.slice(0, index).reduce((sum, value) => sum + value, 0);
    return `${colors[index]} ${start}% ${start + share}%`;
  });
  const covered = shares.reduce((sum, value) => sum + value, 0);
  if (covered < 100) stops.push(`#e7ece9 ${covered}% 100%`);
  return <div className="mix-layout"><div className="donut" style={{ background: `conic-gradient(${stops.join(", ")})` }} role="img" aria-label="Revenue share by product category"><span><strong>{categories.length}</strong><small>categories</small></span></div><ul>{categories.slice(0, 6).map((category, index) => <li key={category.productCategory}><i style={{ background: colors[index] }} /><span>{category.productCategory}</span><strong>{totalRevenue ? Math.round((category.revenue / totalRevenue) * 100) : 0}%</strong></li>)}</ul></div>;
}

export default function ReportDashboard({ report, startDate, endDate, generatedDate, fileCount, totalRecords, validRowCount, issueCount, duplicateRecords, onRestart }) {
  const [view, setView] = useState("stores");
  const money = (value) => formatCurrency(value);
  const percent = (value) => `${Math.round(value)}%`;
  const excluded = Math.max(0, totalRecords - validRowCount);
  const cleanRate = totalRecords ? (validRowCount / totalRecords) * 100 : 0;
  const views = {
    stores: { label: "Stores", rows: report.stores, columns: [{ key: "storeId", label: "ID" }, { key: "storeName", label: "Store" }, { key: "orders", label: "Orders" }, { key: "units", label: "Units" }, { key: "revenue", label: "Revenue", render: money }] },
    regions: { label: "Regions", rows: report.regions, columns: [{ key: "salesRegion", label: "Region" }, { key: "orders", label: "Orders" }, { key: "units", label: "Units" }, { key: "revenue", label: "Revenue", render: money }] },
    categories: { label: "Categories", rows: report.categories, columns: [{ key: "productCategory", label: "Category" }, { key: "orders", label: "Orders" }, { key: "units", label: "Units" }, { key: "revenue", label: "Revenue", render: money }] },
    products: { label: "Products", rows: report.products, columns: [{ key: "product", label: "Product" }, { key: "productCategory", label: "Category" }, { key: "orders", label: "Orders" }, { key: "units", label: "Units" }, { key: "revenue", label: "Revenue", render: money }] },
    customers: { label: "Customers", rows: report.customers, columns: [{ key: "customerName", label: "Customer" }, { key: "orders", label: "Orders" }, { key: "units", label: "Units" }, { key: "revenue", label: "Revenue", render: money }] },
    orders: { label: "Orders", rows: report.orders, columns: [{ key: "orderNumber", label: "Order" }, { key: "date", label: "Date", render: shortDate }, { key: "customerName", label: "Customer" }, { key: "storeName", label: "Store" }, { key: "units", label: "Units" }, { key: "revenue", label: "Revenue", render: money }] },
  };

  const actions = [
    { label: "Key account", title: report.topCustomer?.customerName ?? "No customer data", detail: report.topCustomer ? `${percent(report.topCustomerRevenueShare)} of revenue · ${countLabel(report.topCustomer.orders, "order")}` : "Add customer names to identify account concentration." },
    { label: "Inventory signal", title: report.topSellingProduct, detail: `${report.products.find((product) => product.product === report.topSellingProduct)?.units ?? 0} units sold; confirm stock and fulfillment coverage.` },
    { label: "Regional focus", title: report.highestRevenueRegion, detail: `${money(report.regions[0]?.revenue ?? 0)} in revenue; share the winning mix across other regions.` },
    { label: issueCount ? "Data follow-up" : "CRM hygiene", title: issueCount ? `${countLabel(issueCount, "issue")} excluded` : "Source data passed", detail: issueCount ? `${countLabel(duplicateRecords, "duplicate row")} excluded; the first valid occurrence of each order was kept.` : "Customer, order, product, store, region, and date fields are report-ready." },
  ];

  return (
    <section className="report-shell expanded-report" aria-labelledby="report-title">
      <header className="report-heading report-heading-expanded"><div><p className="issue-line">{shortDate(startDate)} — {shortDate(endDate)}</p><h3 id="report-title">Weekly sales<br /><em>performance.</em></h3></div><div className="generated-meta"><strong>{generatedDate}</strong><small>{countLabel(fileCount, "file")} · {countLabel(report.activeDays, "active day")}</small></div></header>

      <section className="report-quality-strip" aria-label="Source data coverage"><div><span className="ready-dot" /><strong>{percent(cleanRate)} clean row coverage</strong></div><p>{countLabel(validRowCount, "valid row")} from {totalRecords} received{excluded ? ` · ${countLabel(excluded, "row")} excluded` : " · no rows excluded"}</p></section>

      <div className="metric-grid metric-grid-expanded">
        <MetricCard featured label="Total revenue" value={money(report.totalRevenue)} note={`${money(report.dailyAverageRevenue)} per active day`} />
        <MetricCard label="Orders" value={report.uniqueOrders.toLocaleString()} note={countLabel(report.activeDays, "active sales day")} />
        <MetricCard label="Units sold" value={report.totalUnits.toLocaleString()} note={`${report.unitsPerOrder.toFixed(1)} per order`} />
        <MetricCard label="Average order" value={money(report.averageOrderValue)} note={`Median ${money(report.medianOrderValue)}`} />
        <MetricCard label="Customers" value={report.customerCount.toLocaleString()} note={countLabel(report.repeatCustomerCount, "repeat customer")} />
        <MetricCard label="Repeat rate" value={percent(report.repeatCustomerRate)} note="Customers with 2+ orders" />
        <MetricCard label="Revenue / customer" value={money(report.averageRevenuePerCustomer)} note={`${money(report.revenuePerUnit)} per unit`} />
        <MetricCard label="Stores" value={report.storeCount} note={countLabel(report.regions.length, "sales region")} />
      </div>

      <div className="report-overview-grid">
        <section className="analysis-panel revenue-pulse" aria-labelledby="revenue-pulse-title"><div className="card-heading"><h4 id="revenue-pulse-title">Daily revenue</h4><span>Best · {shortDate(report.bestDay?.date)} · {money(report.bestDay?.revenue ?? 0)}</span></div><DailyRevenueChart days={report.daily} /></section>
        <aside className="action-center" aria-labelledby="action-center-title"><div className="card-heading"><h4 id="action-center-title">Priorities</h4></div><ol>{actions.map((action, index) => <li key={action.label}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{action.label}</small><strong>{action.title}</strong><p>{action.detail}</p></div></li>)}</ol></aside>
      </div>

      <div className="report-secondary-grid">
        <section className="analysis-panel" aria-labelledby="region-performance-title"><div className="card-heading"><h4 id="region-performance-title">Regions</h4><span>{report.regions.length} total</span></div><RankedBars rows={report.regions} labelKey="salesRegion" /></section>
        <section className="analysis-panel" aria-labelledby="category-mix-title"><div className="card-heading"><h4 id="category-mix-title">Category mix</h4><span>{countLabel(report.categories.length, "category", "categories")}</span></div><CategoryMix categories={report.categories} totalRevenue={report.totalRevenue} /></section>
      </div>

      <div className="report-insight-grid">
        <section className="analysis-panel customer-intelligence" aria-labelledby="customer-title"><div className="card-heading"><h4 id="customer-title">Customers</h4><span>Top 3 · {percent(report.topThreeCustomerShare)} of revenue</span></div><RankedBars rows={report.customers} labelKey="customerName" /></section>
        <section className="analysis-panel order-economics" aria-labelledby="economics-title"><div className="card-heading"><h4 id="economics-title">Order economics</h4></div><dl><div><dt>Largest order</dt><dd>{money(report.largestOrder?.revenue ?? 0)}</dd><small>{report.largestOrder?.orderNumber ?? "—"} · {report.largestOrder?.customerName ?? "—"}</small></div><div><dt>Median order</dt><dd>{money(report.medianOrderValue)}</dd><small>Midpoint of all valid orders</small></div><div><dt>Units per order</dt><dd>{report.unitsPerOrder.toFixed(1)}</dd><small>{money(report.revenuePerUnit)} revenue per unit</small></div><div><dt>Repeat customers</dt><dd>{report.repeatCustomerCount}</dd><small>{percent(report.repeatCustomerRate)} of customer base</small></div></dl></section>
      </div>

      <aside className="management-narrative"><span>“</span><p>{generateSummary(report, startDate, endDate)}</p></aside>

      <section className="breakdown-card expanded-breakdown"><div className="breakdown-head"><h4>Detail</h4><div className="tabs" role="tablist" aria-label="Report breakdown">{Object.entries(views).map(([key, item]) => <button type="button" role="tab" aria-selected={view === key} className={view === key ? "active" : ""} onClick={() => setView(key)} key={key}>{item.label}</button>)}</div></div><DataTable rows={views[view].rows} columns={views[view].columns} label={views[view].label} /></section>

      <section className="source-boundary"><strong>Source-backed reporting</strong><p>This report uses only values present in the uploaded files. Quota attainment, pipeline value, win rate, forecast accuracy, margin, and sales-cycle length require target, opportunity-stage, cost, and lifecycle fields that are not part of the current source schema.</p></section>

      <section className="report-actions no-print"><div><button className="button ghost" onClick={onRestart}>New report</button></div></section>
    </section>
  );
}
