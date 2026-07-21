export default function WelcomeScreen({ onStart }) {
  return (
    <section className="welcome panel" aria-labelledby="welcome-title">
      <div className="welcome-copy">
        <p className="eyebrow">Weekly reporting, without the spreadsheet scramble</p>
        <h1 id="welcome-title">Turn store files into one confident sales report.</h1>
        <p className="lede">Combine CSV files, catch data issues, approve a clean dataset, and create a manager-ready report in minutes.</p>
        <button className="button primary" onClick={onStart}>Create Weekly Report <span aria-hidden="true">→</span></button>
      </div>
      <ol className="workflow-card" aria-label="How it works">
        <li><span>01</span><div><strong>Add your files</strong><p>Select the week and upload CSVs from every store.</p></div></li>
        <li><span>02</span><div><strong>Review the checks</strong><p>See missing values, invalid numbers, and duplicates.</p></div></li>
        <li><span>03</span><div><strong>Approve and report</strong><p>Exclude issues and print a clean management summary.</p></div></li>
      </ol>
    </section>
  );
}
