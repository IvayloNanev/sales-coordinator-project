import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateReport, getDateRange, groupByRegion, groupByStore, normalizeDate, parseCsvText, parseInputFile, recordsToCsv, validateRecords } from "../lib/sales.js";

const validFixture = [
  { storeId: "101", storeName: "Downtown", orderNumber: "A-1", product: "Desk", productCategory: "Furniture", salesRegion: "North", quantitySold: 2, revenue: 800 },
  { storeId: "102", storeName: "Riverside", orderNumber: "A-2", product: "Chair", productCategory: "Furniture", salesRegion: "South", quantitySold: 3, revenue: 600 },
  { storeId: "101", storeName: "Downtown", orderNumber: "A-3", product: "Chair", productCategory: "Furniture", salesRegion: "North", quantitySold: 1, revenue: 200 },
];

test("calculates revenue, unique orders, units, and average order value", () => {
  const report = calculateReport(validFixture);
  assert.equal(report.totalRevenue, 1600);
  assert.equal(report.uniqueOrders, 3);
  assert.equal(report.totalUnits, 6);
  assert.equal(report.averageOrderValue, 1600 / 3);
});

test("groups by store and region in descending revenue order", () => {
  assert.deepEqual(groupByStore(validFixture).map(({ storeId, orders, revenue }) => ({ storeId, orders, revenue })), [
    { storeId: "101", orders: 2, revenue: 1000 },
    { storeId: "102", orders: 1, revenue: 600 },
  ]);
  assert.deepEqual(groupByRegion(validFixture).map(({ salesRegion, revenue }) => ({ salesRegion, revenue })), [
    { salesRegion: "North", revenue: 1000 },
    { salesRegion: "South", revenue: 600 },
  ]);
});

test("keeps the first valid order and excludes later duplicates and invalid records", () => {
  const base = { date: "2026-07-06", storeId: "101", storeName: "Downtown", customerName: "Acme", product: "Desk", productCategory: "Furniture", salesRegion: "North", quantitySold: "1", revenue: "100", sourceFile: "test.csv", rowNumber: 2 };
  const result = validateRecords([
    { ...base, orderNumber: "DUP-1" },
    { ...base, orderNumber: "DUP-1", rowNumber: 3 },
    { ...base, orderNumber: "BAD-1", rowNumber: 4, quantitySold: "-2", salesRegion: "" },
  ]);
  assert.equal(result.duplicateRecords, 1);
  assert.equal(result.validRecords.length, 1);
  assert.equal(result.validRecords[0].rowNumber, 2);
  assert.ok(result.invalidRecords.some((record) => record.error === "Duplicate order number; first valid occurrence kept"));
  assert.ok(result.invalidRecords.some((record) => record.error === "Quantity must be a positive number"));
  assert.ok(result.invalidRecords.some((record) => record.error === "Missing sales region"));
});

test("accepts Superstore headers and keeps distinct line items from the same order", () => {
  const csv = [
    "Row ID,Order ID,Order Date,Customer Name,City,State,Postal Code,Region,Category,Product Name,Sales,Quantity",
    "1,CA-100,11/8/2016,Claire Gute,Henderson,Kentucky,42420,South,Furniture,Bookcase,261.96,2",
    "2,CA-100,11/8/2016,Claire Gute,Henderson,Kentucky,42420,South,Furniture,Chair,731.94,3",
  ].join("\n");
  const parsed = parseCsvText(csv, "superstore.csv");
  const result = validateRecords(parsed.records, parsed.fileErrors);

  assert.deepEqual(parsed.fileErrors, []);
  assert.equal(result.validRecords.length, 2);
  assert.equal(result.duplicateRecords, 0);
  assert.equal(result.validRecords[0].date, "2016-11-08");
  assert.equal(result.validRecords[0].storeId, "42420");
  assert.equal(result.validRecords[0].storeName, "Henderson, Kentucky");
  assert.equal(result.validRecords[0].orderNumber, "CA-100");
  assert.equal(result.validRecords[0].lineItemId, "1");
  assert.equal(calculateReport(result.validRecords).uniqueOrders, 1);
});

test("uses city and state as a stable store fallback when postal code is blank", () => {
  const csv = [
    "Row ID,Order ID,Order Date,Customer Name,City,State,Postal Code,Region,Category,Product Name,Sales,Quantity",
    "1,CA-100,11/8/2016,Claire Gute,Burlington,Vermont,,East,Furniture,Bookcase,261.96,2",
  ].join("\n");
  const parsed = parseCsvText(csv, "superstore.csv");
  const result = validateRecords(parsed.records, parsed.fileErrors);

  assert.equal(result.validRecords.length, 1);
  assert.equal(result.validRecords[0].storeId, "Burlington, Vermont");
  assert.equal(result.validRecords[0].storeName, "Burlington, Vermont");
});

