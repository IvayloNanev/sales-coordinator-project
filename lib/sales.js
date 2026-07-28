export const REQUIRED_COLUMNS = [
  "Date",
  "Store ID",
  "Store name",
  "Order number",
  "Customer name",
  "Product",
  "Product category",
  "Sales region",
  "Quantity sold",
  "Revenue",
];

const FIELD_BY_HEADER = {
  date: "date",
  orderdate: "date",
  storeid: "storeId",
  postalcode: "storeId",
  storename: "storeName",
  city: "storeCity",
  state: "storeState",
  ordernumber: "orderNumber",
  orderid: "orderNumber",
  customername: "customerName",
  product: "product",
  productname: "product",
  productcategory: "productCategory",
  category: "productCategory",
  salesregion: "salesRegion",
  region: "salesRegion",
  quantitysold: "quantitySold",
  quantity: "quantitySold",
  revenue: "revenue",
  sales: "revenue",
  rowid: "lineItemId",
  shipdate: "shipDate",
  shipmode: "shipMode",
  customerid: "customerId",
  segment: "segment",
  productid: "productId",
  subcategory: "subCategory",
  discount: "discount",
  profit: "profit",
};

const REQUIRED_FIELDS = [
  ["Date", "date"],
  ["Store ID", "storeId"],
  ["Store name", "storeName"],
  ["Order number", "orderNumber"],
  ["Customer name", "customerName"],
  ["Product", "product"],
  ["Product category", "productCategory"],
  ["Sales region", "salesRegion"],
  ["Quantity sold", "quantitySold"],
  ["Revenue", "revenue"],
];

const cleanHeader = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const cleanCell = (value) => String(value ?? "").trim();

