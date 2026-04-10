import { Project, SyntaxKind, CallExpression, Node } from "ts-morph";
import * as path from "path";

export interface PlaywrightStep {
  type: "action" | "assertion" | "navigation" | "wait" | "fill" | "click" | "unknown";
  raw: string;
  method?: string;
  selector?: string;
  value?: string;
}

export interface PlaywrightTest {
  name: string;
  filePath: string;
  steps: PlaywrightStep[];
  rawCode: string;
}

export interface ParseResult {
  tests: PlaywrightTest[];
  filePath: string;
  totalTests: number;
}

function extractStringArg(node: CallExpression): string | undefined {
  const args = node.getArguments();
  if (args.length > 0) {
    const first = args[0];
    if (first.getKind() === SyntaxKind.StringLiteral) {
      return first.getText().replace(/^['"`]|['"`]$/g, "");
    }
    if (first.getKind() === SyntaxKind.TemplateExpression ||
        first.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
      return first.getText().replace(/^`|`$/g, "");
    }
  }
  return undefined;
}

function classifyStep(raw: string): PlaywrightStep {
  const line = raw.trim();

  // Navigation
  if (line.includes("page.goto(") || line.includes("page.reload(") || line.includes("page.goBack(")) {
    const urlMatch = line.match(/goto\(['"`]([^'"`]+)['"`]\)/);
    return { type: "navigation", raw: line, method: "goto", value: urlMatch?.[1] };
  }

  // Click
  if (line.includes(".click(") || line.includes(".dblclick(")) {
    const selMatch = line.match(/getByRole\(([^)]+)\)|getByText\(([^)]+)\)|getByLabel\(([^)]+)\)|locator\(([^)]+)\)|getByTestId\(([^)]+)\)/);
    return { type: "click", raw: line, method: "click", selector: selMatch?.[0] };
  }

  // Fill / type
  if (line.includes(".fill(") || line.includes(".type(") || line.includes(".pressSequentially(")) {
    const valMatch = line.match(/fill\(['"`]([^'"`]*)['"`]\)/);
    return { type: "fill", raw: line, method: "fill", value: valMatch?.[1] };
  }

  // Assertions
  if (line.includes("expect(") || line.includes("toHave") || line.includes("toBe") || line.includes("toContain")) {
    return { type: "assertion", raw: line, method: "expect" };
  }

  // Wait
  if (line.includes("waitFor") || line.includes("page.wait")) {
    return { type: "wait", raw: line, method: "wait" };
  }

  return { type: "unknown", raw: line };
}

export function parsePlaywrightFile(filePath: string): ParseResult {
  const project = new Project({ useInMemoryFileSystem: false });
  const sourceFile = project.addSourceFileAtPath(filePath);

  const tests: PlaywrightTest[] = [];

  // Find all test() and it() calls
  sourceFile.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.CallExpression) return;

    const call = node as CallExpression;
    const expr = call.getExpression();
    const exprText = expr.getText();

    if (!["test", "it", "test.only", "it.only"].includes(exprText)) return;

    const args = call.getArguments();
    if (args.length < 2) return;

    const nameNode = args[0];
    let testName = nameNode.getText().replace(/^['"`]|['"`]$/g, "");

    // Get the test body
    const bodyArg = args[args.length - 1];
    const bodyText = bodyArg.getText();

    // Extract individual statements as steps
    const lines = bodyText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 3 && !l.startsWith("//") && !l.startsWith("async") && !l.startsWith("{") && !l.startsWith("}") && !l.startsWith("const {") && !l.startsWith("const page"));

    const steps: PlaywrightStep[] = lines.map(classifyStep).filter((s) => s.type !== "unknown" || s.raw.includes("page.") || s.raw.includes("expect("));

    if (steps.length > 0) {
      tests.push({
        name: testName,
        filePath: path.basename(filePath),
        steps,
        rawCode: bodyText,
      });
    }
  });

  return {
    tests,
    filePath,
    totalTests: tests.length,
  };
}
