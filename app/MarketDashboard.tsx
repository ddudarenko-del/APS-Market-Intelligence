"use client";

import { useEffect, useRef, useState } from "react";
import data from "./data/market_data.json";

type Tab = "overview" | "conclusions" | "compare" | "profiles" | "competition" | "barriers" | "acquisition" | "respondents" | "data" | "method";
type ScoreMode = "potential" | "aps" | "kast";
type BarrierSort = "default" | "driver" | "barrier";
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
  { id: "conclusions", label: "Выводы" },
  { id: "compare", label: "Сравнение" },
  { id: "profiles", label: "Профили рынков" },
  { id: "competition", label: "Конкуренты / тарифы" },
  { id: "barriers", label: "Барьеры и драйверы" },
  { id: "acquisition", label: "Каналы привлечения" },
  { id: "respondents", label: "Респонденты" },
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

function getAvailability(competitor: (typeof data.market_competitors)[number], marketCode: string): Availability {
  return (competitor.availability as Record<string, Availability> | null)?.[marketCode] ?? {
    status: "unconfirmed",
    account: null,
    card: false,
    note: "Локальная доступность не подтверждена.",
    source_ids: [],
  };
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
  return score === 5 ? "Очень сильная" : score === 4 ? "Сильная" : score === 3 ? "Сегментная" : score === 2 ? "Нишевая" : "Слабая";
}

function barrierScoreLabel(score: number) {
  return score === 5 ? "Критическая" : score === 4 ? "Высокая" : score === 3 ? "Существенная" : score === 2 ? "Управляемая" : "Низкая";
}

const potentialLabels: Record<string, string> = {
  high: "Высокий",
  medium_high: "Средне-высокий",
  medium: "Средний",
  low: "Низкий",
};

const confidenceLabels: Record<string, string> = {
  high: "Хорошо подтверждено",
  medium: "Требует дополнительной проверки",
  hypothesis: "Гипотеза",
};

const brandRoleLabels: Record<string, string> = {
  critical: "Критическая",
  high: "Высокая",
  medium: "Средняя",
  secondary: "Вторичная",
};

const competitionGroupLabels: Record<string, string> = {
  direct_analogue: "Прямые аналоги",
  mass_finance: "Массовые финансовые сервисы",
  crypto_service: "Криптосервисы",
  specialist: "Специализированные решения",
  local_payments: "Локальные платежи и инфраструктура",
  traditional_bank: "Традиционные банки",
};

const competitionRoleLabels: Record<string, string> = {
  active: "Активный конкурент",
  reference: "Ориентир",
  infrastructure: "Инфраструктура",
  historical: "Исторический кейс",
};

const sourceLabelOverrides: Record<string, string> = {
  kast_series_a_2026: "KAST · показатели",
  kast_card_fees_2026: "KAST · тарифы",
  kast_crypto_card: "KAST · карты",
  kast_physical_card_shipping_2026: "KAST · доставка карт",
  kast_country_availability_2026: "KAST · география",
  kast_account_creation_2026: "KAST · регистрация",
};

function SourceChip({ sourceId }: { sourceId: string }) {
  const source = data.sources.find((item) => item.id === sourceId);
  if (!source) return null;
  const label = source.type === "interview" ? "Экспертное интервью" : sourceLabelOverrides[sourceId] ?? source.publisher;
  if (!source.url) {
    return <span className="source-chip interview-source" title={source.title}>{label}</span>;
  }
  return (
    <a href={source.url} target="_blank" rel="noreferrer" className="source-chip" title={`${source.publisher}: ${source.title}`}>
      {label}
    </a>
  );
}

