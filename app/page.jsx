"use client";

import { useMemo, useState } from "react";
import ProgressHeader from "./components/ProgressHeader";
import ReportSetup from "./components/ReportSetup";
import ValidationResults from "./components/ValidationResults";
import ReportDashboard from "./components/ReportDashboard";
import { calculateReport, getDateRange, parseCsvFile, recordsToCsv, validateRecords } from "../lib/sales";

const initialState = { startDate: "", endDate: "", files: [] };

const scrollTo = (id) => window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));

export default function Home() {
  const [setup, setSetup] = useState(initialState);
  const [validation, setValidation] = useState(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [generatedDate, setGeneratedDate] = useState("");
  const [reportReady, setReportReady] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const report = useMemo(() => calculateReport(validation?.validRecords ?? []), [validation]);

  const resetResults = () => {
    setValidation(null);
    setReportReady(false);
  };

  const getRangeFromFiles = async (files) => {
    if (!files.length) return null;
    const parsed = await Promise.all(files.map(parseCsvFile));
    return getDateRange(parsed.flatMap((file) => file.records));
  };

  const addFiles = async (incoming) => {
    const csvFiles = incoming.filter((file) => file.name.toLowerCase().endsWith(".csv"));
    const files = [...setup.files, ...csvFiles.filter((file) => !setup.files.some((existing) => existing.name === file.name && existing.size === file.size))];
    const range = await getRangeFromFiles(files);
    setSetup((current) => ({ ...current, files, ...(range ?? {}) }));
    resetResults();
    return range;
  };

  const updateDate = (key, value) => {
    setSetup((current) => ({ ...current, [key]: value }));
    resetResults();
  };

  const removeFile = async (file) => {
    const files = setup.files.filter((item) => item !== file);
    const range = await getRangeFromFiles(files);
    setSetup((current) => ({ ...current, files, startDate: range?.startDate ?? "", endDate: range?.endDate ?? "" }));
    resetResults();
  };

  const runValidation = async () => {
    setIsValidating(true);
    try {
      const parsed = await Promise.all(setup.files.map(parseCsvFile));
      const records = parsed.flatMap((file) => file.records);
      const results = validateRecords(records, parsed.flatMap((file) => file.fileErrors));
      setTotalRecords(records.length);
      setValidation(results);
      setReportReady(false);
      scrollTo("validate");
    } finally {
      setIsValidating(false);
    }
  };

  const generateReport = () => {
    setGeneratedDate(new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date()));
    setReportReady(true);
    scrollTo("report");
  };

  const restart = () => {
    setSetup(initialState);
    setValidation(null);
    setTotalRecords(0);
    setReportReady(false);
    scrollTo("workspace");
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
      <ProgressHeader validationReady={Boolean(validation)} reportReady={reportReady} />
      <main id="main">
        <div className="workflow" id="workspace">
          <section className="workflow-section" id="upload" aria-labelledby="upload-title">
            <div className="section-kicker"><span>01</span><div><p>Prepare</p><h2 id="upload-title">Set up your report</h2></div></div>
            <ReportSetup {...setup} onDates={updateDate} onFiles={addFiles} onRemove={removeFile} onValidate={runValidation} />
          </section>

          <section className={`workflow-section${validation ? " revealed" : " locked"}`} id="validate" aria-labelledby="validate-title">
            <div className="section-kicker"><span>02</span><div><p>Quality check</p><h2 id="validate-title">Review validation</h2></div>{validation && <span className="section-status">Complete</span>}</div>
            {validation ? (
              <ValidationResults fileCount={setup.files.length} totalRecords={totalRecords} results={validation} onContinue={generateReport} onReturn={() => scrollTo("upload")} />
            ) : (
              <div className="locked-card"><span aria-hidden="true">02</span><div><strong>Validation appears here</strong><p>Add your dates and store files above, then select “Validate data.”</p></div></div>
            )}
          </section>

          <section className={`workflow-section${reportReady ? " revealed" : " locked"}`} id="report" aria-labelledby="report-section-title">
            <div className="section-kicker"><span>03</span><div><p>Results</p><h2 id="report-section-title">Explore your report</h2></div>{reportReady && <span className="section-status">Ready</span>}</div>
            {reportReady ? (
              <ReportDashboard report={report} startDate={setup.startDate} endDate={setup.endDate} generatedDate={generatedDate} onDownload={downloadCleanedData} onRestart={restart} />
            ) : (
              <div className="locked-card"><span aria-hidden="true">03</span><div><strong>Your dashboard is waiting</strong><p>Validate the source data first, then generate the final report right here.</p></div></div>
            )}
          </section>
        </div>
        {isValidating && <div className="loading-overlay" role="status"><span />Checking every row…</div>}
      </main>
      <footer className="site-footer no-print"><strong>Sales Report Assistant</strong><span>Private by design · Processed locally in your browser</span><a href="#main">Back to top ↑</a></footer>
    </div>
  );
}
