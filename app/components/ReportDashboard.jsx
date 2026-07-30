import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateReport,
  comparisonDrivers,
  formatCurrency,
  generateSummary,
  performanceChange,
  previousCompletedWeek,
  previousPeriod,
  recordsToCsv,
  SalesDataManager,
} from "../../lib/sales";

const MetricCard = ({ label, value, note, featured, trend }) => <article className={`metric-card${featured ? " featured" : ""}`}><span>{label}</span><strong>{value}</strong>{note && <small className={trend ? changeClass(trend.value) : ""}>{note}</small>}</article>;

function VisualRanking({ title, eyebrow, rows, labelKey, valueKey = "revenue", valueFormatter, tone = "gold" }) {
  const visibleRows = rows.slice(0, 5);
  const peak = Math.max(...visibleRows.map((row) => Math.abs(row[valueKey]) || 0), 1);
  return (
    <article className={`visual-card visual-card-${tone}`}>
      <header><div><span>{eyebrow}</span><h5>{title}</h5></div><strong>{visibleRows.length}</strong></header>
      <div className="visual-ranking">
        {visibleRows.map((row, index) => {
          const value = row[valueKey] || 0;
          const width = Math.max((Math.abs(value) / peak) * 100, 4);
          return (
            <div className="visual-rank" key={row[labelKey]}>
              <div><span>{row[labelKey]}</span><strong>{valueFormatter(value, row)}</strong></div>
              <div className="visual-track" aria-hidden="true"><i style={{ "--bar-width": `${width}%`, "--bar-delay": `${index * 80}ms` }} /></div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function DataTable({ columns, rows, label }) {
  return <div className="table-wrap"><table><caption className="sr-only">{label} sales breakdown</caption><thead><tr>{columns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${label}-${index}`}>{columns.map((column) => { const value = column.render ? column.render(row[column.key], row) : row[column.key]; return <td key={column.key} title={typeof value === "string" && value.length > 36 ? value : undefined}>{value}</td>; })}</tr>)}</tbody></table></div>;
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
const monthTitle = (value) => new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${value}-01T00:00:00Z`));
const dateButtonLabel = (value) => new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${value}T00:00:00Z`));
const changeMonth = (value, offset) => {
  const date = new Date(`${value}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
};

function GoldDateInput({ id, label, value, min, max, onChange }) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(value.slice(0, 7));
  const [focusedDate, setFocusedDate] = useState(value);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const calendarRef = useRef(null);
  const firstDay = new Date(`${visibleMonth}-01T00:00:00Z`);
  const daysInMonth = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0)).getUTCDate();
  const leadingDays = firstDay.getUTCDay();
  const dayCells = [
    ...Array.from({ length: leadingDays }, (_, index) => ({ spacer: true, key: `before-${index}` })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const iso = `${visibleMonth}-${String(index + 1).padStart(2, "0")}`;
      return { iso, day: index + 1, disabled: iso < min || iso > max, key: iso };
    }),
  ];

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      calendarRef.current?.querySelector(`[data-date="${focusedDate}"]`)?.focus();
    });
  }, [focusedDate, open, visibleMonth]);

  const closeCalendar = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const chooseDate = (nextValue) => {
    onChange(nextValue);
    setVisibleMonth(nextValue.slice(0, 7));
    setFocusedDate(nextValue);
    closeCalendar();
  };

  const moveCalendarFocus = (nextValue) => {
    const bounded = nextValue < min ? min : nextValue > max ? max : nextValue;
    setFocusedDate(bounded);
    setVisibleMonth(bounded.slice(0, 7));
  };

  const handleDayKeyDown = (event, iso) => {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (offsets[event.key]) {
      event.preventDefault();
      moveCalendarFocus(shiftDate(iso, offsets[event.key]));
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
      moveCalendarFocus(shiftDate(iso, event.key === "Home" ? -day : 6 - day));
    }
  };

  return (
    <div className="gold-date-field" ref={rootRef} onKeyDown={(event) => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        closeCalendar();
      }
    }}>
      <label id={`${id}-label`} htmlFor={id}>{label}</label>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="gold-date-trigger"
        aria-pressed={open}
        aria-expanded={open}
        aria-controls={`${id}-calendar`}
        aria-labelledby={`${id}-label ${id}`}
        onClick={() => {
          setVisibleMonth(value.slice(0, 7));
          setFocusedDate(value);
          setOpen((current) => !current);
        }}
      >
        <span>{dateButtonLabel(value)}</span><i className="gold-calendar-icon" aria-hidden="true" />
      </button>
      {open && (
        <div className="gold-date-popover" ref={calendarRef} id={`${id}-calendar`} role="dialog" aria-modal="false" aria-label={`${label} date calendar`}>
          <header>
            <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth((current) => changeMonth(current, -1))}>‹</button>
            <strong>{monthTitle(visibleMonth)}</strong>
            <button type="button" aria-label="Next month" onClick={() => setVisibleMonth((current) => changeMonth(current, 1))}>›</button>
          </header>
          <div className="gold-calendar-weekdays" aria-hidden="true">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className="gold-calendar-days" role="group" aria-label={monthTitle(visibleMonth)}>{dayCells.map((cell) => cell.spacer
            ? <span key={cell.key} />
            : <button type="button" data-date={cell.iso} tabIndex={cell.iso === focusedDate ? 0 : -1} key={cell.key} disabled={cell.disabled} className={cell.iso === value ? "selected" : ""} aria-label={dateButtonLabel(cell.iso)} aria-pressed={cell.iso === value} aria-current={cell.iso === new Date().toISOString().slice(0, 10) ? "date" : undefined} onKeyDown={(event) => handleDayKeyDown(event, cell.iso)} onFocus={() => setFocusedDate(cell.iso)} onClick={() => chooseDate(cell.iso)}>{cell.day}</button>)}</div>
        </div>
      )}
    </div>
  );
}

