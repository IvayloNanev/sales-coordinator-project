"use client";

import { useMemo, useState } from "react";
import ProgressHeader from "./components/ProgressHeader";
import ReportSetup from "./components/ReportSetup";
import ReportDashboard from "./components/ReportDashboard";
import { calculateReport, getDateRange, parseInputFile, recordsToCsv, validateRecords } from "../lib/sales";

const initialState = { startDate: "", endDate: "", files: [] };

export default function Home() {
  const [page, setPage] = useState("upload");
  const [setup, setSetup] = useState(initialState);
  const [validation, setValidation] = useState(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [generatedDate, setGeneratedDate] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const report = useMemo(() => calculateReport(validation?.validRecords ?? []), [validation]);
  const resultsReady = Boolean(validation?.validRecords.length && setup.startDate && setup.endDate);

  const analyzeFiles = async (files) => {
    if (!files.length) {
      setSetup(initialState);
      setValidation(null);
      setTotalRecords(0);
      setGeneratedDate("");
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
    } finally {
      setIsValidating(false);
    }
  };

  const addFiles = async (incoming) => {
    const files = [...setup.files, ...incoming.filter((file) => !setup.files.some((existing) => existing.name === file.name && existing.size === file.size))];
    await analyzeFiles(files);
  };

  const removeFile = async (file) => analyzeFiles(setup.files.filter((item) => item !== file));

  const navigate = (destination) => {
    if (destination === "results" && !resultsReady) return;
    if (destination === "results" && !generatedDate) {
      setGeneratedDate(new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date()));
    }
    setPage(destination);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const produceResults = () => navigate("results");

  const restart = () => {
    setSetup(initialState);
    setValidation(null);
    setTotalRecords(0);
    setGeneratedDate("");
    setPage("upload");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const downloadCleanedData = () => {
    const csv = recordsToCsv(validation?.validRecords ?? []);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `cleaned-sales-${setup.startDate}-to-${setup.endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="app-shell">
      <ProgressHeader page={page} resultsReady={resultsReady} onNavigate={navigate} />
      <main id="main" className="two-page-main">
        {page === "upload" ? (
          <section className="page-view intake-page" aria-label="Upload and validate sales files">
            <ReportSetup {...setup} validation={validation} totalRecords={totalRecords} isValidating={isValidating} onFiles={addFiles} onRemove={removeFile} onProduceResults={produceResults} />
          </section>
        ) : (
          <section className="page-view results-page" aria-label="Generated sales results">
            <ReportDashboard report={report} startDate={setup.startDate} endDate={setup.endDate} generatedDate={generatedDate} fileCount={setup.files.length} totalRecords={totalRecords} validRowCount={validation?.validRecords.length ?? 0} issueCount={validation?.invalidRecords.length ?? 0} duplicateRecords={validation?.duplicateRecords ?? 0} onDownload={downloadCleanedData} onRestart={restart} />
          </section>
        )}
      </main>
      <footer className="site-footer no-print"><strong>Salescraft</strong><span>Private by design · Processed locally in your browser</span><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Back to top ↑</button></footer>
      {isValidating && <div className="loading-overlay" role="status"><span />Reading dates and checking every row…</div>}
    </div>
  );
}