function MarketMap({
  selectedCode,
  visibleCodes,
  scoreMode,
  onSelect,
  onOpenProfile,
}: {
  selectedCode: string;
  visibleCodes: string[];
  scoreMode: ScoreMode;
  onSelect: (code: string) => void;
  onOpenProfile: (code: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").GeoJSON | null>(null);
  const onSelectRef = useRef(onSelect);
  const onOpenProfileRef = useRef(onOpenProfile);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    onSelectRef.current = onSelect;
    onOpenProfileRef.current = onOpenProfile;
  }, [onSelect, onOpenProfile]);

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
          worldCopyJump: false,
          attributionControl: false,
        });
        mapRef.current = map;
        L.control.zoom({ position: "topright" }).addTo(map);

        const response = await fetch("/data/countries.geojson");
        if (!response.ok) throw new Error("Country geometry unavailable");
        const geometry = await response.json() as GeoJSON.GeoJsonObject;
        if (cancelled) return;

        const marketByCode = new Map(data.markets.map((market) => [market.code, market]));
        const layer = L.geoJSON(geometry, {
          style: (feature?: CountryFeature) => {
            const code = feature?.properties?.ADM0_A3 ?? "";
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
            if (!code) return;
            const market = marketByCode.get(code);
            if (!market) return;
            const assessment = data.market_assessments.find((item) => item.market_code === market.code);
            const score = scoreMode === "kast" ? getKastFit(market).score : market.weighted_score;
            const tooltipText = scoreMode === "potential"
              ? `${assessment?.potential.label ?? "Нет качественной оценки"}`
              : `${scoreMode === "kast" ? "KAST Fit" : "APS"}: ${score.toFixed(2)} / 5`;
            countryLayer.bindTooltip(
              `<strong>${market.name_ru}</strong><br>${tooltipText}`,
              { sticky: true, direction: "top", className: "aps-map-tooltip" },
            );
            if (assessment) {
              countryLayer.bindPopup(
                `<section class="market-map-popup"><strong>${market.name_ru}</strong><span>${assessment.potential.label}</span><p><b>Сила потребности:</b> ${assessment.need.score}/5</p><p><b>Сложность входа:</b> ${assessment.entry_complexity.score}/5</p><p>${assessment.headline}</p><p><b>Незакрытая задача:</b> ${assessment.market_gap}</p><small>${confidenceLabels[assessment.confidence]}</small><button type="button" data-market-profile="${code}">Открыть профиль</button></section>`,
                { maxWidth: 320, className: "aps-map-popup-shell" },
              );
            }
            countryLayer.on("click", () => {
              onSelectRef.current(code);
              countryLayer.openPopup();
            });
            countryLayer.on("popupopen", () => {
              const popupElement = countryLayer.getPopup()?.getElement();
              const button = popupElement?.querySelector<HTMLButtonElement>(`[data-market-profile="${code}"]`);
              button?.addEventListener("click", () => onOpenProfileRef.current(code), { once: true });
            });
            countryLayer.on("add", () => {
              const element = (countryLayer as import("leaflet").Path).getElement();
              if (!element) return;
              element.setAttribute("tabindex", "0");
              element.setAttribute("role", "button");
              element.setAttribute("aria-label", `Открыть данные рынка: ${market.name_ru}`);
              element.addEventListener("keydown", (event) => {
                const keyboardEvent = event as KeyboardEvent;
                if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
                keyboardEvent.preventDefault();
                onSelectRef.current(code);
                countryLayer.openPopup();
              });
            });
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
      if (!code) return;
      const market = data.markets.find((item) => item.code === code);
      if (!market) return;
      const visible = visibleSet.has(code);
      const selected = code === selectedCode;
      const assessment = data.market_assessments.find((item) => item.market_code === market.code);
      const score = scoreMode === "kast" ? getKastFit(market).score : market.weighted_score;
      const potentialColor = assessment?.potential.level === "high"
        ? "#35e879"
        : assessment?.potential.level === "medium_high"
          ? "#62c77f"
          : assessment?.potential.level === "medium"
            ? "#a7c765"
            : "#83908a";
      const fillColor = selected
        ? "#40f785"
        : scoreMode === "potential"
          ? potentialColor
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
        {scoreMode === "potential" ? (
          <><span><i className="dot high" /> высокий</span><span><i className="dot mid" /> средний</span><span><i className="dot low" /> низкий</span></>
        ) : (
          <><span><i className="dot high" /> 4,0+</span><span><i className="dot mid" /> 3,2-3,99</span><span><i className="dot low" /> ниже 3,2</span></>
        )}
      </div>
    </div>
  );
}

export function MarketDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [scoreMode, setScoreMode] = useState<ScoreMode>("potential");
  const [selectedCode, setSelectedCode] = useState("PHL");
  const [compareCodes, setCompareCodes] = useState<string[]>(["PHL", "COL", "MEX"]);
  const [region, setRegion] = useState("Все регионы");
  const [competitorMarket, setCompetitorMarket] = useState("ALL");
  const [barrierSort, setBarrierSort] = useState<BarrierSort>("default");

  const selected = data.markets.find((market) => market.code === selectedCode) ?? data.markets[0];
  const selectedAssessment = data.market_assessments.find((item) => item.market_code === selected.code) ?? data.market_assessments[0];
  const selectedReport = data.market_reports.find((item) => item.market_code === selected.code) ?? data.market_reports[0];
  const regions = ["Все регионы", ...Array.from(new Set(data.markets.map((market) => market.region)))];
  const visibleMarkets = region === "Все регионы" ? data.markets : data.markets.filter((market) => market.region === region);
  const compareMarkets = compareCodes
    .map((code) => data.markets.find((market) => market.code === code))
    .filter(Boolean) as Market[];
  const selectedKastFit = getKastFit(selected);
  const selectedAcquisition = data.acquisition_channels.rows.find((row) => row.market_code === selected.code) ?? data.acquisition_channels.rows[0];
  const selectedCompetition = competitorMarket === "ALL" ? null : data.competition_by_market.find((item) => item.market_code === competitorMarket) ?? null;
  const selectedCompetitionAssessment = competitorMarket === "ALL" ? null : data.market_assessments.find((item) => item.market_code === competitorMarket) ?? null;
  const globalCompetitors = data.market_competitors.filter((item) => item.scope === "global" && item.availability);
  const rankedVisibleMarkets = [...visibleMarkets].sort((a, b) => {
    if (scoreMode === "potential") return 0;
    if (scoreMode === "kast") return getKastFit(b).score - getKastFit(a).score;
    return a.rank - b.rank;
  });
  const visibleCompetitors = [...globalCompetitors].sort((a, b) => {
    if (competitorMarket === "ALL") return 0;
    return availabilityOrder[getAvailability(a, competitorMarket).status] - availabilityOrder[getAvailability(b, competitorMarket).status];
  });
  const selectedAvailabilityCounts = competitorMarket === "ALL"
    ? null
    : visibleCompetitors.reduce<Record<AvailabilityStatus, number>>((counts, item) => {
        counts[getAvailability(item, competitorMarket).status] += 1;
        return counts;
      }, { full: 0, partial: 0, unavailable: 0, unconfirmed: 0 });
  const barrierRows = data.market_assessments
    .map((assessment) => ({ assessment, market: data.markets.find((market) => market.code === assessment.market_code)! }))
    .sort((a, b) => {
      if (barrierSort === "driver") return b.assessment.need.score - a.assessment.need.score;
      if (barrierSort === "barrier") return b.assessment.entry_complexity.score - a.assessment.entry_complexity.score;
      return 0;
    });
  const strongNeedMarkets = data.market_assessments.filter((item) => item.need.score >= 4).length;
  const highComplexityMarkets = data.market_assessments.filter((item) => item.entry_complexity.score >= 4).length;
  const criticalComplexityMarkets = data.market_assessments.filter((item) => item.entry_complexity.score === 5).length;
  const completedRespondents = data.respondents.filter((item) => item.status === "completed");

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
          {/* The same component is built by Next/vinext and standalone Vite for Hostinger. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="aps-logo" src="/brand/aps-logo.svg" alt="APS" width={132} height={52} />
          <span className="update-stamp">Исследование обновлено 01.09.2026</span>
        </div>
        <div className="hero-grid">
          <div>
            <h1>APS Market Intelligence</h1>
            <p>
              Анализ продуктового соответствия stablecoin-powered global money app на восьми рынках с учетом открытых данных и экспертных интервью.
            </p>
          </div>
          <div className="hero-metrics" aria-label="Сводка исследования">
            <div><strong>8</strong><span>рынков</span></div>
            <div><strong>{completedRespondents.length}</strong><span>экспертных интервью</span></div>
            <div><strong>{data.sources.length}</strong><span>источников</span></div>
          </div>
        </div>
      </header>

      <div className="method-banner">
        <span className="method-icon">i</span>
        <p>
          <strong>Три независимых слоя.</strong> Исходные APS и KAST / Product Fit сохранены как справочные оценки.
          Предварительный потенциал после интервью является качественным выводом и не рассчитывается из их суммы.
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
                <p>По умолчанию цвет отражает качественный вывод исследования. Карта открывается по клику, тапу и клавиатуре.</p>
              </div>
              <div className="panel-controls">
                <div className="metric-switch" aria-label="Показатель карты">
                  <button type="button" className={scoreMode === "potential" ? "active" : ""} onClick={() => setScoreMode("potential")}>Вывод исследования</button>
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
              onOpenProfile={(code) => chooseMarket(code, "profiles")}
            />
            <div className="selected-market">
              <div>
                <span className="section-kicker">ВЫБРАННЫЙ РЫНОК</span>
                <h3>{selected.name_ru}</h3>
                <span className={`potential-badge ${selectedAssessment.potential.level}`}>{selectedAssessment.potential.label}</span>
                <p>{selectedAssessment.headline}</p>
                <p className="market-gap"><strong>Незакрытая задача:</strong> {selectedAssessment.market_gap}</p>
              </div>
              <div className="selected-kpis">
                <div><span>Сила потребности</span><strong>{selectedAssessment.need.score}/5</strong></div>
                <div><span>Сложность входа</span><strong>{selectedAssessment.entry_complexity.score}/5</strong></div>
                <div><span>Подтверждение</span><strong>{confidenceLabels[selectedAssessment.confidence]}</strong></div>
              </div>
              <button type="button" className="primary-button" onClick={() => setTab("profiles")}>Открыть профиль</button>
            </div>
          </div>

          <aside className="panel ranking-panel">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">РЫНКИ</span>
                <h2>{scoreMode === "potential" ? "По предварительному потенциалу" : scoreMode === "aps" ? "По формуле APS" : "По KAST / Product Fit"}</h2>
              </div>
              <span className="count-pill">8 рынков</span>
            </div>
            <div className="ranking-list">
              {rankedVisibleMarkets.map((market, index) => (
                <button key={market.code} type="button" onClick={() => chooseMarket(market.code)} className={selectedCode === market.code ? "active" : ""}>
                  <span className="rank-number">{scoreMode === "potential" ? market.code : scoreMode === "aps" ? market.rank : index + 1}</span>
                  <span className="rank-name"><strong>{market.name_ru}</strong><small>{market.region}</small></span>
                  {scoreMode === "potential" ? (
                    <><span className="gate-mini">{data.market_assessments.find((item) => item.market_code === market.code)?.headline}</span><span className={`potential-dot ${data.market_assessments.find((item) => item.market_code === market.code)?.potential.level}`}>{potentialLabels[data.market_assessments.find((item) => item.market_code === market.code)?.potential.level ?? "low"]}</span></>
                  ) : (
                    <><span className="gate-mini">{gateLabels[market.regulatory.gate]}</span><ScoreBadge score={scoreMode === "aps" ? market.weighted_score : getKastFit(market).score} /></>
                  )}
                </button>
              ))}
            </div>
            <div className="ranking-note">
              <strong>Ключевой вывод</strong>
              <p>{scoreMode === "potential" ? "Это качественная группировка после интервью, а не новый расчетный рейтинг." : scoreMode === "aps" ? "Исходная формула и значения APS сохранены без изменений." : "KAST Fit остается отдельным справочным показателем и не объединяется с качественным выводом."}</p>
            </div>
          </aside>
        </section>
      )}


      {tab === "conclusions" && (
        <section className="conclusions-layout">
          <article className="panel research-conclusion">
            <span className="section-kicker">ИТОГ ИССЛЕДОВАНИЯ</span>
            <h2>Универсальный аналог KAST не дает достаточного отличия</h2>
            <p>Карта, долларовый счет, хранение стейблкоинов и базовая конвертация уже воспринимаются как стандартный набор. Возможность возникает вокруг конкретной аудитории, незакрытой задачи и измеримого преимущества: курса, комиссии, доходности, локальной функции, платежного маршрута, налогового сопровождения или упрощения сложного финансового сценария.</p>
          </article>
          <div className="research-observations">
            {[
              ["Главный спрос - трансграничные деньги", "Зарубежный доход, семейные переводы и международные специалисты дают наиболее понятные сценарии."],
              ["Базовый продукт больше не отличает", "Карта, кошелек и хранение стейблкоинов легко повторяются на общей инфраструктуре."],
              ["Переключение требует ощутимой выгоды", "Пользователь должен видеть лучший курс, меньшую комиссию, локальную функцию или меньшее число сервисов."],
              ["Регулирование и партнеры определяют реальный вход", "Потенциал спроса нельзя оценивать отдельно от разрешенной модели запуска."],
            ].map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
          <div className="assessment-grid">
            {data.markets.map((market) => {
              const assessment = data.market_assessments.find((item) => item.market_code === market.code)!;
              return (
                <article className="panel assessment-card" key={market.code}>
                  <div className="assessment-card-head"><span>{market.code}</span><strong>{market.name_ru}</strong></div>
                  <span className={`potential-badge ${assessment.potential.level}`}>{assessment.potential.label}</span>
                  <h3>{assessment.headline}</h3>
                  <div className="qualitative-scores">
                    <div><span>Сила потребности</span><strong>{assessment.need.score}/5</strong><small>{driverScoreLabel(assessment.need.score)}</small></div>
                    <div><span>Сложность входа</span><strong>{assessment.entry_complexity.score}/5</strong><small>{barrierScoreLabel(assessment.entry_complexity.score)}</small></div>
                  </div>
                  <p><strong>Незакрытая задача:</strong> {assessment.market_gap}</p>
                  <p className="confidence-line">Уровень подтверждения: {confidenceLabels[assessment.confidence]}</p>
                  <div className="source-chips">{assessment.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
                  <button type="button" onClick={() => chooseMarket(market.code, "profiles")}>Открыть профиль</button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {tab === "barriers" && (
        <section className="barriers-layout">
          <article className="panel barriers-summary">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">РЕАЛЬНОСТЬ ВХОДА НА РЫНОК</span>
                <h2>Сила потребности против сложности входа</h2>
                <p>Две независимые качественные оценки по шкале 1–5. Это не формула рейтинга и не арифметический баланс.</p>
              </div>
              <div className="barrier-sort" aria-label="Сортировка рынков">
                {(["default", "driver", "barrier"] as const).map((sort) => (
                  <button key={sort} type="button" aria-pressed={barrierSort === sort} className={barrierSort === sort ? "active" : ""} onClick={() => setBarrierSort(sort)}>
                    {sort === "default" ? "По рынкам" : sort === "driver" ? "По силе потребности" : "По сложности входа"}
                  </button>
                ))}
              </div>
            </div>
            <div className="barriers-summary-metrics">
              <div><span>Сильная потребность</span><strong>{strongNeedMarkets}</strong><small>рынков с оценкой 4–5</small></div>
              <div><span>Высокая сложность</span><strong>{highComplexityMarkets}</strong><small>рынков с оценкой 4–5</small></div>
              <div><span>Критическая сложность</span><strong>{criticalComplexityMarkets}</strong><small>рынков с оценкой 5</small></div>
            </div>
            <div className="barrier-method-note"><strong>Как читать:</strong><span>Сила потребности показывает выраженность пользовательской задачи. Сложность входа показывает конкуренцию, регулирование и требования к модели запуска. Одна оценка не вычитается из другой.</span></div>
          </article>

          <div className="barrier-matrix-head" aria-hidden="true">
            <span>Рынок</span><span>Сила потребности</span><span>Сложность входа</span><span>Что это означает</span>
          </div>
          <div className="barrier-matrix">
            {barrierRows.map(({ assessment, market }) => {
              return (
                <article className="panel barrier-row" key={assessment.market_code}>
                  <div className="barrier-market">
                    <span className="section-kicker">{market.code} · {market.region}</span>
                    <h3>{market.name_ru}</h3>
                    <span className={`potential-badge ${assessment.potential.level}`}>{assessment.potential.label}</span>
                  </div>
                  <div className="evidence-column driver-column">
                    <div className="evidence-score"><strong>{assessment.need.score}</strong><span>{driverScoreLabel(assessment.need.score)}</span></div>
                    <h4>{assessment.need.title}</h4>
                    <p>{assessment.market_gap}</p>
                    <div className="source-chips">{assessment.need.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
                  </div>
                  <div className="evidence-column barrier-column">
                    <div className="evidence-score"><strong>{assessment.entry_complexity.score}</strong><span>{barrierScoreLabel(assessment.entry_complexity.score)}</span></div>
                    <h4>{assessment.entry_complexity.title}</h4>
                    <p>{assessment.competition_summary}</p>
                    <div className="source-chips">{assessment.entry_complexity.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
                  </div>
                  <div className="barrier-meaning">
                    <span>Условие входа</span>
                    <p>{assessment.entry_condition}</p>
                    <small>Подтверждение: {confidenceLabels[assessment.confidence]}</small>
                    <button type="button" onClick={() => chooseMarket(market.code, "profiles")}>Открыть профиль</button>
                  </div>
                  <div className="barrier-cases">
                    <div className="barrier-cases-heading">
                      <div>
                        <span className="section-kicker">ПОДТВЕРЖДАЮЩИЕ ПРИМЕРЫ</span>
                        <h4>Что рынок уже показал на практике</h4>
                      </div>
                      <p>Факт компании отделён от аналитического вывода APS.</p>
                    </div>
                    <div className="barrier-cases-grid">
                      {(["success", "failure"] as const).map((kind) => {
                        const study = market.case_studies[kind];
                        return (
                          <article key={kind} className={`barrier-case-card ${kind}`}>
                            <div className="barrier-case-topline">
                              <span>{kind === "success" ? "Что сработало" : "Что ограничило результат"}</span>
                              <small>{study.period}</small>
                            </div>
                            <h5>{study.company}</h5>
                            <p className="barrier-case-product">{study.product}</p>
                            <div className="barrier-case-copy">
                              <span>Подтверждённый факт</span>
                              <p>{study.evidence}</p>
                            </div>
                            <div className="barrier-case-copy lesson">
                              <span>Аналитический вывод APS</span>
                              <p>{study.lesson}</p>
                            </div>
                            <div className="source-chips">{study.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {tab === "acquisition" && (
        <section className="acquisition-layout">
          <article className="panel acquisition-summary">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">СТРАТЕГИЯ ПРИВЛЕЧЕНИЯ</span>
                <h2>Какие каналы способны привести первых пользователей</h2>
                <p>Локальный цифровой охват, подтверждённые механики конкурентов и стратегический вывод для нового игрока.</p>
              </div>
              <span className="independent-badge">Не влияет на рейтинг</span>
            </div>
            <div className="acquisition-method-note">
              <strong>Методология</strong>
              <p>{data.acquisition_channels.method_note}</p>
            </div>
          </article>

          <div className="acquisition-market-picker" aria-label="Выбор рынка для анализа каналов">
            {data.markets.map((market) => (
              <button key={market.code} type="button" className={selected.code === market.code ? "active" : ""} onClick={() => chooseMarket(market.code)}>
                <span>{market.code}</span>{market.name_ru}
              </button>
            ))}
          </div>

          <article className="panel acquisition-country">
            <div className="acquisition-country-head">
              <div>
                <span className="section-kicker">{selected.code} · {selected.region}</span>
                <h2>{selected.name_ru}</h2>
                <p>{selectedAcquisition.entry_mix}</p>
              </div>
              <div className="acquisition-source-date">Проверено<br /><strong>{data.acquisition_channels.checked_at}</strong></div>
            </div>

            <div className="acquisition-strategy-grid">
              <div><span>Приоритетная аудитория</span><p>{selectedAcquisition.strategy.audience}</p></div>
              <div><span>Основное сообщение</span><p>{selectedAcquisition.strategy.message}</p></div>
              <div><span>Роль бренда</span><strong>{brandRoleLabels[selectedAcquisition.strategy.role.level]}</strong><p>{selectedAcquisition.strategy.role.explanation}</p></div>
              <div><span>Принцип выхода</span><p>{selectedAssessment.market_principle}</p></div>
              <div><span>Уровень подтверждения</span><strong>{confidenceLabels[selectedAssessment.confidence]}</strong><div className="source-chips">{selectedAssessment.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div></div>
            </div>

            <div className="acquisition-reach-grid">
              <div><span>Пользователи интернета</span><strong>{selectedAcquisition.digital_reach.internet_users_m.toLocaleString("ru-RU")} млн</strong><small>январь 2025</small></div>
              <div><span>Активные профили в соцсетях</span><strong>{selectedAcquisition.digital_reach.social_identities_m.toLocaleString("ru-RU")} млн</strong><small>{selectedAcquisition.digital_reach.social_pct_population.toLocaleString("ru-RU")}% населения</small></div>
              <div><span>Рекламная аудитория Facebook</span><strong>{selectedAcquisition.digital_reach.facebook_ad_m.toLocaleString("ru-RU")} млн</strong><small>потенциальный охват</small></div>
              <div><span>Рекламная аудитория YouTube</span><strong>{selectedAcquisition.digital_reach.youtube_ad_m.toLocaleString("ru-RU")} млн</strong><small>потенциальный охват</small></div>
              <div><span>Рекламная аудитория TikTok 18+</span><strong>{selectedAcquisition.digital_reach.tiktok_adult_ad_m.toLocaleString("ru-RU")} млн</strong><small>потенциальный охват</small></div>
            </div>

            <div className="acquisition-channels-heading">
              <div><span className="section-kicker">ПОТЕНЦИАЛ КАНАЛОВ</span><h3>Приоритетный набор для запуска</h3></div>
              <p>Оценка 1–5 используется только внутри этой вкладки для сравнения каналов.</p>
            </div>
            <div className="acquisition-channel-grid">
              {selectedAcquisition.channels.map((channel, index) => (
                <article className="acquisition-channel-card" key={channel.channel}>
                  <div className="acquisition-channel-topline">
                    <span>0{index + 1}</span>
                    <div className="channel-importance" aria-label={`Важность канала ${channel.importance} из 5`}>
                      {Array.from({ length: 5 }, (_, item) => <i key={item} className={item < channel.importance ? "filled" : ""} />)}
                    </div>
                    <strong>{channel.importance_label}</strong>
                  </div>
                  {("phase" in channel || "evidence_type" in channel) && (
                    <div className="channel-meta">
                      {"phase" in channel && Boolean(channel.phase) && <span>Фаза: {String(channel.phase)}</span>}
                      {"evidence_type" in channel && Boolean(channel.evidence_type) && <span>Основание: {String(channel.evidence_type)}</span>}
                    </div>
                  )}
                  <h4>{channel.channel}</h4>
                  <div className="channel-strategy"><span>Роль</span><p>{channel.role}</p></div>
                  <div className="channel-strategy"><span>Аудитория</span><p>{channel.audience}</p></div>
                  <div className="channel-strategy"><span>Сообщение</span><p>{channel.message}</p></div>
                  <div className="channel-reach"><span>Масштаб / контекст</span><p>{channel.reach}</p></div>
                  <div className="channel-example"><span>Пример конкурента</span><strong>{channel.competitor}</strong><p>{channel.example}</p></div>
                  <div className="channel-playbook"><span>Как использовать новому игроку</span><p>{channel.playbook}</p></div>
                  <div className="source-chips">{channel.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
                </article>
              ))}
            </div>
          </article>
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
                  {market.name_ru}<span>{potentialLabels[data.market_assessments.find((item) => item.market_code === market.code)?.potential.level ?? "low"]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="comparison-cards">
            {compareMarkets.map((market) => {
              const assessment = data.market_assessments.find((item) => item.market_code === market.code)!;
              return <article className="panel country-compare" key={market.code}>
                <div className="country-card-head">
                  <div><span>{market.code}</span><h2>{market.name_ru}</h2><p>{market.region}</p></div>
                  <span className={`potential-badge ${assessment.potential.level}`}>{assessment.potential.label}</span>
                </div>
                <h3 className="compare-headline">{assessment.headline}</h3>
                <div className="qualitative-scores compact">
                  <div><span>Сила потребности</span><strong>{assessment.need.score}/5</strong><small>{driverScoreLabel(assessment.need.score)}</small></div>
                  <div><span>Сложность входа</span><strong>{assessment.entry_complexity.score}/5</strong><small>{barrierScoreLabel(assessment.entry_complexity.score)}</small></div>
                </div>
                <div className="compare-qualitative">
                  <p><span>Конкуренция</span>{assessment.competition_summary}</p>
                  <p><span>Незакрытая задача</span>{assessment.market_gap}</p>
                  <p><span>Условие входа</span>{assessment.entry_condition}</p>
                  <p><span>Роль бренда</span>{brandRoleLabels[assessment.brand_role.level]}</p>
                </div>
                <div className="source-chips">{assessment.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
                <div className="reference-scores"><span>Справочные оценки</span><strong>APS {market.weighted_score.toFixed(2)}</strong><strong>KAST Fit {getKastFit(market).score.toFixed(2)}</strong></div>
                <div className="metric-stack">
                  <div className="metric-section-label"><span>КОЛИЧЕСТВЕННЫЙ КОНТЕКСТ</span></div>
                  <div><span>KAST / Product Fit</span><strong>{getKastFit(market).score.toFixed(2)}</strong><small>{getKastFit(market).category}</small></div>
                  <div><span>Входящие переводы</span><strong>{formatMoney(market.metrics.remittance_in_usd)}</strong><small>{market.metrics.remittance_in_usd?.year ?? "нет данных"}</small></div>
                  <div><span>Переводы / ВВП</span><strong>{formatPct(market.metrics.remittance_pct_gdp)}</strong><small>{market.metrics.remittance_pct_gdp?.year ?? "нет данных"}</small></div>
                  <div><span>Население</span><strong>{formatPeople(market.metrics.population)}</strong><small>{market.metrics.population?.year ?? "нет данных"}</small></div>
                  <div><span>Account ownership</span><strong>{market.metrics.findex_2024.account_ownership_pct.toFixed(1)}%</strong><small>Findex 2024</small></div>
                  <div><span>Smartphone</span><strong>{market.metrics.findex_2024.smartphone_pct.toFixed(1)}%</strong><small>Findex 2024</small></div>
                  <div><span>Crypto adoption</span><strong>{market.metrics.chainalysis_rank_2025 ? `#${market.metrics.chainalysis_rank_2025}` : "вне top-20"}</strong><small>из 151 стран</small></div>
                </div>
                <div className="gate-box"><span>Регуляторный gate</span><strong>{gateLabels[market.regulatory.gate]}</strong><p>{market.regulatory.status}</p></div>
              </article>;
            })}
          </div>

          <div className="panel key-comparison">
            <div className="panel-heading compact"><div><span className="section-kicker">КЛЮЧЕВОЕ СРАВНЕНИЕ</span><h2>Качественные условия входа</h2></div></div>
            <div className="table-scroll"><table><thead><tr><th>Критерий</th>{compareMarkets.map((market) => <th key={market.code}>{market.name_ru}</th>)}</tr></thead><tbody>
              {[
                ["Потенциал", (code: string) => data.market_assessments.find((item) => item.market_code === code)!.potential.label],
                ["Потребность", (code: string) => `${data.market_assessments.find((item) => item.market_code === code)!.need.score}/5`],
                ["Сложность входа", (code: string) => `${data.market_assessments.find((item) => item.market_code === code)!.entry_complexity.score}/5`],
                ["Незакрытая задача", (code: string) => data.market_assessments.find((item) => item.market_code === code)!.market_gap],
                ["Условие входа", (code: string) => data.market_assessments.find((item) => item.market_code === code)!.entry_condition],
                ["Подтверждение", (code: string) => confidenceLabels[data.market_assessments.find((item) => item.market_code === code)!.confidence]],
              ].map(([label, getter]) => <tr key={label as string}><th>{label as string}</th>{compareMarkets.map((market) => <td key={market.code}>{(getter as (code: string) => string)(market.code)}</td>)}</tr>)}
            </tbody></table></div>
          </div>

          <div className="panel criteria-panel">
            <div className="panel-heading"><div><span className="section-kicker">ИСХОДНАЯ ОЦЕНКА APS</span><h2>Шесть критериев</h2><p>Исходные критерии APS сохранены без изменений и не учитывают результаты экспертных интервью.</p></div></div>
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
              <div><span className="section-kicker">{selected.region} · {selected.currency}</span><h2>{selected.name_ru}</h2><p>{selectedAssessment.headline}</p></div>
              <span className={`potential-badge ${selectedAssessment.potential.level}`}>{selectedAssessment.potential.label}</span>
            </div>
            <div className="profile-assessment-grid">
              <div><span>Сила потребности</span><strong>{selectedAssessment.need.score}/5</strong><p>{selectedAssessment.need.title}</p></div>
              <div><span>Сложность входа</span><strong>{selectedAssessment.entry_complexity.score}/5</strong><p>{selectedAssessment.entry_complexity.title}</p></div>
              <div><span>Незакрытая задача</span><p>{selectedAssessment.market_gap}</p></div>
              <div><span>Условие входа</span><p>{selectedAssessment.entry_condition}</p></div>
              <div><span>Приоритетная аудитория</span><p>{selectedAssessment.priority_audience}</p></div>
              <div><span>Основное сообщение</span><p>{selectedAssessment.core_message}</p></div>
            </div>
            <div className="profile-confidence"><strong>Уровень подтверждения: {confidenceLabels[selectedAssessment.confidence]}</strong><div className="source-chips">{selectedAssessment.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div></div>
            <div className="market-report">
              {selectedReport.sections.map((section, index) => (
                <section className="market-report-section" key={section.id}>
                  <span className="report-index">0{index + 1}</span><div><h3>{section.title}</h3>{section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}<div className="source-chips">{section.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div></div>
                </section>
              ))}
            </div>
            <div className="numbers-strip">
              <div><span>Переводы</span><strong>{formatMoney(selected.metrics.remittance_in_usd)}</strong><small>{selected.metrics.remittance_in_usd?.year}</small></div>
              <div><span>Инфляция</span><strong>{selected.metrics.imf_weo.inflation_2025_pct.toFixed(1)}%</strong><small>IMF 2025</small></div>
              <div><span>Account ownership</span><strong>{selected.metrics.findex_2024.account_ownership_pct.toFixed(1)}%</strong><small>Findex 2024</small></div>
              <div><span>Crypto rank</span><strong>{selected.metrics.chainalysis_rank_2025 ? `#${selected.metrics.chainalysis_rank_2025}` : ">20"}</strong><small>Chainalysis 2025</small></div>
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
                      <div className="source-chips">{study.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
                    </article>
                  );
                })}
              </div>
            </div>
            <div className="regulatory-section">
              <div><span className="section-kicker">REGULATORY GATE</span><h3>{gateLabels[selected.regulatory.gate]}</h3><p>{selected.regulatory.status}</p></div>
              <div className="source-chips">{selected.regulatory.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
            </div>
            <div className="profile-fit-section reference-layer">
              <div><span className="section-kicker">СПРАВОЧНЫЕ РАСЧЁТНЫЕ СЛОИ</span><h3>APS {selected.weighted_score.toFixed(2)} · KAST Fit {selectedKastFit.score.toFixed(2)}</h3><p>Обе оценки сохранены без изменений и не объединяются с качественным выводом.</p></div>
              <div className="profile-fit-bars">
                {selectedKastFit.components.map((component) => (
                  <div key={component.key}><span>{component.label}</span><div><i style={{ width: `${component.score * 20}%` }} /></div><strong>{component.score.toFixed(1)}</strong></div>
                ))}
              </div>
            </div>
          </article>
        </section>
      )}

      {tab === "competition" && (
        <section className="panel benchmark-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">КОНКУРЕНТНАЯ СРЕДА · 01.09.2026</span>
              <h2>Локальная структура рынка и доступность глобальных продуктов</h2>
              <p>Сначала показана реальная конкурентная среда выбранной страны, затем — подтверждённая доступность глобальных сервисов.</p>
            </div>
            <span className="count-pill">{globalCompetitors.length} глобальных продуктов · {data.markets.length} рынков</span>
          </div>
          <div className="reference-note">
            <strong>{data.competition_availability.reference_product} — эталон и прямой конкурент</strong>
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
          {selectedCompetition && selectedCompetitionAssessment && (
            <section className="local-competition">
              <div className="local-competition-summary">
                <span className="section-kicker">{competitorMarket} · ЛОКАЛЬНАЯ СТРУКТУРА</span>
                <h3>{selectedCompetitionAssessment.competition_summary}</h3>
                <p><strong>Незакрытая задача:</strong> {selectedCompetitionAssessment.market_gap}</p>
                <p><strong>Условие входа:</strong> {selectedCompetitionAssessment.entry_condition}</p>
                <div className="must-win-list">{selectedCompetitionAssessment.must_win_on.map((item) => <span key={item}>{item}</span>)}</div>
                <div className="source-chips">{selectedCompetitionAssessment.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
              </div>
              <div className="local-competition-groups">
                {selectedCompetition.group_order.map((group) => (
                  <article key={group}>
                    <h4>{competitionGroupLabels[group]}</h4>
                    <div>{selectedCompetition.entities.filter((entity) => entity.group_type === group).map((entity) => {
                      const competitor = data.market_competitors.find((item) => item.id === entity.competitor_id);
                      return <span className={`local-entity ${entity.role}`} key={entity.competitor_id}><strong>{competitor?.provider ?? entity.competitor_id}</strong><small>{competitionRoleLabels[entity.role]}</small></span>;
                    })}</div>
                  </article>
                ))}
              </div>
            </section>
          )}
          <div className="subsection-heading global-availability-heading"><div><span className="section-kicker">ДОСТУПНОСТЬ ГЛОБАЛЬНЫХ ПРОДУКТОВ</span><h2>Аккаунт, обмен и выпуск карты</h2><p>Waitlist и coming soon не считаются действующим присутствием. Частичная доступность показывается отдельно.</p></div></div>
          {selectedAvailabilityCounts && (
            <div className="availability-summary">
              {(Object.keys(availabilityLabels) as AvailabilityStatus[]).map((status) => (
                <div key={status}><AvailabilityBadge status={status} /><strong>{selectedAvailabilityCounts[status]}</strong></div>
              ))}
            </div>
          )}
          <div className="availability-table-scroll">
            {competitorMarket === "ALL" ? (
              <table className="availability-table">
                <thead>
                  <tr>
                    <th>Конкурент</th>
                    <th>Тип</th>
                    {data.markets.map((market) => <th key={market.code}>{market.code}<small>{market.name_ru}</small></th>)}
                  </tr>
                </thead>
                <tbody>
                  {globalCompetitors.map((item) => (
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
            ) : (
              <table className="availability-table focused-availability-table">
                <thead>
                  <tr>
                    <th>Конкурент</th>
                    <th>Тип</th>
                    <th>Статус</th>
                    <th>Сервис / аккаунт</th>
                    <th>Выпуск карты</th>
                    <th>Подтверждённый факт</th>
                    <th>Источники</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCompetitors.map((item) => {
                    const marketAvailability = getAvailability(item, competitorMarket);
                    return (
                      <tr key={item.provider}>
                        <td><strong>{item.provider}</strong></td>
                        <td><span>{item.profile}</span></td>
                        <td><AvailabilityBadge status={marketAvailability.status} /></td>
                        <td><strong className={`support-value ${marketAvailability.account === null ? "unknown" : marketAvailability.account ? "yes" : "no"}`}>{supportLabel(marketAvailability.account)}</strong></td>
                        <td><strong className={`support-value ${marketAvailability.card ? "yes" : "no"}`}>{supportLabel(marketAvailability.card)}</strong></td>
                        <td><p className="availability-note-cell">{marketAvailability.note}</p></td>
                        <td><div className="source-chips">{marketAvailability.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
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
                      <div className="selected-availability-sources">
                        <span>Источники по рынку</span>
                        <div className="source-chips">{selectedAvailability.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
                      </div>
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
                  <div className="source-chips">{item.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
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
                    {source && <SourceChip sourceId={source.id} />}
                    {"secondary_source_id" in item && item.secondary_source_id && <SourceChip sourceId={item.secondary_source_id} />}
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

      {tab === "respondents" && (
        <section className="respondents-layout">
          <article className="panel respondents-intro">
            <span className="section-kicker">ЭКСПЕРТНАЯ ПРОВЕРКА</span>
            <h2>Кто помог проверить рыночные гипотезы</h2>
            <p>В публичной версии показываются только роль и область опыта. Имена и контактные данные не раскрываются без отдельного подтверждения.</p>
            <div className="respondent-metrics"><div><strong>{completedRespondents.length}</strong><span>завершённых интервью</span></div><div><strong>{data.markets.length}</strong><span>рынков в охвате</span></div><div><strong>3</strong><span>критерия отбора</span></div></div>
          </article>
          <div className="respondent-criteria">
            <article><span>01</span><h3>Практический опыт</h3><p>Работа в финтехе, платежах, crypto/Web3 или запуске продуктов на релевантном рынке.</p></article>
            <article><span>02</span><h3>Рыночная близость</h3><p>Знание локальной инфраструктуры, регулирования, поведения пользователей или каналов входа.</p></article>
            <article><span>03</span><h3>Проверяемость</h3><p>Интервью используется как экспертный слой и не подменяет официальные цифры и документы.</p></article>
          </div>
          <div className="respondent-grid">
            {completedRespondents.map((respondent) => (
              <article className="panel respondent-card" key={respondent.id}>
                <div><span className="respondent-status">Интервью завершено</span><small>{respondent.scope === "cross_market" ? "несколько рынков" : "локальный рынок"}</small></div>
                <h3>{respondent.display_name}</h3>
                <p className="respondent-role">{respondent.role}</p>
                <dl><div><dt>Область опыта</dt><dd>{respondent.expertise}</dd></div><div><dt>Основание выбора</dt><dd>{respondent.selection_rationale}</dd></div><div><dt>Рынки</dt><dd>{respondent.market_codes.join(" · ")}</dd></div></dl>
                <div className="source-chips"><SourceChip sourceId={respondent.source_id} /></div>
              </article>
            ))}
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
              <div><span>02</span><strong>Предварительный потенциал</strong><p>Качественный вывод после интервью. Он не рассчитывается из APS, KAST Fit, силы потребности или сложности входа.</p></div>
              <div><span>03</span><strong>Исходная оценка APS</strong><p>Шесть баллов и их веса сохранены без изменений как отдельный справочный слой.</p></div>
              <div><span>04</span><strong>KAST / Product Fit</strong><p>Независимый расчёт использует инфляцию IMF, переводы World Bank, crypto rank Chainalysis и показатели Findex.</p></div>
              <div><span>05</span><strong>Регуляторная модель</strong><p>Отдельный статус показывает, возможен ли прямой запуск, нужен партнёр или допустима только ограниченная модель.</p></div>
              <div><span>06</span><strong>Интервью</strong><p>Экспертные свидетельства помечены отдельно, не имеют внешней ссылки и не подменяют официальные источники.</p></div>
            </div>
            <div className="formula-box"><code>Σ (балл критерия × вес) = итог из 5</code><p>Пример: Филиппины = 5×25% + 5×20% + 5×15% + 3×15% + 4×15% + 5×10% = <strong>4,55</strong>.</p></div>
            <div className="formula-box kast-formula"><code>KAST Fit = 30% USD need + 20% cross-border + 25% crypto audience + 15% mobile readiness + 10% access gap</code><p>Инфляция: 5 баллов от 25%, 4 от 10%, 3 от 5%, 2 от 3%, иначе 1. Cross-border — среднее баллов по абсолютному объёму переводов и доле ВВП. Crypto: top-10 = 5, #11–20 = 4, вне опубликованного top-20 = 2. Mobile readiness — среднее smartphone и recent internet use, делённое на 20. Access gap = (100% − account ownership) / 20.</p><p>Для Вьетнама входящие переводы 2024 рассчитаны как 3,4% от опубликованного World Bank ВВП 2024; это производное значение отмечено в данных.</p></div>
          </article>

          <article className="panel sources-card">
            <div className="panel-heading compact"><div><span className="section-kicker">SOURCE REGISTER</span><h2>{data.sources.length} базовых источников</h2></div></div>
            <div className="sources-list">
              {data.sources.map((source) => (
                <article key={source.id}>
                  <span className="source-tier">{source.tier.replaceAll("_", " ")}</span>
                  <strong>{source.title}</strong>
                  <p>{source.publisher} · {source.period}</p>
                  <small>Проверено {source.accessed}</small>
                  <SourceChip sourceId={source.id} />
                </article>
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
