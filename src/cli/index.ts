#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import * as path from "path";
import * as fs from "fs";
import { parsePlaywrightFile } from "../parser/playwright-parser";
import { convertAllTests, ConversionResult } from "../converter/groq-converter";
import { generateHTMLReport } from "../reporter/html-reporter";
import { writeYamlFiles } from "../reporter/yaml-writer";

const program = new Command();

const BANNER = `
${chalk.hex("#c4a882")("  ╔═══════════════════════════════════╗")}
${chalk.hex("#c4a882")("  ║")}  ${chalk.bold.hex("#3a2d22")("PlayToMomentic")}  ${chalk.hex("#9a8878")("Playwright → Momentic")}  ${chalk.hex("#c4a882")("║")}
${chalk.hex("#c4a882")("  ╚═══════════════════════════════════╝")}
`;

program
  .name("play-to-momentic")
  .description("Convert Playwright test files to Momentic YAML using Groq AI")
  .version("1.0.0");

program
  .command("convert <file>")
  .description("Convert a Playwright .spec.ts file to Momentic YAML")
  .option("-o, --output <dir>", "Output directory", "./momentic-tests")
  .option("-k, --key <key>", "Groq API key (or set GROQ_API_KEY env var)")
  .option("-m, --model <model>", "Groq model to use", "llama-3.3-70b-versatile")
  .option("--no-html", "Skip generating the HTML report")
  .option("--no-yaml", "Skip generating individual YAML files")
  .action(async (file: string, options: any) => {
    console.log(BANNER);

    const apiKey: string = options.key || process.env.GROQ_API_KEY || "";
    if (!apiKey) {
      console.error(chalk.red("  ✗ Groq API key required. Set GROQ_API_KEY env var or use --key flag.\n"));
      process.exit(1);
    }

    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red("  ✗ File not found: " + filePath + "\n"));
      process.exit(1);
    }

    console.log(chalk.hex("#9a8878")("  Input   ") + chalk.hex("#3a2d22")(path.basename(filePath)));
    console.log(chalk.hex("#9a8878")("  Output  ") + chalk.hex("#3a2d22")(path.resolve(options.output)));
    console.log(chalk.hex("#9a8878")("  Model   ") + chalk.hex("#3a2d22")(options.model));
    console.log();

    const parseSpinner = ora({ text: "Parsing Playwright test file...", color: "yellow" }).start();

    let parseResult: any;
    try {
      parseResult = parsePlaywrightFile(filePath);
      parseSpinner.succeed(
        chalk.hex("#9a8878")("Parsed ") +
        chalk.bold.hex("#3a2d22")(String(parseResult.totalTests) + " tests") +
        chalk.hex("#9a8878")(" from ") +
        chalk.hex("#3a2d22")(path.basename(filePath))
      );
    } catch (err) {
      parseSpinner.fail(chalk.red("Parse failed: " + (err as Error).message));
      process.exit(1);
      return;
    }

    if (parseResult.totalTests === 0) {
      console.log(chalk.yellow("\n  No test() blocks found in this file.\n"));
      process.exit(0);
      return;
    }

    console.log();

    const convertSpinner = ora({
      text: "Converting test 1 of " + parseResult.totalTests + "...",
      color: "yellow",
    }).start();

    let results: ConversionResult[] = [];
    try {
      results = await convertAllTests(
        parseResult.tests,
        apiKey,
        (index: number, total: number, name: string) => {
          convertSpinner.text = "Converting test " + (index + 1) + " of " + total + ": " + chalk.hex("#c4a882")(name.slice(0, 50));
        }
      );
      convertSpinner.succeed(
        chalk.hex("#9a8878")("Converted ") +
        chalk.bold.hex("#3a2d22")(String(results.length) + " tests") +
        chalk.hex("#9a8878")(" via Groq AI")
      );
    } catch (err) {
      convertSpinner.fail(chalk.red("Conversion failed: " + (err as Error).message));
      process.exit(1);
      return;
    }

    const outputDir = path.resolve(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log();

    if (options.yaml !== false) {
      const yamlSpinner = ora({ text: "Writing YAML files...", color: "yellow" }).start();
      const written = writeYamlFiles(results, outputDir);
      yamlSpinner.succeed(
        chalk.hex("#9a8878")("Wrote ") +
        chalk.bold.hex("#3a2d22")(String(written.length) + " YAML files") +
        chalk.hex("#9a8878")(" to ") +
        chalk.hex("#3a2d22")(options.output)
      );
    }

    if (options.html !== false) {
      const htmlSpinner = ora({ text: "Generating HTML report...", color: "yellow" }).start();
      const reportPath = path.join(outputDir, "report.html");
      generateHTMLReport(results, reportPath, filePath);
      htmlSpinner.succeed(
        chalk.hex("#9a8878")("Generated report → ") +
        chalk.bold.hex("#c4a882")(reportPath)
      );
    }

    const totalSteps = results.reduce((s: number, r: ConversionResult) => s + (r.converted?.steps?.length ?? 0), 0);
    const totalTokens = results.reduce((s: number, r: ConversionResult) => s + r.tokensUsed, 0);

    console.log();
    console.log(chalk.hex("#c4a882")("  ─────────────────────────────────────"));
    console.log(chalk.hex("#9a8878")("  Tests converted  ") + chalk.bold.hex("#3a2d22")(String(results.length)));
    console.log(chalk.hex("#9a8878")("  Total steps      ") + chalk.bold.hex("#3a2d22")(String(totalSteps)));
    console.log(chalk.hex("#9a8878")("  Tokens used      ") + chalk.bold.hex("#3a2d22")(totalTokens.toLocaleString()));
    console.log(chalk.hex("#c4a882")("  ─────────────────────────────────────"));
    console.log();
    console.log(chalk.bold.hex("#3a2d22")("  Done! ") + chalk.hex("#9a8878")("Open the report in your browser:"));
    console.log(chalk.hex("#c4a882")("  " + path.join(outputDir, "report.html")));
    console.log();
  });

program.parse(process.argv);
