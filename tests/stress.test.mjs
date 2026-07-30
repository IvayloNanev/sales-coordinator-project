import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateReport,
  INPUT_LIMITS,
  parseCsvText,
  parseInputFile,
  validateRecords,
} from "../lib/sales.js";

const canonicalHeader = "Row ID,Date,Store ID,Store name,Order number,Customer name,Product,Product category,Sales region,Quantity sold,Revenue";

const makeRow = (index, overrides = {}) => {
  const row = {
    lineItemId: String(index),
    date: "2026-07-06",
    storeId: String(100 + (index % 5)),
    storeName: `Store ${index % 5}`,
    orderNumber: `ORDER-${Math.ceil(index / 2)}`,
    customerName: `Customer ${index % 50}`,
    product: `Product ${index % 25}`,
    productCategory: `Category ${index % 4}`,
    salesRegion: ["North", "South", "East", "West"][index % 4],
    quantitySold: String((index % 10) + 1),
    revenue: String((index % 100) + 0.5),
    ...overrides,
  };
  return [
    row.lineItemId, row.date, row.storeId, row.storeName, row.orderNumber,
    row.customerName, row.product, row.productCategory, row.salesRegion,
    row.quantitySold, row.revenue,
  ].join(",");
};

const parseAndValidate = (csv, name = "stress.csv") => {
  const parsed = parseCsvText(csv, name);
  return { parsed, validation: validateRecords(parsed.records, parsed.fileErrors) };
};

test("handles empty, header-only, malformed, and missing-schema CSV files without throwing", () => {
  const cases = [
    ["", "File is empty"],
    ["Date,Revenue", "Missing required column"],
    [`${canonicalHeader}\n"unclosed`, "Malformed CSV"],
  ];

  for (const [csv, expectedError] of cases) {
    const { validation } = parseAndValidate(csv);
    assert.equal(validation.validRecords.length, 0);
    assert.ok(validation.invalidRecords.some((record) => record.error.includes(expectedError)));
  }

  const headerOnly = parseAndValidate(canonicalHeader);
  assert.equal(headerOnly.validation.validRecords.length, 0);
  assert.equal(headerOnly.validation.invalidRecords.length, 0);
});

test("preserves quoted commas, escaped quotes, multiline text, Unicode, and formula-like text", () => {
  const csv = [
    canonicalHeader,
    '1,2026-07-06,101,Downtown,A-1,Zoë,"Desk, Large",Furniture,North,2,100',
    '2,2026-07-06,101,Downtown,A-2,李雷,"Chair ""Plus""",Furniture,North,3,200',
    '3,2026-07-06,101,Downtown,A-3,Amélie,"Multi-line',
    'product",Furniture,North,1,50',
    '4,2026-07-06,101,Downtown,A-4,Safe User,"=HYPERLINK(""https://example.com"")",Furniture,North,1,25',
  ].join("\n");
  const { validation } = parseAndValidate(csv);

  assert.equal(validation.validRecords.length, 4);
  assert.equal(validation.invalidRecords.length, 0);
  assert.equal(validation.validRecords[0].product, "Desk, Large");
  assert.equal(validation.validRecords[1].product, 'Chair "Plus"');
  assert.equal(validation.validRecords[2].product, "Multi-line product");
  assert.match(validation.validRecords[3].product, /^=HYPERLINK/);
});

test("mutation matrix rejects bad values and keeps valid spelling variants", () => {
  const rows = [
    makeRow(1),
    makeRow(2, { date: "" }),
    makeRow(3, { date: "2026-02-30" }),
    makeRow(4, { product: " " }),
    makeRow(5, { quantitySold: "abc" }),
    makeRow(6, { quantitySold: "-2" }),
    makeRow(7, { revenue: "-1" }),
    makeRow(8, { salesRegion: " north " }),
    makeRow(9, { lineItemId: "1" }),
  ];
  const { validation } = parseAndValidate([canonicalHeader, ...rows].join("\n"));
  const invalidRows = new Set(validation.invalidRecords.map((record) => record.rowNumber));

  assert.equal(validation.validRecords.length, 2);
  assert.deepEqual([...invalidRows].sort((a, b) => a - b), [3, 4, 5, 6, 7, 8, 10]);
  assert.equal(validation.duplicateRecords, 1);
});

