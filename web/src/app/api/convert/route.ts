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

export async function POST(request: NextRequest) {
  try {
    const { code, apiKey, fileName } = await request.json();

    if (!code || !apiKey) {
      return NextResponse.json({ error: "Missing code or API key" }, { status: 400 });
    }

    // Extract individual test blocks using regex
    const testPattern = /test\s*\(\s*(['"`])(.+?)\1\s*,\s*async[^{]*\{([\s\S]*?)(?=\n\s*\}\s*\n\s*(?:test|it|\})|$)/g;
    const tests: Array<{ name: string; body: string }> = [];
    let match;

    while ((match = testPattern.exec(code)) !== null) {
      tests.push({
        name: match[2],
        body: match[0],
      });
    }

    if (tests.length === 0) {
      // Try to convert the whole file as one test
      tests.push({ name: fileName || "Test", body: code });
    }

    const results = [];

    for (const test of tests) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3-70b-8192",
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

      // Small delay between requests
      if (tests.indexOf(test) < tests.length - 1) {
        await new Promise(r => setTimeout(r, 400));
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