test("rejects blanks in every required reporting field", () => {
  const base = {
    date: "2026-07-06", storeId: "101", storeName: "Downtown", orderNumber: "A-1",
    customerName: "Acme", product: "Desk", productCategory: "Furniture", salesRegion: "North",
    quantitySold: "1", revenue: "100", sourceFile: "test.csv", rowNumber: 2,
  };
  const result = validateRecords([
    { ...base, orderNumber: "NO-STORE", storeName: "   " },
    { ...base, orderNumber: "NO-CATEGORY", productCategory: "" },
  ]);

  assert.equal(result.validRecords.length, 0);
  assert.ok(result.invalidRecords.some((record) => record.error === "Missing store name"));
  assert.ok(result.invalidRecords.some((record) => record.error === "Missing product category"));
});

test("groups spelling and whitespace variants without changing the first display label", () => {
  const base = {
    date: "2026-07-06", storeId: "101", storeName: "Downtown", customerName: "Acme",
    product: "Desk", productCategory: "Furniture", salesRegion: "North",
    quantitySold: "2", revenue: "10", sourceFile: "test.csv",
  };
  const result = validateRecords([
    { ...base, lineItemId: "1", orderNumber: "ORDER-1", rowNumber: 2 },
    {
      ...base, lineItemId: "2", orderNumber: "order-1", rowNumber: 3,
      storeName: " downtown ", customerName: " acme ", product: " desk ",
      productCategory: " furniture ", salesRegion: " north ", quantitySold: "10", revenue: "20",
    },
  ]);
  const report = calculateReport(result.validRecords);

  assert.equal(result.validRecords.length, 2);
  assert.equal(report.uniqueOrders, 1);
  assert.equal(report.regions.length, 1);
  assert.equal(report.regions[0].salesRegion, "North");
  assert.equal(report.products.length, 1);
  assert.equal(report.products[0].product, "Desk");
  assert.equal(report.customers.length, 1);
  assert.equal(report.totalUnits, 12);
});

test("converts numeric text before calculating and sorting", () => {
  const base = {
    date: "2026-07-06", storeId: "101", storeName: "Downtown", customerName: "Acme",
    productCategory: "Furniture", salesRegion: "North", sourceFile: "test.csv",
  };
  const result = validateRecords([
    { ...base, lineItemId: "1", orderNumber: "A-1", product: "Desk", quantitySold: "2", revenue: "$1,000.50", rowNumber: 2 },
    { ...base, lineItemId: "2", orderNumber: "A-2", product: "Chair", quantitySold: "10", revenue: "200", rowNumber: 3 },
  ]);
  const report = calculateReport(result.validRecords);

  assert.equal(result.validRecords[0].quantitySold, 2);
  assert.equal(result.validRecords[0].revenue, 1000.5);
  assert.equal(report.totalUnits, 12);
  assert.equal(report.totalRevenue, 1200.5);
  assert.equal(report.topSellingProduct, "Chair");
});

test("deduplicates line-item IDs case-insensitively while preserving repeated order IDs", () => {
  const base = {
    date: "2026-07-06", storeId: "101", storeName: "Downtown", customerName: "Acme",
    product: "Desk", productCategory: "Furniture", salesRegion: "North",
    quantitySold: "1", revenue: "100", sourceFile: "test.csv", orderNumber: "A-1",
  };
  const result = validateRecords([
    { ...base, lineItemId: "ROW-1", rowNumber: 2 },
    { ...base, lineItemId: "row-1", rowNumber: 3 },
    { ...base, lineItemId: "ROW-2", rowNumber: 4 },
  ]);

  assert.equal(result.validRecords.length, 2);
  assert.equal(result.duplicateRecords, 1);
  assert.ok(result.invalidRecords.some((record) => record.error === "Duplicate line item; first valid occurrence kept"));
});

test("scopes line-item IDs to their source file", () => {
  const base = {
    date: "2026-07-06", storeId: "101", storeName: "Downtown", customerName: "Acme",
    product: "Desk", productCategory: "Furniture", salesRegion: "North",
    quantitySold: "1", revenue: "100", lineItemId: "1",
  };
  const result = validateRecords([
    { ...base, sourceFile: "store-101.csv", orderNumber: "A-1", rowNumber: 2 },
    { ...base, sourceFile: "store-102.csv", orderNumber: "A-2", rowNumber: 2 },
  ]);

  assert.equal(result.validRecords.length, 2);
  assert.equal(result.duplicateRecords, 0);
});

test("requires customer names on every reportable row", () => {
  const result = validateRecords([{
    date: "2026-07-06", storeId: "101", storeName: "Downtown", orderNumber: "A-1", customerName: "",
    product: "Desk", productCategory: "Furniture", salesRegion: "North", quantitySold: "1", revenue: "100",
    sourceFile: "test.csv", rowNumber: 2,
  }]);
  assert.equal(result.validRecords.length, 0);
  assert.ok(result.invalidRecords.some((record) => record.error === "Missing customer name"));
});

