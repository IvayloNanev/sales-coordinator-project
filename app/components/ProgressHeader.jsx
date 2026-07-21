const steps = [
  { label: "Upload", value: "setup" },
  { label: "Validate", value: "validation" },
  { label: "Report", value: "report" },
];

export default function ProgressHeader({ currentStep, onNavigate }) {
  const activeIndex = Math.max(0, ["setup", "validation", "report"].indexOf(currentStep));
  return (
    <header className="app-header no-print">
      <a className="brand" href="#main" aria-label="Sales Report Assistant home">
        <span className="brand-mark" aria-hidden="true">SR</span>
        <span>Sales Report Assistant</span>
      </a>
      <ol className="progress" aria-label="Report progress">
        {steps.map((step, index) => (
          <li className={index <= activeIndex ? "active" : ""} key={step.value}>
            <button type="button" aria-current={index === activeIndex ? "step" : undefined} onClick={() => onNavigate(step.value)}>
              <span>{index + 1}</span>{step.label}
            </button>
          </li>
        ))}
      </ol>
      <div className="privacy-note"><span aria-hidden="true">●</span> Files stay in this browser</div>
    </header>
  );
}
