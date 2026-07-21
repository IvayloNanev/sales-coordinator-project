const steps = ["Upload", "Validate", "Approve", "Report"];

export default function ProgressHeader({ currentStep }) {
  const activeIndex = Math.max(0, ["setup", "validation", "approval", "report"].indexOf(currentStep));
  return (
    <header className="app-header no-print">
      <a className="brand" href="#main" aria-label="Sales Report Assistant home">
        <span className="brand-mark" aria-hidden="true">SR</span>
        <span>Sales Report Assistant</span>
      </a>
      {currentStep !== "welcome" && (
        <ol className="progress" aria-label="Report progress">
          {steps.map((step, index) => (
            <li className={index <= activeIndex ? "active" : ""} aria-current={index === activeIndex ? "step" : undefined} key={step}>
              <span>{index + 1}</span>{step}
            </li>
          ))}
        </ol>
      )}
      <div className="privacy-note"><span aria-hidden="true">●</span> Files stay in this browser</div>
    </header>
  );
}
