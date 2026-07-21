"use client";

import { useMemo, useState } from "react";
import ProgressHeader from "./components/ProgressHeader";
import WelcomeScreen from "./components/WelcomeScreen";
import ReportSetup from "./components/ReportSetup";
import ValidationResults from "./components/ValidationResults";
import DataApproval from "./components/DataApproval";
import ReportDashboard from "./components/ReportDashboard";
import { calculateReport, parseCsvFile, recordsToCsv, validateRecords } from "../lib/sales";

const initialState = { startDate: "", endDate: "", files: [] };

export default function Home() {
  const [step, setStep] = useState("welcome");
  const [setup, setSetup] = useState(initialState);
  const [validation, setValidation] = useState(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [dataApproved, setDataApproved] = useState(false);
  const [reportApproved, setReportApproved] = useState(false);
  const [generatedDate, setGeneratedDate] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const report = useMemo(() => calculateReport(validation?.validRecords ?? []), [validation]);

  const addFiles = (incoming) => {
    const csvFiles = incoming.filter((file) => file.name.toLowerCase().endsWith(".csv"));
    setSetup((current) => ({ ...current, files: [...current.files, ...csvFiles.filter((file) => !current.files.some((existing) => existing.name === file.name && existing.size === file.size))] }));
  };

  const runValidation = async () => {
    setIsValidating(true);
    try {
      const parsed = await Promise.all(setup.files.map(parseCsvFile));
      const records = parsed.flatMap((file) => file.records);
      const fileErrors = parsed.flatMap((file) => file.fileErrors);
      setTotalRecords(records.length);
      setValidation(validateRecords(records, fileErrors));
      setDataApproved(false);
      setStep("validation");
    } finally {
      setIsValidating(false);
    }
  };

  const restart = () => {
    setStep("setup");
    setSetup(initialState);
    setValidation(null);
    setTotalRecords(0);
    setDataApproved(false);
    setReportApproved(false);
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
      <ProgressHeader currentStep={step} />
      <main id="main" className={step === "report" ? "report-main" : "main-content"}>
        {step === "welcome" && <WelcomeScreen onStart={() => setStep("setup")} />}
        {step === "setup" && <ReportSetup {...setup} onDates={(key, value) => setSetup((current) => ({ ...current, [key]: value }))} onFiles={addFiles} onRemove={(file) => setSetup((current) => ({ ...current, files: current.files.filter((item) => item !== file) }))} onValidate={runValidation} />}
        {step === "validation" && validation && <ValidationResults fileCount={setup.files.length} totalRecords={totalRecords} results={validation} onContinue={() => setStep("approval")} onReturn={() => setStep("setup")} />}
        {step === "approval" && <DataApproval report={report} startDate={setup.startDate} endDate={setup.endDate} approved={dataApproved} onApprove={setDataApproved} onDownload={downloadCleanedData} onGenerate={() => { setGeneratedDate(new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date())); setStep("report"); }} onReturn={() => setStep("validation")} />}
        {step === "report" && <ReportDashboard report={report} startDate={setup.startDate} endDate={setup.endDate} generatedDate={generatedDate} reportApproved={reportApproved} onApprove={setReportApproved} onPrint={() => window.print()} onRestart={restart} />}
        {isValidating && <div className="loading-overlay" role="status"><span />Validating store data…</div>}
      </main>
      <footer className="site-footer no-print"><span>Sales Report Assistant</span><span>Local-only data processing · No files are uploaded</span></footer>
    </div>
  );
}
