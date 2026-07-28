import { useMemo, useState } from "react";
import {
  calculateReport,
  comparisonDrivers,
  formatCurrency,
  generateSummary,
  performanceChange,
  previousPeriod,
  recordsToCsv,
  SalesDataManager,
} from "../../lib/sales";
import useChartReveal from "../hooks/useChartReveal";

const MetricCard = ({ label, value, note, featured }) => <article className={`metric-card${featured ? " featured" : ""}`}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;

function DataTable({ columns, rows, label }) {
  return <div className="table-wrap"><table><caption className="sr-only">{label} sales breakdown</caption><thead><tr>{columns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${label}-${index}`}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row[column.key], row) : row[column.key]}</td>)}</tr>)}</tbody></table></div>;
}

const shortDate = (value) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "—";
const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
const shiftDate = (value, days) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const changeLabel = (change) => {
  if (change.percentage === null) return change.value ? "New vs prior" : "No prior activity";
  const sign = change.percentage > 0 ? "+" : "";
  return `${sign}${change.percentage.toFixed(1)}% vs prior`;
};
const changeClass = (value) => value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

const ComparisonCard = ({ label, value, change, formatter = (item) => item.toLocaleString() }) => (
  <article className="comparison-card">
    <span>{label}</span>
    <strong>{formatter(value)}</strong>
    <small className={changeClass(change.value)}>{changeLabel(change)}</small>
  </article>
);

function DailyRevenueChart({ days }) {
  const revealRef = useChartReveal();
  const visible = days.slice(-14);
  const max = Math.max(...visible.map((day) => day.revenue), 1);
  return (
    <div className="daily-chart chart-reveal" ref={revealRef} role="img" aria-label={`Daily revenue for ${visible.length} active sales days`}>
      <div className="daily-bars">{visible.map((day, index) => <div className="daily-column" style={{ "--chart-index": index }} key={day.date}><strong>{formatCurrency(day.revenue)}</strong><div><i style={{ height: `${Math.max(5, (day.revenue / max) * 100)}%` }} /></div><span>{shortDate(day.date)}</span><small>{day.orders} ord.</small></div>)}</div>
    </div>
  );
}

function RankedBars({ rows, labelKey, valueKey = "revenue", valueFormatter = formatCurrency }) {
  const revealRef = useChartReveal();
  const visible = rows.slice(0, 6);
  const max = Math.max(...visible.map((row) => row[valueKey]), 1);
  return <div className="ranked-bars chart-reveal" ref={revealRef}>{visible.map((row, index) => <div className="ranked-row" style={{ "--chart-index": index }} key={`${row[labelKey]}-${index}`}><div><span>{String(index + 1).padStart(2, "0")}</span><strong>{row[labelKey]}</strong><b>{valueFormatter(row[valueKey])}</b></div><div><i style={{ width: `${(row[valueKey] / max) * 100}%` }} /></div></div>)}</div>;
}

function CategoryMix({ categories, totalRevenue }) {
  const revealRef = useChartReveal();
  const colors = ["#17365f", "#b88a35", "#315b84", "#d7b86a", "#6f7f91", "#8a6828"];
  const shares = categories.slice(0, 6).map((category) => totalRevenue ? (category.revenue / totalRevenue) * 100 : 0);
  const stops = shares.map((share, index) => {
    const start = shares.slice(0, index).reduce((sum, value) => sum + value, 0);
    return `${colors[index]} ${start}% ${start + share}%`;
  });
  const covered = shares.reduce((sum, value) => sum + value, 0);
  if (covered < 100) stops.push(`#e7ece9 ${covered}% 100%`);
  return <div className="mix-layout chart-reveal" ref={revealRef}><div className="donut" style={{ "--donut-background": `conic-gradient(${stops.join(", ")})` }} role="img" aria-label="Revenue share by product category"><span><strong>{categories.length}</strong><small>categories</small></span></div><ul>{categories.slice(0, 6).map((category, index) => <li key={category.productCategory}><i style={{ background: colors[index] }} /><span>{category.productCategory}</span><strong>{totalRevenue ? Math.round((category.revenue / totalRevenue) * 100) : 0}%</strong></li>)}</ul></div>;
}

export default function ReportDashboard({ records, startDate, endDate, generatedDate, fileCount, totalRecords, validRowCount, onRestart }) {
  const [view, setView] = useState("regions");
  const defaultStart = startDate && endDate ? [startDate, shiftDate(endDate, -6)].sort().at(-1) : startDate;
  const [filters, setFilters] = useState({
    startDate: defaultStart,
    endDate,
    region: "",
    category: "",
    segment: "",
  });
  const manager = useMemo(() => new SalesDataManager(records), [records]);
  const options = useMemo(() => ({
    regions: [...new Set(manager.records.map((record) => record.salesRegion).filter(Boolean))].sort(),
    categories: [...new Set(manager.records.map((record) => record.productCategory).filter(Boolean))].sort(),
    segments: [...new Set(manager.records.map((record) => record.segment).filter(Boolean))].sort(),
  }), [manager]);
  const currentRecords = useMemo(() => manager.filterData(filters), [manager, filters]);
  const report = useMemo(() => calculateReport(currentRecords), [currentRecords]);
  const priorRange = useMemo(() => previousPeriod(filters.startDate, filters.endDate), [filters.startDate, filters.endDate]);
  const priorRecords = useMemo(() => priorRange ? manager.filterData({
    ...filters,
    startDate: priorRange.startDate,
    endDate: priorRange.endDate,
  }) : [], [manager, filters, priorRange]);
  const priorReport = useMemo(() => calculateReport(priorRecords), [priorRecords]);
  const changes = useMemo(() => performanceChange(report, priorReport), [report, priorReport]);
  const categoryDrivers = useMemo(() => comparisonDrivers(currentRecords, priorRecords, "productCategory"), [currentRecords, priorRecords]);
  const productDrivers = useMemo(() => comparisonDrivers(currentRecords, priorRecords, "product"), [currentRecords, priorRecords]);
  const discountImpact = useMemo(() => manager.discountImpact(currentRecords), [manager, currentRecords]);
  const underperformers = useMemo(
    () => report.products.filter((product) => product.profit < 0).sort((a, b) => a.profit - b.profit).slice(0, 8),
    [report.products],
  );
  const money = (value) => formatCurrency(value);
  const percent = (value) => `${Math.round(value)}%`;
  const excluded = Math.max(0, totalRecords - validRowCount);
  const cleanRate = totalRecords ? (validRowCount / totalRecords) * 100 : 0;
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));
  const resetFilters = () => setFilters({ startDate: defaultStart, endDate, region: "", category: "", segment: "" });
  const downloadFilteredCsv = () => {
    const blob = new Blob([recordsToCsv(currentRecords)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sales-report-${filters.startDate}-${filters.endDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const views = {
    regions: { label: "Regions", rows: report.regions, columns: [{ key: "salesRegion", label: "Region" }, { key: "orders", label: "Orders" }, { key: "revenue", label: "Sales", render: money }, { key: "profit", label: "Profit", render: money }, { key: "profitMargin", label: "Margin", render: (value) => `${value.toFixed(1)}%` }] },
    categories: { label: "Categories", rows: report.categories, columns: [{ key: "productCategory", label: "Category" }, { key: "orders", label: "Orders" }, { key: "revenue", label: "Sales", render: money }, { key: "profit", label: "Profit", render: money }, { key: "profitMargin", label: "Margin", render: (value) => `${value.toFixed(1)}%` }] },
    products: { label: "Products", rows: report.products, columns: [{ key: "product", label: "Product" }, { key: "productCategory", label: "Category" }, { key: "revenue", label: "Sales", render: money }, { key: "profit", label: "Profit", render: money }, { key: "averageDiscount", label: "Avg. discount", render: (value) => `${(value * 100).toFixed(1)}%` }] },
  };

  return (
    <section className="report-shell expanded-report" aria-labelledby="report-title">
      <header className="report-heading report-heading-expanded"><div><p className="issue-line">{shortDate(filters.startDate)} — {shortDate(filters.endDate)}</p><h3 id="report-title">Sales<br /><em>performance.</em></h3></div><div className="generated-meta"><strong>{generatedDate}</strong><small>{countLabel(fileCount, "file")} · {countLabel(report.activeDays, "active day")}</small></div></header>

      <section className="report-filter-panel no-print" aria-label="Report filters">
        <div><label htmlFor="report-start">From</label><input id="report-start" type="date" min={startDate} max={filters.endDate} value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} /></div>
        <div><label htmlFor="report-end">To</label><input id="report-end" type="date" min={filters.startDate} max={endDate} value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} /></div>
        <div><label htmlFor="report-region">Region</label><select id="report-region" value={filters.region} onChange={(event) => updateFilter("region", event.target.value)}><option value="">All regions</option>{options.regions.map((option) => <option key={option}>{option}</option>)}</select></div>
        <div><label htmlFor="report-category">Category</label><select id="report-category" value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}><option value="">All categories</option>{options.categories.map((option) => <option key={option}>{option}</option>)}</select></div>
        <div><label htmlFor="report-segment">Segment</label><select id="report-segment" value={filters.segment} onChange={(event) => updateFilter("segment", event.target.value)}><option value="">All segments</option>{options.segments.map((option) => <option key={option}>{option}</option>)}</select></div>
        <button type="button" onClick={resetFilters}>Reset</button>
      </section>

      <section className="report-quality-strip" aria-label="Source data coverage"><div><span className="ready-dot" /><strong>{percent(cleanRate)} clean row coverage</strong></div><p>{countLabel(validRowCount, "valid row")} from {totalRecords} received{excluded ? ` · ${countLabel(excluded, "row")} excluded` : " · no rows excluded"}</p></section>

      <section className="comparison-strip" aria-label="Current period compared with prior period">
        <header><div><span>Period comparison</span><strong>{shortDate(priorRange?.startDate)}—{shortDate(priorRange?.endDate)}</strong></div><small>{priorRecords.length ? `${priorRecords.length.toLocaleString()} prior line items` : "No prior-period rows in this source"}</small></header>
        <div>
          <ComparisonCard label="Sales" value={report.totalRevenue} change={changes.revenue} formatter={money} />
          <ComparisonCard label="Profit" value={report.totalProfit} change={changes.profit} formatter={money} />
          <ComparisonCard label="Orders" value={report.uniqueOrders} change={changes.orders} />
          <ComparisonCard label="Units" value={report.totalUnits} change={changes.units} />
        </div>
      </section>

      <div className="metric-grid metric-grid-expanded">
        <MetricCard featured label="Total revenue" value={money(report.totalRevenue)} note={`${money(report.dailyAverageRevenue)} per active day`} />
        <MetricCard featured label="Total profit" value={money(report.totalProfit)} note={`${report.profitMargin.toFixed(1)}% profit margin`} />
        <MetricCard label="Average discount" value={`${(report.averageDiscount * 100).toFixed(1)}%`} note="Across visible line items" />
        <MetricCard label="Orders" value={report.uniqueOrders.toLocaleString()} note={countLabel(report.activeDays, "active sales day")} />
        <MetricCard label="Units sold" value={report.totalUnits.toLocaleString()} note={`${report.unitsPerOrder.toFixed(1)} per order`} />
        <MetricCard label="Average order" value={money(report.averageOrderValue)} note={`Median ${money(report.medianOrderValue)}`} />
      </div>

      <div className="report-overview-single">
        <section className="analysis-panel revenue-pulse" aria-labelledby="revenue-pulse-title"><div className="card-heading"><h4 id="revenue-pulse-title">Daily revenue</h4><span>Best · {shortDate(report.bestDay?.date)} · {money(report.bestDay?.revenue ?? 0)}</span></div><DailyRevenueChart days={report.daily} /></section>
      </div>

      <div className="report-secondary-grid">
        <section className="analysis-panel" aria-labelledby="region-performance-title"><div className="card-heading"><h4 id="region-performance-title">Regions</h4><span>{report.regions.length} total</span></div><RankedBars rows={report.regions} labelKey="salesRegion" /></section>
        <section className="analysis-panel" aria-labelledby="category-mix-title"><div className="card-heading"><h4 id="category-mix-title">Category mix</h4><span>{countLabel(report.categories.length, "category", "categories")}</span></div><CategoryMix categories={report.categories} totalRevenue={report.totalRevenue} /></section>
      </div>

      <div className="coordinator-analysis-grid">
        <section className="analysis-panel change-drivers" aria-labelledby="change-drivers-title">
          <div className="card-heading"><h4 id="change-drivers-title">What changed?</h4><span>Largest sales movements</span></div>
          <div className="driver-groups">
            <div><h5>Categories</h5><ul>{categoryDrivers.map((driver) => <li key={driver.label}><span>{driver.label}</span><strong className={changeClass(driver.revenueChange)}>{driver.revenueChange > 0 ? "+" : ""}{money(driver.revenueChange)}</strong></li>)}</ul></div>
            <div><h5>Products</h5><ul>{productDrivers.map((driver) => <li key={driver.label}><span>{driver.label}</span><strong className={changeClass(driver.revenueChange)}>{driver.revenueChange > 0 ? "+" : ""}{money(driver.revenueChange)}</strong></li>)}</ul></div>
          </div>
        </section>

        <section className="analysis-panel" aria-labelledby="discount-impact-title">
          <div className="card-heading"><h4 id="discount-impact-title">Discount impact</h4><span>Profit by discount level</span></div>
          <div className="compact-analysis-table"><table><thead><tr><th>Discount</th><th>Sales</th><th>Profit</th><th>Avg. profit</th></tr></thead><tbody>{discountImpact.map((row) => <tr className={row.totalProfit < 0 ? "risk-row" : ""} key={row.discount}><td>{Math.round(row.discount * 100)}%</td><td>{money(row.totalSales)}</td><td>{money(row.totalProfit)}</td><td>{money(row.averageProfit)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="analysis-panel" aria-labelledby="underperformers-title">
          <div className="card-heading"><h4 id="underperformers-title">Underperformers</h4><span>{report.products.filter((product) => product.profit < 0).length} products below $0 profit</span></div>
          <div className="compact-analysis-table"><table><thead><tr><th>Product</th><th>Sales</th><th>Profit</th><th>Margin</th></tr></thead><tbody>{underperformers.map((product) => <tr key={product.product}><td>{product.product}</td><td>{money(product.revenue)}</td><td className="negative">{money(product.profit)}</td><td>{product.profitMargin.toFixed(1)}%</td></tr>)}</tbody></table></div>
        </section>

      </div>

      <aside className="management-narrative"><span>“</span><p>{generateSummary(report, filters.startDate, filters.endDate)} {priorRecords.length ? `Sales were ${changeLabel(changes.revenue).toLowerCase()}, while profit was ${changeLabel(changes.profit).toLowerCase()}.` : "No comparable prior-period rows were available in the uploaded source."}</p></aside>

      <section className="breakdown-card expanded-breakdown"><div className="breakdown-head"><h4>Detail</h4><div className="tabs" role="tablist" aria-label="Report breakdown">{Object.entries(views).map(([key, item]) => <button type="button" role="tab" aria-selected={view === key} className={view === key ? "active" : ""} onClick={() => setView(key)} key={key}>{item.label}</button>)}</div></div><DataTable rows={views[view].rows} columns={views[view].columns} label={views[view].label} /></section>

      <section className="source-boundary"><strong>Built for Marcus’s Monday report</strong><p>The dashboard stays focused on period performance, regions, categories, products, discounts, and profit using only values present in the uploaded order data.</p></section>

      <section className="report-actions no-print"><div><button className="button ghost" onClick={onRestart}>New report</button></div><div><button className="button secondary" type="button" onClick={downloadFilteredCsv}>Download filtered CSV</button><button className="button primary" type="button" onClick={() => window.print()}>Print / Save PDF</button></div></section>
    </section>
  );
}
