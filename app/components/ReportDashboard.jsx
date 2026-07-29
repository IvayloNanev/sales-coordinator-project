import { useMemo, useState } from "react";
import {
  calculateReport,
  comparisonDrivers,
  formatCurrency,
  performanceChange,
  previousPeriod,
  recordsToCsv,
  SalesDataManager,
} from "../../lib/sales";

const MetricCard = ({ label, value, note, featured, trend }) => <article className={`metric-card${featured ? " featured" : ""}`}><span>{label}</span><strong>{value}</strong>{note && <small className={trend ? changeClass(trend.value) : ""}>{note}</small>}</article>;

function DataTable({ columns, rows, label }) {
  return <div className="table-wrap"><table><caption className="sr-only">{label} sales breakdown</caption><thead><tr>{columns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${label}-${index}`}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row[column.key], row) : row[column.key]}</td>)}</tr>)}</tbody></table></div>;
}

const shortDate = (value) => {
  if (!value) return "—";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
};
const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
const shiftDate = (value, days) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const calendarMonthRange = (value, offset = 0) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset, 1);
  const startDate = date.toISOString().slice(0, 10);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return { startDate, endDate: date.toISOString().slice(0, 10) };
};
const changeLabel = (change) => {
  if (change.percentage === null) return change.value ? "New vs prior" : "No prior activity";
  const sign = change.percentage > 0 ? "+" : "";
  return `${sign}${change.percentage.toFixed(1)}% vs prior`;
};
const changeClass = (value) => value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

export default function ReportDashboard({ records, startDate, endDate, generatedDate, fileCount, onRestart }) {
  const [view, setView] = useState("regions");
  const [orderQuery, setOrderQuery] = useState("");
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
  const regionDrivers = useMemo(() => comparisonDrivers(currentRecords, priorRecords, "salesRegion"), [currentRecords, priorRecords]);
  const categoryChanges = useMemo(
    () => new Map(categoryDrivers.map((driver) => [driver.label, driver.revenueChange])),
    [categoryDrivers],
  );
  const regionChanges = useMemo(
    () => new Map(regionDrivers.map((driver) => [driver.label, driver.revenueChange])),
    [regionDrivers],
  );
  const highestDiscountProducts = useMemo(
    () => report.products
      .filter((product) => product.averageDiscount > 0)
      .sort((a, b) => b.averageDiscount - a.averageDiscount || a.profit - b.profit)
      .slice(0, 5),
    [report.products],
  );
  const visibleOrders = useMemo(() => {
    const query = orderQuery.trim().toLowerCase();
    if (!query) return report.orders;
    return report.orders.filter((order) => (
      order.orderNumber.toLowerCase().includes(query)
      || order.customerName.toLowerCase().includes(query)
      || order.products.toLowerCase().includes(query)
      || order.salesRegion.toLowerCase().includes(query)
    ));
  }, [report.orders, orderQuery]);
  const money = (value) => formatCurrency(value);
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));
  const resetFilters = () => setFilters({ startDate: defaultStart, endDate, region: "", category: "", segment: "" });
  const applyPeriod = (period) => {
    let range;
    if (period === "week") range = { startDate: shiftDate(endDate, -6), endDate };
    if (period === "month") range = { ...calendarMonthRange(endDate), endDate };
    if (period === "previous-month") range = calendarMonthRange(endDate, -1);
    if (period === "all") range = { startDate, endDate };
    setFilters((current) => ({
      ...current,
      startDate: range.startDate < startDate ? startDate : range.startDate,
      endDate: range.endDate > endDate ? endDate : range.endDate,
    }));
  };
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
    orders: { label: "Orders", rows: visibleOrders, columns: [{ key: "orderNumber", label: "Order ID" }, { key: "date", label: "Date", render: shortDate }, { key: "customerName", label: "Customer" }, { key: "salesRegion", label: "Region" }, { key: "products", label: "Products" }, { key: "revenue", label: "Sales", render: money }, { key: "profit", label: "Profit", render: money }] },
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
        <div className="period-presets" aria-label="Quick reporting periods">
          <span>Quick periods</span>
          <button type="button" onClick={() => applyPeriod("week")}>Latest week</button>
          <button type="button" onClick={() => applyPeriod("month")}>Latest month</button>
          <button type="button" onClick={() => applyPeriod("previous-month")}>Previous month</button>
          <button type="button" onClick={() => applyPeriod("all")}>All dates</button>
        </div>
      </section>

      <section className="monday-briefing" aria-labelledby="monday-briefing-title">
        <div className="briefing-heading"><div><p className="eyebrow">Marcus’s Monday priorities</p><h4 id="monday-briefing-title">Monday briefing</h4></div><span>Sales totals, period movement, and margin risk</span></div>
        <div className="briefing-grid">
          <section className="analysis-panel" aria-labelledby="category-briefing-title">
            <div className="card-heading"><h5 id="category-briefing-title">Sales by category</h5><span>vs prior period</span></div>
            <div className="compact-analysis-table"><table><thead><tr><th>Category</th><th>Sales</th><th>Change</th></tr></thead><tbody>{report.categories.map((category) => {
              const change = categoryChanges.get(category.productCategory) ?? 0;
              return <tr key={category.productCategory}><td>{category.productCategory}</td><td>{money(category.revenue)}</td><td className={changeClass(change)}>{change > 0 ? "+" : ""}{money(change)}</td></tr>;
            })}</tbody></table></div>
          </section>

          <section className="analysis-panel" aria-labelledby="region-briefing-title">
            <div className="card-heading"><h5 id="region-briefing-title">Regions up or down</h5><span>vs prior period</span></div>
            <div className="compact-analysis-table"><table><thead><tr><th>Region</th><th>Sales</th><th>Change</th></tr></thead><tbody>{report.regions.map((region) => {
              const change = regionChanges.get(region.salesRegion) ?? 0;
              return <tr className={change < 0 ? "risk-row" : ""} key={region.salesRegion}><td>{region.salesRegion}</td><td>{money(region.revenue)}</td><td className={changeClass(change)}>{change > 0 ? "+" : ""}{money(change)}</td></tr>;
            })}</tbody></table></div>
          </section>

          <section className="analysis-panel discount-risk-panel" aria-labelledby="discount-risk-title">
            <div className="card-heading"><h5 id="discount-risk-title">Highest-discount products</h5><span>Margin effect</span></div>
            <div className="compact-analysis-table"><table><thead><tr><th>Product</th><th>Avg. discount</th><th>Profit</th><th>Margin</th></tr></thead><tbody>{highestDiscountProducts.map((product) => <tr className={product.profit < 0 ? "risk-row" : ""} key={product.product}><td>{product.product}</td><td>{(product.averageDiscount * 100).toFixed(1)}%</td><td className={changeClass(product.profit)}>{money(product.profit)}</td><td className={changeClass(product.profitMargin)}>{product.profitMargin.toFixed(1)}%</td></tr>)}</tbody></table></div>
            {!highestDiscountProducts.length && <p className="briefing-empty">No discounted products appear in this period.</p>}
          </section>
        </div>
      </section>

      <div className="metric-grid metric-grid-expanded">
        <MetricCard featured label="Sales" value={money(report.totalRevenue)} note={changeLabel(changes.revenue)} trend={changes.revenue} />
        <MetricCard featured label="Profit" value={money(report.totalProfit)} note={`${changeLabel(changes.profit)} · ${report.profitMargin.toFixed(1)}% margin`} trend={changes.profit} />
        <MetricCard label="Average discount" value={`${(report.averageDiscount * 100).toFixed(1)}%`} note="Across visible line items" />
        <MetricCard label="Orders" value={report.uniqueOrders.toLocaleString()} note={changeLabel(changes.orders)} trend={changes.orders} />
        <MetricCard label="Units sold" value={report.totalUnits.toLocaleString()} note={changeLabel(changes.units)} trend={changes.units} />
        <MetricCard label="Average order" value={money(report.averageOrderValue)} note={`Median ${money(report.medianOrderValue)}`} />
      </div>

      <section className="breakdown-card expanded-breakdown">
        <div className="breakdown-head"><div><h4>Detail</h4><small>Review performance or trace an individual order.</small></div><div className="tabs" role="tablist" aria-label="Report breakdown">{Object.entries(views).map(([key, item]) => <button type="button" role="tab" aria-selected={view === key} className={view === key ? "active" : ""} onClick={() => setView(key)} key={key}>{item.label}</button>)}</div></div>
        {view === "orders" && <div className="order-search no-print"><label htmlFor="order-search">Find an order</label><input id="order-search" type="search" value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="Search order ID, customer, product, or region" /><span>{countLabel(visibleOrders.length, "matching order")}</span></div>}
        <DataTable rows={views[view].rows} columns={views[view].columns} label={views[view].label} />
      </section>

      <section className="report-actions no-print"><div><button className="button ghost" onClick={onRestart}>New report</button></div><div><button className="button secondary" type="button" onClick={downloadFilteredCsv}>Download filtered CSV</button><button className="button primary" type="button" onClick={() => window.print()}>Print / Save PDF</button></div></section>
    </section>
  );
}
