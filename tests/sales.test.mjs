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

test("detects duplicates and invalid records", () => {
  const base = { date: "2026-07-06", storeId: "101", storeName: "Downtown", product: "Desk", productCategory: "Furniture", salesRegion: "North", quantitySold: "1", revenue: "100", sourceFile: "test.csv", rowNumber: 2 };
  const result = validateRecords([
    { ...base, orderNumber: "DUP-1" },
    { ...base, orderNumber: "DUP-1", rowNumber: 3 },
    { ...base, orderNumber: "BAD-1", rowNumber: 4, quantitySold: "-2", salesRegion: "" },
  ]);
  assert.equal(result.duplicateRecords, 2);
  assert.equal(result.validRecords.length, 0);
  assert.ok(result.invalidRecords.some((record) => record.error === "Duplicate order number"));
  assert.ok(result.invalidRecords.some((record) => record.error === "Quantity must be a positive number"));
  assert.ok(result.invalidRecords.some((record) => record.error === "Missing sales region"));
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
  assert.equal(result.validRecords.length, 25);
  assert.equal(result.duplicateRecords, 2);
  assert.equal(report.totalRevenue, 21030);
  assert.equal(report.totalUnits, 99);
  assert.equal(report.uniqueOrders, 25);
  assert.equal(report.averageOrderValue, 841.2);
  assert.equal(report.highestRevenueStore, "Westgate");
  assert.equal(report.highestRevenueRegion, "West");
  assert.equal(report.highestRevenueProduct, "Ergonomic Chair");
  assert.equal(report.topSellingProduct, "Wireless Mouse");
  assert.equal(report.customerCount, 25);
  assert.equal(report.medianOrderValue, 630);
  assert.equal(report.activeDays, 5);
  assert.equal(report.dailyAverageRevenue, 4206);
  assert.equal(report.bestDay.date, "2026-07-06");
  assert.equal(report.bestDay.revenue, 9450);
  assert.equal(report.largestOrder.orderNumber, "103-001");
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
