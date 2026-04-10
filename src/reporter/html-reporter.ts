import * as fs from "fs";
import * as path from "path";
import { ConversionResult } from "../converter/groq-converter";

export function generateHTMLReport(
  results: ConversionResult[],
  outputPath: string,
  inputFile: string
): void {
  const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
  const totalSteps = results.reduce((sum, r) => sum + r.converted.steps.length, 0);
  const timestamp = new Date().toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

  const cardsHTML = results.map((r, i) => {
    const stepsHTML = r.converted.steps.map((step, si) => `
      <div class="step">
        <div class="step-num">${si + 1}</div>
        <div class="step-content">
          <div class="step-desc">${escapeHtml(step.description ?? "")}</div>
          <div class="step-meta">
            ${step.action ? `<span class="meta-chip action">${step.action}</span>` : ""}
            ${step.selector ? `<span class="meta-chip selector">${escapeHtml(step.selector)}</span>` : ""}
            ${step.value ? `<span class="meta-chip value">"${escapeHtml(step.value)}"</span>` : ""}
            ${step.assertion ? `<span class="meta-chip assertion">${escapeHtml(step.assertion)}</span>` : ""}
          </div>
        </div>
      </div>`).join("");

    const tagsHTML = (r.converted.tags ?? []).map(t => `<span class="tag">${t}</span>`).join("");

    const yamlEscaped = escapeHtml(r.yaml);

    return `
    <div class="card" id="card-${i}">
      <div class="card-header" onclick="toggleCard(${i})">
        <div class="card-header-left">
          <div class="test-index">${i + 1}</div>
          <div class="test-info">
            <div class="test-name">${escapeHtml(r.converted.name)}</div>
            <div class="test-desc">${escapeHtml(r.converted.description)}</div>
          </div>
        </div>
        <div class="card-header-right">
          <div class="tags">${tagsHTML}</div>
          <div class="step-count">${r.converted.steps.length} steps</div>
          <div class="chevron" id="chevron-${i}">&#8250;</div>
        </div>
      </div>
      <div class="card-body" id="body-${i}">
        <div class="card-body-inner">
          ${r.converted.url ? `<div class="url-row"><span class="url-label">Start URL</span><span class="url-val">${escapeHtml(r.converted.url)}</span></div>` : ""}
          <div class="tabs">
            <button class="tab active" onclick="switchTab(${i}, 'steps', this)">Steps</button>
            <button class="tab" onclick="switchTab(${i}, 'yaml', this)">YAML</button>
            <button class="tab" onclick="switchTab(${i}, 'original', this)">Original</button>
          </div>
          <div class="tab-content" id="steps-${i}">
            <div class="steps-list">${stepsHTML}</div>
          </div>
          <div class="tab-content hidden" id="yaml-${i}">
            <div class="code-block"><button class="copy-btn" onclick="copyYaml(${i})">Copy</button><pre>${yamlEscaped}</pre></div>
          </div>
          <div class="tab-content hidden" id="original-${i}">
            <div class="code-block"><pre>${escapeHtml(r.original.rawCode)}</pre></div>
          </div>
        </div>
      </div>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PlayToMomentic — Migration Report</title>
  <style>
    :root {
      --nude-50: #faf8f5;
      --nude-100: #f4f0ea;
      --nude-200: #e8e0d5;
      --nude-300: #d4c8b8;
      --nude-400: #b8a898;
      --nude-500: #9a8878;
      --nude-600: #7a6858;
      --nude-700: #5c4c3c;
      --nude-800: #3d3028;
      --nude-900: #1e1810;
      --cream: #fdfbf8;
      --sand: #e8ddd0;
      --mocha: #6b5c4e;
      --espresso: #3a2d22;
      --accent: #c4a882;
      --accent-light: #f0e8dc;
      --green: #7a9e7e;
      --blue: #8599b0;
      --text-primary: #2d2318;
      --text-secondary: #6b5c4e;
      --text-muted: #9a8878;
      --border: #e0d5c8;
      --radius: 12px;
      --radius-sm: 8px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, "Inter", "Segoe UI", sans-serif;
      background: var(--nude-50);
      color: var(--text-primary);
      min-height: 100vh;
      line-height: 1.6;
    }
    /* Header */
    .header {
      background: var(--cream);
      border-bottom: 1px solid var(--border);
      padding: 0 2rem;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header-inner {
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo-mark {
      width: 32px; height: 32px;
      background: var(--espresso);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: var(--accent);
      font-size: 14px; font-weight: 700;
    }
    .logo-text {
      font-size: 16px; font-weight: 600;
      color: var(--espresso);
      letter-spacing: -0.3px;
    }
    .logo-sub { font-size: 13px; color: var(--text-muted); font-weight: 400; }
    .header-meta { font-size: 12px; color: var(--text-muted); }
    /* Hero */
    .hero {
      background: linear-gradient(135deg, var(--cream) 0%, var(--nude-100) 100%);
      border-bottom: 1px solid var(--border);
      padding: 3rem 2rem;
    }
    .hero-inner {
      max-width: 960px;
      margin: 0 auto;
    }
    .hero-label {
      font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .1em;
      color: var(--accent);
      margin-bottom: .75rem;
    }
    .hero-title {
      font-size: 28px; font-weight: 700;
      color: var(--espresso);
      letter-spacing: -.5px;
      margin-bottom: .5rem;
    }
    .hero-file {
      font-size: 14px; color: var(--text-secondary);
      font-family: "SF Mono", "Fira Code", monospace;
      background: var(--nude-200);
      padding: 3px 10px;
      border-radius: 20px;
      display: inline-block;
      margin-bottom: 2rem;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }
    @media (max-width: 600px) { .stats { grid-template-columns: repeat(2, 1fr); } }
    .stat-card {
      background: var(--cream);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.25rem 1.5rem;
    }
    .stat-val {
      font-size: 32px; font-weight: 700;
      color: var(--espresso);
      line-height: 1;
      margin-bottom: .25rem;
      letter-spacing: -1px;
    }
    .stat-label {
      font-size: 12px; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: .06em;
    }
    /* Main */
    .main {
      max-width: 960px;
      margin: 0 auto;
      padding: 2rem;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .section-title {
      font-size: 13px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .08em;
      color: var(--text-muted);
    }
    .expand-all {
      font-size: 12px; color: var(--mocha);
      cursor: pointer; border: none; background: none;
      font-family: inherit;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    /* Cards */
    .cards { display: flex; flex-direction: column; gap: .75rem; }
    .card {
      background: var(--cream);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      transition: box-shadow .2s;
    }
    .card:hover { box-shadow: 0 2px 12px rgba(60,40,20,.08); }
    .card-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.25rem 1.5rem;
      cursor: pointer;
      user-select: none;
      gap: 1rem;
    }
    .card-header-left { display: flex; align-items: flex-start; gap: .875rem; flex: 1; min-width: 0; }
    .test-index {
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--nude-200);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 600;
      color: var(--mocha);
      flex-shrink: 0;
    }
    .test-info { min-width: 0; }
    .test-name {
      font-size: 15px; font-weight: 600;
      color: var(--espresso);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin-bottom: 2px;
    }
    .test-desc { font-size: 12px; color: var(--text-secondary); }
    .card-header-right {
      display: flex; align-items: center; gap: .75rem; flex-shrink: 0;
    }
    .tags { display: flex; gap: .3rem; flex-wrap: wrap; }
    .tag {
      font-size: 10px; font-weight: 500;
      padding: 2px 8px; border-radius: 20px;
      background: var(--accent-light); color: var(--mocha);
      border: 1px solid var(--sand);
    }
    .step-count {
      font-size: 12px; color: var(--text-muted);
      white-space: nowrap;
    }
    .chevron {
      font-size: 18px; color: var(--text-muted);
      transition: transform .2s;
      line-height: 1;
    }
    .chevron.open { transform: rotate(90deg); }
    /* Card body */
    .card-body { display: none; border-top: 1px solid var(--border); }
    .card-body.open { display: block; }
    .card-body-inner { padding: 1.5rem; }
    .url-row {
      display: flex; align-items: center; gap: .5rem;
      margin-bottom: 1.25rem;
      font-size: 13px;
    }
    .url-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .06em; color: var(--text-muted);
    }
    .url-val {
      font-family: "SF Mono", "Fira Code", monospace;
      color: var(--blue);
      font-size: 12px;
    }
    /* Tabs */
    .tabs {
      display: flex; gap: .25rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 1.25rem;
    }
    .tab {
      font-size: 13px; font-weight: 500;
      padding: .5rem 1rem;
      border: none; background: none;
      color: var(--text-muted);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      font-family: inherit;
      transition: color .15s;
    }
    .tab.active { color: var(--espresso); border-bottom-color: var(--espresso); }
    .tab:hover { color: var(--espresso); }
    .tab-content.hidden { display: none; }
    /* Steps */
    .steps-list { display: flex; flex-direction: column; gap: .5rem; }
    .step {
      display: flex; gap: .875rem; align-items: flex-start;
      padding: .75rem 1rem;
      background: var(--nude-50);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .step-num {
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--nude-200);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 600; color: var(--mocha);
      flex-shrink: 0; margin-top: 1px;
    }
    .step-content { flex: 1; min-width: 0; }
    .step-desc { font-size: 13px; color: var(--text-primary); margin-bottom: .35rem; }
    .step-meta { display: flex; gap: .3rem; flex-wrap: wrap; }
    .meta-chip {
      font-size: 10px; font-weight: 500;
      padding: 2px 7px; border-radius: 20px;
    }
    .meta-chip.action { background: var(--espresso); color: var(--accent-light); }
    .meta-chip.selector { background: var(--nude-200); color: var(--mocha); }
    .meta-chip.value { background: #eef3ee; color: var(--green); }
    .meta-chip.assertion { background: #eef0f5; color: var(--blue); }
    /* Code block */
    .code-block {
      position: relative;
      background: var(--nude-800);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .code-block pre {
      font-family: "SF Mono", "Fira Code", monospace;
      font-size: 12px; line-height: 1.7;
      color: var(--nude-100);
      padding: 1.25rem;
      overflow-x: auto;
      white-space: pre;
    }
    .copy-btn {
      position: absolute; top: .75rem; right: .75rem;
      font-size: 11px; font-weight: 500;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid var(--nude-600);
      background: var(--nude-700);
      color: var(--nude-200);
      cursor: pointer;
      font-family: inherit;
    }
    .copy-btn:hover { background: var(--nude-600); }
    /* Footer */
    .footer {
      text-align: center;
      padding: 2rem;
      font-size: 12px;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
      margin-top: 3rem;
    }
    .footer a { color: var(--mocha); text-decoration: none; }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <div class="logo">
        <div class="logo-mark">P→M</div>
        <div>
          <div class="logo-text">PlayToMomentic</div>
        </div>
      </div>
      <div class="header-meta">${timestamp}</div>
    </div>
  </header>

  <section class="hero">
    <div class="hero-inner">
      <div class="hero-label">Migration Report</div>
      <h1 class="hero-title">Playwright → Momentic</h1>
      <div class="hero-file">${escapeHtml(path.basename(inputFile))}</div>
      <div class="stats">
        <div class="stat-card">
          <div class="stat-val">${results.length}</div>
          <div class="stat-label">Tests converted</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${totalSteps}</div>
          <div class="stat-label">Total steps</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${Math.round(totalSteps / Math.max(results.length, 1))}</div>
          <div class="stat-label">Avg steps / test</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${totalTokens.toLocaleString()}</div>
          <div class="stat-label">Tokens used</div>
        </div>
      </div>
    </div>
  </section>

  <main class="main">
    <div class="section-header">
      <div class="section-title">${results.length} converted tests</div>
      <button class="expand-all" onclick="expandAll()">Expand all</button>
    </div>
    <div class="cards">
      ${cardsHTML}
    </div>
  </main>

  <footer class="footer">
    Generated by <strong>PlayToMomentic</strong> &mdash; <a href="https://github.com/Rabba-Meghana/Play-Momentic" target="_blank">github.com/Rabba-Meghana/Play-Momentic</a>
  </footer>

  <script>
    const yamlData = ${JSON.stringify(results.map(r => r.yaml))};

    function toggleCard(i) {
      const body = document.getElementById('body-' + i);
      const chevron = document.getElementById('chevron-' + i);
      const isOpen = body.classList.contains('open');
      body.classList.toggle('open', !isOpen);
      chevron.classList.toggle('open', !isOpen);
    }

    function expandAll() {
      document.querySelectorAll('.card-body').forEach(b => b.classList.add('open'));
      document.querySelectorAll('.chevron').forEach(c => c.classList.add('open'));
    }

    function switchTab(i, tab, btn) {
      ['steps','yaml','original'].forEach(t => {
        document.getElementById(t + '-' + i).classList.toggle('hidden', t !== tab);
      });
      btn.closest('.card-body-inner').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
    }

    function copyYaml(i) {
      navigator.clipboard.writeText(yamlData[i]).then(() => {
        const btns = document.querySelectorAll('.copy-btn');
        const btn = btns[i];
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 1500); }
      });
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, "utf-8");
}

function escapeHtml(str: string): string {
  return (str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
