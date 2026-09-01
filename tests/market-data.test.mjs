import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const data = JSON.parse(await readFile(new URL("../app/data/market_data.json", import.meta.url), "utf8"));
const marketCodes = new Set(data.markets.map((market) => market.code));
const sourceIds = new Set(data.sources.map((source) => source.id));
const competitorIds = new Set(data.market_competitors.map((competitor) => competitor.id));

function assertReferences(value, path = "data") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertReferences(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if ((key === "source_id" || key === "secondary_source_id") && item != null) assert.ok(sourceIds.has(item), `${path}.${key}: ${item}`);
    if (key === "source_ids") for (const id of item) assert.ok(sourceIds.has(id), `${path}.${key}: ${id}`);
    if (key === "competitor_id") assert.ok(competitorIds.has(item), `${path}.${key}: ${item}`);
    if (key === "market_code" && item !== "GLOBAL") assert.ok(marketCodes.has(item), `${path}.${key}: ${item}`);
    if (key === "market_codes") for (const code of item) assert.ok(marketCodes.has(code), `${path}.${key}: ${code}`);
    assertReferences(item, `${path}.${key}`);
  }
}

test("contains one complete qualitative assessment and six report sections per market", () => {
  assert.equal(data.markets.length, 8);
  assert.equal(data.market_assessments.length, 8);
  assert.equal(new Set(data.market_assessments.map((item) => item.market_code)).size, 8);
  assert.equal(data.market_reports.length, 8);
  for (const report of data.market_reports) {
    assert.ok(marketCodes.has(report.market_code));
    assert.deepEqual(report.sections.map((section) => section.id), ["summary", "competition", "audience", "product", "regulation", "marketing"]);
    assert.ok(report.sections.every((section) => section.paragraphs.length > 0));
  }
});

test("keeps supported enums and all qualitative content populated", () => {
  const confidenceLevels = new Set(["high", "medium", "hypothesis"]);
  for (const assessment of data.market_assessments) {
    assert.ok(marketCodes.has(assessment.market_code));
    assert.ok(confidenceLevels.has(assessment.confidence));
    assert.ok(assessment.headline && assessment.market_gap && assessment.entry_condition);
    assert.ok(assessment.competition_summary && assessment.priority_audience && assessment.core_message && assessment.market_principle);
    assert.ok(assessment.need.score >= 1 && assessment.need.score <= 5);
    assert.ok(assessment.entry_complexity.score >= 1 && assessment.entry_complexity.score <= 5);
  }
});

test("resolves market, competitor and source references", () => {
  assert.equal(new Set(data.sources.map((source) => source.id)).size, data.sources.length);
  assert.equal(new Set(data.market_competitors.map((competitor) => competitor.id)).size, data.market_competitors.length);
  for (const source of data.sources) {
    if (source.type === "interview") assert.equal(source.url, null);
  }
  for (const assessment of data.market_assessments) {
    for (const id of assessment.source_ids) assert.ok(sourceIds.has(id), `${assessment.market_code}: missing source ${id}`);
  }
  for (const market of data.competition_by_market) {
    assert.ok(marketCodes.has(market.market_code));
    for (const entity of market.entities) assert.ok(competitorIds.has(entity.competitor_id), `${market.market_code}: missing competitor ${entity.competitor_id}`);
  }
  assertReferences(data);
});

test("keeps competition, respondent and acquisition enums valid", () => {
  const groupTypes = new Set(["direct_analogue", "mass_finance", "crypto_service", "specialist", "local_payments", "traditional_bank"]);
  const roles = new Set(["active", "reference", "infrastructure", "historical"]);
  const phases = new Set(["validation", "launch", "scale", "trust", "growth", "distribution", "awareness"]);
  const evidenceTypes = new Set(["interview", "open_data", "competitor_example", "mixed"]);
  assert.equal(new Set(data.respondents.map((item) => item.id)).size, data.respondents.length);
  for (const market of data.competition_by_market) {
    for (const entity of market.entities) {
      assert.ok(groupTypes.has(entity.group_type));
      assert.ok(roles.has(entity.role));
      if (entity.role === "active") {
        const competitor = data.market_competitors.find((item) => item.id === entity.competitor_id);
        assert.ok(competitor?.provider);
        assert.ok(market.market_code);
      }
    }
  }
  for (const row of data.acquisition_channels.rows) {
    assert.ok(row.strategy.decision.priority && row.strategy.decision.brand_level && row.strategy.decision.primary_channel);
    assert.ok(row.strategy.decision.brand && row.strategy.decision.sales && row.strategy.decision.avoid);
    assert.ok(row.strategy.profile_evidence.length >= 3);
    for (const item of row.strategy.profile_evidence) assert.ok(item.point && item.source_ids.length > 0);
    for (const channel of row.channels) {
      if (channel.phase) assert.ok(phases.has(channel.phase));
      if (channel.evidence_type) assert.ok(evidenceTypes.has(channel.evidence_type));
    }
  }
});