test("handles empty input safely", () => {
  const report = calculateReport([]);
  assert.equal(report.totalRevenue, 0);
  assert.equal(report.uniqueOrders, 0);
  assert.equal(report.averageOrderValue, 0);
  assert.deepEqual(report.stores, []);
});

test("derives the reporting period from valid CSV dates", () => {
  assert.equal(normalizeDate("7/6/2026"), "2026-07-06");
  assert.equal(normalizeDate("2026-02-30"), null);
  assert.deepEqual(getDateRange([
    { date: "2026-07-10" },
    { date: "7/6/2026" },
    { date: "not-a-date" },
    { date: "2026-07-08" },
  ]), { startDate: "2026-07-06", endDate: "2026-07-10" });
  assert.equal(getDateRange([{ date: "unknown" }]), null);
});

test("exports cleaned records as a correctly escaped CSV", () => {
  const csv = recordsToCsv([{ date: "2026-07-06", storeId: "101", storeName: "Downtown", orderNumber: "A-1", customerName: "Smith, Jane", product: 'Chair "Plus"', productCategory: "Furniture", salesRegion: "North", quantitySold: 2, revenue: 800 }]);
  assert.match(csv, /^Date,Store ID,Store name,Order number/);
  assert.match(csv, /"Smith, Jane"/);
  assert.match(csv, /"Chair ""Plus"""/);
});

test("sample files produce the manually verified totals", async () => {
  const files = ["store-101.csv", "store-102.csv", "store-103.csv"];
  const parsed = await Promise.all(files.map(async (name) => parseCsvText(await readFile(new URL(`../sample-files/${name}`, import.meta.url), "utf8"), name)));
  const records = parsed.flatMap((file) => file.records);
  const result = validateRecords(records, parsed.flatMap((file) => file.fileErrors));
  const report = calculateReport(result.validRecords);
  assert.equal(records.length, 30);
  assert.equal(result.validRecords.length, 26);
  assert.equal(result.duplicateRecords, 1);
  assert.equal(report.totalRevenue, 21390);
  assert.equal(report.totalUnits, 102);
  assert.equal(report.uniqueOrders, 26);
  assert.equal(report.averageOrderValue, 21390 / 26);
  assert.equal(report.highestRevenueStore, "Westgate");
  assert.equal(report.highestRevenueRegion, "West");
  assert.equal(report.highestRevenueProduct, "Ergonomic Chair");
  assert.equal(report.topSellingProduct, "Wireless Mouse");
  assert.equal(report.customerCount, 26);
  assert.equal(report.medianOrderValue, 615);
  assert.equal(report.activeDays, 5);
  assert.equal(report.dailyAverageRevenue, 4278);
  assert.equal(report.bestDay.date, "2026-07-06");
  assert.equal(report.bestDay.revenue, 9450);
  assert.equal(report.largestOrder.orderNumber, "103-001");
});

test("the bundled Superstore sample imports every line item and preserves order totals", async () => {
  const name = "sample-superstore.csv";
  const parsed = parseCsvText(await readFile(new URL(`../sample-files/${name}`, import.meta.url), "utf8"), name);
  const result = validateRecords(parsed.records, parsed.fileErrors);
  const report = calculateReport(result.validRecords);

  assert.deepEqual(parsed.fileErrors, []);
  assert.equal(parsed.records.length, 9994);
  assert.equal(result.validRecords.length, 9994);
  assert.equal(result.invalidRecords.length, 0);
  assert.equal(result.duplicateRecords, 0);
  assert.equal(report.uniqueOrders, 5009);
  assert.equal(Number(report.totalRevenue.toFixed(2)), 2297200.86);
  assert.deepEqual(getDateRange(result.validRecords), { startDate: "2014-01-03", endDate: "2017-12-30" });
});

test("accepts tabular JSON, TSV, and flags unreadable file formats", async () => {
  const row = {
    Date: "2026-07-06", "Store ID": "101", "Store name": "Downtown", "Order number": "A-1",
    "Customer name": "Jane", Product: "Desk", "Product category": "Furniture", "Sales region": "North",
    "Quantity sold": 2, Revenue: 800,
  };
  const json = await parseInputFile({ name: "sales.json", type: "application/json", text: async () => JSON.stringify([row]) });
  assert.equal(json.records.length, 1);
  assert.equal(json.records[0].orderNumber, "A-1");

  const tsvText = `${Object.keys(row).join("\t")}\n${Object.values(row).join("\t")}`;
  const tsv = await parseInputFile({ name: "sales.tsv", type: "text/tab-separated-values", text: async () => tsvText });
  assert.equal(tsv.records.length, 1);
  assert.equal(tsv.records[0].revenue, "800");

  const unknown = await parseInputFile({ name: "sales.photo", type: "application/octet-stream" });
  assert.equal(unknown.records.length, 0);
  assert.match(unknown.fileErrors[0].error, /format does not expose/i);
});
