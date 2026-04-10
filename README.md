# PlayToMomentic

> Convert Playwright test files to Momentic YAML — instantly, using Groq Llama 3.

Built to solve the #1 onboarding blocker for [Momentic](https://momentic.ai): teams with existing Playwright suites don't want to rewrite hundreds of tests from scratch. This tool does it for them.

![PlayToMomentic](https://img.shields.io/badge/Playwright%20→%20Momentic-migration%20tool-c4a882?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3a2d22?style=flat-square)
![Groq](https://img.shields.io/badge/Groq-Llama%203%2070B-9a8878?style=flat-square)

---

## What it does

Paste or upload a `.spec.ts` Playwright file → get production-ready Momentic YAML with:

- **Plain-English step descriptions** (not brittle CSS selectors)
- **Intent-based selectors** that survive UI changes
- **Auto-detected test tags** (smoke, auth, checkout, etc.)
- **Beautiful HTML report** showing side-by-side original vs converted

---

## Quick start

### Web app (recommended)

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter your Groq API key, paste your test file.

### CLI

```bash
npm install
export GROQ_API_KEY=gsk_your_key_here
npx ts-node src/cli/index.ts convert examples/sample.spec.ts --output ./output
```

Opens `output/report.html` in your browser with the full migration report.

---

## CLI usage

```
play-to-momentic convert <file> [options]

Options:
  -o, --output <dir>   Output directory (default: ./momentic-tests)
  -k, --key <key>      Groq API key (or set GROQ_API_KEY env var)
  -m, --model <model>  Groq model (default: llama3-70b-8192)
  --no-html            Skip HTML report
  --no-yaml            Skip YAML file output
```

### Examples

```bash
# Convert a single file
npx ts-node src/cli/index.ts convert tests/auth.spec.ts

# Custom output directory
npx ts-node src/cli/index.ts convert tests/checkout.spec.ts --output ./momentic

# Use specific Groq model
npx ts-node src/cli/index.ts convert tests/auth.spec.ts --model mixtral-8x7b-32768
```

---

## Output

For each test block, you get:

**Input (Playwright):**
```typescript
test("user can sign in", async ({ page }) => {
  await page.goto("https://app.example.com/login");
  await page.getByLabel("Email").fill("user@example.com");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/dashboard/);
});
```

**Output (Momentic YAML):**
```yaml
name: "User can sign in"
description: "Verifies that a user can successfully log in with valid credentials"
url: "https://app.example.com/login"
tags: [smoke, auth]
steps:
  - description: "Navigate to the login page"
    action: navigate
    url: "https://app.example.com/login"
  - description: "Enter the user's email address"
    action: fill
    selector: "Email address input field"
    value: "user@example.com"
  - description: "Click the Sign in button"
    action: click
    selector: "Sign in button"
  - description: "Verify the user is redirected to the dashboard"
    action: assert
    assertion: "The page URL contains 'dashboard'"
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| CLI | TypeScript · Node.js · Commander.js · ts-morph (AST) |
| AI | Groq API · Llama 3 70B |
| Web | Next.js 14 · React 18 · CSS Modules |
| Testing parsing | ts-morph · Playwright AST analysis |
| Output | YAML · HTML report |
| CI | GitHub Actions |

---

## Get a Groq API key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (free)
3. Create an API key
4. The free tier is more than enough for this tool

---

## Project structure

```
Play-Momentic/
├── src/
│   ├── cli/index.ts          # CLI entry point
│   ├── parser/               # Playwright AST parser
│   ├── converter/            # Groq AI converter
│   └── reporter/             # HTML report + YAML writer
├── web/
│   └── src/app/              # Next.js web app
├── examples/
│   └── sample.spec.ts        # Demo Playwright test
└── .github/workflows/        # CI pipeline
```

---

## Contributing

This project was built as a prototype to solve a real Momentic onboarding problem. PRs welcome — especially around:

- Supporting more Playwright patterns (page fixtures, custom commands)
- Adding a VS Code extension
- Improving YAML quality for complex assertion chains

---

*Built with TypeScript · Groq · Next.js*
