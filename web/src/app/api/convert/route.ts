import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an expert at converting Playwright E2E test code into Momentic YAML test format.

Momentic tests use plain English descriptions and follow this YAML structure:

name: "Test name here"
description: "What this test verifies in one sentence"
url: "https://example.com/start-page"
tags: [smoke, regression]
steps:
  - description: "Navigate to the login page"
    action: navigate
    url: "https://example.com/login"
  - description: "Enter the email address"
    action: fill
    selector: "Email input field"
    value: "user@example.com"
  - description: "Click the submit button"
    action: click
    selector: "Submit button"
  - description: "Verify the dashboard is visible"
    action: assert
    assertion: "Dashboard heading is visible on the page"

Rules:
- Write ALL descriptions in clear, plain English
- Use intent-based selectors (describe what the element IS, not its CSS/XPath)
- For assertions, describe what the user should SEE
- Infer the starting URL from page.goto() calls
- Add relevant tags: smoke, auth, checkout, navigation, form, etc.
- ONLY output valid YAML, no explanation, no markdown code blocks`;

function extractTests(code: string): Array<{ name: string; body: string }> {
  const tests: Array<{ name: string; body: string }> = [];

  // Match test( or it( with any quote style, handling nested braces
  const lines = code.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    // Look for test( or it( at start of line (possibly indented)
    const testMatch = line.match(/^\s*(?:test|it)\s*\(\s*(['"`])(.*?)\1/);
    if (testMatch) {
      const name = testMatch[2];
      // Collect the full test block by tracking brace depth
      let depth = 0;
      let started = false;
      const blockLines: string[] = [];

      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        blockLines.push(l);
        for (const ch of l) {
          if (ch === "{") { depth++; started = true; }
          if (ch === "}") { depth--; }
        }
        if (started && depth === 0) {
          i = j + 1;
          break;
        }
      }

      tests.push({ name, body: blockLines.join("\n") });
      continue;
    }
    i++;
  }

  return tests;
}

export async function POST(request: NextRequest) {
  try {
    const { code, apiKey, fileName } = await request.json();

    if (!code || !apiKey) {
      return NextResponse.json({ error: "Missing code or API key" }, { status: 400 });
    }

    const tests = extractTests(code);

    if (tests.length === 0) {
      tests.push({ name: fileName || "Test", body: code });
    }

    const results = [];

    for (let idx = 0; idx < tests.length; idx++) {
      const test = tests[idx];

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Convert this Playwright test to Momentic YAML:\n\nTest name: "${test.name}"\n\n${test.body}\n\nOutput ONLY the YAML.`,
            },
          ],
          temperature: 0.2,
          max_tokens: 1200,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        return NextResponse.json({ error: err.error?.message ?? "Groq API error" }, { status: 500 });
      }

      const data = await response.json();
      const rawYaml = data.choices[0]?.message?.content ?? "";
      const cleanYaml = rawYaml.replace(/```yaml\n?/g, "").replace(/```\n?/g, "").trim();

      results.push({
        name: test.name,
        yaml: cleanYaml,
        tokens: data.usage?.total_tokens ?? 0,
      });

      if (idx < tests.length - 1) {
        await new Promise(r => setTimeout(r, 350));
      }
    }

    return NextResponse.json({ results, totalTests: results.length });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
