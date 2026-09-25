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
  assert.doesNotMatch(html, />Выводы<\/button>/);
  assert.match(html, />Обзор и итоги<\/button>/);
  assert.match(html, />Профили стран<\/button>/);
  assert.doesNotMatch(html, /Полная информация из обзора/);
  assert.match(html, />Каналы продвижения<\/button>/);
  assert.doesNotMatch(html, />Сравнение<\/button>/);
  assert.match(html, /Респонденты/);
  assert.match(html, />Кейсы<\/button>/);
  assert.doesNotMatch(html, />Барьеры<\/button>/);
  assert.match(html, />Рейтинг</);
  assert.match(html, />Базовый</);
  assert.match(html, />Стратегический</);
  assert.match(html, /Стратегический рейтинг был сформирован на стратегической сессии с командой 14 сентября/);
  assert.match(html, /Приоритетный рынок/);
  assert.doesNotMatch(html, /Универсальный аналог KAST не дает достаточного отличия/);
  assert.match(html, /Главный спрос - трансграничные деньги и снижение налоговой нагрузки/);
  assert.doesNotMatch(html, /ВЫБРАННЫЙ РЫНОК/);
  assert.doesNotMatch(html, /Три независимых слоя/);
  assert.doesNotMatch(html, /Ключевой вывод/);
  assert.doesNotMatch(html, /Диагностический инструмент, не юридическое заключение/);
  assert.match(html, /Карта рынков APS/);
  assert.doesNotMatch(html, /class="selected-market"/);
  assert.match(html, />18<\/strong><span>экспертных интервью<\/span>/);
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
  assert.match(dashboard, /Сравнение и выводы для APS/);
  assert.match(dashboard, /local-competition-table/);
  assert.doesNotMatch(dashboard, /id: "compare"/);
  assert.doesNotMatch(dashboard, /id: "conclusions"/);
  assert.doesNotMatch(dashboard, /id: "barriers"/);
  assert.doesNotMatch(dashboard, /tab === "barriers"/);
  assert.equal((dashboard.match(/tab === "profiles"/g) ?? []).length, 1);
  assert.equal((dashboard.match(/data\.metadata\.interviews_conducted/g) ?? []).length, 2);
  assert.equal(parsedData.metadata.interviews_conducted, 18);
  assert.equal(parsedData.metadata.updated, "2026-09-24");
  assert.equal(parsedData.strategic_ranking.rows.length, 8);
  assert.equal("source_title" in parsedData.strategic_ranking, false);
  assert.equal("source_url" in parsedData.strategic_ranking, false);
  assert.match(dashboard, /ЕДИНАЯ ОЦЕНКА/i);
  assert.match(dashboard, /data\.market_competitors/);
  assert.match(dashboard, /\/data\/countries\.geojson/);
  assert.doesNotMatch(dashboard, /cartocdn|CARTO/i);
  assert.doesNotMatch(dashboard, /data-market-profile|onOpenProfileRef/);
  assert.doesNotMatch(dashboard, /aps-map-score/);
  assert.doesNotMatch(dashboard, /\/ 5 · \$\{unified\.label\}<\/span>/);
  assert.doesNotMatch(dashboard, /bindPopup|openPopup|market-map-popup/);
  assert.doesNotMatch(dashboard, /atlas-legend/);
  assert.doesNotMatch(styles, /\.atlas-legend/);
  assert.doesNotMatch(dashboard, /className="map-region-select"|className="map-toolbar"|L\.control\.zoom/);
  assert.match(dashboard, /dragging: false/);
  assert.match(dashboard, /scrollWheelZoom: false/);
  assert.match(dashboard, /doubleClickZoom: false/);
  assert.match(dashboard, /strategicOverlayOpen/);
  assert.match(dashboard, /ВЫБРАННЫЙ РЫНОК/);
  assert.match(dashboard, /getStrategicRating\(market\.code\)\.hashtags/);
  assert.match(dashboard, /acquisition-evidence-title/);
  assert.match(dashboard, /String\(index \+ 1\)\.padStart\(2, "0"\)/);
  assert.match(dashboard, /acquisition_channel_map\.json/);
  assert.match(dashboard, /ОБНОВЛЁННАЯ КАРТА КАНАЛОВ ПРОДВИЖЕНИЯ · 2026/);
  assert.doesNotMatch(dashboard, /Полная детализация из обновлённого документа/);
  assert.match(dashboard, /Рекомендуемая первая волна контактов/);
  assert.match(dashboard, /Выберите до пяти каналов на каждом релевантном рынке/);
  assert.doesNotMatch(dashboard, /acquisitionChannelMap\.meta\.title\[language\]/);
  assert.match(dashboard, /selectedAcquisitionDocument\[language\]/);
  assert.doesNotMatch(dashboard, /acquisitionChannelMap\.reading_key|acquisition-reading-key/);
  assert.doesNotMatch(dashboard, /Все пункты и ссылки из документа|acquisition-document-status/);
  assert.doesNotMatch(dashboard, /Дополнительная аналитика|className="panel acquisition-summary"|Какие каналы способны привести первых пользователей/);
  assert.doesNotMatch(dashboard, /data\.acquisition_channels\.method_note|selectedAcquisition\.channels\.map/);
  assert.match(dashboard, /getRegulatoryConstraintHtml/);
  assert.match(dashboard, /className="acquisition-regulatory-point"/);
  assert.match(dashboard, /selectedRegulatoryConstraintHtml/);
  assert.match(dashboard, /removeAcquisitionEvidenceMarkers/);
  assert.match(dashboard, /replace\(\/\[★✓△\]/);
  assert.match(dashboard, /selectedAcquisitionDocumentHtml/);
  assert.match(dashboard, /parseAcquisitionChannelTable/);
  assert.match(dashboard, /className="acquisition-unified-table"/);
  assert.match(dashboard, /Международные и локальные каналы и кейсы/);
  assert.ok(dashboard.indexOf('className="acquisition-country-context"') < dashboard.indexOf('className="acquisition-unified-table-wrap"'));
  assert.match(styles, /\.acquisition-unified-table \{/);
  assert.doesNotMatch(dashboard, /className="panel acquisition-map-intro"/);
  assert.match(styles, /\.acquisition-document-global/);
  assert.doesNotMatch(styles, /\.acquisition-reading-key|\.acquisition-document-status|\.acquisition-secondary-heading|\.acquisition-priority-table/);
  assert.match(dashboard, /strategicallyOrderedVisibleMarkets/);
  assert.match(dashboard, /className="rank-number"/);
  assert.match(styles, /@keyframes strategic-overlay-in/);
  assert.match(styles, /\.strategic-market-panel\.strategic-market-overlay \{[\s\S]*inset: 0;[\s\S]*width: 100%;[\s\S]*height: 100%;/);
  assert.doesNotMatch(styles, /\.map-toolbar|\.map-reset|\.map-region-select|\.leaflet-control-zoom/);
  assert.match(styles, /\.overview-grid \{[^}]*align-items: start;/);
  assert.doesNotMatch(dashboard, /className="selected-market"/);
  assert.match(dashboard, /Исследование рыночного потенциала криптофинансовой платформы для платежей и управления цифровыми активами с функцией выпуска крипто-связанных платежных карт/);
  assert.doesNotMatch(dashboard, /Восемь рынков в одном поле/);
  assert.doesNotMatch(dashboard, /Клик выбирает рынок и обновляет блок под картой/);
  assert.doesNotMatch(dashboard, /Клик, тап или клавиатура/);
  assert.doesNotMatch(dashboard, /APS Market Intelligence · research workspace/);
  assert.match(dashboard, /В выигрыше может оказаться продукт, который не заменяет GCash/);
  assert.match(dashboard, /Неочевидные точки входа на рынок/);
  assert.match(dashboard, /Моряк подключает целую семью/);
  assert.ok(dashboard.indexOf('className="conclusions-layout overview-conclusions"') < dashboard.indexOf('className="panel under-map-insights"'));
  assert.ok(dashboard.indexOf('className="panel cross-market-insights"') < dashboard.indexOf('className="panel under-map-insights"'));
  assert.ok(dashboard.indexOf('className="conclusions-layout overview-conclusions"') < dashboard.indexOf('tab === "profiles"'));
  assert.ok(dashboard.indexOf('className="panel under-map-insights"') < dashboard.indexOf('tab === "profiles"'));
  assert.match(dashboard, /marketConclusionItems\[selected\.code\]/);
  assert.match(dashboard, /className="profile-strategic-context"/);
  assert.match(dashboard, /selectedStrategic\.hashtags\.map/);
  assert.equal((dashboard.match(/selectedStrategic\.details_en : selectedStrategic\.details_ru/g) ?? []).length, 2);
  assert.match(dashboard, /allowLinks=\{false\}/);
  assert.match(dashboard, /sourceId=\{id\} plain/);
  assert.match(dashboard, /Пользователь должен видеть лучший курс, меньшую комиссию или локальную функцию/);
  assert.doesNotMatch(dashboard, /меньшее число сервисов/);
  assert.doesNotMatch(dashboard, /className="gate-mini"/);
  assert.match(dashboard, /className="hero hero-compact"/);
  assert.doesNotMatch(dashboard, /tab === "overview" \? "" : "hero-compact"/);
  assert.match(dashboard, /Исследование обновлено 24\.09\.2026/);
  assert.doesNotMatch(dashboard, /Исследование обновлено 23\.09\.2026/);
  assert.doesNotMatch(dashboard, /Исследование обновлено 02\.09\.2026/);
  assert.doesNotMatch(dashboard, /Исследование обновлено 01\.09\.2026/);
  assert.doesNotMatch(dashboard, /КОНКУРЕНТНАЯ СРЕДА · 01\.09\.2026/);
  assert.match(dashboard, /onClick=\{\(\) => onSelect\(market\.code\)\}/);
  assert.match(dashboard, /onMouseEnter=\{\(\) => setLabelHighlight\(market\.code, true\)\}/);
  assert.match(dashboard, /Что уже работает или не работает/);
  assert.doesNotMatch(dashboard, /Только конкретные компании и опубликованные факты/);
  assert.doesNotMatch(dashboard, /tabs-scroll|tabScroll|tabs\.scrollBy|tabs\.scrollWidth/);
  assert.match(styles, /\.tabs \{[^}]*overflow-x: auto;/);
  assert.match(dashboard, /function AudienceGroups/);
  assert.match(dashboard, /function RichReportContent/);
  assert.match(dashboard, /function RichInlineText/);
  assert.match(dashboard, /Что важнее на этом рынке/);
  assert.match(dashboard, /Конкретные основания решения/);
  assert.match(dashboard, /Международные и локальные каналы и кейсы/);
  assert.match(dashboard, /data\.case_lessons/);
  assert.match(dashboard, /КЕЙСЫ ПО РЫНКАМ/);
  assert.match(dashboard, /кейсов и примеров/);
  assert.doesNotMatch(dashboard, /подробный разбор|повторяющихся причин/);
  assert.match(dashboard, /marketCaseRows\.map/);
  assert.match(dashboard, /market\.case_studies\[kind\]/);
  assert.match(dashboard, /study\.constraint_label \?\? "Что ограничило результат"/);
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
  assert.doesNotMatch(styles, /\.aps-map-score/);
  assert.match(dashboard, /zoomSnap: 0/);
  assert.match(dashboard, /new ResizeObserver\(fitMapToFrame\)/);
  assert.match(dashboard, /className="map-label-layer"/);
  assert.match(dashboard, /className={`map-label-card map-label-card-/);
  assert.doesNotMatch(dashboard, /bindTooltip/);
  assert.match(styles, /\.map-label-layer \{[\s\S]*pointer-events: none;/);
  assert.match(styles, /\.map-label-card \{[\s\S]*pointer-events: auto;/);
  assert.match(styles, /\.map-label-card small \{[^}]*overflow-wrap: anywhere;/);
  assert.doesNotMatch(dashboard, /Диагностический инструмент, не юридическое заключение/);
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
  assert.match(localization, /"Обзор и итоги": "Overview and findings"/);
  assert.match(localization, /"Профили стран": "Country profiles"/);
  assert.match(localization, /"Каналы продвижения": "Promotion channels"/);
  assert.match(localization, /"ПРОФИЛИ СТРАН": "COUNTRY PROFILES"/);
  assert.doesNotMatch(dashboard, />COUNTRY PROFILES</);
  assert.doesNotMatch(dashboard, /Сообщение\. В отличие от UK и Канады/);
});