test("publishes only completed respondents and current ARQ naming", () => {
  assert.equal(data.respondents.length, 9);
  assert.ok(data.respondents.every((respondent) => respondent.status === "completed" && respondent.visibility === "name_initial"));
  assert.ok(data.respondents.every((respondent) => /^[A-Z][A-Za-z]+ [A-Z]\.$/.test(respondent.display_name)));
  assert.ok(data.respondents.every((respondent) => sourceIds.has(respondent.source_id)));
  assert.ok(data.market_competitors.every((competitor) => competitor.provider !== "DolarApp"));
});

test("preserves the structured Indonesia country-detail report", () => {
  const report = data.market_reports.find((item) => item.market_code === "IDN");
  assert.ok(report);
  const sections = Object.fromEntries(report.sections.map((section) => [section.id, section]));
  assert.ok(sections.summary.paragraphs.every((paragraph) => paragraph.startsWith("::b0::")));
  assert.match(sections.product.paragraphs.join(" "), /Tangem Wallet/);
  assert.match(sections.product.paragraphs.join(" "), /Стоимость физической карты — болевая точка/);
  assert.match(sections.marketing.paragraphs.join(" "), /Coinfest Asia/);
  assert.match(sections.marketing.paragraphs.join(" "), /::b2::\[AirdropFind\]/);
  assert.doesNotMatch(report.sections.flatMap((section) => section.paragraphs).join(" "), /чч|на уровне Филиппин/);
});

test("includes the sourced Tangem success case for Indonesia", () => {
  const tangem = data.case_lessons.supporting_cases.find((item) => item.company === "Tangem Wallet" && item.market === "Индонезия");
  assert.ok(tangem);
  assert.equal(tangem.constraint_label, "Почему сработало");
  assert.match(tangem.outcome, /Coinfest Asia/);
  assert.match(tangem.constraint, /NFC|X-сообществ/);
  assert.ok(tangem.source_ids.includes("interview_id_marketing_2026"));
  assert.ok(tangem.source_ids.includes("tangem_annual_report_2025"));
  assert.ok(tangem.source_ids.includes("tangem_ring_official"));
});

test("calculates one unified market score from nine non-overlapping criteria", () => {
  const weights = Object.fromEntries(
    data.unified_scoring.blocks.flatMap((block) => block.criteria.map((criterion) => [criterion.key, criterion.weight])),
  );
  assert.ok(Math.abs(data.unified_scoring.blocks.reduce((sum, block) => sum + block.weight, 0) - 1) < 1e-9);
  assert.ok(Math.abs(Object.values(weights).reduce((sum, weight) => sum + weight, 0) - 1) < 1e-9);
  assert.equal(data.unified_scoring.rows.length, data.markets.length);

  const ranks = [];
  for (const row of data.unified_scoring.rows) {
    assert.ok(marketCodes.has(row.market_code));
    assert.deepEqual(Object.keys(row.components).sort(), Object.keys(weights).sort());
    for (const component of Object.values(row.components)) assert.ok(component.score >= 1 && component.score <= 5);

    const raw = Object.entries(row.components).reduce((sum, [key, component]) => sum + component.score * weights[key], 0);
    assert.equal(row.raw_score, Number(raw.toFixed(3)), `${row.market_code}: raw score`);
    const expectedFinal = Math.round(Math.min(row.raw_score, row.gate?.cap ?? 5) * 100) / 100;
    assert.equal(row.final_score, expectedFinal, `${row.market_code}: final score`);

    const expectedLevel = row.final_score >= 4 ? "high" : row.final_score >= 3.4 ? "medium_high" : row.final_score >= 2.8 ? "medium" : "low";
    assert.equal(row.level, expectedLevel, `${row.market_code}: level`);
    ranks.push(row.rank);
  }

  assert.deepEqual(ranks, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(data.unified_scoring.rows.map((row) => row.market_code), ["PHL", "COL", "IDN", "ARG", "VNM", "CAN", "GBR", "MEX"]);
});
