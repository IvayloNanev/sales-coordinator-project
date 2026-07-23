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
  const seenValidOrders = new Set();
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
    if (!errors.length && normalizedOrder && seenValidOrders.has(normalizedOrder)) {
      errors.push("Duplicate order number; first valid occurrence kept");
      duplicateRecords += 1;
    }

    if (errors.length) {
      errors.forEach((error) => invalidRecords.push({ ...record, error }));
    } else {
      seenValidOrders.add(normalizedOrder);
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

  return {
    totalRevenue,
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

export function generateSummary(report, startDate, endDate) {
  const orderLabel = report.uniqueOrders === 1 ? "unique order" : "unique orders";
  return `During ${startDate} through ${endDate}, the included stores generated ${formatCurrency(report.totalRevenue)} in revenue across ${report.uniqueOrders} ${orderLabel}. ${report.highestRevenueStore} was the highest-performing location, while ${report.highestRevenueRegion} was the strongest sales region. ${report.highestRevenueProduct} generated the most revenue, and ${report.topSellingProduct} sold the most units.`;
}
