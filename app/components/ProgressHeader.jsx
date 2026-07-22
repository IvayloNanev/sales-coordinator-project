const steps = [
  { label: "Upload & validate", number: "01" },
  { label: "Review & report", number: "02" },
];

export default function ProgressHeader({ page, reviewReady, onNavigate }) {
  const activeIndex = page === "review" ? 1 : 0;
  const available = [true, reviewReady];

  return (
    <header className="app-header no-print">
      <button className="brand brand-button" type="button" onClick={() => onNavigate("upload")} aria-label="Salescraft home">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span>Sales<span>craft</span></span>
      </button>
      <nav className="progress two-step-progress" aria-label="Report workflow">
        {steps.map((step, index) => (
          <button
            type="button"
            className={`${available[index] ? "available" : "locked"}${activeIndex === index ? " active" : ""}`}
            disabled={!available[index]}
            onClick={() => onNavigate(index ? "review" : "upload")}
            aria-current={activeIndex === index ? "step" : undefined}
            key={step.number}
          >
            <span aria-hidden="true">{index < activeIndex ? "✓" : step.number}</span>
            {step.label}
          </button>
        ))}
      </nav>
      <div className="privacy-note"><span aria-hidden="true" /> Local & private</div>
    </header>
  );
}
