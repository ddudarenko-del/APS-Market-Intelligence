"use client";

import { useEffect, useRef, useState } from "react";
import data from "./data/market_data.json";

type Tab = "overview" | "kastfit" | "barriers" | "compare" | "profiles" | "competition" | "data" | "method";
type ScoreMode = "aps" | "kast";
type BarrierSort = "balance" | "driver" | "barrier";
type MetricValue = { value: number; year: number } | null;
type Market = (typeof data.markets)[number];
type AvailabilityStatus = "full" | "partial" | "unavailable" | "unconfirmed";
type Availability = {
  status: AvailabilityStatus;
  account: boolean | null;
  card: boolean;
  note: string;
  source_ids: string[];
};
type CountryProperties = { ADM0_A3?: string };
type CountryFeature = GeoJSON.Feature<GeoJSON.Geometry, CountryProperties>;
type CountryLayer = import("leaflet").Path & { feature?: CountryFeature };

const tabLabels: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Обзор" },
  { id: "kastfit", label: "KAST / Product Fit" },
  { id: "barriers", label: "Барьеры и драйверы" },
  { id: "compare", label: "Сравнение" },
  { id: "profiles", label: "Профили рынков" },
  { id: "competition", label: "Конкуренты / тарифы" },
  { id: "data", label: "Сырые данные" },
  { id: "method", label: "Методология / источники" },
];

const gateLabels: Record<string, string> = {
  partner_or_authorisation: "Партнёр / авторизация",
  authorisation: "Авторизация",
  registration: "Регистрация",
  licensed_partner: "Лицензированный партнёр",
  fiat_wrapper_only: "Только fiat-wrapper",
  ifpe_or_bank: "IFPE / банк",
};

const availabilityLabels: Record<AvailabilityStatus, string> = {
  full: "Полностью",
  partial: "Частично",
  unavailable: "Недоступно",
  unconfirmed: "Не подтверждено",
};

const availabilityOrder: Record<AvailabilityStatus, number> = {
  full: 0,
  partial: 1,
  unconfirmed: 2,
  unavailable: 3,
};

function getAvailability(competitor: (typeof data.market_competitors)[number], marketCode: string) {
  return (competitor.availability as Record<string, Availability>)[marketCode];
}

function AvailabilityBadge({ status, compact = false }: { status: AvailabilityStatus; compact?: boolean }) {
  return <span className={`availability-badge ${status} ${compact ? "compact" : ""}`}>{compact ? "" : availabilityLabels[status]}</span>;
}

function supportLabel(value: boolean | null) {
  if (value === null) return "не подтверждено";
  return value ? "да" : "нет";
}

function formatMoney(metric: MetricValue) {
  if (!metric) return "нет данных";
  const billions = metric.value / 1_000_000_000;
  if (billions >= 1) return `$${billions.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млрд`;
  return `$${(metric.value / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} млн`;
}

function formatPct(metric: MetricValue) {
  if (!metric) return "нет данных";
  return `${metric.value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`;
}

function formatPeople(metric: MetricValue) {
  if (!metric) return "нет данных";
  return `${(metric.value / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн`;
}

function bandScore(value: number, bands: Array<[number, number]>) {
  for (const [threshold, score] of bands) {
    if (value >= threshold) return score;
  }
  return 1;
}

function getKastFit(market: Market) {
  const metrics = market.metrics;
  const inflation = metrics.imf_weo.inflation_2025_pct;
  const remittanceIn = metrics.remittance_in_usd?.value ?? 0;
  const remittanceGdp = metrics.remittance_pct_gdp?.value ?? 0;
  const cryptoRank = metrics.chainalysis_rank_2025;

  const usdNeed = bandScore(inflation, [[25, 5], [10, 4], [5, 3], [3, 2]]);
  const remittanceVolume = bandScore(remittanceIn, [[50_000_000_000, 5], [20_000_000_000, 4], [10_000_000_000, 3], [1_000_000_000, 2]]);
  const remittanceIntensity = bandScore(remittanceGdp, [[5, 5], [3, 4], [1, 3], [0.25, 2]]);
  const crossBorder = (remittanceVolume + remittanceIntensity) / 2;
  const cryptoAudience = cryptoRank == null ? 2 : cryptoRank <= 10 ? 5 : cryptoRank <= 20 ? 4 : 2;
  const mobileReadiness = Math.min(5, ((metrics.findex_2024.smartphone_pct + metrics.findex_2024.recent_internet_use_pct) / 2) / 20);
  const accessGap = Math.min(5, (100 - metrics.findex_2024.account_ownership_pct) / 20);

  const components = [
    { key: "usd_need", label: "USD-защита", score: usdNeed, weight: 0.3, evidence: `${inflation.toFixed(1)}% инфляция` },
    { key: "cross_border", label: "Cross-border", score: crossBorder, weight: 0.2, evidence: `${formatMoney(metrics.remittance_in_usd)} · ${formatPct(metrics.remittance_pct_gdp)} ВВП` },
    { key: "crypto_audience", label: "Crypto-аудитория", score: cryptoAudience, weight: 0.25, evidence: cryptoRank ? `#${cryptoRank} Chainalysis` : "вне опубликованного top-20" },
    { key: "mobile_readiness", label: "Mobile readiness", score: mobileReadiness, weight: 0.15, evidence: `${metrics.findex_2024.smartphone_pct.toFixed(1)}% smartphone · ${metrics.findex_2024.recent_internet_use_pct.toFixed(1)}% internet` },
    { key: "access_gap", label: "Access gap", score: accessGap, weight: 0.1, evidence: `${metrics.findex_2024.account_ownership_pct.toFixed(1)}% имеют счёт` },
  ];
  const score = components.reduce((total, component) => total + component.score * component.weight, 0);
  return {
    score,
    category: score >= 3.2 ? "Высокий fit" : score >= 2.6 ? "Средний fit" : "Низкий fit",
    components,
  };
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 4 ? "high" : score >= 3.2 ? "mid" : "low";
  return <span className={`score-badge ${tone}`}>{score.toFixed(2)}</span>;
}