export default function ReportDashboard({ records, startDate, endDate, generatedDate, fileCount, onRestart }) {
  const [view, setView] = useState("regions");
  const [orderQuery, setOrderQuery] = useState("");
  const [resultsUpdating, setResultsUpdating] = useState(false);
  const reportTitleRef = useRef(null);
  const tabRefs = useRef([]);
  const hasMountedResults = useRef(false);
  const defaultStart = startDate;
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
  const largestRegionalDecline = useMemo(
    () => regionDrivers.filter((driver) => driver.revenueChange < 0).sort((a, b) => a.revenueChange - b.revenueChange)[0] ?? null,
    [regionDrivers],
  );
  const regionalContributors = useMemo(() => {
    if (!largestRegionalDecline) return [];
    const matchesRegion = (record) => record.salesRegion.trim().toLowerCase() === largestRegionalDecline.label.trim().toLowerCase();
    return comparisonDrivers(
      currentRecords.filter(matchesRegion),
      priorRecords.filter(matchesRegion),
      "product",
      5,
    );
  }, [currentRecords, priorRecords, largestRegionalDecline]);
  const regionalCategoryContributors = useMemo(() => {
    if (!largestRegionalDecline) return [];
    const matchesRegion = (record) => record.salesRegion.trim().toLowerCase() === largestRegionalDecline.label.trim().toLowerCase();
    return comparisonDrivers(
      currentRecords.filter(matchesRegion),
      priorRecords.filter(matchesRegion),
      "productCategory",
      3,
    );
  }, [currentRecords, priorRecords, largestRegionalDecline]);
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
      || order.customerId.toLowerCase().includes(query)
      || order.customerName.toLowerCase().includes(query)
      || order.products.toLowerCase().includes(query)
      || order.salesRegion.toLowerCase().includes(query)
    ));
  }, [report.orders, orderQuery]);
  const presetRanges = useMemo(() => {
    const completedWeek = previousCompletedWeek(endDate);
    const usableCompletedWeek = completedWeek && completedWeek.endDate >= startDate
      ? { startDate: completedWeek.startDate < startDate ? startDate : completedWeek.startDate, endDate: completedWeek.endDate }
      : { startDate: shiftDate(endDate, -6) < startDate ? startDate : shiftDate(endDate, -6), endDate };
    return ({
    week: usableCompletedWeek,
    month: { startDate: calendarMonthRange(endDate).startDate < startDate ? startDate : calendarMonthRange(endDate).startDate, endDate },
    "previous-month": {
      startDate: calendarMonthRange(endDate, -1).startDate < startDate ? startDate : calendarMonthRange(endDate, -1).startDate,
      endDate: calendarMonthRange(endDate, -1).endDate > endDate ? endDate : calendarMonthRange(endDate, -1).endDate,
    },
    all: { startDate, endDate },
    });
  }, [endDate, startDate]);
  const activePeriod = Object.entries(presetRanges).find(([, range]) => range.startDate === filters.startDate && range.endDate === filters.endDate)?.[0] ?? "";
  const filtersDirty = filters.startDate !== defaultStart || filters.endDate !== endDate || Boolean(filters.region || filters.category || filters.segment);
  const activeFilterText = [
    `${shortDate(filters.startDate)} to ${shortDate(filters.endDate)}`,
    filters.region || "All regions",
    filters.category || "All categories",
    filters.segment || "All segments",
    countLabel(report.uniqueOrders, "matching order"),
  ].join(" · ");
  const managerSummary = useMemo(() => generateSummary(
    report,
    shortDate(filters.startDate),
    shortDate(filters.endDate),
    { changes, largestDecline: largestRegionalDecline, contributingDrivers: regionalContributors },
  ), [report, filters.startDate, filters.endDate, changes, largestRegionalDecline, regionalContributors]);

  useEffect(() => {
    reportTitleRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!hasMountedResults.current) {
      hasMountedResults.current = true;
      return undefined;
    }
    setResultsUpdating(true);
    const timer = window.setTimeout(() => setResultsUpdating(false), 160);
    return () => window.clearTimeout(timer);
  }, [filters, orderQuery, view]);
  const money = (value) => formatCurrency(value);
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));
  const resetFilters = () => setFilters({ startDate: defaultStart, endDate, region: "", category: "", segment: "" });
  const applyPeriod = (period) => {
    const range = presetRanges[period];
    setFilters((current) => ({
      ...current,
      startDate: range.startDate,
      endDate: range.endDate,
    }));
  };
  const handleTabKeyDown = (event, index) => {
    const keys = { ArrowRight: 1, ArrowLeft: -1 };
    let nextIndex = index;
    if (keys[event.key]) nextIndex = (index + keys[event.key] + Object.keys(views).length) % Object.keys(views).length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = Object.keys(views).length - 1;
    else return;
    event.preventDefault();
    const nextView = Object.keys(views)[nextIndex];
    setView(nextView);
    tabRefs.current[nextIndex]?.focus();
  };
  const confirmRestart = () => {
    if (window.confirm("Start a new report? This will clear the current files, validation, and filters.")) onRestart();
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
    orders: { label: "Orders", rows: visibleOrders, columns: [{ key: "orderNumber", label: "Order ID" }, { key: "date", label: "Date", render: shortDate }, { key: "customerId", label: "Customer ID" }, { key: "customerName", label: "Customer" }, { key: "salesRegion", label: "Region" }, { key: "products", label: "Products" }, { key: "revenue", label: "Sales", render: money }, { key: "profit", label: "Profit", render: money }] },
  };

  return (
    <section className="report-shell expanded-report" aria-labelledby="report-title">
      <header className="report-heading report-heading-expanded"><div><p className="issue-line">{shortDate(filters.startDate)} — {shortDate(filters.endDate)}</p><h3 id="report-title" ref={reportTitleRef} tabIndex="-1">Sales<br /><em>performance.</em></h3></div><div className="generated-meta"><strong>{generatedDate}</strong><small>{countLabel(fileCount, "file")} · {countLabel(report.activeDays, "active day")}</small></div></header>

      <section className="report-filter-panel no-print" aria-label="Report filters">
        <GoldDateInput id="report-start" label="From" min={startDate} max={filters.endDate} value={filters.startDate} onChange={(value) => updateFilter("startDate", value)} />
        <GoldDateInput id="report-end" label="To" min={filters.startDate} max={endDate} value={filters.endDate} onChange={(value) => updateFilter("endDate", value)} />
        <div><label htmlFor="report-region">Region</label><select id="report-region" value={filters.region} onChange={(event) => updateFilter("region", event.target.value)}><option value="">All regions</option>{options.regions.map((option) => <option key={option}>{option}</option>)}</select></div>
        <div><label htmlFor="report-category">Category</label><select id="report-category" value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}><option value="">All categories</option>{options.categories.map((option) => <option key={option}>{option}</option>)}</select></div>
        <div><label htmlFor="report-segment">Segment</label><select id="report-segment" value={filters.segment} onChange={(event) => updateFilter("segment", event.target.value)}><option value="">All segments</option>{options.segments.map((option) => <option key={option}>{option}</option>)}</select></div>
        <button type="button" disabled={!filtersDirty} onClick={resetFilters}>Reset filters</button>
        <div className="period-presets" aria-label="Quick reporting periods">
          <span>Quick periods</span>
          <button type="button" aria-pressed={activePeriod === "week"} onClick={() => applyPeriod("week")}>Previous completed week</button>
          <button type="button" aria-pressed={activePeriod === "month"} onClick={() => applyPeriod("month")}>Latest month</button>
          <button type="button" aria-pressed={activePeriod === "previous-month"} onClick={() => applyPeriod("previous-month")}>Previous month</button>
          <button type="button" aria-pressed={activePeriod === "all"} onClick={() => applyPeriod("all")}>All dates</button>
        </div>
        <p className="active-filter-summary" aria-live="polite"><strong>Showing</strong> {activeFilterText}</p>
      </section>

      <div className={`report-results${resultsUpdating ? " is-updating" : ""}`}>
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
            <div className="compact-analysis-table"><table><thead><tr><th>Product</th><th>Avg. discount</th><th>Profit</th><th>Margin</th></tr></thead><tbody>{highestDiscountProducts.map((product) => <tr className={product.profit < 0 ? "risk-row" : ""} key={product.product}><td title={product.product}>{product.product}</td><td>{(product.averageDiscount * 100).toFixed(1)}%</td><td className={changeClass(product.profit)}>{money(product.profit)}</td><td className={changeClass(product.profitMargin)}>{product.profitMargin.toFixed(1)}%</td></tr>)}</tbody></table></div>
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

      <section className="manager-summary-card" aria-labelledby="manager-summary-title">
        <div className="manager-summary-label"><span aria-hidden="true">M</span><div><p className="eyebrow">Ready for Monday</p><h4 id="manager-summary-title">Manager summary</h4></div></div>
        <div className="manager-summary-copy">
          <p>{managerSummary}</p>
          <small>Comparison: {shortDate(priorRange?.startDate)}–{shortDate(priorRange?.endDate)} · Current period: {shortDate(filters.startDate)}–{shortDate(filters.endDate)}</small>
        </div>
        {largestRegionalDecline ? <aside className="driver-evidence">
          <span>Why {largestRegionalDecline.label} changed</span>
          <strong>{money(largestRegionalDecline.revenueChange)} vs prior</strong>
          <ul>
            {regionalContributors.filter((driver) => driver.revenueChange < 0).slice(0, 3).map((driver) => <li key={driver.label}><span>{driver.label}</span><b>{money(driver.revenueChange)}</b></li>)}
            {regionalCategoryContributors.filter((driver) => driver.revenueChange < 0).slice(0, 2).map((driver) => <li key={`category-${driver.label}`}><span>{driver.label} category</span><b>{money(driver.revenueChange)}</b></li>)}
          </ul>
        </aside> : <aside className="driver-evidence positive-evidence"><span>Regional movement</span><strong>No region declined versus the prior period.</strong></aside>}
      </section>

      <section className="report-visuals" aria-labelledby="visual-overview-title">
        <div className="visuals-heading">
          <div><p className="eyebrow">Performance at a glance</p><h4 id="visual-overview-title">Where the business is moving.</h4></div>
          <p>Relative contribution across the current filtered period.</p>
        </div>
        <div className="visual-grid">
          <VisualRanking title="Sales by category" eyebrow="Revenue mix" rows={report.categories} labelKey="productCategory" valueFormatter={money} />
          <VisualRanking title="Sales by region" eyebrow="Market strength" rows={report.regions} labelKey="salesRegion" valueFormatter={money} tone="amber" />
          <VisualRanking title="Profit leaders" eyebrow="Margin contribution" rows={[...report.products].sort((a, b) => b.profit - a.profit)} labelKey="product" valueKey="profit" valueFormatter={money} tone="green" />
        </div>
      </section>

      <section className="breakdown-card expanded-breakdown">
        <div className="breakdown-head"><div><h4>Detail</h4><small>Review performance or trace an individual order.</small></div><div className="tabs" role="tablist" aria-label="Report breakdown">{Object.entries(views).map(([key, item], index) => <button id={`report-tab-${key}`} ref={(element) => { tabRefs.current[index] = element; }} type="button" role="tab" aria-controls={`report-panel-${key}`} aria-selected={view === key} tabIndex={view === key ? 0 : -1} className={view === key ? "active" : ""} onKeyDown={(event) => handleTabKeyDown(event, index)} onClick={() => setView(key)} key={key}>{item.label}</button>)}</div></div>
        {view === "orders" && <div className="order-search no-print"><label htmlFor="order-search">Find an order or customer</label><input id="order-search" type="search" value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="Search order ID, customer ID or name, product, or region" /><span>{countLabel(visibleOrders.length, "matching order")}</span></div>}
        <div id={`report-panel-${view}`} role="tabpanel" aria-labelledby={`report-tab-${view}`} tabIndex="0"><DataTable rows={views[view].rows} columns={views[view].columns} label={views[view].label} /></div>
      </section>
      </div>

      <section className="report-actions no-print"><div className="restart-action"><button className="button ghost danger-action" onClick={confirmRestart}>Start a new report</button><small>Clears the current files and report.</small></div><div><button className="button secondary" type="button" onClick={downloadFilteredCsv}>Download filtered CSV</button><button className="button primary" type="button" onClick={() => window.print()}>Print / Save PDF</button></div></section>
    </section>
  );
}
