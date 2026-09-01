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
  assert.match(html, /По предварительному потенциалу/);
  assert.doesNotMatch(html, /Три независимых слоя/);
  assert.match(html, /Интерактивная карта рынков APS/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("keeps production metadata and documented market intelligence", async () => {
  const [page, layout, dashboard, data] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MarketDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/market_data.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<MarketDashboard \/>/);
  assert.match(layout, /APS Market Intelligence/);
  assert.match(layout, /images:\s*\["\/og\.png"\]/);
  assert.match(dashboard, /KAST Fit = 30% USD need/);
  assert.match(dashboard, /data\.market_competitors/);
  assert.match(dashboard, /\/data\/countries\.geojson/);
  assert.doesNotMatch(dashboard, /cartocdn|CARTO/i);
  assert.doesNotMatch(dashboard, /data-market-profile|onOpenProfileRef/);
  assert.match(dashboard, /market-map-popup-value/);
  assert.match(dashboard, /Предварительный потенциал рынка/);
  assert.match(dashboard, /atlas-legend-title/);
  assert.match(dashboard, /tabs-scroll-left/);
  assert.match(dashboard, /tabs\.scrollBy/);
  assert.match(dashboard, /disabled=\{!tabScroll\.left\}/);
  assert.match(dashboard, /disabled=\{!tabScroll\.right\}/);
  assert.match(dashboard, /function AudienceGroups/);
  assert.match(dashboard, /section\.id === "audience"/);
  assert.match(dashboard, /scoreMode !== "potential" && <span className="rank-number">/);
  assert.match(dashboard, /potential-mode/);
  assert.match(data, /"kast_fit"/);
  assert.match(data, /"market_competitors"/);
  assert.match(data, /"market_assessments"/);
  assert.match(data, /"market_reports"/);
  assert.match(data, /"respondents"/);
  assert.doesNotMatch(page + layout, /codex-preview|_sites-preview/);
});
