import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the unified APS research workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>APS Market Intelligence<\/title>/i);
  assert.match(html, /Выводы/);
  assert.match(html, /Респонденты/);
  assert.match(html, /Кейсы и уроки/);
  assert.match(html, /Единый рейтинг/);
  assert.doesNotMatch(html, /Три независимых слоя/);
  assert.doesNotMatch(html, /Ключевой вывод/);
  assert.match(html, /Интерактивная карта рынков APS/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("keeps production metadata and documented market intelligence", async () => {
  const [page, layout, dashboard, data, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MarketDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/market_data.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const parsedData = JSON.parse(data);

  assert.match(page, /<MarketDashboard \/>/);
  assert.match(layout, /APS Market Intelligence/);
  assert.match(layout, /images:\s*\["\/og\.png"\]/);
  assert.match(dashboard, /data\.unified_scoring/);
  assert.match(dashboard, /ЕДИНАЯ ОЦЕНКА/i);
  assert.match(dashboard, /data\.market_competitors/);
  assert.match(dashboard, /\/data\/countries\.geojson/);
  assert.doesNotMatch(dashboard, /cartocdn|CARTO/i);
  assert.doesNotMatch(dashboard, /data-market-profile|onOpenProfileRef/);
  assert.match(dashboard, /aps-map-score/);
  assert.doesNotMatch(dashboard, /bindPopup|openPopup|market-map-popup/);
  assert.match(dashboard, /atlas-legend-title/);
  assert.match(dashboard, /Клик выбирает рынок и обновляет блок под картой/);
  assert.doesNotMatch(dashboard, /Клик, тап или клавиатура/);
  assert.match(dashboard, /В выигрыше может оказаться продукт, который не заменяет GCash/);
  assert.match(dashboard, /Что уже работает или не работает/);
  assert.doesNotMatch(dashboard, /Только конкретные компании и опубликованные факты/);
  assert.match(dashboard, /tabs-scroll-left/);
  assert.match(dashboard, /tabs\.scrollBy/);
  assert.match(dashboard, /disabled=\{!tabScroll\.left\}/);
  assert.match(dashboard, /disabled=\{!tabScroll\.right\}/);
  assert.match(dashboard, /function AudienceGroups/);
  assert.match(dashboard, /function RichReportContent/);
  assert.match(dashboard, /function RichInlineText/);
  assert.match(dashboard, /Что важнее на этом рынке/);
  assert.match(dashboard, /Конкретные основания решения/);
  assert.match(dashboard, /Подтверждённый пример \/ свидетельство/);
  assert.match(dashboard, /data\.case_lessons/);
  assert.match(dashboard, /section\.id === "audience"/);
  assert.match(dashboard, /getUnifiedScore\(market\.code\)\.final_score/);
  assert.doesNotMatch(dashboard, /ScoreMode|scoreMode|getKastFit|По формуле APS|По KAST \/ Product Fit/);
  assert.match(data, /"unified_scoring"/);
  assert.match(data, /"market_competitors"/);
  assert.match(data, /"market_assessments"/);
  assert.match(data, /"market_reports"/);
  assert.match(data, /"respondents"/);
  assert.match(data, /"case_lessons"/);
  assert.equal(parsedData.market_assessments.find((item) => item.market_code === "IDN")?.confidence, "high");
  const philippinesReport = parsedData.market_reports.find((item) => item.market_code === "PHL");
  assert.match(philippinesReport.sections.find((section) => section.id === "product").paragraphs.join(" "), /суперприложения/);
  assert.match(philippinesReport.sections.find((section) => section.id === "marketing").paragraphs.join(" "), /CALABARZON/);
  assert.match(data, /"Simple\.app"/);
  assert.match(dashboard, /\? "#40f785"[\s\S]*\? "#b7d85c"[\s\S]*\? "#f0cf57"[\s\S]*: "#f29a52"/);
  assert.match(styles, /\.attractiveness-badge\.low \{[^}]*#f29a52/);
  assert.match(styles, /\.aps-map-score\.low \{ background: #f29a52; \}/);
  assert.doesNotMatch(page + layout, /codex-preview|_sites-preview/);
});

test("ships a reviewed RU / EN language layer without changing the Russian default", async () => {
  const [dashboard, localization, translationJson] = await Promise.all([
    readFile(new URL("../app/MarketDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/localization.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/translations.en.json", import.meta.url), "utf8"),
  ]);
  const translations = JSON.parse(translationJson);

  assert.match(dashboard, /useState<Language>\("ru"\)/);
  assert.match(dashboard, /className="language-switch"/);
  assert.match(dashboard, />RU<\/button>/);
  assert.match(dashboard, />EN<\/button>/);
  assert.ok(Object.keys(translations).length >= 1_000);
  assert.equal(translations["Филиппины"], "Philippines");
  assert.match(localization, /"Реализуемость входа": "Entry feasibility"/);
  assert.match(localization, /"Незакрытая задача": "Unmet need"/);
  assert.match(localization, /"Каналы привлечения": "Acquisition channels"/);
});
