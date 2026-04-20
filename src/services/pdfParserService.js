// Support server-side PDF parsing and normalization for imported test papers.

import { readFile } from "fs/promises";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfjsPath = new URL("../../node_modules/pdfjs-dist/legacy/build/pdf.mjs", import.meta.url);
const pdfjsLib = await import(pdfjsPath);
const getDocument = pdfjsLib.getDocument ?? pdfjsLib.default?.getDocument;

const QUESTION_START = /^(\d{1,3})[.):] +(?!only\b|and\b|or\b|to\b|of\b|in\b|the\b|is\b|are\b|was\b|were\b|[A-Z][a-z]+ +:)(.{15,})$/;
const OPTION_START = /^\s*[\(\[]?\s*([A-Da-d])\s*[\)\].:\-]\s+(.+)$/;
const INLINE_ANSWER = /(?:ans(?:wer)?|correct(?:\s*option)?|solution)\s*[:\-]?\s*\(?\s*([A-Da-d])\s*\)?/i;
const ANSWER_SECTION_TITLE = /(answer\s*key|correct\s*answers?|solutions?)/i;

// Handle the normalizeWhitespace logic for this module.
function normalizeWhitespace(v) {
  return v.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

// Handle the normalizeLines logic for this module.
function normalizeLines(text) {
  return text.split(/\r?\n/).map(normalizeWhitespace).filter(Boolean);
}

// Handle the detectColumnSplit logic for this module.
function detectColumnSplit(items) {
  const xs = items.map((i) => Number(i.transform?.[4] || 0));
  if (!xs.length) return null;
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  if (xs.filter((x) => x < mid).length < 5 || xs.filter((x) => x >= mid).length < 5) return null;
  return mid;
}

// Handle the buildColumnText logic for this module.
function buildColumnText(items, minX, maxX) {
  const rows = new Map();
  items.forEach((item) => {
    if (!item.str?.trim()) return;
    const x = Number(item.transform?.[4] || 0);
    if (x < minX || x > maxX) return;
    const key = String(Math.round(Number(item.transform?.[5] || 0)));
    const cur = rows.get(key) || [];
    cur.push({ x, text: String(item.str) });
    rows.set(key, cur);
  });
  return [...rows.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([, row]) => row.sort((a, b) => a.x - b.x).map((i) => i.text).join(" "))
    .join("\n");
}

// Handle the buildPageText logic for this module.
function buildPageText(items) {
  const valid = items.filter((i) => i.str && String(i.str).trim());
  const split = detectColumnSplit(valid);
  if (!split) {
    const rows = new Map();
    valid.forEach((item) => {
      const x = Number(item.transform?.[4] || 0);
      const key = String(Math.round(Number(item.transform?.[5] || 0)));
      const cur = rows.get(key) || [];
      cur.push({ x, text: String(item.str) });
      rows.set(key, cur);
    });
    return [...rows.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([, row]) => row.sort((a, b) => a.x - b.x).map((i) => i.text).join(" "))
      .join("\n");
  }
  const allXs = valid.map((i) => Number(i.transform?.[4] || 0));
  return buildColumnText(valid, Math.min(...allXs), split) + "\n" + buildColumnText(valid, split, Math.max(...allXs) + 1);
}

// Handle the parseAnswerKey logic for this module.
function parseAnswerKey(lines) {
  const map = new Map();
  let inSection = false;
  lines.forEach((line) => {
    if (ANSWER_SECTION_TITLE.test(line)) inSection = true;
    if (!inSection) return;
    [...line.matchAll(/(\d{1,3})\s*[\].:\-)]*\s*\(?\s*([A-Da-d])\s*\)?/g)].forEach(([, n, o]) =>
      map.set(Number(n), o.toUpperCase())
    );
  });
  return map;
}

// Handle the lineLooksLikeQuestionStart logic for this module.
function lineLooksLikeQuestionStart(line) {
  const match = line.match(QUESTION_START);
  if (!match) return false;
  const body = normalizeWhitespace(match[2] || "");
  if (!body) return false;
  const wordCount = body.split(" ").filter(Boolean).length;
  if (body.includes(" : ") && wordCount <= 7 && !/[?)]$/.test(body)) return false;
  return true;
}

// Handle the splitInlineOptions logic for this module.
function splitInlineOptions(line) {
  const matches = [...line.matchAll(/(^|\s)\(?\s*([A-Da-d])\s*\)?\s*[)\].:\-]?\s+(?=\S)/g)];
  if (matches.length < 2) return null;
  return matches
    .map((match, index) => {
      const start = match.index + match[1].length;
      const end = index + 1 < matches.length ? matches[index + 1].index : line.length;
      return line.slice(start, end).trim();
    })
    .filter(Boolean);
}

