"use client";

import { useState } from "react";
import ProgressHeader from "./components/ProgressHeader";
import ReportSetup from "./components/ReportSetup";
import ReportDashboard from "./components/ReportDashboard";
import { getDateRange, parseInputFile, validateRecords } from "../lib/sales";

const initialState = { startDate: "", endDate: "", files: [] };
const coverageFields = [
  ["Order date", "date"], ["Order ID", "orderNumber"], ["Customer", "customerName"], ["Segment", "segment"],
  ["Product", "product"], ["Category", "productCategory"], ["Region", "salesRegion"], ["Quantity", "quantitySold"],
  ["Sales", "revenue"], ["Discount", "discount"], ["Profit", "profit"],
];

export default function Home() {
  const [page, setPage] = useState("upload");
  const [setup, setSetup] = useState(initialState);
  const [validation, setValidation] = useState(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [generatedDate, setGeneratedDate] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [intakeAnalysis, setIntakeAnalysis] = useState({ files: [], coverage: [] });
  const resultsReady = Boolean(validation?.validRecords.length && setup.startDate && setup.endDate);

  const analyzeFiles = async (files) => {
    if (!files.length) {
      setSetup(initialState);
      setValidation(null);
      setTotalRecords(0);
      setGeneratedDate("");
      setIntakeAnalysis({ files: [], coverage: [] });
      return;
    }

    setIsValidating(true);
    try {
      const parsed = await Promise.all(files.map(parseInputFile));
      const records = parsed.flatMap((file) => file.records);
      const range = getDateRange(records);
      const results = validateRecords(records, parsed.flatMap((file) => file.fileErrors));
      setSetup({ files, startDate: range?.startDate ?? "", endDate: range?.endDate ?? "" });
      setTotalRecords(records.length);
      setValidation(results);
      setGeneratedDate("");
      const belongsToFile = (sourceFile, fileName) => sourceFile === fileName || sourceFile?.startsWith(`${fileName} ·`);
      setIntakeAnalysis({
        files: files.map((file, index) => {
          const parsedFile = parsed[index];
          const validRows = results.validRecords.filter((record) => belongsToFile(record.sourceFile, file.name));
          const issues = results.invalidRecords.filter((record) => belongsToFile(record.sourceFile, file.name));
          const range = getDateRange(parsedFile.records);
          return {
            name: file.name,
            type: file.name.split(".").pop()?.toUpperCase() || "FILE",
            size: file.size,
            columnCount: parsedFile.columnCount ?? 0,
            columnNames: parsedFile.columnNames ?? [],
            previewRows: parsedFile.previewRows ?? [],
            columnProfiles: parsedFile.columnProfiles ?? [],
            extractedRows: parsedFile.records.length,
            validRows: validRows.length,
            issues: issues.length,
            startDate: range?.startDate ?? "",
            endDate: range?.endDate ?? "",
            revenue: validRows.reduce((sum, record) => sum + record.revenue, 0),
            orders: new Set(validRows.map((record) => record.orderNumber)).size,
          };
        }),
        coverage: coverageFields.map(([label, key]) => ({
          label,
          present: records.filter((record) => String(record[key] ?? "").trim()).length,
          total: records.length,
        })),
      });
    } finally {
      setIsValidating(false);
    }
  };

  const addFiles = async (incoming) => {
    const files = [...setup.files, ...incoming.filter((file) => !setup.files.some((existing) => existing.name === file.name && existing.size === file.size))];
    await analyzeFiles(files);
  };

  const navigate = (destination) => {
    if (destination === "results" && !resultsReady) return;
    if (destination === "results" && !generatedDate) {
      setGeneratedDate(new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date()));
    }
    setPage(destination);
  };

  const produceResults = () => {
    navigate("results");
  };

  const restart = () => {
    setSetup(initialState);
    setValidation(null);
    setTotalRecords(0);
    setGeneratedDate("");
    setIsValidating(false);
    setIntakeAnalysis({ files: [], coverage: [] });
    setPage("upload");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <div className="app-shell">
      <ProgressHeader onNavigate={restart} />
      <main id="main" className="two-page-main">
        {page === "upload" ? (
          <section className="page-view intake-page" aria-label="Upload and validate sales files">
            <ReportSetup {...setup} validation={validation} totalRecords={totalRecords} intakeAnalysis={intakeAnalysis} isValidating={isValidating} onFiles={addFiles} onProduceResults={produceResults} />
          </section>
        ) : (
          <section className="page-view results-page" aria-label="Generated sales results">
            <ReportDashboard records={validation?.validRecords ?? []} startDate={setup.startDate} endDate={setup.endDate} generatedDate={generatedDate} fileCount={setup.files.length} onRestart={restart} />
          </section>
        )}
      </main>
      <footer className="site-footer no-print"><strong>Salescraft</strong><span>Local processing · No uploads</span></footer>
      {isValidating && <div className="loading-overlay" role="status"><span />Reading dates and checking every row…</div>}
    </div>
  );
}