export function normalizeDate(value) {
  const text = cleanCell(value);
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const usMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!isoMatch && !usMatch) return null;

  const [, yearText, monthText, dayText] = isoMatch ?? [usMatch[0], usMatch[3], usMatch[1], usMatch[2]];
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${yearText.padStart(4, "0")}-${monthText.padStart(2, "0")}-${dayText.padStart(2, "0")}`;
}

export function getDateRange(records) {
  const dates = records.map((record) => normalizeDate(record.date)).filter(Boolean).sort();
  return dates.length ? { startDate: dates[0], endDate: dates.at(-1) } : null;
}

export function parseCsvRows(text, delimiter = ",") {
  const rows = [];
  const errors = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => cleanCell(value) !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) errors.push("Unclosed quoted value");
  row.push(cell);
  if (row.some((value) => cleanCell(value) !== "")) rows.push(row);
  return { rows, errors };
}

function parseTableRows(rows, sourceFile = "Uploaded file", syntaxErrors = []) {
  if (!rows.length) {
    return { records: [], fileErrors: [{ sourceFile, rowNumber: 1, orderNumber: "", error: "File is empty" }] };
  }

  const headers = rows[0].map(cleanHeader);
  const availableFields = new Set(headers.map((header) => FIELD_BY_HEADER[header]).filter(Boolean));
  if (availableFields.has("storeCity")) {
    availableFields.add("storeName");
    availableFields.add("storeId");
  }
  const missingColumns = REQUIRED_FIELDS
    .filter(([, field]) => !availableFields.has(field))
    .map(([column]) => column);
  const fileErrors = [
    ...syntaxErrors.map((error) => ({ sourceFile, rowNumber: 1, orderNumber: "", error: `Malformed CSV: ${error}` })),
    ...missingColumns.map((column) => ({ sourceFile, rowNumber: 1, orderNumber: "", error: `Missing required column: ${column}` })),
  ];

  if (missingColumns.length || syntaxErrors.length) return { records: [], fileErrors };

  const records = [];
  rows.slice(1).forEach((values, index) => {
    const record = { sourceFile, rowNumber: index + 2 };
    headers.forEach((header, columnIndex) => {
      const field = FIELD_BY_HEADER[header];
      if (field) record[field] = cleanCell(values[columnIndex]);
    });
    if (!record.storeName && record.storeCity) {
      record.storeName = record.storeState ? `${record.storeCity}, ${record.storeState}` : record.storeCity;
    }
    if (!record.storeId && record.storeCity) {
      record.storeId = record.storeState ? `${record.storeCity}, ${record.storeState}` : record.storeCity;
    }
    delete record.storeCity;
    delete record.storeState;
    if (values.length !== headers.length) record.malformedRow = true;
    records.push(record);
  });

  return { records, fileErrors };
}

export function parseCsvText(text, sourceFile = "Uploaded file", delimiter = ",") {
  const normalizedText = String(text ?? "").replace(/^\uFEFF/, "");
  const { rows, errors } = parseCsvRows(normalizedText, delimiter);
  return parseTableRows(rows, sourceFile, errors);
}

export async function parseCsvFile(file) {
  return parseCsvText(await file.text(), file.name);
}

function parseJsonText(text, sourceFile) {
  try {
    const value = JSON.parse(text);
    const objects = Array.isArray(value) ? value : Array.isArray(value?.records) ? value.records : [value];
    if (!objects.length || objects.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
      throw new Error("JSON must contain an object or an array of row objects");
    }
    const headers = [...new Set(objects.flatMap((item) => Object.keys(item)))];
    const rows = [headers, ...objects.map((item) => headers.map((header) => item[header] ?? ""))];
    return parseTableRows(rows, sourceFile);
  } catch (error) {
    return { records: [], fileErrors: [{ sourceFile, rowNumber: 1, orderNumber: "", error: `Unable to read JSON: ${error.message}` }] };
  }
}

async function parseWorkbookFile(file) {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
    const parsedSheets = workbook.SheetNames.map((sheetName) => {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
      return parseTableRows(rows, `${file.name} · ${sheetName}`);
    });
    return {
      records: parsedSheets.flatMap((sheet) => sheet.records),
      fileErrors: parsedSheets.flatMap((sheet) => sheet.fileErrors),
    };
  } catch (error) {
    return { records: [], fileErrors: [{ sourceFile: file.name, rowNumber: 1, orderNumber: "", error: `Unable to read spreadsheet: ${error.message}` }] };
  }
}

async function parsePdfFile(file) {
  try {
    const [pdfjs, worker] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const rows = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = new Map();
      content.items.forEach((item) => {
        const text = String(item.str ?? "").trim();
        if (!text) return;
        const y = Math.round(item.transform?.[5] ?? 0);
        const x = item.transform?.[4] ?? 0;
        const line = lines.get(y) ?? [];
        line.push({ x, text });
        lines.set(y, line);
      });
      [...lines.entries()]
        .sort(([a], [b]) => b - a)
        .forEach(([, cells]) => rows.push(cells.sort((a, b) => a.x - b.x).map((cell) => cell.text)));
    }

    return parseTableRows(rows, file.name);
  } catch (error) {
    return { records: [], fileErrors: [{ sourceFile: file.name, rowNumber: 1, orderNumber: "", error: `Unable to extract a sales table from PDF: ${error.message}` }] };
  }
}

export async function parseInputFile(file) {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (["xlsx", "xls", "xlsm", "ods"].includes(extension)) return parseWorkbookFile(file);
  if (extension === "pdf" || file.type === "application/pdf") return parsePdfFile(file);
  if (extension === "json" || file.type === "application/json") return parseJsonText(await file.text(), file.name);
  if (extension === "tsv" || extension === "tab") return parseCsvText(await file.text(), file.name, "\t");
  if (extension === "psv") return parseCsvText(await file.text(), file.name, "|");
  if (["csv", "txt", "dat"].includes(extension) || file.type.startsWith("text/")) {
    const text = await file.text();
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes("|") && !firstLine.includes(",") ? "|" : ",";
    return parseCsvText(text, file.name, delimiter);
  }
  return {
    records: [],
    fileErrors: [{ sourceFile: file.name, rowNumber: 1, orderNumber: "", error: "File accepted, but this format does not expose a readable sales table" }],
  };
}

export function validateRecords(records, fileErrors = []) {
  const invalidRecords = [];
  const validRecords = [];
  const seenValidRecords = new Set();
  let duplicateRecords = 0;

  records.forEach((record) => {
    const errors = [];
    if (!cleanCell(record.date)) errors.push("Missing date");
    else if (!normalizeDate(record.date)) errors.push("Date must use YYYY-MM-DD or MM/DD/YYYY");
    if (!cleanCell(record.storeId)) errors.push("Missing store ID");
    if (!cleanCell(record.orderNumber)) errors.push("Missing order number");
    if (!cleanCell(record.customerName)) errors.push("Missing customer name");
    if (!cleanCell(record.product)) errors.push("Missing product");
    if (!cleanCell(record.salesRegion)) errors.push("Missing sales region");
    if (!cleanCell(record.quantitySold)) errors.push("Missing quantity");
    if (!cleanCell(record.revenue)) errors.push("Missing revenue");

    const quantity = Number(record.quantitySold);
    const revenue = Number(String(record.revenue ?? "").replace(/[$,]/g, ""));
    if (cleanCell(record.quantitySold) && (!Number.isFinite(quantity) || quantity <= 0)) errors.push("Quantity must be a positive number");
    if (cleanCell(record.revenue) && (!Number.isFinite(revenue) || revenue < 0)) errors.push("Revenue must be a nonnegative number");
    if (record.malformedRow) errors.push("Malformed row: column count does not match header");

    const normalizedOrder = cleanCell(record.orderNumber).toLowerCase();
    const normalizedLineItem = cleanCell(record.lineItemId).toLowerCase();
    const recordIdentity = normalizedLineItem ? `line:${normalizedLineItem}` : `order:${normalizedOrder}`;
    if (!errors.length && normalizedOrder && seenValidRecords.has(recordIdentity)) {
      errors.push(normalizedLineItem
        ? "Duplicate line item; first valid occurrence kept"
        : "Duplicate order number; first valid occurrence kept");
      duplicateRecords += 1;
    }

    if (errors.length) {
      errors.forEach((error) => invalidRecords.push({ ...record, error }));
    } else {
      seenValidRecords.add(recordIdentity);
      validRecords.push({ ...record, quantitySold: quantity, revenue });
    }
  });

  fileErrors.forEach((error) => invalidRecords.push(error));
  return { validRecords, invalidRecords, duplicateRecords };
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
}

const CSV_FIELDS = [
  ["Date", "date"],
  ["Store ID", "storeId"],
  ["Store name", "storeName"],
  ["Order number", "orderNumber"],
  ["Customer name", "customerName"],
  ["Product", "product"],
  ["Product category", "productCategory"],
  ["Sales region", "salesRegion"],
  ["Quantity sold", "quantitySold"],
  ["Revenue", "revenue"],
];

const escapeCsvValue = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function recordsToCsv(records) {
  const header = CSV_FIELDS.map(([label]) => escapeCsvValue(label)).join(",");
  const rows = records.map((record) => CSV_FIELDS.map(([, field]) => escapeCsvValue(record[field])).join(","));
  return [header, ...rows].join("\r\n");
}

function groupRecords(records, key, labelKey = key) {
  const groups = new Map();
  records.forEach((record) => {
    const id = record[key] || "Unspecified";
    const current = groups.get(id) ?? {
      [key]: id,
      [labelKey]: record[labelKey] || id,
      orderNumbers: new Set(),
      units: 0,
      revenue: 0,
      profit: 0,
      discountTotal: 0,
      lineItems: 0,
    };
    current.orderNumbers.add(record.orderNumber);
    current.units += record.quantitySold;
    current.revenue += record.revenue;
    current.profit += toFiniteNumber(record.profit);
    current.discountTotal += toFiniteNumber(record.discount);
    current.lineItems += 1;
    groups.set(id, current);
  });
  return [...groups.values()]
    .map(({ orderNumbers, discountTotal, lineItems, ...group }) => ({
      ...group,
      orders: orderNumbers.size,
      averageDiscount: lineItems ? discountTotal / lineItems : 0,
      profitMargin: group.revenue ? (group.profit / group.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function groupByStore(records) {
  return groupRecords(records, "storeId", "storeName");
}

export function groupByRegion(records) {
  return groupRecords(records, "salesRegion");
}

export function groupByCategory(records) {
  return groupRecords(records, "productCategory");
}

export function groupByProduct(records) {
  return groupRecords(records, "product", "productCategory");
}

export function groupByCustomer(records) {
  return groupRecords(records, "customerName");
}

function aggregateOrders(records) {
  const orders = new Map();
  records.forEach((record) => {
    const current = orders.get(record.orderNumber) ?? {
      orderNumber: record.orderNumber,
      date: record.date,
      customerName: record.customerName || "Unspecified",
      storeName: record.storeName || record.storeId,
      salesRegion: record.salesRegion,
      products: new Set(),
      units: 0,
      revenue: 0,
    };
    current.products.add(record.product);
    current.units += record.quantitySold;
    current.revenue += record.revenue;
    orders.set(record.orderNumber, current);
  });
  return [...orders.values()]
    .map(({ products, ...order }) => ({ ...order, products: [...products].join(", ") }))
    .sort((a, b) => b.revenue - a.revenue);
}

function groupByDay(records) {
  const days = new Map();
  records.forEach((record) => {
    const date = normalizeDate(record.date) ?? record.date;
    const current = days.get(date) ?? { date, orderNumbers: new Set(), units: 0, revenue: 0 };
    current.orderNumbers.add(record.orderNumber);
    current.units += record.quantitySold;
    current.revenue += record.revenue;
    days.set(date, current);
  });
  return [...days.values()]
    .map(({ orderNumbers, ...day }) => ({ ...day, orders: orderNumbers.size }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function calculateReport(records) {
  const totalRevenue = records.reduce((sum, record) => sum + record.revenue, 0);
  const totalProfit = records.reduce((sum, record) => sum + toFiniteNumber(record.profit), 0);
  const totalDiscount = records.reduce((sum, record) => sum + toFiniteNumber(record.discount), 0);
  const uniqueOrders = new Set(records.map((record) => record.orderNumber)).size;
  const totalUnits = records.reduce((sum, record) => sum + record.quantitySold, 0);
  const stores = groupByStore(records);
  const regions = groupByRegion(records);
  const categories = groupByCategory(records);
  const products = groupByProduct(records);
  const customers = groupByCustomer(records);
  const orders = aggregateOrders(records);
  const daily = groupByDay(records);
  const productsByUnits = [...products].sort((a, b) => b.units - a.units || b.revenue - a.revenue);
  const repeatCustomers = customers.filter((customer) => customer.orders > 1);
  const sortedOrderValues = orders.map((order) => order.revenue).sort((a, b) => a - b);
  const medianOrderValue = sortedOrderValues.length
    ? sortedOrderValues.length % 2
      ? sortedOrderValues[Math.floor(sortedOrderValues.length / 2)]
      : (sortedOrderValues[sortedOrderValues.length / 2 - 1] + sortedOrderValues[sortedOrderValues.length / 2]) / 2
    : 0;
  const bestDay = [...daily].sort((a, b) => b.revenue - a.revenue)[0] ?? null;
  const fulfillmentDays = records
    .map((record) => record.fulfillmentDays)
    .filter(Number.isFinite);

  return {
    totalRevenue,
    totalProfit,
    profitMargin: totalRevenue ? (totalProfit / totalRevenue) * 100 : 0,
    averageDiscount: records.length ? totalDiscount / records.length : 0,
    averageFulfillmentDays: fulfillmentDays.length
      ? fulfillmentDays.reduce((sum, days) => sum + days, 0) / fulfillmentDays.length
      : null,
    uniqueOrders,
    totalUnits,
    averageOrderValue: uniqueOrders ? totalRevenue / uniqueOrders : 0,
    storeCount: stores.length,
    customerCount: customers.length,
    repeatCustomerCount: repeatCustomers.length,
    repeatCustomerRate: customers.length ? (repeatCustomers.length / customers.length) * 100 : 0,
    averageRevenuePerCustomer: customers.length ? totalRevenue / customers.length : 0,
    unitsPerOrder: uniqueOrders ? totalUnits / uniqueOrders : 0,
    revenuePerUnit: totalUnits ? totalRevenue / totalUnits : 0,
    medianOrderValue,
    activeDays: daily.length,
    dailyAverageRevenue: daily.length ? totalRevenue / daily.length : 0,
    stores,
    regions,
    categories,
    products,
    customers,
    orders,
    daily,
    topProducts: products.slice(0, 5),
    bestDay,
    largestOrder: orders[0] ?? null,
    topCustomer: customers[0] ?? null,
    topCustomerRevenueShare: totalRevenue && customers[0] ? (customers[0].revenue / totalRevenue) * 100 : 0,
    topThreeCustomerShare: totalRevenue ? (customers.slice(0, 3).reduce((sum, customer) => sum + customer.revenue, 0) / totalRevenue) * 100 : 0,
    topSellingProduct: productsByUnits[0]?.product ?? "—",
    highestRevenueProduct: products[0]?.product ?? "—",
    highestRevenueCategory: categories[0]?.productCategory ?? "—",
    highestRevenueStore: stores[0]?.storeName ?? "—",
    highestRevenueRegion: regions[0]?.salesRegion ?? "—",
  };
}

const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(number) ? number : fallback;
};

const daysBetween = (start, end) => {
  const normalizedStart = normalizeDate(start);
  const normalizedEnd = normalizeDate(end);
  if (!normalizedStart || !normalizedEnd) return null;
  return (Date.parse(`${normalizedEnd}T00:00:00Z`) - Date.parse(`${normalizedStart}T00:00:00Z`)) / 86_400_000;
};

/**
 * Provides reusable filtering and analysis for normalized sales records.
 *
 * Use `fromCsvText` to load a CSV, or pass records produced by
 * `parseCsvText` and `validateRecords` to the constructor.
 */
export class SalesDataManager {
  constructor(records = []) {
    this.records = records.map((record) => ({
      ...record,
      quantitySold: toFiniteNumber(record.quantitySold),
      revenue: toFiniteNumber(record.revenue),
      discount: toFiniteNumber(record.discount),
      profit: toFiniteNumber(record.profit),
      fulfillmentDays: daysBetween(record.date, record.shipDate),
    }));
  }

  static fromCsvText(text, sourceFile = "Uploaded file") {
    const parsed = parseCsvText(text, sourceFile);
    const validation = validateRecords(parsed.records, parsed.fileErrors);
    return {
      manager: new SalesDataManager(validation.validRecords),
      ...validation,
    };
  }

  filterData({ region, category, segment, startDate, endDate } = {}) {
    const normalizedStart = startDate ? normalizeDate(startDate) : null;
    const normalizedEnd = endDate ? normalizeDate(endDate) : null;
    if (startDate && !normalizedStart) throw new TypeError("startDate must use YYYY-MM-DD or MM/DD/YYYY");
    if (endDate && !normalizedEnd) throw new TypeError("endDate must use YYYY-MM-DD or MM/DD/YYYY");

    return this.records.filter((record) => {
      const recordDate = normalizeDate(record.date);
      return (!region || record.salesRegion === region)
        && (!category || record.productCategory === category)
        && (!segment || record.segment === segment)
        && (!normalizedStart || (recordDate && recordDate >= normalizedStart))
        && (!normalizedEnd || (recordDate && recordDate <= normalizedEnd));
    });
  }

  performanceSummary(groupBy = "salesRegion", records = this.records) {
    return this.#group(records, groupBy).map((group) => ({
      [groupBy]: group.value,
      totalSales: group.records.reduce((sum, record) => sum + record.revenue, 0),
      totalProfit: group.records.reduce((sum, record) => sum + record.profit, 0),
      orderCount: new Set(group.records.map((record) => record.orderNumber)).size,
    }));
  }

  flagUnderperformers(groupBy = "product", thresholdProfit = 0, records = this.records) {
    return this.performanceSummary(groupBy, records)
      .filter((group) => group.totalProfit < thresholdProfit);
  }

  discountImpact(records = this.records) {
    return this.#group(records, "discount")
      .map((group) => {
        const totalProfit = group.records.reduce((sum, record) => sum + record.profit, 0);
        return {
          discount: Number(group.value),
          averageProfit: group.records.length ? totalProfit / group.records.length : 0,
          totalProfit,
          totalSales: group.records.reduce((sum, record) => sum + record.revenue, 0),
          lineItemCount: group.records.length,
        };
      })
      .sort((a, b) => a.discount - b.discount);
  }

  fulfillmentAnalysis(groupBy = "salesRegion", records = this.records) {
    return this.#group(records, groupBy).map((group) => {
      const fulfillmentDays = group.records
        .map((record) => record.fulfillmentDays)
        .filter(Number.isFinite);
      return {
        [groupBy]: group.value,
        averageFulfillmentDays: fulfillmentDays.length
          ? fulfillmentDays.reduce((sum, days) => sum + days, 0) / fulfillmentDays.length
          : null,
        maximumFulfillmentDays: fulfillmentDays.length ? Math.max(...fulfillmentDays) : null,
        orderCount: new Set(group.records.map((record) => record.orderNumber)).size,
      };
    });
  }

  #group(records, field) {
    const groups = new Map();
    records.forEach((record) => {
      const value = record[field] ?? "Unspecified";
      const group = groups.get(value) ?? [];
      group.push(record);
      groups.set(value, group);
    });
    return [...groups.entries()]
      .map(([value, groupedRecords]) => ({ value, records: groupedRecords }))
      .sort((a, b) => String(a.value).localeCompare(String(b.value)));
  }
}

export function previousPeriod(startDate, endDate) {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (!start || !end || start > end) return null;
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  const durationDays = Math.round((endMs - startMs) / 86_400_000) + 1;
  const previousEndMs = startMs - 86_400_000;
  const previousStartMs = previousEndMs - (durationDays - 1) * 86_400_000;
  return {
    startDate: new Date(previousStartMs).toISOString().slice(0, 10),
    endDate: new Date(previousEndMs).toISOString().slice(0, 10),
  };
}

export function performanceChange(current, previous) {
  const percentage = (value, priorValue) => (
    priorValue ? ((value - priorValue) / Math.abs(priorValue)) * 100 : value ? null : 0
  );
  return {
    revenue: {
      value: current.totalRevenue - previous.totalRevenue,
      percentage: percentage(current.totalRevenue, previous.totalRevenue),
    },
    profit: {
      value: current.totalProfit - previous.totalProfit,
      percentage: percentage(current.totalProfit, previous.totalProfit),
    },
    orders: {
      value: current.uniqueOrders - previous.uniqueOrders,
      percentage: percentage(current.uniqueOrders, previous.uniqueOrders),
    },
    units: {
      value: current.totalUnits - previous.totalUnits,
      percentage: percentage(current.totalUnits, previous.totalUnits),
    },
  };
}

export function comparisonDrivers(currentRecords, previousRecords, field, limit = 5) {
  const totals = new Map();
  const add = (records, period) => records.forEach((record) => {
    const label = record[field] || "Unspecified";
    const current = totals.get(label) ?? { label, currentRevenue: 0, previousRevenue: 0, currentProfit: 0, previousProfit: 0 };
    current[`${period}Revenue`] += record.revenue;
    current[`${period}Profit`] += toFiniteNumber(record.profit);
    totals.set(label, current);
  });
  add(currentRecords, "current");
  add(previousRecords, "previous");
  return [...totals.values()]
    .map((item) => ({
      ...item,
      revenueChange: item.currentRevenue - item.previousRevenue,
      profitChange: item.currentProfit - item.previousProfit,
    }))
    .sort((a, b) => Math.abs(b.revenueChange) - Math.abs(a.revenueChange))
    .slice(0, limit);
}

export function generateSummary(report, startDate, endDate) {
  const orderLabel = report.uniqueOrders === 1 ? "unique order" : "unique orders";
  return `During ${startDate} through ${endDate}, the business generated ${formatCurrency(report.totalRevenue)} in revenue across ${report.uniqueOrders} ${orderLabel}. ${report.highestRevenueRegion} led regional sales, while ${report.highestRevenueCategory} was the strongest category. ${report.highestRevenueProduct} generated the most revenue, and ${report.topSellingProduct} sold the most units.`;
}
