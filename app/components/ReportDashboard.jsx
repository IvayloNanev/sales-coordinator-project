import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateReport,
  comparisonDrivers,
  formatCurrency,
  performanceChange,
  previousCompletedWeek,
  previousPeriod,
  recordsToCsv,
  SalesDataManager,
} from "../../lib/sales";
import useChartReveal from "../hooks/useChartReveal";

const MetricCard = ({ label, value, note, featured, trend, onAnimationEnd }) => <article className={`metric-card${featured ? " featured" : ""}`} onAnimationEnd={onAnimationEnd}><span>{label}</span><strong>{value}</strong>{note && <small className={trend ? changeClass(trend.value) : ""}>{note}</small>}</article>;

function RegionTrendSmallMultiples({ trends }) {
  if (!trends.length || trends.every((trend) => trend.weeks.length < 2)) return <p className="briefing-empty">Not enough weekly history is available for a regional trend.</p>;
  return (
    <div className="region-trend-grid">{trends.map((trend) => {
      const values = trend.weeks.map((week) => week.sales);
      const width = 300;
      const height = 86;
      const padding = 8;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const spread = Math.max(1, max - min);
      const points = trend.weeks.map((week, index) => ({ ...week, x: padding + (index / Math.max(1, trend.weeks.length - 1)) * (width - padding * 2), y: height - padding - ((week.sales - min) / spread) * (height - padding * 2) }));
      const latest = trend.weeks.at(-1);
      const prior = trend.weeks.at(-2);
      const change = latest.sales - prior.sales;
      const percentage = prior.sales ? (change / Math.abs(prior.sales)) * 100 : null;
      return <article className={`region-trend-card ${changeClass(change)}`} key={trend.region}><header><div><strong>{trend.region}</strong><small>8-week sales trend</small></div><span>{change > 0 ? "↑ Up" : change < 0 ? "↓ Down" : "— Flat"} {percentage === null ? "" : `${Math.abs(percentage).toFixed(1)}%`}</span></header><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${trend.region} weekly sales trend ending at ${formatCurrency(latest.sales)}`}><line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} className="region-trend-guide" /><polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} className="region-trend-line" /><circle cx={points.at(-2).x} cy={points.at(-2).y} r="4" className="region-trend-prior-point" /><circle cx={points.at(-1).x} cy={points.at(-1).y} r="5" className="region-trend-current-point" />{points.map((point) => <title key={point.startDate}>{`${point.startDate} to ${point.endDate}: ${formatCurrency(point.sales)}`}</title>)}</svg><footer><span>{trend.weeks[0].label}</span><strong>{formatCurrency(latest.sales)} reported week</strong><span>{latest.label}</span></footer></article>;
    })}</div>
  );
}

function DiscountMarginCards({ products }) {
  if (!products.length) return <p className="briefing-empty">Discount and margin data are unavailable for this period.</p>;
  return (
    <div className="discount-impact-list">{products.map((product, index) => {
      const isRisk = product.profitMargin < 0;
      return <article className={`discount-impact-item${isRisk ? " is-risk" : " is-positive"}`} key={product.product}><span className="risk-rank">{index + 1}</span><div className="discount-product"><strong>{product.product}</strong><small>{(product.averageDiscount * 100).toFixed(1)}% weighted discount</small></div><div className="discount-margin"><strong>{product.profitMargin.toFixed(1)}% margin</strong><small>{formatCurrency(product.profit)} profit</small></div><b className="margin-verdict">{isRisk ? "Hurting margin" : "Margin remains positive"}</b></article>;
    })}</div>
  );
}

function SalesTrend({ days, money }) {
  if (days.length < 2) return null;
  const width = 320;
  const height = 72;
  const padding = 5;
  const peak = Math.max(...days.map((day) => day.revenue), 1);
  const points = days.map((day, index) => {
    const x = padding + (index / (days.length - 1)) * (width - padding * 2);
    const y = height - padding - (Math.max(day.revenue, 0) / peak) * (height - padding * 2);
    return { x, y, ...day };
  });
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaString = `${padding},${height - padding} ${pointString} ${width - padding},${height - padding}`;
  const lastPoint = points.at(-1);
  return (
    <figure className="insight-trend">
      <figcaption><span>Daily sales trend</span><b>{money(lastPoint.revenue)} latest</b></figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily sales trend across ${days.length} active days`}>
        <polygon points={areaString} className="insight-trend-area" />
        <polyline points={pointString} pathLength="1" className="insight-trend-line" />
        <circle cx={lastPoint.x} cy={lastPoint.y} r="3.5" className="insight-trend-point" />
      </svg>
    </figure>
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
const changeLabel = (change) => {
  if (change.percentage === null) return change.value ? "New vs prior" : "No prior activity";
  const sign = change.percentage > 0 ? "+" : "";
  return `${sign}${change.percentage.toFixed(1)}% vs prior`;
};
const changeClass = (value) => value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
const comparisonLabel = (value, baseline) => {
  if (!baseline) return value ? "New activity" : "No activity";
  const percentage = ((value - baseline) / Math.abs(baseline)) * 100;
  return `${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%`;
};
const shiftYear = (value, offset) => {
  const date = new Date(`${value}T00:00:00Z`);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + offset);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
};
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
  const [view, setView] = useState("orders");
  const [orderQuery, setOrderQuery] = useState("");
  const [resultsUpdating, setResultsUpdating] = useState(false);
  const [customDatesOpen, setCustomDatesOpen] = useState(false);
  const [salesQuestion, setSalesQuestion] = useState("");
  const [salesAnswer, setSalesAnswer] = useState(null);
  const reportTitleRef = useRef(null);
  const briefingRevealRef = useChartReveal(true, { threshold: 0.06, rootMargin: "0px 0px 24% 0px" });
  const metricsRevealRef = useChartReveal(true, { threshold: 0.06, rootMargin: "0px 0px 24% 0px" });
  const managerSummaryRevealRef = useChartReveal(true, { threshold: 0.12, rootMargin: "0px 0px 8% 0px" });
  const actionableInsightsRevealRef = useChartReveal(true, { threshold: 0.12, rootMargin: "0px 0px 12% 0px" });
  const orderDetailRef = useRef(null);
  const tabRefs = useRef([]);
  const hasMountedResults = useRef(false);
  const completedDefault = previousCompletedWeek(endDate);
  const hasCompletedWeek = completedDefault && completedDefault.startDate >= startDate && completedDefault.endDate <= endDate;
  const defaultStart = hasCompletedWeek ? completedDefault.startDate : startDate;
  const defaultEnd = hasCompletedWeek ? completedDefault.endDate : endDate;
  const [filters, setFilters] = useState({
    startDate: defaultStart,
    endDate: defaultEnd,
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
  const regionalWeeklyTrends = useMemo(() => {
    const weeks = Array.from({ length: 8 }, (_, index) => {
      const end = shiftDate(filters.endDate, -(7 - index) * 7);
      return { startDate: shiftDate(end, -6), endDate: end, label: shortDate(end) };
    }).filter((week) => week.endDate >= startDate);
    const visibleRegions = filters.region ? [filters.region] : options.regions;
    return visibleRegions.map((region) => ({
      region,
      weeks: weeks.map((week) => ({
        ...week,
        sales: manager.filterData({ region, category: filters.category, segment: filters.segment, startDate: week.startDate, endDate: week.endDate }).reduce((sum, record) => sum + record.revenue, 0),
      })),
    }));
  }, [filters.category, filters.endDate, filters.region, filters.segment, manager, options.regions, startDate]);
  const currentRecords = useMemo(() => manager.filterData(filters), [manager, filters]);
  const report = useMemo(() => calculateReport(currentRecords), [currentRecords]);
  const priorRange = useMemo(() => previousPeriod(filters.startDate, filters.endDate), [filters.startDate, filters.endDate]);
  const priorRecords = useMemo(() => priorRange ? manager.filterData({
    ...filters,
    startDate: priorRange.startDate,
    endDate: priorRange.endDate,
  }) : [], [manager, filters, priorRange]);
  const priorReport = useMemo(() => calculateReport(priorRecords), [priorRecords]);
  const yearAgoRange = useMemo(() => ({
    startDate: shiftYear(filters.startDate, -1),
    endDate: shiftYear(filters.endDate, -1),
  }), [filters.startDate, filters.endDate]);
  const yearAgoRecords = useMemo(() => manager.filterData({
    ...filters,
    startDate: yearAgoRange.startDate,
    endDate: yearAgoRange.endDate,
  }), [manager, filters, yearAgoRange]);
  const yearAgoReport = useMemo(() => calculateReport(yearAgoRecords), [yearAgoRecords]);
  const changes = useMemo(() => performanceChange(report, priorReport), [report, priorReport]);
  const categoryDrivers = useMemo(() => comparisonDrivers(currentRecords, priorRecords, "productCategory"), [currentRecords, priorRecords]);
  const regionDrivers = useMemo(() => comparisonDrivers(currentRecords, priorRecords, "salesRegion"), [currentRecords, priorRecords]);
  const categoryChanges = useMemo(
    () => new Map(categoryDrivers.map((driver) => [driver.label, driver.revenueChange])),
    [categoryDrivers],
  );
  const largestRegionalDecline = useMemo(
    () => regionDrivers.filter((driver) => driver.revenueChange < 0).sort((a, b) => a.revenueChange - b.revenueChange)[0] ?? null,
    [regionDrivers],
  );
  const highestDiscountProducts = useMemo(
    () => report.products
      .filter((product) => Number.isFinite(product.averageDiscount) && product.averageDiscount > 0 && Number.isFinite(product.profitMargin))
      .sort((a, b) => b.averageDiscount - a.averageDiscount || (a.profit ?? 0) - (b.profit ?? 0))
      .slice(0, 5),
    [report.products],
  );
  const atRiskCustomers = useMemo(() => {
    const currentCustomerNames = new Set(report.customers.map((customer) => customer.customerName.trim().toLowerCase()));
    return priorReport.customers
      .filter((customer) => !currentCustomerNames.has(customer.customerName.trim().toLowerCase()))
      .sort((a, b) => b.revenue - a.revenue);
  }, [report.customers, priorReport.customers]);
  const unprofitableCustomers = useMemo(
    () => report.customers
      .filter((customer) => Number.isFinite(customer.profit) && customer.profit < 0)
      .sort((a, b) => a.profit - b.profit),
    [report.customers],
  );
  const unprofitableProducts = useMemo(
    () => report.products
      .filter((product) => Number.isFinite(product.profit) && product.profit < 0)
      .sort((a, b) => a.profit - b.profit),
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
  const filtersDirty = filters.startDate !== defaultStart || filters.endDate !== defaultEnd || Boolean(filters.region || filters.category || filters.segment);
  const isCompletedWeekSelected = Boolean(completedDefault && filters.startDate === completedDefault.startDate && filters.endDate === completedDefault.endDate);
  const isCompletedWeeklyRange = new Date(`${filters.startDate}T00:00:00Z`).getUTCDay() === 1
    && new Date(`${filters.endDate}T00:00:00Z`).getUTCDay() === 0
    && shiftDate(filters.startDate, 6) === filters.endDate;
  const managerSummaryPoints = useMemo(() => {
    const regionsUp = regionDrivers.filter((driver) => driver.revenueChange > 0);
    const regionsDown = regionDrivers.filter((driver) => driver.revenueChange < 0);
    return [
      {
        label: "Sales by category",
        value: report.categories.length ? report.categories.map((category) => `${category.productCategory} ${formatCurrency(category.revenue)}`).join(" · ") : "Unavailable",
      },
      {
        label: "Regions vs prior period",
        value: `Up: ${regionsUp.length ? regionsUp.map((driver) => `${driver.label} (+${formatCurrency(driver.revenueChange)})`).join(", ") : "none"} · Down: ${regionsDown.length ? regionsDown.map((driver) => `${driver.label} (${formatCurrency(driver.revenueChange)})`).join(", ") : "none"}`,
      },
      {
        label: "Biggest discounts",
        value: highestDiscountProducts.length ? highestDiscountProducts.slice(0, 3).map((product) => `${product.product} ${(product.averageDiscount * 100).toFixed(1)}%`).join(" · ") : "Unavailable",
      },
      {
        label: "Margin impact",
        value: highestDiscountProducts.length ? highestDiscountProducts.slice(0, 3).map((product) => `${product.product}: ${product.profitMargin.toFixed(1)}% margin (${product.profitMargin < 0 ? "hurt margin" : "remained positive"})`).join(" · ") : "Unavailable",
      },
    ];
  }, [report.categories, regionDrivers, highestDiscountProducts]);

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
  const resetFilters = () => setFilters({ startDate: defaultStart, endDate: defaultEnd, region: "", category: "", segment: "" });
  const earlierWeek = { startDate: shiftDate(filters.startDate, -7), endDate: shiftDate(filters.endDate, -7) };
  const laterWeek = { startDate: shiftDate(filters.startDate, 7), endDate: shiftDate(filters.endDate, 7) };
  const canInspectEarlierWeek = earlierWeek.startDate >= startDate;
  const canInspectLaterWeek = Boolean(completedDefault && laterWeek.endDate <= completedDefault.endDate);
  const moveReportWeek = (direction) => {
    const range = direction < 0 ? earlierWeek : laterWeek;
    setFilters((current) => ({ ...current, startDate: range.startDate, endDate: range.endDate }));
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
    regions: { label: "Regions", rows: report.regions, columns: [{ key: "salesRegion", label: "Region" }, { key: "orders", label: "Orders" }, { key: "revenue", label: "Sales", render: money }, { key: "profit", label: "Profit", render: (value) => Number.isFinite(value) ? money(value) : "Unavailable" }, { key: "profitMargin", label: "Margin", render: (value) => Number.isFinite(value) ? `${value.toFixed(1)}%` : "Unavailable" }] },
    categories: { label: "Categories", rows: report.categories, columns: [{ key: "productCategory", label: "Category" }, { key: "orders", label: "Orders" }, { key: "revenue", label: "Sales", render: money }, { key: "profit", label: "Profit", render: (value) => Number.isFinite(value) ? money(value) : "Unavailable" }, { key: "profitMargin", label: "Margin", render: (value) => Number.isFinite(value) ? `${value.toFixed(1)}%` : "Unavailable" }] },
    products: { label: "Products", rows: report.products, columns: [{ key: "product", label: "Product" }, { key: "productCategory", label: "Category" }, { key: "revenue", label: "Sales", render: money }, { key: "profit", label: "Profit", render: (value) => Number.isFinite(value) ? money(value) : "Unavailable" }, { key: "averageDiscount", label: "Weighted discount", render: (value) => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "Unavailable" }] },
    orders: { label: "Orders", rows: visibleOrders, columns: [{ key: "orderNumber", label: "Order ID" }, { key: "date", label: "Date", render: shortDate }, { key: "customerName", label: "Customer" }, { key: "products", label: "Products" }, { key: "categories", label: "Categories" }, { key: "salesRegion", label: "Region" }, { key: "units", label: "Quantity" }, { key: "revenue", label: "Sales", render: money }, { key: "averageDiscount", label: "Discount", render: (value) => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "Unavailable" }, { key: "profit", label: "Profit", render: (value) => Number.isFinite(value) ? money(value) : "Unavailable" }] },
  };
  const answerSalesQuestion = (rawQuestion) => {
    const question = rawQuestion.trim();
    if (!question) return;
    const normalized = question.toLowerCase();
    const requestedRegion = options.regions.find((region) => normalized.includes(region.toLowerCase()));
    let answer;
    if (requestedRegion) {
      const matchesRegion = (record) => record.salesRegion.trim().toLowerCase() === requestedRegion.toLowerCase();
      const currentRegionRecords = currentRecords.filter(matchesRegion);
      const priorRegionRecords = priorRecords.filter(matchesRegion);
      const currentRegionSales = currentRegionRecords.reduce((sum, record) => sum + record.revenue, 0);
      const priorRegionSales = priorRegionRecords.reduce((sum, record) => sum + record.revenue, 0);
      const change = currentRegionSales - priorRegionSales;
      const productDrivers = comparisonDrivers(currentRegionRecords, priorRegionRecords, "product", 3);
      const categoryDriver = comparisonDrivers(currentRegionRecords, priorRegionRecords, "productCategory", 1)[0];
      const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
      const drivers = productDrivers.filter((driver) => change < 0 ? driver.revenueChange < 0 : driver.revenueChange > 0);
      answer = {
        title: `${requestedRegion} is ${direction} ${money(Math.abs(change))} versus the prior period.`,
        explanation: drivers.length ? `${drivers.slice(0, 2).map((driver) => `${driver.label} (${driver.revenueChange > 0 ? "+" : ""}${money(driver.revenueChange)})`).join(" and ")} explain the largest product-level movement.${categoryDriver ? ` ${categoryDriver.label} was the strongest category driver (${categoryDriver.revenueChange > 0 ? "+" : ""}${money(categoryDriver.revenueChange)}).` : ""}` : "No single product driver explains a material change in this selected period.",
      };
    } else if (normalized.includes("discount") || normalized.includes("margin")) {
      answer = {
        title: highestDiscountProducts.length ? `${highestDiscountProducts[0].product} had the highest weighted discount at ${(highestDiscountProducts[0].averageDiscount * 100).toFixed(1)}%.` : "Discount and margin data are unavailable.",
        explanation: highestDiscountProducts.length ? highestDiscountProducts.slice(0, 3).map((product) => `${product.product}: ${product.profitMargin.toFixed(1)}% margin—${product.profitMargin < 0 ? "the discount hurt margin" : "margin remained positive"}`).join(" · ") : "Upload complete discount and profit columns to answer this question.",
      };
    } else if (normalized.includes("categor")) {
      answer = { title: `${report.highestRevenueCategory} led category sales.`, explanation: report.categories.map((category) => `${category.productCategory}: ${money(category.revenue)}`).join(" · ") };
    } else if (normalized.includes("region")) {
      const up = regionDrivers.filter((driver) => driver.revenueChange > 0);
      const down = regionDrivers.filter((driver) => driver.revenueChange < 0);
      answer = { title: `${up.length} ${up.length === 1 ? "region is" : "regions are"} up; ${down.length} ${down.length === 1 ? "is" : "are"} down.`, explanation: `Up: ${up.length ? up.map((driver) => `${driver.label} (+${money(driver.revenueChange)})`).join(", ") : "none"}. Down: ${down.length ? down.map((driver) => `${driver.label} (${money(driver.revenueChange)})`).join(", ") : "none"}.` };
    } else {
      answer = { title: `${money(report.totalRevenue)} in sales across ${report.uniqueOrders.toLocaleString()} orders.`, explanation: `Ask about a named region, category sales, or discounts and margins for a more specific explanation.` };
    }
    setSalesQuestion(question);
    setSalesAnswer({ question, ...answer });
  };
  const questionSuggestions = [
    `Why is ${largestRegionalDecline?.label || options.regions[0] || "the leading"} region ${largestRegionalDecline ? "down" : "changing"}?`,
    "Which regions are up or down?",
    "Which discounts hurt our margins?",
    "What are total sales by category?",
  ];

  return (
    <section className="report-shell expanded-report" aria-labelledby="report-title">
      <header className="report-heading report-heading-expanded"><div><p className="issue-line">{shortDate(filters.startDate)} — {shortDate(filters.endDate)}</p><h3 id="report-title" ref={reportTitleRef} tabIndex="-1">Weekly Manager <em>Report.</em></h3></div><div className="generated-meta"><strong>{generatedDate}</strong><small>{countLabel(fileCount, "file")} · {countLabel(report.activeDays, "active day")}</small></div></header>

      <div className={`report-results${resultsUpdating ? " is-updating" : ""}`}>
      <section className="monday-briefing" ref={briefingRevealRef} aria-labelledby="monday-briefing-title">
        <div className="briefing-heading"><div><p className="eyebrow">Monday briefing</p><h4 id="monday-briefing-title">{isCompletedWeeklyRange ? "Week of " : "Selected dates: "}{shortDate(filters.startDate)}–{shortDate(filters.endDate)}</h4><small>Compared with {shortDate(priorRange?.startDate)}–{shortDate(priorRange?.endDate)}</small></div><div className="week-navigation no-print"><span>{isCompletedWeekSelected ? "Latest completed week" : isCompletedWeeklyRange ? "Earlier completed week" : "Custom date range"}</span><div><button type="button" disabled={!canInspectEarlierWeek} onClick={() => moveReportWeek(-1)}>← Previous week</button><button type="button" disabled={!canInspectLaterWeek} onClick={() => moveReportWeek(1)}>Later week →</button><button type="button" aria-expanded={customDatesOpen} aria-controls="briefing-custom-dates" onClick={() => setCustomDatesOpen((open) => !open)}>Custom dates</button></div></div></div>
        {customDatesOpen ? <div className="briefing-custom-dates no-print" id="briefing-custom-dates"><GoldDateInput id="briefing-start" label="Custom start" min={startDate} max={filters.endDate} value={filters.startDate} onChange={(value) => updateFilter("startDate", value)} /><GoldDateInput id="briefing-end" label="Custom end" min={filters.startDate} max={endDate} value={filters.endDate} onChange={(value) => updateFilter("endDate", value)} /><button type="button" onClick={() => setCustomDatesOpen(false)}>Done</button></div> : null}
        <div className="briefing-grid">
          <section className="analysis-panel" aria-labelledby="category-briefing-title">
            <div className="card-heading"><h5 id="category-briefing-title">Sales by category</h5><span>vs prior period</span></div>
            <div className="briefing-ranking">{report.categories.map((category, index) => {
              const change = categoryChanges.get(category.productCategory) ?? 0;
              const maxRevenue = report.categories[0]?.revenue || 1;
              return <div className="briefing-rank-row" style={{ "--briefing-index": index * 3 }} key={category.productCategory}><div className="briefing-rank-label"><strong>{category.productCategory}</strong><span>{money(category.revenue)}</span></div><div className="briefing-bar-track"><span style={{ width: `${Math.max(4, (category.revenue / maxRevenue) * 100)}%` }} /></div><small className={changeClass(change)}>{change > 0 ? "▲ " : change < 0 ? "▼ " : "— "}{money(Math.abs(change))}</small></div>;
            })}</div>
          </section>

          <section className="analysis-panel" aria-labelledby="region-briefing-title">
            <div className="card-heading"><h5 id="region-briefing-title">Regional sales trends</h5><span>Eight completed weeks · latest change highlighted</span></div>
            <RegionTrendSmallMultiples trends={regionalWeeklyTrends} />
          </section>

          <section className="analysis-panel discount-risk-panel" aria-labelledby="discount-risk-title">
            <div className="card-heading"><h5 id="discount-risk-title">Highest-discount products</h5><span>Direct margin verdict</span></div>
            <DiscountMarginCards products={highestDiscountProducts} />
          </section>
        </div>
      </section>

      <section className="manager-summary-card" ref={managerSummaryRevealRef} aria-labelledby="manager-summary-title">
        <div className="manager-summary-overview">
          <header className="manager-summary-label"><span aria-hidden="true">M</span><div><h4 id="manager-summary-title">Manager summary</h4><small>{shortDate(filters.startDate)}–{shortDate(filters.endDate)} vs {shortDate(priorRange?.startDate)}–{shortDate(priorRange?.endDate)}</small></div></header>
          <div className="manager-summary-copy">
            <ul className="manager-summary-points">
              {managerSummaryPoints.map((point) => <li key={point.label}><strong>{point.label}</strong><span>{point.value}</span></li>)}
            </ul>
          </div>
        </div>
        <div className="sales-question-tool" aria-labelledby="sales-question-title">
          <div className="sales-question-heading"><h5 id="sales-question-title">Get the reason behind the number</h5></div>
          <form className="sales-question-form" onSubmit={(event) => { event.preventDefault(); answerSalesQuestion(salesQuestion); }}><label className="sr-only" htmlFor="sales-question">Ask a sales question</label><input id="sales-question" value={salesQuestion} onChange={(event) => setSalesQuestion(event.target.value)} placeholder="For example: Why is the West region down?" /><button className="button primary" type="submit">Answer</button><button className="sales-question-reset" type="button" disabled={!salesQuestion && !salesAnswer} onClick={() => { setSalesQuestion(""); setSalesAnswer(null); }}>Reset</button></form>
          <div className="question-suggestions no-print" aria-label="Suggested questions">{questionSuggestions.map((question) => <button type="button" key={question} onClick={() => answerSalesQuestion(question)}>{question}</button>)}</div>
          {salesAnswer ? <article className="sales-answer" aria-live="polite"><span>Answer</span><p className="sales-answer-question">“{salesAnswer.question}”</p><strong>{salesAnswer.title}</strong><p>{salesAnswer.explanation}</p></article> : <p className="sales-question-empty">Choose a suggested question or ask one in your own words.</p>}
        </div>
      </section>

      <section className="order-data-overview" ref={orderDetailRef} aria-labelledby="order-data-title">
        <div className="order-data-overview-head"><div><p className="eyebrow">Order-level data</p><h4 id="order-data-title">Every order is available for inspection.</h4><p>Trace the figures in this report back to the underlying transaction details.</p></div><ul aria-label="Available order fields">{["Date", "Customer", "Product", "Category", "Region", "Quantity", "Price / sales", "Discount", "Profit"].map((field) => <li key={field}>{field}</li>)}</ul></div>
        <section className="report-filter-panel detail-filter-panel embedded-detail-filters no-print" aria-label="Order data filters">
          <div className="report-filter-field"><label htmlFor="report-region">Region</label><select id="report-region" value={filters.region} onChange={(event) => updateFilter("region", event.target.value)}><option value="">All regions</option>{options.regions.map((option) => <option key={option}>{option}</option>)}</select></div>
          <div className="report-filter-field"><label htmlFor="report-category">Category</label><select id="report-category" value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}><option value="">All categories</option>{options.categories.map((option) => <option key={option}>{option}</option>)}</select></div>
          <div className="report-filter-field"><label htmlFor="report-segment">Segment</label><select id="report-segment" value={filters.segment} onChange={(event) => updateFilter("segment", event.target.value)}><option value="">All segments</option>{options.segments.map((option) => <option key={option}>{option}</option>)}</select></div>
          <div className="filter-reset-field"><span>Actions</span><button type="button" disabled={!filtersDirty} onClick={resetFilters}>Reset filters</button></div>
          <p className="active-filter-summary" aria-live="polite"><strong>Showing</strong> {countLabel(report.uniqueOrders, "order")} across {filters.region || "all regions"}, {filters.category || "all categories"}, and {filters.segment || "all segments"}.</p>
        </section>
        <div className="order-data-detail">
          <div className="breakdown-head"><div><h5>Explore the data</h5><small>Review performance or trace an individual order.</small></div><div className="tabs" role="tablist" aria-label="Report breakdown">{Object.entries(views).map(([key, item], index) => <button id={`report-tab-${key}`} ref={(element) => { tabRefs.current[index] = element; }} type="button" role="tab" aria-controls={`report-panel-${key}`} aria-selected={view === key} tabIndex={view === key ? 0 : -1} className={view === key ? "active" : ""} onKeyDown={(event) => handleTabKeyDown(event, index)} onClick={() => setView(key)} key={key}>{item.label}</button>)}</div></div>
          {view === "orders" && <div className="order-search no-print"><label htmlFor="order-search">Find an order or customer</label><input id="order-search" type="search" value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="Search order ID, customer ID or name, product, or region" /><span>{countLabel(visibleOrders.length, "matching order")}</span></div>}
          <div id={`report-panel-${view}`} className={view === "orders" ? "orders-panel" : undefined} role="tabpanel" aria-labelledby={`report-tab-${view}`} tabIndex="0"><DataTable rows={views[view].rows} columns={views[view].columns} label={views[view].label} /></div>
        </div>
      </section>

      <div className="metric-grid metric-grid-expanded" ref={metricsRevealRef}>
        <MetricCard featured label="Sales" value={money(report.totalRevenue)} note={changeLabel(changes.revenue)} trend={changes.revenue} />
        <MetricCard featured label="Profit" value={report.profitAvailability === "available" ? money(report.totalProfit) : "Unavailable"} note={report.profitAvailability === "available" ? `${changeLabel(changes.profit)} · ${report.profitMargin.toFixed(1)}% margin` : report.profitAvailability === "partial" ? "Partial profit data; analysis withheld" : "Profit column not supplied"} trend={report.profitAvailability === "available" ? changes.profit : null} />
        <MetricCard label="Orders" value={report.uniqueOrders.toLocaleString()} note={changeLabel(changes.orders)} trend={changes.orders} />
        <MetricCard label="Units sold" value={report.totalUnits.toLocaleString()} note={changeLabel(changes.units)} trend={changes.units} />
        <MetricCard label="Average order" value={money(report.averageOrderValue)} note={`Median ${money(report.medianOrderValue)}`} />
      </div>

      <section className="breakdown-card discount-impact-summary" aria-labelledby="discount-impact-title">
        <div className="breakdown-head"><div><h4 id="discount-impact-title">Discount impact</h4><small>{report.discountAvailability === "available" ? `${(report.averageDiscount * 100).toFixed(1)}% weighted discount across visible sales.` : "Discount rate is weighted by visible sales."}</small></div></div>
        {report.discountAvailability === "available" ? <div className="compact-analysis-table"><table><thead><tr><th>Group</th><th>Sales</th><th>Orders</th><th>Units</th><th>Profit</th><th>Margin</th></tr></thead><tbody>{report.discountImpact.map((group) => <tr key={group.kind}><td>{group.kind === "discounted" ? "Discounted lines" : "Non-discounted lines"}</td><td>{money(group.sales)}</td><td>{group.orders.toLocaleString()}</td><td>{group.units.toLocaleString()}</td><td>{Number.isFinite(group.profit) ? money(group.profit) : "Unavailable"}</td><td>{Number.isFinite(group.profitMargin) ? `${group.profitMargin.toFixed(1)}%` : "Unavailable"}</td></tr>)}</tbody></table></div> : <p className="briefing-empty">{report.discountAvailability === "partial" ? "Discount data is only partially available, so the comparison is withheld." : "Discount data unavailable."}</p>}
      </section>

      <section className="actionable-insights" ref={actionableInsightsRevealRef} aria-labelledby="actionable-insights-title">
        <div className="actionable-insights-heading">
          <h4 id="actionable-insights-title">Recommended actions</h4>
          <p>Three evidence-based priorities for the next manager conversation.</p>
        </div>
        <div className="actionable-insights-grid">
          <article className="insight-card insight-card-risk">
            <div className="insight-card-topline"><span aria-hidden="true">01</span><p>Customer retention</p></div>
            <strong>{countLabel(atRiskCustomers.length, "at-risk customer")}</strong>
            <p>{atRiskCustomers.length ? `${money(atRiskCustomers.reduce((sum, customer) => sum + customer.revenue, 0))} in prior-period sales has not returned.` : "Every prior-period customer returned in the current period."}</p>
            <details>
              <summary><span className="details-open-label">{atRiskCustomers.length ? "View customers" : "View status"}</span><span className="details-close-label">Close details</span></summary>
              {atRiskCustomers.length ? <ul>{atRiskCustomers.slice(0, 5).map((customer) => <li key={customer.customerName}><span>{customer.customerName}</span><b>{money(customer.revenue)}</b></li>)}</ul> : <p className="insight-empty">No customer follow-up is required from this signal.</p>}
            </details>
          </article>

          <article className="insight-card insight-card-profit">
            <div className="insight-card-topline"><span aria-hidden="true">02</span><p>Profit protection</p></div>
            <strong>{countLabel(unprofitableProducts.length + unprofitableCustomers.length, "profit risk")}</strong>
            <p>{report.profitAvailability === "available" ? `${countLabel(unprofitableProducts.length, "product")} and ${countLabel(unprofitableCustomers.length, "customer")} are below zero profit.` : "Complete profit data is required to identify margin risks."}</p>
            <details>
              <summary><span className="details-open-label">View risks</span><span className="details-close-label">Close details</span></summary>
              {report.profitAvailability === "available" && (unprofitableProducts.length || unprofitableCustomers.length) ? <>
                {unprofitableProducts.length > 0 && <div className="insight-detail-group"><span>Products</span><ul>{unprofitableProducts.slice(0, 3).map((product) => <li key={product.product}><span>{product.product}</span><b>{money(product.profit)}</b></li>)}</ul></div>}
                {unprofitableCustomers.length > 0 && <div className="insight-detail-group"><span>Customers</span><ul>{unprofitableCustomers.slice(0, 3).map((customer) => <li key={customer.customerName}><span>{customer.customerName}</span><b>{money(customer.profit)}</b></li>)}</ul></div>}
              </> : <p className="insight-empty">{report.profitAvailability === "available" ? "No negative-profit customers or products were found." : "Profit analysis is unavailable for this file."}</p>}
            </details>
          </article>

          <article className="insight-card insight-card-year">
            <div className="insight-card-topline"><span aria-hidden="true">03</span><p>Year-over-year</p></div>
            <strong className={changeClass(report.totalRevenue - yearAgoReport.totalRevenue)}>{comparisonLabel(report.totalRevenue, yearAgoReport.totalRevenue)} sales</strong>
            <p>{yearAgoRecords.length ? `Compared with ${shortDate(yearAgoRange.startDate)}–${shortDate(yearAgoRange.endDate)}.` : "No matching activity was found for the same period last year."}</p>
            <SalesTrend days={report.daily} money={money} />
            <details>
              <summary><span className="details-open-label">View comparison</span><span className="details-close-label">Close details</span></summary>
              <dl className="insight-comparison">
                <div><dt>Sales</dt><dd>{money(report.totalRevenue)} <span>{comparisonLabel(report.totalRevenue, yearAgoReport.totalRevenue)}</span></dd></div>
                <div><dt>Orders</dt><dd>{report.uniqueOrders.toLocaleString()} <span>{comparisonLabel(report.uniqueOrders, yearAgoReport.uniqueOrders)}</span></dd></div>
                <div><dt>Profit</dt><dd>{report.totalProfit === null ? "Unavailable" : money(report.totalProfit)} <span>{report.totalProfit === null || yearAgoReport.totalProfit === null ? "—" : comparisonLabel(report.totalProfit, yearAgoReport.totalProfit)}</span></dd></div>
              </dl>
            </details>
          </article>
        </div>
      </section>

      </div>

      <section className="report-actions no-print"><div className="restart-action"><button className="button ghost danger-action" onClick={confirmRestart}>Start a new report</button><small>Clears the current files and report.</small></div><div><button className="button secondary" type="button" onClick={downloadFilteredCsv}>Download filtered CSV</button><button className="button primary" type="button" onClick={() => window.print()}>Print / Save PDF</button></div></section>
    </section>
  );
}