function driverScoreLabel(score: number) {
  return score === 5 ? "Структурный" : score === 4 ? "Сильный" : score === 3 ? "Сегментный" : score === 2 ? "Нишевой" : "Слабый";
}

function barrierScoreLabel(score: number) {
  return score === 5 ? "Блокирующий" : score === 4 ? "Высокий" : score === 3 ? "Существенный" : score === 2 ? "Управляемый" : "Низкий";
}

function SourceLink({ sourceId }: { sourceId: string }) {
  const source = data.sources.find((item) => item.id === sourceId);
  if (!source) return null;
  return (
    <a href={source.url} target="_blank" rel="noreferrer" className="source-chip">
      {source.publisher}
    </a>
  );
}

function MarketMap({
  selectedCode,
  visibleCodes,
  scoreMode,
  onSelect,
}: {
  selectedCode: string;
  visibleCodes: string[];
  scoreMode: ScoreMode;
  onSelect: (code: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").GeoJSON | null>(null);
  const onSelectRef = useRef(onSelect);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;

    async function initialiseMap() {
      if (!containerRef.current || mapRef.current) return;
      try {
        const leafletModule = await import("leaflet");
        if (cancelled || !containerRef.current) return;
        const L = leafletModule.default;
        const map = L.map(containerRef.current, {
          center: [18, 8],
          zoom: 2,
          minZoom: 2,
          maxZoom: 6,
          zoomControl: false,
          worldCopyJump: true,
          attributionControl: true,
        });
        mapRef.current = map;
        L.control.zoom({ position: "topright" }).addTo(map);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
          subdomains: "abcd",
          maxZoom: 20,
        }).addTo(map);

        const response = await fetch("/data/countries.geojson");
        if (!response.ok) throw new Error("Country geometry unavailable");
        const geometry = await response.json();
        if (cancelled) return;

        const marketByCode = new Map(data.markets.map((market) => [market.code, market]));
        const layer = L.geoJSON(geometry, {
          style: (feature?: CountryFeature) => {
            const code = feature?.properties?.ADM0_A3;
            const market = marketByCode.get(code);
            return {
              color: market ? "#7b8a82" : "#303a35",
              weight: market ? 1.2 : 0.55,
              fillColor: market ? "#1e6b43" : "#111713",
              fillOpacity: market ? 0.82 : 0.52,
            };
          },
          onEachFeature: (feature: CountryFeature, countryLayer: import("leaflet").Layer) => {
            const code = feature?.properties?.ADM0_A3;
            const market = marketByCode.get(code);
            if (!market) return;
            const score = scoreMode === "kast" ? getKastFit(market).score : market.weighted_score;
            countryLayer.bindTooltip(
              `<strong>${market.name_ru}</strong><br>${scoreMode === "kast" ? "KAST Fit" : "APS"}: ${score.toFixed(2)} / 5`,
              { sticky: true, direction: "top", className: "aps-map-tooltip" },
            );
            countryLayer.on("click", () => onSelectRef.current(code));
          },
        }).addTo(map);
        layerRef.current = layer;
        map.fitBounds([[-56, -168], [76, 178]], { padding: [12, 12] });
        setMapStatus("ready");
      } catch {
        setMapStatus("error");
      }
    }

    initialiseMap();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, [scoreMode]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const visibleSet = new Set(visibleCodes);
    layer.eachLayer((layerItem: import("leaflet").Layer) => {
      const countryLayer = layerItem as CountryLayer;
      const code = countryLayer.feature?.properties?.ADM0_A3;
      const market = data.markets.find((item) => item.code === code);
      if (!market) return;
      const visible = visibleSet.has(code);
      const selected = code === selectedCode;
      const score = scoreMode === "kast" ? getKastFit(market).score : market.weighted_score;
      const fillColor = selected
        ? "#40f785"
        : score >= 4
          ? "#29a865"
          : score >= 3.2
            ? "#197a49"
            : "#155c3a";
      countryLayer.setStyle({
        color: selected ? "#d9ffe7" : "#82948a",
        weight: selected ? 2.4 : 1.2,
        fillColor,
        fillOpacity: visible ? (selected ? 1 : 0.86) : 0.16,
      });
    });
  }, [selectedCode, visibleCodes, scoreMode]);

  function resetView() {
    mapRef.current?.fitBounds([[-56, -168], [76, 178]], { padding: [12, 12] });
  }

  return (
    <div className="map-frame">
      <div ref={containerRef} className="real-map" aria-label="Интерактивная карта рынков APS" />
      {mapStatus === "loading" && <div className="map-state">Загружаем границы стран...</div>}
      {mapStatus === "error" && <div className="map-state error">Карта временно недоступна</div>}
      <button type="button" className="map-reset" onClick={resetView}>Весь мир</button>
      <div className="atlas-legend">
        <span><i className="dot high" /> 4,0+</span>
        <span><i className="dot mid" /> 3,2-3,99</span>
        <span><i className="dot low" /> ниже 3,2</span>
      </div>
    </div>
  );
}