// Handle the parseQuestionBlocks logic for this module.
function blockHasOptionSignals(block) {
  let count = 0;
  for (let index = 1; index < block.length; index += 1) {
    const line = block[index];
    if (OPTION_START.test(line)) count += 1;
    else if (splitInlineOptions(line)?.length >= 2) count += 2;
    if (count >= 2) return true;
  }
  return false;
}

// Handle the parseQuestionBlocks logic for this module.
function parseQuestionBlocks(lines) {
  const blocks = [];
  let currentBlock = [];
  let currentQuestionNumber = 0;

  for (const line of lines) {
    if (lineLooksLikeQuestionStart(line)) {
      const nextQuestionNumber = Number(line.match(QUESTION_START)?.[1] || 0);
      if (!currentBlock.length) {
        currentBlock = [line];
        currentQuestionNumber = nextQuestionNumber;
        continue;
      }

      if (nextQuestionNumber > currentQuestionNumber && blockHasOptionSignals(currentBlock)) {
        blocks.push(currentBlock);
        currentBlock = [line];
        currentQuestionNumber = nextQuestionNumber;
        continue;
      }
    }

    if (currentBlock.length) {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length) {
    blocks.push(currentBlock);
  }

  return blocks;
}

// Handle the finalizeOption logic for this module.
function finalizeOption(buf, options) {
  if (!buf) return;
  const text = normalizeWhitespace(buf.text.join(" "));
  if (text) options.push({ key: buf.key, text });
}

// Handle the parseQuestionBlock logic for this module.
function parseQuestionBlock(block, answerKey) {
  const m = block[0].match(QUESTION_START);
  if (!m) return null;
  const num = Number(m[1]);
  const promptLines = [m[2] || ""].filter(Boolean);
  const options = [];
  let currentOption = null;
  let inlineCorrect = null;

  for (let i = 1; i < block.length; i++) {
    const line = block[i];
    if (!line) continue;

    const answerMatch = line.match(INLINE_ANSWER);
    if (answerMatch) { inlineCorrect = answerMatch[1].toUpperCase(); continue; }

    const inlineOpts = splitInlineOptions(line);
    if (inlineOpts) {
      finalizeOption(currentOption, options);
      currentOption = null;
      inlineOpts.forEach((seg) => {
        const sm = seg.match(/^\(?\s*([A-Da-d])\s*\)?\s*[)\].:\-]?\s*(.+)$/);
        if (sm) options.push({ key: sm[1].toUpperCase(), text: normalizeWhitespace(sm[2]) });
      });
      continue;
    }

    const optMatch = line.match(OPTION_START);
    if (optMatch) {
      finalizeOption(currentOption, options);
      currentOption = { key: optMatch[1].toUpperCase(), text: [optMatch[2]] };
      continue;
    }

    if (currentOption) currentOption.text.push(line);
    else promptLines.push(line);
  }
  finalizeOption(currentOption, options);

  const unique = options.filter((o, i, arr) => arr.findIndex((x) => x.key === o.key) === i).slice(0, 4);
  if (unique.length < 2) return null;

  return {
    id: `q-${num}`,
    number: num,
    prompt: normalizeWhitespace(promptLines.join(" ")),
    options: unique,
    correctOption: inlineCorrect || answerKey.get(num) || "",
    parserNotes: [
      unique.length !== 4 ? `Detected ${unique.length} options` : null,
      !(inlineCorrect || answerKey.get(num)) ? "Correct answer not found automatically" : null
    ].filter(Boolean)
  };
}

// Handle the parsePdfFile logic for this module.
export async function parsePdfFile(filePath) {
  console.log("1. pdf starts parsing for file: ", filePath);
  const data = new Uint8Array(await readFile(filePath));
  console.log("2. pdf data loaded, size: ", data.length);
  const pdf = await getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  console.log("3. pdf loaded, number of pages: ", pdf.numPages);
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(buildPageText(content.items));
  }
  console.log("4. all pages processed, building questions");
  const lines = normalizeLines(pages.join("\n\n"));
  console.log("5. total lines extracted: ", lines.length);
  const answerKey = parseAnswerKey(lines);
  console.log("6. answer key parsed, entries: ", answerKey.size);
  const blocks = parseQuestionBlocks(lines);
  console.log("7. question blocks identified: ", blocks.length);
  const questions = blocks.map((b) => parseQuestionBlock(b, answerKey)).filter(Boolean).sort((a, b) => a.number - b.number);
  console.log("8. questions parsed and sorted, total valid questions: ", questions.length);
  return { questions, warnings: [] };
}
