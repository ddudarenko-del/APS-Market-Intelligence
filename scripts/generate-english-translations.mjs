import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataPath = path.join(projectRoot, "app/data/market_data.json");
const componentPath = path.join(projectRoot, "app/MarketDashboard.tsx");
const outputPath = path.join(projectRoot, "app/data/translations.en.json");
const cyrillic = /[А-Яа-яЁё]/;
const richMarker = /^::(?:h|p|b[0-3])::/;
const richToken = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s]+)/g;

function collectRichString(value, output) {
  const tokens = value.replace(richMarker, "").split(richToken).filter(Boolean);
  for (const token of tokens) {
    if (/^https?:\/\//.test(token)) continue;
    const bold = token.match(/^\*\*([\s\S]+)\*\*$/);
    const link = token.match(/^\[([^\]]+)\]\(https?:\/\/[^)]+\)$/);
    const visibleText = (bold?.[1] ?? link?.[1] ?? token).trim();
    if (cyrillic.test(visibleText)) output.add(visibleText);
  }
}

function collectJsonStrings(value, output) {
  if (typeof value === "string") {
    if (richMarker.test(value)) {
      collectRichString(value, output);
      return;
    }
    if (cyrillic.test(value)) output.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonStrings(item, output));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectJsonStrings(item, output));
  }
}

function collectComponentStrings(source, output) {
  const sourceFile = ts.createSourceFile(componentPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if ((ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) && cyrillic.test(node.text)) {
      output.add(node.text);
    }
    if (ts.isJsxText(node)) {
      const normalized = node.getText(sourceFile).replace(/\s+/g, " ").trim();
      if (cyrillic.test(normalized)) output.add(normalized);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const strings = new Set();
collectJsonStrings(JSON.parse(fs.readFileSync(dataPath, "utf8")), strings);
collectComponentStrings(fs.readFileSync(componentPath, "utf8"), strings);

const existing = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, "utf8")) : {};
const pending = [...strings].filter((value) => !existing[value]);
const batches = [];
let current = [];
let currentLength = 0;

for (const value of pending) {
  const markerLength = 32;
  if (current.length && currentLength + value.length + markerLength > 3200) {
    batches.push(current);
    current = [];
    currentLength = 0;
  }
  current.push(value);
  currentLength += value.length + markerLength;
}
if (current.length) batches.push(current);

async function translateBatch(batch, batchIndex) {
  const input = batch.map((value, index) => `__APS_${String(index).padStart(4, "0")}__\n${value}`).join("\n");
  const params = new URLSearchParams({ client: "at", sl: "ru", tl: "en", dt: "t", q: input });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, {
      headers: { "user-agent": "Mozilla/5.0 APS Market Intelligence localization" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Translation request failed: ${response.status}`);
    const payload = await response.json();
    const translated = payload[0].map((segment) => segment[0] ?? "").join("");
    const parts = translated.split(/__APS_(\d{4})__\s*/g);
    const result = {};
    for (let index = 1; index < parts.length; index += 2) {
      const sourceIndex = Number(parts[index]);
      result[batch[sourceIndex]] = parts[index + 1]?.trim() ?? "";
    }
    if (Object.keys(result).length !== batch.length) {
      throw new Error(`Marker mismatch in batch ${batchIndex + 1}: ${Object.keys(result).length}/${batch.length}`);
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

for (let index = 0; index < batches.length; index += 1) {
  let translated;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      translated = await translateBatch(batches[index], index);
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  Object.assign(existing, translated);
  fs.writeFileSync(outputPath, `${JSON.stringify(existing, null, 2)}\n`);
  process.stdout.write(`Translated ${index + 1}/${batches.length} batches (${Object.keys(existing).length} strings)\n`);
}

process.stdout.write(`English dictionary ready: ${Object.keys(existing).length} strings\n`);