export function MarketDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [scoreMode, setScoreMode] = useState<ScoreMode>("aps");
  const [selectedCode, setSelectedCode] = useState("PHL");
  const [compareCodes, setCompareCodes] = useState<string[]>(["PHL", "COL", "MEX"]);
  const [region, setRegion] = useState("Все регионы");
  const [competitorMarket, setCompetitorMarket] = useState("ALL");
  const [barrierSort, setBarrierSort] = useState<BarrierSort>("balance");

  const selected = data.markets.find((market) => market.code === selectedCode) ?? data.markets[0];
  const regions = ["Все регионы", ...Array.from(new Set(data.markets.map((market) => market.region)))];
  const visibleMarkets = region === "Все регионы" ? data.markets : data.markets.filter((market) => market.region === region);
  const compareMarkets = compareCodes
    .map((code) => data.markets.find((market) => market.code === code))
    .filter(Boolean) as Market[];
  const selectedKastFit = getKastFit(selected);
  const kastRanking = [...data.markets]
    .map((market) => ({ market, fit: getKastFit(market) }))
    .sort((a, b) => b.fit.score - a.fit.score);
  const rankedVisibleMarkets = [...visibleMarkets].sort((a, b) => {
    if (scoreMode === "kast") return getKastFit(b).score - getKastFit(a).score;
    return a.rank - b.rank;
  });
  const visibleCompetitors = [...data.market_competitors].sort((a, b) => {
    if (competitorMarket === "ALL") return 0;
    return availabilityOrder[getAvailability(a, competitorMarket).status] - availabilityOrder[getAvailability(b, competitorMarket).status];
  });
  const selectedAvailabilityCounts = competitorMarket === "ALL"
    ? null
    : visibleCompetitors.reduce<Record<AvailabilityStatus, number>>((counts, item) => {
        counts[getAvailability(item, competitorMarket).status] += 1;
        return counts;
      }, { full: 0, partial: 0, unavailable: 0, unconfirmed: 0 });
  const barrierRows = data.barriers_drivers.rows
    .map((row) => ({ row, market: data.markets.find((market) => market.code === row.market_code)! }))
    .sort((a, b) => {
      if (barrierSort === "driver") return b.row.driver.score - a.row.driver.score || b.row.barrier.score - a.row.barrier.score;
      if (barrierSort === "barrier") return b.row.barrier.score - a.row.barrier.score || b.row.driver.score - a.row.driver.score;
      return (b.row.driver.score - b.row.barrier.score) - (a.row.driver.score - a.row.barrier.score) || b.row.driver.score - a.row.driver.score;
    });
  const averageDriver = data.barriers_drivers.rows.reduce((sum, item) => sum + item.driver.score, 0) / data.barriers_drivers.rows.length;
  const averageBarrier = data.barriers_drivers.rows.reduce((sum, item) => sum + item.barrier.score, 0) / data.barriers_drivers.rows.length;
  const launchBlockingMarkets = data.barriers_drivers.rows.filter((item) => item.barrier.score === 5).length;

  function chooseMarket(code: string, nextTab?: Tab) {
    setSelectedCode(code);
    if (nextTab) setTab(nextTab);
  }

  function toggleCompare(code: string) {
    setCompareCodes((current) => {
      if (current.includes(code)) return current.filter((item) => item !== code);
      if (current.length >= 3) return [...current.slice(1), code];
      return [...current, code];
    });
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-topline">
          <img className="aps-logo" src="./brand/aps-logo.svg" alt="APS" width={132} height={52} />
          <span className="update-stamp">Market Intelligence / данные проверены 11.08.2026</span>
        </div>
        <div className="hero-grid">
          <div>
            <h1>Где APS может выиграть и на каких условиях</h1>
            <p>
              Восемь рынков, исходный рейтинг APS и отдельный KAST / Product Fit
              для stablecoin-powered global money app.
            </p>
          </div>
          <div className="hero-metrics" aria-label="Сводка исследования">
            <div><strong>8</strong><span>рынков</span></div>
            <div><strong>6+2</strong><span>APS + Fit + B/D</span></div>
            <div><strong>{data.sources.length}</strong><span>базовых источников</span></div>
          </div>
        </div>
      </header>

      <div className="method-banner">
        <span className="method-icon">i</span>
        <p>
          <strong>Два независимых показателя.</strong> Исходный APS-балл сохранён без изменений.
          KAST / Product Fit оценивает только сходство спроса и аудитории с моделью KAST;
          регуляторный gate по-прежнему показан отдельно.
        </p>
      </div>

      <nav className="tabs" aria-label="Разделы исследования">
        {tabLabels.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <section className="content-grid overview-grid">
          <div className="panel atlas-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">MARKET ATLAS</span>
                <h2>Восемь рынков в одном поле</h2>
                <p>Цвет страны отражает взвешенный балл. Нажмите на страну, чтобы открыть её показатели.</p>
              </div>
              <div className="panel-controls">
                <div className="metric-switch" aria-label="Показатель карты">
                  <button type="button" className={scoreMode === "aps" ? "active" : ""} onClick={() => setScoreMode("aps")}>APS</button>
                  <button type="button" className={scoreMode === "kast" ? "active" : ""} onClick={() => setScoreMode("kast")}>KAST Fit</button>
                </div>
                <select value={region} onChange={(event) => setRegion(event.target.value)} aria-label="Фильтр по региону">
                  {regions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <MarketMap
              selectedCode={selectedCode}
              visibleCodes={visibleMarkets.map((market) => market.code)}
              scoreMode={scoreMode}
              onSelect={chooseMarket}
            />
            <div className="selected-market">
              <div>
                <span className="section-kicker">ВЫБРАННЫЙ РЫНОК</span>
                <h3>{selected.name_ru}</h3>
                <p>{selected.profile.demand}</p>
              </div>
              <div className="selected-kpis">
                <div><span>APS-балл</span><strong>{selected.weighted_score.toFixed(2)}</strong></div>
                <div><span>KAST Fit</span><strong>{selectedKastFit.score.toFixed(2)}</strong></div>
                <div><span>Переводы</span><strong>{formatMoney(selected.metrics.remittance_in_usd)}</strong></div>
              </div>
              <button type="button" className="primary-button" onClick={() => setTab("profiles")}>Открыть профиль →</button>
            </div>
          </div>

          <aside className="panel ranking-panel">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">РЕЙТИНГ</span>
                <h2>{scoreMode === "aps" ? "По формуле ТЗ" : "По KAST / Product Fit"}</h2>
              </div>
              <span className="count-pill">8 рынков</span>
            </div>
            <div className="ranking-list">
              {rankedVisibleMarkets.map((market, index) => (
                <button key={market.code} type="button" onClick={() => chooseMarket(market.code)} className={selectedCode === market.code ? "active" : ""}>
                  <span className="rank-number">{scoreMode === "aps" ? market.rank : index + 1}</span>
                  <span className="rank-name"><strong>{market.name_ru}</strong><small>{market.region}</small></span>
                  <span className="gate-mini">{gateLabels[market.regulatory.gate]}</span>
                  <ScoreBadge score={scoreMode === "aps" ? market.weighted_score : getKastFit(market).score} />
                </button>
              ))}
            </div>
            <div className="ranking-note">
              <strong>Ключевой вывод</strong>
              <p>{scoreMode === "aps" ? "Филиппины лидируют по исходной формуле. Аргентина и Колумбия близки по баллу, но требуют разных стратегий." : "Для модели KAST вверх поднимаются рынки, где одновременно видны USD-защита, crypto-аудитория, мобильная готовность и трансграничный сценарий."}</p>
            </div>
          </aside>
        </section>
      )}

      {tab === "kastfit" && (
        <section className="kast-layout">
          <article className="panel kast-benchmark">
            <div className="kast-benchmark-copy">
              <span className="section-kicker">PRODUCT REFERENCE</span>
              <h2>KAST как точная продуктовая модель</h2>
              <p>{data.kast_benchmark.positioning}. Показатель ниже отвечает только на вопрос: насколько каждый из восьми рынков похож на среду, где этот сценарий востребован.</p>
              <div className="source-chips">{data.kast_benchmark.source_ids.map((id) => <SourceLink key={id} sourceId={id} />)}</div>
            </div>
            <div className="kast-benchmark-metrics">
              <div><span>Пользователи</span><strong>{data.kast_benchmark.users}</strong><small>заявление KAST</small></div>
              <div><span>Annualized volume</span><strong>{data.kast_benchmark.annualized_volume}</strong><small>заявление KAST</small></div>
              <div><span>Приём карты</span><strong>{data.kast_benchmark.merchant_acceptance}</strong><small>merchant locations</small></div>
              <div><span>Standard / USD spend</span><strong>{data.kast_benchmark.standard_card}</strong><small>{data.kast_benchmark.usd_spend_fee} комиссия</small></div>
            </div>
          </article>

          <div className="kast-workspace">
            <aside className="panel kast-ranking-panel">
              <div className="panel-heading compact">
                <div><span className="section-kicker">KAST FIT RANKING</span><h2>Отдельно от APS</h2></div>
                <span className="count-pill">0–5</span>
              </div>
              <div className="kast-ranking-list">
                {kastRanking.map(({ market, fit }, index) => (
                  <button key={market.code} type="button" className={selectedCode === market.code ? "active" : ""} onClick={() => chooseMarket(market.code)}>
                    <span className="rank-number">{index + 1}</span>
                    <span className="rank-name"><strong>{market.name_ru}</strong><small>{fit.category}</small></span>
                    <ScoreBadge score={fit.score} />
                  </button>
                ))}
              </div>
            </aside>

            <article className="panel kast-detail">
              <div className="kast-detail-head">
                <div><span className="section-kicker">{selected.code} · PRODUCT FIT</span><h2>{selected.name_ru}</h2><p>{selectedKastFit.category} · исходный APS-балл {selected.weighted_score.toFixed(2)}</p></div>
                <div className="profile-score kast-score"><strong>{selectedKastFit.score.toFixed(2)}</strong><span>из 5</span></div>
              </div>
              <div className="fit-component-list">
                {selectedKastFit.components.map((component) => (
                  <div className="fit-component" key={component.key}>
                    <div className="fit-component-title"><strong>{component.label}</strong><span>{Math.round(component.weight * 100)}%</span></div>
                    <div className="fit-bar"><span style={{ width: `${component.score * 20}%` }} /></div>
                    <div className="fit-component-meta"><small>{component.evidence}</small><strong>{component.score.toFixed(2)}</strong></div>
                  </div>
                ))}
              </div>
              <div className="fit-reading">
                <div><span className="section-kicker">ПРИОРИТЕТНАЯ АУДИТОРИЯ</span><p>{selected.profile.audience}</p></div>
                <div><span className="section-kicker">СЦЕНАРИЙ KAST</span><p>{selected.profile.use_case}</p></div>
              </div>
            </article>
          </div>

          <article className="panel fit-method-summary">
            <div><span className="section-kicker">ФОРМУЛА</span><h3>Пять наблюдаемых сигналов, без экспертной надбавки</h3></div>
            <code>30% USD-защита + 20% cross-border + 25% crypto-аудитория + 15% mobile readiness + 10% access gap</code>
            <p>Регуляторная возможность запуска и интенсивность конкуренции намеренно не входят в Product Fit: они остаются отдельными слоями и не подменяют наличие спроса.</p>
          </article>
        </section>
      )}

      {tab === "barriers" && (
        <section className="barriers-layout">
          <article className="panel barriers-summary">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">MARKET ENTRY REALITY</span>
                <h2>Сила потребности против сложности входа</h2>
                <p>Две независимые экспертные оценки по шкале 1–5. Каждая опирается на опубликованные показатели, правила и продуктовые аналоги.</p>
              </div>
              <div className="barrier-sort" aria-label="Сортировка рынков">
                {(["balance", "driver", "barrier"] as const).map((sort) => (
                  <button key={sort} type="button" aria-pressed={barrierSort === sort} className={barrierSort === sort ? "active" : ""} onClick={() => setBarrierSort(sort)}>
                    {sort === "balance" ? "По балансу" : sort === "driver" ? "По драйверу" : "По барьеру"}
                  </button>
                ))}
              </div>
            </div>
            <div className="barriers-summary-metrics">
              <div><span>Средний драйвер</span><strong>{averageDriver.toFixed(1)}</strong><small>из 5</small></div>
              <div><span>Средний барьер</span><strong>{averageBarrier.toFixed(1)}</strong><small>из 5</small></div>
              <div><span>Launch-blocking</span><strong>{launchBlockingMarkets}</strong><small>рынка с барьером 5</small></div>
            </div>
            <div className="barrier-method-note"><strong>Как читать:</strong><span>{data.barriers_drivers.method_note}</span></div>
          </article>

          <div className="barrier-matrix-head" aria-hidden="true">
            <span>Рынок и аналоги</span><span>Драйвер категории</span><span>Ключевой барьер</span><span>Баланс</span>
          </div>
          <div className="barrier-matrix">
            {barrierRows.map(({ row, market }) => {
              const balance = row.driver.score - row.barrier.score;
              const decision = balance > 0 ? "Окно входа" : balance === 0 ? "Нужна точная модель входа" : "Сначала снять барьер";
              return (
                <article className="panel barrier-row" key={row.market_code}>
                  <div className="barrier-market">
                    <span className="section-kicker">{market.code} · {market.region}</span>
                    <h3>{market.name_ru}</h3>
                    <div className="analog-list" aria-label="Подтверждённые аналоги">
                      {row.analogs.map((analog) => <span key={analog}>{analog}</span>)}
                    </div>
                  </div>
                  <div className="evidence-column driver-column">
                    <div className="evidence-score"><strong>{row.driver.score}</strong><span>{driverScoreLabel(row.driver.score)}</span></div>
                    <h4>{row.driver.title}</h4>
                    <p>{row.driver.explanation}</p>
                    <div className="source-chips">{row.driver.source_ids.map((id) => <SourceLink key={id} sourceId={id} />)}</div>
                  </div>
                  <div className="evidence-column barrier-column">
                    <div className="evidence-score"><strong>{row.barrier.score}</strong><span>{barrierScoreLabel(row.barrier.score)}</span></div>
                    <h4>{row.barrier.title}</h4>
                    <p>{row.barrier.explanation}</p>
                    <div className="source-chips">{row.barrier.source_ids.map((id) => <SourceLink key={id} sourceId={id} />)}</div>
                  </div>
                  <div className={`barrier-balance ${balance > 0 ? "positive" : balance < 0 ? "negative" : "neutral"}`}>
                    <span>Драйвер − барьер</span>
                    <strong>{balance > 0 ? `+${balance}` : balance}</strong>
                    <p>{decision}</p>
                    <button type="button" onClick={() => chooseMarket(market.code, "profiles")}>Открыть профиль</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {tab === "compare" && (
        <section className="compare-layout">
          <div className="panel compare-picker">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">COMPARE</span>
                <h2>Выберите до трёх рынков</h2>
              </div>
              <span className="count-pill">{compareCodes.length}/3</span>
            </div>
            <div className="market-pills">
              {data.markets.map((market) => (
                <button
                  key={market.code}
                  type="button"
                  className={compareCodes.includes(market.code) ? "active" : ""}
                  onClick={() => toggleCompare(market.code)}
                >
                  {market.name_ru}<span>{market.weighted_score.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="comparison-cards">
            {compareMarkets.map((market) => (
              <article className="panel country-compare" key={market.code}>
                <div className="country-card-head">
                  <div><span>{market.code}</span><h2>{market.name_ru}</h2><p>{market.region}</p></div>
                  <div className="dual-score"><span>APS <ScoreBadge score={market.weighted_score} /></span><span>KAST <ScoreBadge score={getKastFit(market).score} /></span></div>
                </div>
                <div className="metric-stack">
                  <div><span>KAST / Product Fit</span><strong>{getKastFit(market).score.toFixed(2)}</strong><small>{getKastFit(market).category}</small></div>
                  <div><span>Входящие переводы</span><strong>{formatMoney(market.metrics.remittance_in_usd)}</strong><small>{market.metrics.remittance_in_usd?.year ?? "нет данных"}</small></div>
                  <div><span>Переводы / ВВП</span><strong>{formatPct(market.metrics.remittance_pct_gdp)}</strong><small>{market.metrics.remittance_pct_gdp?.year ?? "нет данных"}</small></div>
                  <div><span>Население</span><strong>{formatPeople(market.metrics.population)}</strong><small>{market.metrics.population?.year ?? "нет данных"}</small></div>
                  <div><span>Account ownership</span><strong>{market.metrics.findex_2024.account_ownership_pct.toFixed(1)}%</strong><small>Findex 2024</small></div>
                  <div><span>Smartphone</span><strong>{market.metrics.findex_2024.smartphone_pct.toFixed(1)}%</strong><small>Findex 2024</small></div>
                  <div><span>Crypto adoption</span><strong>{market.metrics.chainalysis_rank_2025 ? `#${market.metrics.chainalysis_rank_2025}` : "вне top-20"}</strong><small>из 151 стран</small></div>
                </div>
                <div className="gate-box"><span>Регуляторный gate</span><strong>{gateLabels[market.regulatory.gate]}</strong><p>{market.regulatory.status}</p></div>
              </article>
            ))}
          </div>

          <div className="panel criteria-panel">
            <div className="panel-heading"><div><span className="section-kicker">SCORE BREAKDOWN</span><h2>Шесть критериев</h2></div></div>
            <div className="criteria-table">
              {data.metadata.criteria.map((criterion) => (
                <div className="criteria-row" key={criterion.key}>
                  <div className="criteria-label"><strong>{criterion.label}</strong><span>{Math.round(criterion.weight * 100)}%</span></div>
                  {compareMarkets.map((market) => {
                    const value = market.scores[criterion.key as keyof typeof market.scores];
                    return <div className="criteria-value" key={market.code}><span style={{ width: `${value * 20}%` }} /><strong>{value}</strong></div>;
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "profiles" && (
        <section className="profiles-layout">
          <aside className="panel profile-nav">
            <span className="section-kicker">COUNTRY PROFILES</span>
            {data.markets.map((market) => (
              <button key={market.code} type="button" className={selectedCode === market.code ? "active" : ""} onClick={() => chooseMarket(market.code)}>
                <span>{market.code}</span><strong>{market.name_ru}</strong><small>{market.weighted_score.toFixed(2)}</small>
              </button>
            ))}
          </aside>

          <article className="panel profile-detail">
            <div className="profile-hero">
              <div><span className="section-kicker">{selected.region} · {selected.currency}</span><h2>{selected.name_ru}</h2><p>{selected.category}</p></div>
              <div className="profile-score-pair">
                <div className="profile-score"><strong>{selected.weighted_score.toFixed(2)}</strong><span>APS</span></div>
                <div className="profile-score kast-score"><strong>{selectedKastFit.score.toFixed(2)}</strong><span>KAST Fit</span></div>
              </div>
            </div>
            <div className="profile-grid">
              <div><span>Источник спроса</span><p>{selected.profile.demand}</p></div>
              <div><span>Приоритетная аудитория</span><p>{selected.profile.audience}</p></div>
              <div><span>Сценарий</span><p>{selected.profile.use_case}</p></div>
              <div><span>Главный барьер</span><p>{selected.profile.barrier}</p></div>
              <div className="wide"><span>Рекомендуемый вход</span><p>{selected.profile.entry}</p></div>
            </div>
            <div className="numbers-strip">
              <div><span>Переводы</span><strong>{formatMoney(selected.metrics.remittance_in_usd)}</strong><small>{selected.metrics.remittance_in_usd?.year}</small></div>
              <div><span>Инфляция</span><strong>{selected.metrics.imf_weo.inflation_2025_pct.toFixed(1)}%</strong><small>IMF 2025</small></div>
              <div><span>Account ownership</span><strong>{selected.metrics.findex_2024.account_ownership_pct.toFixed(1)}%</strong><small>Findex 2024</small></div>
              <div><span>Crypto rank</span><strong>{selected.metrics.chainalysis_rank_2025 ? `#${selected.metrics.chainalysis_rank_2025}` : ">20"}</strong><small>Chainalysis 2025</small></div>
            </div>
            <div className="profile-fit-section">
              <div><span className="section-kicker">KAST / PRODUCT FIT</span><h3>{selectedKastFit.category}</h3><p>Отдельный показатель не меняет исходный APS-рейтинг.</p></div>
              <div className="profile-fit-bars">
                {selectedKastFit.components.map((component) => (
                  <div key={component.key}><span>{component.label}</span><div><i style={{ width: `${component.score * 20}%` }} /></div><strong>{component.score.toFixed(1)}</strong></div>
                ))}
              </div>
            </div>
            <div className="case-studies-section">
              <div className="case-studies-heading">
                <div><span className="section-kicker">ПОДТВЕРЖДЁННЫЕ КЕЙСЫ</span><h3>Что уже сработало — и что сломалось</h3></div>
                <p>Только конкретные компании и опубликованные факты. Вывод APS отделён от доказательства.</p>
              </div>
              <div className="case-studies-grid">
                {(["success", "failure"] as const).map((kind) => {
                  const study = selected.case_studies[kind];
                  return (
                    <article key={kind} className={`case-study-card ${kind}`}>
                      <div className="case-study-topline">
                        <span>{kind === "success" ? "Подтверждённый рост" : "Закрытие / сбой"}</span>
                        <small>{study.period}</small>
                      </div>
                      <h4>{study.company}</h4>
                      <p className="case-study-product">{study.product}</p>
                      <div className="case-study-fact"><span>Факт</span><p>{study.evidence}</p></div>
                      <div className="case-study-lesson"><span>Вывод для APS</span><p>{study.lesson}</p></div>
                      <div className="source-chips">{study.source_ids.map((id) => <SourceLink key={id} sourceId={id} />)}</div>
                    </article>
                  );
                })}
              </div>
            </div>
            <div className="regulatory-section">
              <div><span className="section-kicker">REGULATORY GATE</span><h3>{gateLabels[selected.regulatory.gate]}</h3><p>{selected.regulatory.status}</p></div>
              <div className="source-chips">{selected.regulatory.source_ids.map((id) => <SourceLink key={id} sourceId={id} />)}</div>
            </div>
          </article>
        </section>
      )}

      {tab === "competition" && (
        <section className="panel benchmark-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">MARKET AVAILABILITY · 11.08.2026</span>
              <h2>Где конкурент доступен полностью, а где — частично</h2>
              <p>Отдельно проверены основной сервис/аккаунт и выпуск карты для резидента. Waitlist и coming soon не считаются действующим присутствием.</p>
            </div>
            <span className="count-pill">{data.market_competitors.length} конкурентов · {data.markets.length} рынков</span>
          </div>
          <div className="reference-note">
            <strong>{data.competition_availability.reference_product} — продуктовый эталон</strong>
            <span>{data.competition_availability.reference_note}</span>
          </div>
          <div className="availability-legend" aria-label="Обозначения доступности">
            {(Object.entries(data.competition_availability.definitions) as Array<[AvailabilityStatus, string]>).map(([status, definition]) => (
              <div key={status}><AvailabilityBadge status={status} /><span>{definition}</span></div>
            ))}
          </div>
          <div className="competitor-filter" aria-label="Фильтр конкурентов по рынку">
            <button type="button" className={competitorMarket === "ALL" ? "active" : ""} onClick={() => setCompetitorMarket("ALL")}>Все рынки</button>
            {data.markets.map((market) => <button key={market.code} type="button" className={competitorMarket === market.code ? "active" : ""} onClick={() => setCompetitorMarket(market.code)}>{market.name_ru}</button>)}
          </div>
          {selectedAvailabilityCounts && (
            <div className="availability-summary">
              {(Object.keys(availabilityLabels) as AvailabilityStatus[]).map((status) => (
                <div key={status}><AvailabilityBadge status={status} /><strong>{selectedAvailabilityCounts[status]}</strong></div>
              ))}
            </div>
          )}
          <div className="availability-table-scroll">
            <table className="availability-table">
              <thead>
                <tr>
                  <th>Конкурент</th>
                  <th>Тип</th>
                  {data.markets.map((market) => <th key={market.code}>{market.code}<small>{market.name_ru}</small></th>)}
                </tr>
              </thead>
              <tbody>
                {data.market_competitors.map((item) => (
                  <tr key={item.provider}>
                    <td><strong>{item.provider}</strong></td>
                    <td><span>{item.profile}</span></td>
                    {data.markets.map((market) => {
                      const marketAvailability = getAvailability(item, market.code);
                      return (
                        <td key={market.code}>
                          <button type="button" onClick={() => setCompetitorMarket(market.code)} title={`${item.provider} · ${market.name_ru}: ${availabilityLabels[marketAvailability.status]}`}>
                            <AvailabilityBadge status={marketAvailability.status} compact />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="subsection-heading competition-detail-heading">
            <div>
              <span className="section-kicker">OFFICIAL EVIDENCE</span>
              <h2>{competitorMarket === "ALL" ? "Профили и покрытие" : `Доступность: ${data.markets.find((market) => market.code === competitorMarket)?.name_ru}`}</h2>
            </div>
            <span className="count-pill">{competitorMarket === "ALL" ? "вся география" : "сначала доступные"}</span>
          </div>
          <div className="competitor-grid">
            {visibleCompetitors.map((item) => {
              const selectedAvailability = competitorMarket === "ALL" ? null : getAvailability(item, competitorMarket);
              const fullMarkets = data.markets.filter((market) => getAvailability(item, market.code).status === "full");
              const partialMarkets = data.markets.filter((market) => getAvailability(item, market.code).status === "partial");
              return (
                <article className="competitor-card" key={item.provider}>
                  <div className="competitor-card-head">
                    <span>{item.profile}</span>
                    <strong>{item.provider}</strong>
                  </div>
                  {selectedAvailability ? (
                    <div className="selected-availability">
                      <div className="selected-availability-head"><AvailabilityBadge status={selectedAvailability.status} /><span>{competitorMarket}</span></div>
                      <div className="support-checks">
                        <span>Сервис / аккаунт <strong>{supportLabel(selectedAvailability.account)}</strong></span>
                        <span>Выпуск карты <strong>{supportLabel(selectedAvailability.card)}</strong></span>
                      </div>
                      <p>{selectedAvailability.note}</p>
                    </div>
                  ) : (
                    <p className="competitor-markets">
                      <strong>Полностью:</strong> {fullMarkets.map((market) => market.name_ru).join(" · ") || "—"}<br />
                      <strong>Частично:</strong> {partialMarkets.map((market) => market.name_ru).join(" · ") || "—"}
                    </p>
                  )}
                  <h3>{item.product}</h3>
                  <p>{item.evidence}</p>
                  <div className="competitor-terms"><span>Публичные условия</span><strong>{item.public_terms}</strong></div>
                  <div className="source-chips">{item.source_ids.map((id) => <SourceLink key={id} sourceId={id} />)}</div>
                </article>
              );
            })}
          </div>
          <div className="subsection-heading">
            <div><span className="section-kicker">VERIFIED PRICE POINTS</span><h2>Сопоставимые тарифы и лимиты</h2><p>Только опубликованные цифры с официальных страниц; условия разных регионов не переносятся автоматически.</p></div>
            <span className="count-pill">{data.competitor_benchmarks.length} точек</span>
          </div>
          <div className="benchmark-grid">
            {data.competitor_benchmarks.map((item, index) => {
              const market = data.markets.find((entry) => entry.code === item.market_code);
              const source = data.sources.find((entry) => entry.id === item.source_id);
              return (
                <article className="benchmark-card" key={`${item.provider}-${index}`}>
                  <div className="benchmark-head">
                    <span>{item.market_code === "GLOBAL" ? "Global benchmark" : market?.name_ru ?? item.market_code}</span>
                    <strong>{item.provider}</strong>
                  </div>
                  <p className="benchmark-product">{item.product}</p>
                  <span className="benchmark-metric">{item.metric}</span>
                  <h3>{item.value}</h3>
                  {item.note && <p className="benchmark-note">{item.note}</p>}
                  <div className="benchmark-sources">
                    {source && <a href={source.url} target="_blank" rel="noreferrer">Официальные условия ↗</a>}
                    {"secondary_source_id" in item && item.secondary_source_id && <SourceLink sourceId={item.secondary_source_id} />}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="benchmark-conclusion">
            <strong>Что это означает для APS</strong>
            <p>Сравнивать нужно effective cost полного сценария: funding → conversion → card/QR spend → cash-out. Headline «0%» без fair-use, FX и withdrawal cost недостаточен.</p>
          </div>
        </section>
      )}

      {tab === "data" && (
        <section className="panel data-panel">
          <div className="panel-heading">
            <div><span className="section-kicker">RAW INDICATOR DATA</span><h2>Сопоставимые значения</h2><p>Каждая ячейка хранит год наблюдения. «Нет данных» означает, что источник не публикует показатель.</p></div>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Рынок</th><th>APS</th><th>KAST Fit</th><th>Входящие переводы</th><th>% ВВП</th><th>Население</th><th>Интернет</th><th>Account ownership</th><th>Digital payments</th><th>Smartphone</th><th>Инфляция 2025</th><th>Crypto rank</th></tr></thead>
              <tbody>
                {data.markets.map((market) => (
                  <tr key={market.code} onClick={() => chooseMarket(market.code, "profiles")}>
                    <td><strong>{market.name_ru}</strong><small>{market.code}</small></td>
                    <td>{market.weighted_score.toFixed(2)}</td>
                    <td>{getKastFit(market).score.toFixed(2)}<small>{getKastFit(market).category}</small></td>
                    <td>{formatMoney(market.metrics.remittance_in_usd)}<small>{market.metrics.remittance_in_usd?.year}</small></td>
                    <td>{formatPct(market.metrics.remittance_pct_gdp)}<small>{market.metrics.remittance_pct_gdp?.year}</small></td>
                    <td>{formatPeople(market.metrics.population)}<small>{market.metrics.population?.year}</small></td>
                    <td>{market.metrics.internet_users_pct ? `${market.metrics.internet_users_pct.value.toFixed(1)}%` : "нет данных"}<small>{market.metrics.internet_users_pct?.year}</small></td>
                    <td>{market.metrics.findex_2024.account_ownership_pct.toFixed(1)}%<small>2024</small></td>
                    <td>{market.metrics.findex_2024.digital_payment_pct == null ? "нет данных" : `${market.metrics.findex_2024.digital_payment_pct.toFixed(1)}%`}<small>2024</small></td>
                    <td>{market.metrics.findex_2024.smartphone_pct.toFixed(1)}%<small>2024</small></td>
                    <td>{market.metrics.imf_weo.inflation_2025_pct.toFixed(1)}%<small>2025</small></td>
                    <td>{market.metrics.chainalysis_rank_2025 ? `#${market.metrics.chainalysis_rank_2025}` : ">20"}<small>2025</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "method" && (
        <section className="method-layout">
          <article className="panel methodology-card">
            <span className="section-kicker">METHODOLOGY</span>
            <h2>Факты, оценки и gate не смешиваются</h2>
            <div className="method-steps">
              <div><span>01</span><strong>Фактический слой</strong><p>World Bank, Global Findex, IMF, Chainalysis и регуляторы. Год хранится рядом с каждым значением.</p></div>
              <div><span>02</span><strong>Экспертные баллы</strong><p>Шесть баллов из исходного APS.docx сохранены как аналитические оценки; итог пересчитан по весам ТЗ.</p></div>
              <div><span>03</span><strong>Регуляторный gate</strong><p>Отдельный статус показывает, возможен ли direct launch, нужен партнёр или допустим только fiat-wrapper.</p></div>
              <div><span>04</span><strong>KAST / Product Fit</strong><p>Новый независимый балл использует инфляцию IMF, переводы World Bank, crypto rank Chainalysis и показатели Findex. Ручная экспертная надбавка не применяется.</p></div>
              <div><span>05</span><strong>Барьеры и драйверы</strong><p>Два отдельных экспертных балла 1–5: сила подтверждённой продуктовой потребности и тяжесть market-entry барьера. Факты и источники показаны рядом с каждой оценкой.</p></div>
            </div>
            <div className="formula-box"><code>Σ (балл критерия × вес) = итог из 5</code><p>Пример: Филиппины = 5×25% + 5×20% + 5×15% + 3×15% + 4×15% + 5×10% = <strong>4,55</strong>.</p></div>
            <div className="formula-box kast-formula"><code>KAST Fit = 30% USD need + 20% cross-border + 25% crypto audience + 15% mobile readiness + 10% access gap</code><p>Инфляция: 5 баллов от 25%, 4 от 10%, 3 от 5%, 2 от 3%, иначе 1. Cross-border — среднее баллов по абсолютному объёму переводов и доле ВВП. Crypto: top-10 = 5, #11–20 = 4, вне опубликованного top-20 = 2. Mobile readiness — среднее smartphone и recent internet use, делённое на 20. Access gap = (100% − account ownership) / 20.</p><p>Для Вьетнама входящие переводы 2024 рассчитаны как 3,4% от опубликованного World Bank ВВП 2024; это производное значение отмечено в данных.</p></div>
          </article>

          <article className="panel sources-card">
            <div className="panel-heading compact"><div><span className="section-kicker">SOURCE REGISTER</span><h2>{data.sources.length} базовых источников</h2></div></div>
            <div className="sources-list">
              {data.sources.map((source) => (
                <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                  <span className="source-tier">{source.tier.replaceAll("_", " ")}</span>
                  <strong>{source.title}</strong>
                  <p>{source.publisher} · {source.period}</p>
                  <small>Проверено {source.accessed} ↗</small>
                </a>
              ))}
            </div>
          </article>
        </section>
      )}

      <footer>
        <span>APS Market Intelligence · research workspace</span>
        <span>Диагностический инструмент, не юридическое заключение</span>
      </footer>
    </main>
  );
}
