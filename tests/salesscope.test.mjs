import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateReport, parseInputFile, validateRecords } from "../lib/sales.js";

const loadSalesScopeWorkbook = async () => {
  const bytes = await readFile(new URL("../data/salesscope-test-raw-sales-data.xlsx", import.meta.url));
  return parseInputFile({
    name: "SalesScope_Test_Raw_Sales_Data.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: bytes.length,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
};

test("imports the SalesScope stress-test workbook without errors", async () => {
  const parsed = await loadSalesScopeWorkbook();
  const validation = validateRecords(parsed.records, parsed.fileErrors);
  const report = calculateReport(validation.validRecords);

  assert.deepEqual(parsed.fileErrors, []);
  assert.equal(validation.invalidRecords.length, 0);
  assert.equal(validation.duplicateRecords, 0);
  assert.equal(validation.validRecords.length, 179);
  assert.equal(report.uniqueOrders, 179);
  assert.equal(report.totalUnits, 1783);
  assert.equal(Number(report.totalRevenue.toFixed(2)), 565959.92);
  assert.equal(Number(report.totalProfit.toFixed(2)), 249388.92);
});

test("normalizes intentional SalesScope stress cases before validation", async () => {
  const parsed = await loadSalesScopeWorkbook();
  const { validRecords, invalidRecords } = validateRecords(parsed.records, parsed.fileErrors);
  const returnedOrder = validRecords.find((record) => record.orderNumber === "SO-10090");

  assert.equal(invalidRecords.length, 0);
  assert.equal(validRecords.filter((record) => record.orderNumber === "SO-10032").length, 1);
  assert.equal(validRecords.filter((record) => record.salesRegion === "Unassigned").length, 1);
  assert.equal(validRecords.filter((record) => record.customerName.startsWith("Customer ")).length, 1);
  assert.equal(returnedOrder.orderStatus, "Returned");
  assert.ok(validRecords.every((record) => record.productCategory !== "electronics"));
});
