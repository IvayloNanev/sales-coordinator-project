"use client";

import { useMemo, useState } from "react";
import ProgressHeader from "./components/ProgressHeader";
import ReportSetup from "./components/ReportSetup";
import ValidationResults from "./components/ValidationResults";
import ReportDashboard from "./components/ReportDashboard";
import { calculateReport, getDateRange, parseCsvFile, recordsToCsv, validateRecords } from "../lib/sales";

const initialState = { startDate: "", endDate: "", files: [] };

export default function Home() {
  const [page, setPage] = useState("upload");
  const [setup, setSetup] = useState(initialState);
  const [validation, setValidation] = useState(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [generatedDate, setGeneratedDate] = useState("");
  const [reportReady, setReportReady] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const report = useMemo(() => calculateReport(validation?.validRecords ?? []), [validation]);
  const reviewReady = Boolean(validation?.validRecords.length && setup.startDate && setup.endDate);

  const analyzeFiles = async (files) => {
    if (!files.length) {
      setSetup(initialState);
      setValidation(null);
      setTotalRecords(0);
      setReportReady(false);
      return;
    }

    setIsValidating(true);
    try {
      const parsed = await Promise.all(files.map(parseCsvFile));
      const records = parsed.flatMap((file) => file.records);
      const range = getDateRange(records);
      const results = validateRecords(records, parsed.flatMap((file) => file.fileErrors));
      setSetup({ files, startDate: range?.startDate ?? "", endDate: range?.endDate ?? "" });
      setTotalRecords(records.length);
      setValidation(results);
      setReportReady(false);
    } finally {
      setIsValidating(false);
    }
  };

  const addFiles = async (incoming) => {
    const csvFiles = incoming.filter((file) => file.name.toLowerCase().endsWith(".csv"));
    const files = [...setup.files, ...csvFiles.filter((file) => !setup.files.some((existing) => existing.name === file.name && existing.size === file.size))];
    await analyzeFiles(files);
  };

  const removeFile = async (file) => analyzeFiles(setup.files.filter((item) => item !== file));

  const navigate = (destination) => {
    if (destination === "review" && !reviewReady) return;
    setPage(destination);
    if (destination === "upload") setReportReady(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const generateReport = () => {
    setGeneratedDate(new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date()));
    setReportReady(true);
    window.requestAnimationFrame(() => document.getElementById("generated-report")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const restart = () => {
    setSetup(initialState);
    setValidation(null);
    setTotalRecords(0);
    setReportReady(false);
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
      <ProgressHeader page={page} reviewReady={reviewReady} onNavigate={navigate} />
      <main id="main" className="two-page-main">
        {page === "upload" ? (
          <section className="page-view intake-page" aria-label="Upload and validate sales files">
            <ReportSetup {...setup} validation={validation} totalRecords={totalRecords} isValidating={isValidating} onFiles={addFiles} onRemove={removeFile} onContinue={() => navigate("review")} />
          </section>
        ) : (
          <section className="page-view review-page" aria-labelledby="review-title">
            <header className="review-hero">
              <div><p className="eyebrow">Final quality check</p><h1 id="review-title">Review files, then build the report.</h1><p>Confirm what came in and inspect any excluded rows before creating the manager-ready summary.</p></div>
              <div className="review-period"><small>Reporting period</small><strong>{setup.startDate}</strong><span>to</span><strong>{setup.endDate}</strong></div>
            </header>
            <div className="review-file-strip panel">
              <div><small>Source files</small><strong>{setup.files.length} CSV {setup.files.length === 1 ? "file" : "files"}</strong></div>
              <ul>{setup.files.map((file) => <li key={`${file.name}-${file.lastModified}`}><span>CSV</span>{file.name}<small>{Math.max(1, Math.round(file.size / 1024))} KB</small></li>)}</ul>
            </div>
            <ValidationResults fileCount={setup.files.length} totalRecords={totalRecords} results={validation} onContinue={generateReport} onReturn={() => navigate("upload")} />
            {reportReady && <div id="generated-report" className="generated-report"><ReportDashboard report={report} startDate={setup.startDate} endDate={setup.endDate} generatedDate={generatedDate} onDownload={downloadCleanedData} onRestart={restart} /></div>}
          </section>
        )}
      </main>
      <footer className="site-footer no-print"><strong>Salescraft</strong><span>Private by design · Processed locally in your browser</span><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Back to top ↑</button></footer>
      {isValidating && <div className="loading-overlay" role="status"><span />Reading dates and checking every row…</div>}
    </div>
  );
}
