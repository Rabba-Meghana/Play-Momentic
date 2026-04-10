"use client";

import { useState, useRef, useCallback } from "react";
import styles from "./page.module.css";

interface ConversionResult {
  name: string;
  yaml: string;
  tokens: number;
}

interface ApiResponse {
  results: ConversionResult[];
  totalTests: number;
  error?: string;
}

type Status = "idle" | "loading" | "done" | "error";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [code, setCode] = useState("");
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Record<number, "yaml" | "original">>(  {});
  const [copied, setCopied] = useState<Record<number, boolean>>({});
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setCode(e.target?.result as string ?? "");
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleConvert = async () => {
    if (!code.trim()) return setError("Please paste or upload a Playwright test file.");
    if (!apiKey.trim()) return setError("Please enter your Groq API key.");
    setError("");
    setStatus("loading");
    setResults([]);

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, apiKey, fileName }),
      });
      const data: ApiResponse = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Conversion failed");
      setResults(data.results);
      setStatus("done");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  };

  const copyYaml = (i: number, yaml: string) => {
    navigator.clipboard.writeText(yaml);
    setCopied(prev => ({ ...prev, [i]: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, [i]: false })), 1500);
  };

  const downloadAll = () => {
    const combined = results
      .map((r, i) => `# --- Test ${i + 1}: ${r.name} ---\n${r.yaml}`)
      .join("\n\n---\n\n");
    const blob = new Blob([combined], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "momentic-tests.yaml";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalTokens = results.reduce((s, r) => s + r.tokens, 0);
  const totalSteps = results.reduce((s, r) => s + (r.yaml.match(/^\s+- description:/gm)?.length ?? 0), 0);

  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <div className={styles.logoMark}>P→M</div>
            <div>
              <div className={styles.logoText}>PlayToMomentic</div>
              <div className={styles.logoSub}>Playwright → Momentic YAML</div>
            </div>
          </div>
          <nav className={styles.headerNav}>
            <a href="https://github.com/Rabba-Meghana/Play-Momentic" target="_blank" className={styles.navLink}>
              GitHub
            </a>
            <a href="https://momentic.ai/docs" target="_blank" className={styles.navLink}>
              Momentic Docs
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroLabel}>Open Source Migration Tool</div>
          <h1 className={styles.heroTitle}>
            Convert Playwright tests to<br />
            <span className={styles.heroAccent}>Momentic YAML</span> in seconds
          </h1>
          <p className={styles.heroDesc}>
            Paste your <code>.spec.ts</code> file, drop your Groq key, and get production-ready
            Momentic test YAML with plain-English descriptions — powered by Llama 3.
          </p>
        </div>
      </section>

      {/* Main */}
      <main className={styles.main}>
        <div className={styles.grid}>

          {/* Left panel */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Input</span>
              {fileName && <span className={styles.fileChip}>{fileName}</span>}
            </div>

            {/* API Key */}
            <div className={styles.field}>
              <label className={styles.label}>Groq API Key</label>
              <input
                type="password"
                className={styles.input}
                placeholder="gsk_••••••••••••••••••••••••"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <div className={styles.fieldHint}>
                Get your key at <a href="https://console.groq.com" target="_blank">console.groq.com</a> — free tier works
              </div>
            </div>

            {/* Drop zone */}
            <div className={styles.field}>
              <label className={styles.label}>Playwright Test File</label>
              <div
                className={`${styles.dropZone} ${dragOver ? styles.dragOver : ""}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".ts,.js,.spec.ts,.spec.js"
                  style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                <div className={styles.dropIcon}>⬆</div>
                <div className={styles.dropText}>
                  Drop your <code>.spec.ts</code> file here
                </div>
                <div className={styles.dropSub}>or click to browse</div>
              </div>
            </div>

            {/* Code editor */}
            <div className={styles.field}>
              <label className={styles.label}>
                Or paste code directly
                {code && <span className={styles.lineCount}>{code.split("\n").length} lines</span>}
              </label>
              <textarea
                className={styles.textarea}
                placeholder={`import { test, expect } from '@playwright/test';\n\ntest('user can login', async ({ page }) => {\n  await page.goto('https://app.example.com/login');\n  await page.getByLabel('Email').fill('user@example.com');\n  await page.getByRole('button', { name: 'Sign in' }).click();\n  await expect(page).toHaveURL(/dashboard/);\n});`}
                value={code}
                onChange={e => setCode(e.target.value)}
                spellCheck={false}
              />
            </div>

            {error && (
              <div className={styles.errorBox}>{error}</div>
            )}

            <button
              className={styles.convertBtn}
              onClick={handleConvert}
              disabled={status === "loading"}
            >
              {status === "loading" ? (
                <span className={styles.btnLoading}>
                  <span className={styles.spinner} />
                  Converting with Groq...
                </span>
              ) : (
                "Convert to Momentic YAML →"
              )}
            </button>
          </div>

          {/* Right panel */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Output</span>
              {results.length > 0 && (
                <button className={styles.downloadBtn} onClick={downloadAll}>
                  ↓ Download all
                </button>
              )}
            </div>

            {status === "idle" && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>◎</div>
                <div className={styles.emptyTitle}>Ready to convert</div>
                <div className={styles.emptyDesc}>
                  Your Momentic YAML tests will appear here,<br />
                  one card per test block.
                </div>
              </div>
            )}

            {status === "loading" && (
              <div className={styles.emptyState}>
                <div className={styles.loadingDots}>
                  <span /><span /><span />
                </div>
                <div className={styles.emptyTitle}>Groq is converting your tests</div>
                <div className={styles.emptyDesc}>Using Llama 3 70B — usually takes 5–15 seconds</div>
              </div>
            )}

            {status === "done" && results.length > 0 && (
              <>
                {/* Stats bar */}
                <div className={styles.statsBar}>
                  <div className={styles.statItem}>
                    <div className={styles.statVal}>{results.length}</div>
                    <div className={styles.statLabel}>tests</div>
                  </div>
                  <div className={styles.statDiv} />
                  <div className={styles.statItem}>
                    <div className={styles.statVal}>{totalSteps}</div>
                    <div className={styles.statLabel}>steps</div>
                  </div>
                  <div className={styles.statDiv} />
                  <div className={styles.statItem}>
                    <div className={styles.statVal}>{totalTokens.toLocaleString()}</div>
                    <div className={styles.statLabel}>tokens</div>
                  </div>
                </div>

                {/* Result cards */}
                <div className={styles.resultCards}>
                  {results.map((r, i) => (
                    <div key={i} className={styles.resultCard}>
                      <div className={styles.resultCardHeader}>
                        <div className={styles.resultNum}>{i + 1}</div>
                        <div className={styles.resultName}>{r.name}</div>
                        <div className={styles.resultTokens}>{r.tokens} tokens</div>
                      </div>

                      <div className={styles.resultTabs}>
                        <button
                          className={`${styles.resultTab} ${(activeTab[i] ?? "yaml") === "yaml" ? styles.activeTab : ""}`}
                          onClick={() => setActiveTab(p => ({ ...p, [i]: "yaml" }))}
                        >
                          YAML
                        </button>
                        <button
                          className={`${styles.resultTab} ${activeTab[i] === "original" ? styles.activeTab : ""}`}
                          onClick={() => setActiveTab(p => ({ ...p, [i]: "original" }))}
                        >
                          Original
                        </button>
                      </div>

                      <div className={styles.codeWrap}>
                        <button
                          className={styles.copyBtn}
                          onClick={() => copyYaml(i, activeTab[i] === "original" ? "" : r.yaml)}
                        >
                          {copied[i] ? "Copied!" : "Copy"}
                        </button>
                        <pre className={styles.codeBlock}>
                          {(activeTab[i] ?? "yaml") === "yaml" ? r.yaml : `// Test: ${r.name}`}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* How it works */}
        <section className={styles.howItWorks}>
          <h2 className={styles.sectionTitle}>How it works</h2>
          <div className={styles.steps}>
            {[
              { n: "01", title: "Parse", desc: "We extract every test() block from your Playwright file using TypeScript AST analysis." },
              { n: "02", title: "Convert", desc: "Each test is sent to Groq's Llama 3 70B model with a carefully tuned prompt that understands Momentic's YAML schema." },
              { n: "03", title: "Export", desc: "Download individual YAML files or a combined file — ready to drop into your Momentic workspace." },
            ].map(s => (
              <div key={s.n} className={styles.step}>
                <div className={styles.stepNum}>{s.n}</div>
                <div className={styles.stepTitle}>{s.title}</div>
                <div className={styles.stepDesc}>{s.desc}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>Built for Momentic · Powered by Groq Llama 3 ·</span>
        <a href="https://github.com/Rabba-Meghana/Play-Momentic" target="_blank"> View on GitHub</a>
      </footer>
    </div>
  );
}
