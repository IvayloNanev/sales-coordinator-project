"use client";

import { useMemo, useState } from "react";
import ProgressHeader from "./components/ProgressHeader";
import ReportSetup from "./components/ReportSetup";
import ValidationResults from "./components/ValidationResults";
import ReportDashboard from "./components/ReportDashboard";
import { calculateReport, parseCsvFile, recordsToCsv, validateRecords } from "../lib/sales";

const initialState = { startDate: "", endDate: "", files: [] };

export default function Home() {
  const [step, setStep] = useState("setup");
  const [setup, setSetup] = useState(initialState);
  const [validation, setValidation] = useState(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [generatedDate, setGeneratedDate] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const report = useMemo(() => calculateReport(validation?.validRecords ?? []), [validation]);

  const addFiles = (incoming) => {
    const csvFiles = incoming.filter((file) => file.name.toLowerCase().endsWith(".csv"));
    setSetup((current) => ({ ...current, files: [...current.files, ...csvFiles.filter((file) => !current.files.some((existing) => existing.name === file.name && existing.size === file.size))] }));
    setValidation(null);
  };

  const updateDate = (key, value) => {
    setSetup((current) => ({ ...current, [key]: value }));
    setValidation(null);
  };

  const removeFile = (file) => {
    setSetup((current) => ({ ...current, files: current.files.filter((item) => item !== file) }));
    setValidation(null);
  };

  const setReportDate = () => setGeneratedDate(new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date()));

  const runValidation = async (destination = "validation") => {
    setIsValidating(true);
    try {
      const parsed = await Promise.all(setup.files.map(parseCsvFile));
      const records = parsed.flatMap((file) => file.records);
      const fileErrors = parsed.flatMap((file) => file.fileErrors);
      const results = validateRecords(records, fileErrors);
      setTotalRecords(records.length);
      setValidation(results);
      if (destination === "report" && results.validRecords.length) {
        setReportDate();
        setStep("report");
      } else {
        setStep("validation");
      }
    } finally {
      setIsValidating(false);
    }
  };

  const navigateToStep = async (destination) => {
    if (destination === "setup") {
      setStep("setup");
      return;
    }

    if (destination === "validation") {
      if (validation) setStep("validation");
      else if (setup.startDate && setup.endDate && setup.startDate <= setup.endDate && setup.files.length) await runValidation();
      else setStep("setup");
      return;
    }

    if (validation?.validRecords.length) {
      setReportDate();
      setStep("report");
    } else if (setup.startDate && setup.endDate && setup.startDate <= setup.endDate && setup.files.length) {
      await runValidation("report");
    } else {
      setStep("setup");
    }
  };

  const restart = () => {
    setStep("setup");
    setSetup(initialState);
    setValidation(null);
    setTotalRecords(0);
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
      <ProgressHeader currentStep={step} onNavigate={navigateToStep} />
      <main id="main" className={step === "report" ? "report-main" : "main-content"}>
        {step === "setup" && <ReportSetup {...setup} onDates={updateDate} onFiles={addFiles} onRemove={removeFile} />}
        {step === "validation" && validation && <ValidationResults fileCount={setup.files.length} totalRecords={totalRecords} results={validation} onContinue={() => { setReportDate(); setStep("report"); }} onReturn={() => setStep("setup")} />}
        {step === "report" && <ReportDashboard report={report} startDate={setup.startDate} endDate={setup.endDate} generatedDate={generatedDate} onDownload={downloadCleanedData} onRestart={restart} />}
        {isValidating && <div className="loading-overlay" role="status"><span />Validating store data…</div>}
      </main>
      <footer className="site-footer no-print"><span>Sales Report Assistant</span><span>Local-only data processing · No files are uploaded</span></footer>
    </div>
  );
}
