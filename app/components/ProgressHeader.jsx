export default function ProgressHeader({ onNavigate }) {
  return (
    <header className="app-header no-print">
      <button className="brand brand-button" type="button" onClick={onNavigate} aria-label="Salescraft home">
        <span className="brand-mark" aria-hidden="true" />
        <span>Sales<span>craft</span></span>
      </button>
      <p className="masthead-note">Automated reporting</p>
      <div className="privacy-note"><span aria-hidden="true">◆</span> Processed locally</div>
    </header>
  );
}