test("deterministic fuzz input never loses a row and report invariants survive row reordering", () => {
  let seed = 0x5eed1234;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const rows = Array.from({ length: 5_000 }, (_, offset) => {
    const index = offset + 1;
    const region = ["North", "north", " NORTH ", "South"][Math.floor(random() * 4)];
    const overrides = { salesRegion: region };
    if (index % 97 === 0) overrides.customerName = "";
    if (index % 113 === 0) overrides.quantitySold = "not-a-number";
    if (index % 997 === 0) overrides.lineItemId = String(index - 1);
    return makeRow(index, overrides);
  });
  const { parsed, validation } = parseAndValidate([canonicalHeader, ...rows].join("\n"), "fuzz.csv");
  const invalidRowCount = new Set(validation.invalidRecords.map((record) => record.rowNumber)).size;

  assert.equal(parsed.records.length, 5_000);
  assert.equal(validation.validRecords.length + invalidRowCount, 5_000);
  assert.ok(validation.invalidRecords.length > 0);
  assert.ok(validation.validRecords.length > 4_800);

  const forward = calculateReport(validation.validRecords);
  const reversed = calculateReport([...validation.validRecords].reverse());
  assert.equal(forward.totalRevenue, reversed.totalRevenue);
  assert.equal(forward.totalUnits, reversed.totalUnits);
  assert.equal(forward.uniqueOrders, reversed.uniqueOrders);
  assert.equal(forward.regions.length, reversed.regions.length);
});

test("processes a 50,000-row CSV within a practical local budget", { timeout: 20_000 }, () => {
  const rows = Array.from({ length: 50_000 }, (_, index) => makeRow(index + 1));
  const startedAt = Date.now();
  const { parsed, validation } = parseAndValidate([canonicalHeader, ...rows].join("\n"), "large.csv");
  const elapsedMs = Date.now() - startedAt;
  const report = calculateReport(validation.validRecords);

  assert.equal(parsed.records.length, 50_000);
  assert.equal(validation.validRecords.length, 50_000);
  assert.equal(validation.invalidRecords.length, 0);
  assert.equal(report.uniqueOrders, 50_000);
  assert.ok(elapsedMs < 15_000, `50,000 rows took ${elapsedMs}ms`);
});

test("rejects excessive file size, row count, column count, and cell length with clear errors", async () => {
  let textRead = false;
  const oversizedFile = await parseInputFile({
    name: "too-large.csv",
    type: "text/csv",
    size: INPUT_LIMITS.maxFileSizeBytes + 1,
    text: async () => {
      textRead = true;
      return canonicalHeader;
    },
  });
  assert.equal(textRead, false);
  assert.match(oversizedFile.fileErrors[0].error, /25 MB limit/);

  const tooManyRows = [
    canonicalHeader,
    ...Array.from({ length: INPUT_LIMITS.maxRows + 1 }, (_, index) => makeRow(index + 1)),
  ].join("\n");
  assert.match(parseCsvText(tooManyRows, "too-many-rows.csv").fileErrors[0].error, /maximum is 100000/);

  const tooManyColumns = Array.from({ length: INPUT_LIMITS.maxColumns + 1 }, (_, index) => `Column ${index}`).join(",");
  assert.match(parseCsvText(tooManyColumns, "too-many-columns.csv").fileErrors[0].error, /maximum is 200/);

  const oversizedCell = `${canonicalHeader}\n${makeRow(1, { product: "x".repeat(INPUT_LIMITS.maxCellLength + 1) })}`;
  assert.match(parseCsvText(oversizedCell, "oversized-cell.csv").fileErrors[0].error, /exceeds 10,000 characters/);
});
