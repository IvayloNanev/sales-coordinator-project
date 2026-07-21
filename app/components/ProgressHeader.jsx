const steps = [
  { label: "Setup", href: "#upload", number: "01" },
  { label: "Validate", href: "#validate", number: "02" },
  { label: "Report", href: "#report", number: "03" },
];

export default function ProgressHeader({ validationReady, reportReady }) {
  const available = [true, validationReady, reportReady];
  const activeIndex = reportReady ? 2 : validationReady ? 1 : 0;
  return (
    <header className="app-header no-print">
      <a className="brand" href="#main" aria-label="Sales Report Assistant home">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span>Sales<span>craft</span></span>
      </a>
      <nav className="progress" aria-label="Report workflow">
        {steps.map((step, index) => {
          const className = `${available[index] ? "available" : "locked"}${activeIndex === index ? " active" : ""}`;
          const content = <><span aria-hidden="true">{available[index] && index > 0 ? "✓" : step.number}</span>{step.label}</>;
          return available[index]
            ? <a className={className} href={step.href} aria-current={activeIndex === index ? "step" : undefined} key={step.href}>{content}</a>
            : <span className={className} aria-disabled="true" key={step.href}>{content}</span>;
        })}
      </nav>
      <div className="privacy-note"><span aria-hidden="true" /> Local & private</div>
    </header>
  );
}
