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
  storeid: "storeId",
  storename: "storeName",
  ordernumber: "orderNumber",
  customername: "customerName",
  product: "product",
  productcategory: "productCategory",
  salesregion: "salesRegion",
  quantitysold: "quantitySold",
  revenue: "revenue",
};

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

export function parseCsvRows(text) {
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
    } else if (character === "," && !quoted) {
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

export function parseCsvText(text, sourceFile = "Uploaded file") {
  const normalizedText = String(text ?? "").replace(/^\uFEFF/, "");
  const { rows, errors: syntaxErrors } = parseCsvRows(normalizedText);
  if (!rows.length) {
    return { records: [], fileErrors: [{ sourceFile, rowNumber: 1, orderNumber: "", error: "File is empty" }] };
  }

  const headers = rows[0].map(cleanHeader);
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(cleanHeader(column)));
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
    if (values.length !== headers.length) record.malformedRow = true;
    records.push(record);
  });

  return { records, fileErrors };
}

export async function parseCsvFile(file) {
  return parseCsvText(await file.text(), file.name);
}

export function validateRecords(records, fileErrors = []) {
  const orderCounts = new Map();
  records.forEach((record) => {
    const order = cleanCell(record.orderNumber).toLowerCase();
    if (order) orderCounts.set(order, (orderCounts.get(order) ?? 0) + 1);
  });

  const invalidRecords = [];
  const validRecords = [];
  let duplicateRecords = 0;

  records.forEach((record) => {
    const errors = [];
    if (!cleanCell(record.date)) errors.push("Missing date");
    else if (!normalizeDate(record.date)) errors.push("Date must use YYYY-MM-DD or MM/DD/YYYY");
    if (!cleanCell(record.storeId)) errors.push("Missing store ID");
    if (!cleanCell(record.orderNumber)) errors.push("Missing order number");
    if (!cleanCell(record.product)) errors.push("Missing product");
    if (!cleanCell(record.salesRegion)) errors.push("Missing sales region");
    if (!cleanCell(record.quantitySold)) errors.push("Missing quantity");
    if (!cleanCell(record.revenue)) errors.push("Missing revenue");

    const quantity = Number(record.quantitySold);
    const revenue = Number(String(record.revenue ?? "").replace(/[$,]/g, ""));
    if (cleanCell(record.quantitySold) && (!Number.isFinite(quantity) || quantity <= 0)) errors.push("Quantity must be a positive number");
    if (cleanCell(record.revenue) && (!Number.isFinite(revenue) || revenue < 0)) errors.push("Revenue must be a nonnegative number");
    if (record.malformedRow) errors.push("Malformed row: column count does not match header");

    const duplicate = cleanCell(record.orderNumber) && orderCounts.get(cleanCell(record.orderNumber).toLowerCase()) > 1;
    if (duplicate) {
      errors.push("Duplicate order number");
      duplicateRecords += 1;
    }

    if (errors.length) {
      errors.forEach((error) => invalidRecords.push({ ...record, error }));
    } else {
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
    };
    current.orderNumbers.add(record.orderNumber);
    current.units += record.quantitySold;
    current.revenue += record.revenue;
    groups.set(id, current);
  });
  return [...groups.values()]
    .map(({ orderNumbers, ...group }) => ({ ...group, orders: orderNumbers.size }))
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

export function calculateReport(records) {
  const totalRevenue = records.reduce((sum, record) => sum + record.revenue, 0);
  const uniqueOrders = new Set(records.map((record) => record.orderNumber)).size;
  const totalUnits = records.reduce((sum, record) => sum + record.quantitySold, 0);
  const stores = groupByStore(records);
  const regions = groupByRegion(records);
  const categories = groupByCategory(records);
  const products = groupByProduct(records);
  const productsByUnits = [...products].sort((a, b) => b.units - a.units || b.revenue - a.revenue);

  return {
    totalRevenue,
    uniqueOrders,
    totalUnits,
    averageOrderValue: uniqueOrders ? totalRevenue / uniqueOrders : 0,
    storeCount: stores.length,
    stores,
    regions,
    categories,
    products,
    topProducts: products.slice(0, 5),
    topSellingProduct: productsByUnits[0]?.product ?? "—",
    highestRevenueProduct: products[0]?.product ?? "—",
    highestRevenueCategory: categories[0]?.productCategory ?? "—",
    highestRevenueStore: stores[0]?.storeName ?? "—",
    highestRevenueRegion: regions[0]?.salesRegion ?? "—",
  };
}

export function generateSummary(report, startDate, endDate) {
  return `During ${startDate} through ${endDate}, the included stores generated ${formatCurrency(report.totalRevenue)} in revenue across ${report.uniqueOrders} unique orders. ${report.highestRevenueStore} was the highest-performing location, while ${report.highestRevenueRegion} was the strongest sales region. ${report.highestRevenueProduct} generated the most revenue, and ${report.topSellingProduct} sold the most units.`;
}
