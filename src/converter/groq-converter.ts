import Groq from "groq-sdk";
import { PlaywrightTest, PlaywrightStep } from "../parser/playwright-parser";

export interface MomentcStep {
  description: string;
  action: string;
  selector?: string;
  value?: string;
  assertion?: string;
}

export interface MomentcTest {
  name: string;
  description: string;
  url?: string;
  steps: MomentcStep[];
  tags: string[];
}

export interface ConversionResult {
  original: PlaywrightTest;
  converted: MomentcTest;
  yaml: string;
  tokensUsed: number;
}

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
- Write ALL descriptions in clear, plain English — as if explaining to a non-technical person
- Use intent-based selectors (describe what the element IS, not its CSS/XPath)
- For assertions, describe what the user should SEE, not the technical check
- Infer the starting URL from page.goto() calls
- Add relevant tags: smoke, auth, checkout, navigation, form, etc.
- ONLY output valid YAML, nothing else, no explanation, no markdown code blocks`;

function buildUserPrompt(test: PlaywrightTest): string {
  const stepsText = test.steps.map((s) => `  ${s.raw}`).join("\n");
  return `Convert this Playwright test to Momentic YAML format:

Test name: "${test.name}"
File: ${test.filePath}

Test code:
${test.rawCode}

Output ONLY the Momentic YAML, no explanations.`;
}

export async function convertTestWithGroq(
  test: PlaywrightTest,
  apiKey: string,
  model: string = "llama-3.3-70b-versatile"
): Promise<ConversionResult> {
  const groq = new Groq({ apiKey });

  const response = await groq.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(test) },
    ],
    temperature: 0.2,
    max_tokens: 1500,
  });

  const rawYaml = response.choices[0]?.message?.content ?? "";
  const cleanYaml = rawYaml
    .replace(/```yaml\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const tokensUsed = response.usage?.total_tokens ?? 0;

  // Parse back to structured object for the report
  let converted: MomentcTest = {
    name: test.name,
    description: `Converted from ${test.filePath}`,
    steps: [],
    tags: ["converted", "playwright-migration"],
  };

  try {
    const yaml = await import("js-yaml");
    const parsed = yaml.load(cleanYaml) as Partial<MomentcTest>;
    if (parsed && typeof parsed === "object") {
      converted = {
        name: parsed.name ?? test.name,
        description: parsed.description ?? converted.description,
        url: parsed.url,
        steps: (parsed.steps as MomentcStep[]) ?? [],
        tags: (parsed.tags as string[]) ?? converted.tags,
      };
    }
  } catch {
    // yaml parse failed, still return raw yaml
  }

  return {
    original: test,
    converted,
    yaml: cleanYaml,
    tokensUsed,
  };
}

export async function convertAllTests(
  tests: PlaywrightTest[],
  apiKey: string,
  onProgress?: (index: number, total: number, name: string) => void
): Promise<ConversionResult[]> {
  const results: ConversionResult[] = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    onProgress?.(i, tests.length, test.name);
    const result = await convertTestWithGroq(test, apiKey);
    results.push(result);
    // Small delay to respect rate limits
    if (i < tests.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return results;
}
