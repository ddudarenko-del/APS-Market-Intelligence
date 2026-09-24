"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import acquisitionChannelMap from "./data/acquisition_channel_map.json";
import data from "./data/market_data.json";
import task5Conclusions from "./data/task5_conclusions.json";
import { type Language, translateCompositeText, translateText, translateTextNode } from "./localization";

type Tab = "overview" | "profiles" | "competition" | "cases" | "acquisition" | "respondents" | "data" | "method";
type MetricValue = { value: number; year: number } | null;
type UnifiedScore = (typeof data.unified_scoring.rows)[number];
type StrategicRating = (typeof data.strategic_ranking.rows)[number];
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

const translatableAttributes = ["aria-label", "title", "placeholder"] as const;
const marketConclusionItems = task5Conclusions.markets as Record<string, Array<{ title: string; body: string }>>;
const underMapInsights = [
  {
    title: "Больницы - новые центры диаспор",
    body: "В Канаде и UK крупные медицинские центры концентрируют филиппинских, индийских, нигерийских и карибских специалистов с регулярным международным доходом и переводами семье.",
  },
  {
    title: "Не таргетинг по стране, а охота за районами",
    body: "Mississauga, Brampton и Surrey - готовые кластеры диаспор и трансграничных денежных коридоров. Один район может быть ценнее национальной кампании.",
  },
  {
    title: "Женщины - не сегмент, а стартовая площадка",
    body: "На Филиппинах сообщества вокруг финансовой независимости могут стать соавторами продукта, первыми пользователями и каналом доверия к нему.",
  },
  {
    title: "Моряк подключает целую семью",
    body: "Партнёрство с судоходной компанией или крюинговым агентством приводит сразу двух пользователей: моряка, который получает зарплату, и семью, которая получает часть дохода на Филиппинах.",
  },
  {
    title: "Инновация вместо слова денег",
    body: "В Индонезии платёжное кольцо или другая заметная технология способна привлечь гораздо более широкую аудиторию, чем коммуникация внутри криптосообщества.",
  },
  {
    title: "Один студент - вход в семейный кошелёк",
    body: "Студент первым осваивает продукт для оплаты обучения или международных переводов, а затем подключает родителей и других родственников. Вход на рынок через студенческие сообщества (в том числе сообщества диаспор).",
  },
];

function useDomLocalization(language: Language) {
  const rootRef = useRef<HTMLElement>(null);
  const originalTextRef = useRef(new WeakMap<Text, string>());
  const originalAttributeRef = useRef(new WeakMap<Element, Map<string, string>>());

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    document.documentElement.lang = language;

    const localizeText = (node: Text) => {
      const current = node.nodeValue ?? "";
      if (/[А-Яа-яЁё]/.test(current)) originalTextRef.current.set(node, current);
      const source = originalTextRef.current.get(node) ?? current;
      const localized = language === "en" ? translateTextNode(source, language) : source;
      if (localized !== current) node.nodeValue = localized;
    };

    const localizeAttributes = (element: Element) => {
      let originals = originalAttributeRef.current.get(element);
      if (!originals) {
        originals = new Map<string, string>();
        originalAttributeRef.current.set(element, originals);
      }
      for (const attribute of translatableAttributes) {
        const current = element.getAttribute(attribute);
        if (!current) continue;
        if (/[А-Яа-яЁё]/.test(current)) originals.set(attribute, current);
        const source = originals.get(attribute) ?? current;
        const localized = language === "en" ? translateCompositeText(source, language) : source;
        if (localized !== current) element.setAttribute(attribute, localized);
      }
    };

    const localizeTree = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        localizeText(node as Text);
        return;
      }
      if (!(node instanceof Element)) return;
      if (node.matches("script, style")) return;
      localizeAttributes(node);
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) localizeText(current as Text);
        else if (current instanceof Element) localizeAttributes(current);
        current = walker.nextNode();
      }
    };

    localizeTree(root);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") localizeText(mutation.target as Text);
        if (mutation.type === "attributes" && mutation.target instanceof Element) localizeAttributes(mutation.target);
        mutation.addedNodes.forEach(localizeTree);
      }
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatableAttributes],
    });
    return () => observer.disconnect();
  }, [language]);

  return rootRef;
}

const tabLabels: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Обзор и итоги" },
  { id: "profiles", label: "Профили стран" },
  { id: "competition", label: "Конкуренты" },
  { id: "cases", label: "Кейсы" },
  { id: "acquisition", label: "Каналы продвижения" },
  { id: "respondents", label: "Респонденты" },
  { id: "data", label: "Данные" },
  { id: "method", label: "Методология" },
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

function formatMoney(metric: MetricValue, language: Language) {
  if (!metric) return translateText("нет данных", language);
  const locale = language === "en" ? "en-US" : "ru-RU";
  const billions = metric.value / 1_000_000_000;
  if (billions >= 1) return `$${billions.toLocaleString(locale, { maximumFractionDigits: 1 })} ${language === "en" ? "bn" : "млрд"}`;
  return `$${(metric.value / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 0 })} ${language === "en" ? "m" : "млн"}`;
}

function formatPct(metric: MetricValue, language: Language) {
  if (!metric) return translateText("нет данных", language);
  return `${metric.value.toLocaleString(language === "en" ? "en-US" : "ru-RU", { maximumFractionDigits: 2 })}%`;
}

function formatPeople(metric: MetricValue, language: Language) {
  if (!metric) return translateText("нет данных", language);
  const locale = language === "en" ? "en-US" : "ru-RU";
  return `${(metric.value / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })} ${language === "en" ? "m" : "млн"}`;
}

function getUnifiedScore(marketCode: string): UnifiedScore {
  return data.unified_scoring.rows.find((row) => row.market_code === marketCode) ?? data.unified_scoring.rows[0];
}

function getStrategicRating(marketCode: string): StrategicRating {
  return data.strategic_ranking.rows.find((row) => row.market_code === marketCode) ?? data.strategic_ranking.rows[0];
}

function getStrategicRatingClass(rating: string) {
  if (rating === "Priority Market") return "priority";
  if (rating === "Priority Subject to Licensing" || rating === "Conditional Opportunity") return "conditional";
  if (rating === "High-Potential, High-Risk Test") return "test";
  if (rating === "Secondary Opportunity") return "secondary";
  return "long-term";
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 4 ? "high" : score >= 3.4 ? "medium-high" : score >= 2.8 ? "mid" : "low";
  return <span className={`score-badge ${tone}`}>{score.toFixed(2)}</span>;
}

const confidenceLabels: Record<string, string> = {
  high: "Хорошо подтверждено",
  medium: "Требует дополнительной проверки",
  hypothesis: "Гипотеза",
};

const unifiedCriteria = data.unified_scoring.blocks.flatMap((block) => block.criteria);

function getUnifiedCriterion(key: string) {
  return unifiedCriteria.find((criterion) => criterion.key === key) ?? unifiedCriteria[0];
}

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

function getCountryStyle(code: string, visibleCodes: string[], selectedCode: string) {
  const unified = getUnifiedScore(code);
  const visible = visibleCodes.includes(code);
  const selected = code === selectedCode;
  const fillColor = unified.level === "high"
    ? "#40f785"
    : unified.level === "medium_high"
      ? "#b7d85c"
      : unified.level === "medium"
        ? "#f0cf57"
        : "#f29a52";
  return {
    color: selected ? "#d9ffe7" : "#82948a",
    weight: selected ? 2.4 : 1.2,
    fillColor,
    fillOpacity: visible ? (selected ? 1 : 0.86) : 0.16,
  };
}

function SourceChip({ sourceId, plain = false }: { sourceId: string; plain?: boolean }) {
  const source = data.sources.find((item) => item.id === sourceId);
  if (!source) return null;
  const label = source.type === "interview" ? "Экспертное интервью" : sourceLabelOverrides[sourceId] ?? source.publisher;
  if (plain || !source.url) {
    return <span className="source-chip interview-source" title={source.title}>{label}</span>;
  }
  return (
    <a href={source.url} target="_blank" rel="noreferrer" className="source-chip" title={`${source.publisher}: ${source.title}`}>
      {label}
    </a>
  );
}

function splitAudienceLead(paragraph: string) {
  const isGroupLead = /^(?:Группа \d+\.|Опция \d+\.|Первая(?: и [^—]+)? аудитория\s+—|Вторая аудитория\s+—|Третья(?: и [^—]+)? аудитория\s+—|Третья гипотеза\s+—|Четвертая гипотеза\s+—|Наиболее интересная гипотеза\s+—|Group \d+[.:]|Option \d+[.:]|First(?: and [^—]+)? audience\s+—|Second audience\s+—|Third(?: and [^—]+)? audience\s+—|Third hypothesis\s+—|Fourth hypothesis\s+—|Most promising hypothesis\s+—)/.test(paragraph);
  if (!isGroupLead) return null;
  const numberedPrefix = paragraph.match(/^(?:Группа \d+\.|Опция \d+\.|Group \d+[.:]|Option \d+[.:])\s*/)?.[0].length ?? 0;
  const sentenceEnd = paragraph.indexOf(". ", numberedPrefix);
  if (sentenceEnd === -1) return { title: paragraph, detail: "" };
  return {
    title: paragraph.slice(0, sentenceEnd + 1),
    detail: paragraph.slice(sentenceEnd + 2),
  };
}

function AudienceGroups({ paragraphs, language }: { paragraphs: string[]; language: Language }) {
  const intro: string[] = [];
  const groups: Array<{ title: string; details: string[] }> = [];
  let currentGroup: { title: string; details: string[] } | null = null;

  for (const sourceParagraph of paragraphs) {
    const paragraph = translateText(sourceParagraph, language);
    const lead = splitAudienceLead(paragraph);
    if (lead) {
      currentGroup = { title: lead.title, details: lead.detail ? [lead.detail] : [] };
      groups.push(currentGroup);
    } else if (currentGroup) {
      currentGroup.details.push(paragraph);
    } else {
      intro.push(paragraph);
    }
  }

  return (
    <div className="audience-content">
      {intro.map((paragraph, index) => <p className="audience-intro" key={`intro-${index}`}>{paragraph}</p>)}
      <div className="audience-groups">
        {groups.map((group, index) => (
          <article className="audience-group" key={`${group.title}-${index}`}>
            <h4>{group.title}</h4>
            {group.details.map((detail, detailIndex) => <p key={detailIndex}>{detail}</p>)}
          </article>
        ))}
      </div>
    </div>
  );
}

function RichInlineText({ source, language, allowLinks = true }: { source: string; language: Language; allowLinks?: boolean }) {
  const tokens = source.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s]+)/g).filter(Boolean);
  return tokens.map((token, index) => {
    const bold = token.match(/^\*\*([\s\S]+)\*\*$/);
    if (bold) return <strong key={index}>{translateTextNode(bold[1], language)}</strong>;
    const markdownLink = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (markdownLink) {
      if (!allowLinks) return <span key={index}>{translateTextNode(markdownLink[1], language)}</span>;
      return <a key={index} href={markdownLink[2]} target="_blank" rel="noreferrer">{translateTextNode(markdownLink[1], language)}</a>;
    }
    if (/^https?:\/\//.test(token)) return allowLinks ? <a key={index} href={token} target="_blank" rel="noreferrer">{token}</a> : null;
    return <span key={index}>{translateTextNode(token, language)}</span>;
  });
}

function RichReportContent({ paragraphs, language, allowLinks = true }: { paragraphs: string[]; language: Language; allowLinks?: boolean }) {
  return (
    <div className="report-rich-content" role="list">
      {paragraphs.map((source, index) => {
        const marker = source.match(/^::(h|p|b([0-3]))::([\s\S]*)$/);
        const kind = marker?.[1] ?? "p";
        const level = marker?.[2] ? Number(marker[2]) : 0;
        const content = marker?.[3] ?? source;
        if (kind === "h") return <h4 className="report-rich-heading" key={index}><RichInlineText source={content} language={language} allowLinks={allowLinks} /></h4>;
        if (kind === "p") return <p className="report-rich-paragraph" key={index}><RichInlineText source={content} language={language} allowLinks={allowLinks} /></p>;
        return (
          <div className={`report-rich-bullet level-${level}`} role="listitem" aria-level={level + 1} key={index}>
            <span className="report-rich-marker" aria-hidden="true">{level >= 2 ? "–" : "•"}</span>
            <p><RichInlineText source={content} language={language} allowLinks={allowLinks} /></p>
          </div>
        );
      })}
    </div>
  );
}

function StrategicDetail({ text }: { text: string }) {
  const separator = text.indexOf(":");
  if (separator < 0) return <>{text}</>;
  return (
    <>
      <strong>{text.slice(0, separator)}</strong>
      {" "}<span>{text.slice(separator + 1).trim()}</span>
    </>
  );
}

function getRegulatoryConstraintHtml(language: Language, countryName: string) {
  const marker = '<p class="acq-bullet"><strong>';
  const segment = acquisitionChannelMap.global.guardrails[language]
    .split(marker)
    .slice(1)
    .find((item) => item.startsWith(`${countryName}</strong>`));
  return segment ? `${marker}${segment}` : "";
}

function removeAcquisitionEvidenceMarkers(html: string) {
  return html.replace(/[★✓△]\s*/g, "");
}

function MarketMap({
  selectedCode,
  visibleCodes,
  onSelect,
  overlay,
}: {
  selectedCode: string;
  visibleCodes: string[];
  onSelect: (code: string) => void;
  overlay?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").GeoJSON | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedCodeRef = useRef(selectedCode);
  const visibleCodesRef = useRef(visibleCodes);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    selectedCodeRef.current = selectedCode;
    visibleCodesRef.current = visibleCodes;
  }, [selectedCode, visibleCodes]);

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
          zoomSnap: 0,
          zoomControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          touchZoom: false,
          worldCopyJump: false,
          attributionControl: false,
        });
        mapRef.current = map;

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
            const selectCountry = () => onSelectRef.current(code);
            const highlightCountry = () => {
              countryLayer.bringToFront();
              countryLayer.setStyle({ color: "#effff4", weight: 3, fillOpacity: 1 });
            };
            const resetCountryHighlight = () => {
              countryLayer.setStyle(getCountryStyle(code, visibleCodesRef.current, selectedCodeRef.current));
            };
            countryLayer.on("click", selectCountry);
            countryLayer.on("mouseover", highlightCountry);
            countryLayer.on("mouseout", resetCountryHighlight);
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
              });
            });
          },
        }).addTo(map);
        layerRef.current = layer;
        const worldBounds: import("leaflet").LatLngBoundsExpression = [[-56, -168], [76, 178]];
        const fitMapToFrame = () => {
          map.invalidateSize({ animate: false });
          map.fitBounds(worldBounds, { padding: [22, 22], animate: false });
        };
        fitMapToFrame();
        const resizeObserver = new ResizeObserver(fitMapToFrame);
        resizeObserver.observe(containerRef.current);
        map.once("unload", () => resizeObserver.disconnect());
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
  }, []);

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
      countryLayer.setStyle(getCountryStyle(code, [...visibleSet], selectedCode));
    });
  }, [selectedCode, visibleCodes]);

  const setLabelHighlight = (code: string, active: boolean) => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.eachLayer((layerItem: import("leaflet").Layer) => {
      const countryLayer = layerItem as CountryLayer;
      if (countryLayer.feature?.properties?.ADM0_A3 !== code) return;
      if (active) {
        countryLayer.bringToFront();
        countryLayer.setStyle({ color: "#effff4", weight: 3, fillOpacity: 1 });
        return;
      }
      countryLayer.setStyle(getCountryStyle(code, visibleCodesRef.current, selectedCodeRef.current));
    });
  };

  return (
    <div className="map-frame">
      <div ref={containerRef} className="real-map" aria-label="Карта рынков APS" />
      {mapStatus === "ready" && (
        <div className="map-label-layer" aria-label="Рынки на карте">
          {data.markets.filter((market) => visibleCodes.includes(market.code)).map((market) => (
            <button
              type="button"
              key={market.code}
              className={`map-label-card map-label-card-${market.code.toLowerCase()}${selectedCode === market.code ? " is-selected" : ""}`}
              onClick={() => onSelect(market.code)}
              onMouseEnter={() => setLabelHighlight(market.code, true)}
              onMouseLeave={() => setLabelHighlight(market.code, false)}
              onFocus={() => setLabelHighlight(market.code, true)}
              onBlur={() => setLabelHighlight(market.code, false)}
              aria-label={`Выбрать рынок: ${market.name_ru}`}
            >
              <strong>{market.name_ru}</strong>
              <small>{getStrategicRating(market.code).hashtags.join(" ")}</small>
            </button>
          ))}
        </div>
      )}
      {mapStatus === "loading" && <div className="map-state">Загружаем границы стран...</div>}
      {mapStatus === "error" && <div className="map-state error">Карта временно недоступна</div>}
      {overlay}
    </div>
  );
}

export function MarketDashboard() {
  const [language, setLanguage] = useState<Language>("ru");
  const localizationRootRef = useDomLocalization(language);
  const locale = language === "en" ? "en-US" : "ru-RU";
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedCode, setSelectedCode] = useState("PHL");
  const [competitorMarket, setCompetitorMarket] = useState("ALL");
  const [strategicOverlayOpen, setStrategicOverlayOpen] = useState(false);

  const selected = data.markets.find((market) => market.code === selectedCode) ?? data.markets[0];
  const selectedAssessment = data.market_assessments.find((item) => item.market_code === selected.code) ?? data.market_assessments[0];
  const selectedUnified = getUnifiedScore(selected.code);
  const selectedStrategic = getStrategicRating(selected.code);
  const selectedReport = data.market_reports.find((item) => item.market_code === selected.code) ?? data.market_reports[0];
  const visibleMarkets = data.markets;
  const selectedAcquisition = data.acquisition_channels.rows.find((row) => row.market_code === selected.code) ?? data.acquisition_channels.rows[0];
  const selectedAcquisitionDocument = acquisitionChannelMap.markets[selected.code as keyof typeof acquisitionChannelMap.markets] ?? acquisitionChannelMap.markets.PHL;
  const selectedRegulatoryConstraintHtml = getRegulatoryConstraintHtml(language, selectedAcquisitionDocument.name[language]);
  const selectedAcquisitionDocumentHtml = removeAcquisitionEvidenceMarkers(selectedAcquisitionDocument[language]);
  const selectedCompetition = competitorMarket === "ALL" ? null : data.competition_by_market.find((item) => item.market_code === competitorMarket) ?? null;
  const selectedCompetitionAssessment = competitorMarket === "ALL" ? null : data.market_assessments.find((item) => item.market_code === competitorMarket) ?? null;
  const globalCompetitors = data.market_competitors.filter((item) => item.scope === "global" && item.availability);
  const strategicallyOrderedVisibleMarkets = [...visibleMarkets].sort((a, b) => {
    const aPosition = data.strategic_ranking.rows.findIndex((row) => row.market_code === a.code);
    const bPosition = data.strategic_ranking.rows.findIndex((row) => row.market_code === b.code);
    return aPosition - bPosition;
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
  const marketCaseRows = data.markets.map((market) => ({
    market,
    assessment: data.market_assessments.find((assessment) => assessment.market_code === market.code) ?? data.market_assessments[0],
  }));
  const completedRespondents = data.respondents.filter((item) => item.status === "completed");

  function chooseMarket(code: string, nextTab?: Tab) {
    setSelectedCode(code);
    if (nextTab) setTab(nextTab);
  }

  function chooseOverviewMarket(code: string) {
    setSelectedCode(code);
    setStrategicOverlayOpen(true);
  }

  return (
    <main ref={localizationRootRef} className="app-shell">
      <header className="hero hero-compact">
        <div className="hero-topline">
          {/* The same component is built by Next/vinext and standalone Vite for Hostinger. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="aps-logo" src="/brand/aps-logo.svg" alt="APS" width={132} height={52} />
          <div className="hero-actions">
            <span className="update-stamp">Исследование обновлено 23.09.2026</span>
            <div className="language-switch" role="group" aria-label="Выбор языка">
              <button type="button" className={language === "ru" ? "active" : ""} aria-pressed={language === "ru"} onClick={() => setLanguage("ru")}>RU</button>
              <button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
            </div>
          </div>
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
            <div><strong>{data.metadata.interviews_conducted}</strong><span>экспертных интервью</span></div>
            <div><strong>{data.sources.length}</strong><span>источников</span></div>
          </div>
        </div>
      </header>

      <div className="tabs-shell">
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
      </div>

      {tab === "overview" && (
        <>
        <section className="content-grid overview-grid">
          <div className="panel atlas-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">MARKET ATLAS</span>
                <h2>Исследование рыночного потенциала криптофинансовой платформы для платежей и управления цифровыми активами с функцией выпуска крипто-связанных платежных карт</h2>
              </div>
            </div>
            <MarketMap
              selectedCode={selectedCode}
              visibleCodes={visibleMarkets.map((market) => market.code)}
              onSelect={chooseOverviewMarket}
              overlay={strategicOverlayOpen ? (
                <article className="panel strategic-market-panel strategic-market-overlay" aria-live="polite">
                  <button type="button" className="strategic-overlay-close" aria-label="Закрыть описание выбранного рынка" onClick={() => setStrategicOverlayOpen(false)}>×</button>
                  <div className="strategic-market-heading">
                    <div>
                      <span className="section-kicker">ВЫБРАННЫЙ РЫНОК</span>
                      <h2>{selected.name_ru}</h2>
                    </div>
                    <span className={`strategic-rating-label ${getStrategicRatingClass(selectedStrategic.rating)}`}>{selectedStrategic.rating}</span>
                  </div>
                  <ul className="strategic-market-details">
                    {(language === "en" ? selectedStrategic.details_en : selectedStrategic.details_ru).map((item) => <li key={item}><StrategicDetail text={item} /></li>)}
                  </ul>
                </article>
              ) : null}
            />
          </div>

          <aside className="panel ranking-panel">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">РЫНКИ</span>
                <h2>Рейтинг</h2>
              </div>
              <span className="count-pill">8 рынков</span>
            </div>
            <div className="ranking-columns" aria-hidden="true">
              <span>Страна</span>
              <span>Базовый</span>
              <span>Стратегический</span>
            </div>
            <div className="ranking-list">
              {strategicallyOrderedVisibleMarkets.map((market) => (
                <button key={market.code} type="button" onClick={() => chooseOverviewMarket(market.code)} className={selectedCode === market.code ? "active" : ""}>
                  <span className="rank-country">
                    <span className="rank-number">{data.strategic_ranking.rows.findIndex((row) => row.market_code === market.code) + 1}</span>
                    <span className="rank-name"><strong>{market.name_ru}</strong><small>{market.region}</small></span>
                  </span>
                  <ScoreBadge score={getUnifiedScore(market.code).final_score} />
                  <span className={`strategic-rating-label ${getStrategicRatingClass(getStrategicRating(market.code).rating)}`}>{getStrategicRating(market.code).rating}</span>
                </button>
              ))}
            </div>
            <p className="strategic-rating-note">
              Стратегический рейтинг был сформирован на стратегической сессии с командой 14 сентября. Он учитывает готовность выходить на рынки со сложным регулированием, ограничениями на рекламу и высокими требованиями к лицензированию ради более значимых возможностей.
            </p>
          </aside>
        </section>
        <section className="conclusions-layout overview-conclusions">
          <article className="panel research-conclusion">
            <span className="section-kicker">ИТОГ ИССЛЕДОВАНИЯ</span>
            <h2>Универсальный аналог KAST не дает достаточного отличия</h2>
            <p>Карта, долларовый счет, хранение стейблкоинов и базовая конвертация уже воспринимаются как стандартный набор. Возможность возникает вокруг конкретной аудитории, незакрытой задачи и измеримого преимущества: курса, комиссии, доходности, локальной функции, платежного маршрута, налогового сопровождения или упрощения сложного финансового сценария.</p>
          </article>
          <div className="research-observations">
            {[
              ["Главный спрос - трансграничные деньги", "Зарубежный доход, семейные переводы и международные специалисты дают наиболее понятные сценарии."],
              ["Базовый продукт больше не отличает", "В выигрыше может оказаться продукт, который не заменяет GCash, QRIS или локальный банк, а становится для них «входом глобальных денег». На Филиппинах и в Индонезии это особенно выражено."],
              ["Переключение требует ощутимой выгоды", "Пользователь должен видеть лучший курс, меньшую комиссию или локальную функцию."],
              ["Регулирование и партнеры определяют реальный вход", "Потенциал спроса нельзя оценивать отдельно от разрешенной модели запуска."],
            ].map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
          <section className="panel cross-market-insights">
            <div className="conclusions-section-heading">
              <div>
                <span className="section-kicker">СКВОЗНЫЕ ИНСАЙТЫ</span>
                <h2>Что повторяется между рынками</h2>
              </div>
              <span className="count-pill">8 выводов</span>
            </div>
            <div className="cross-market-insights-grid">
              {task5Conclusions.cross_market.map((insight, index) => (
                <article key={insight.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{insight.title}</h3>
                    <p>{insight.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="panel under-map-insights" aria-labelledby="under-map-insights-title">
            <div className="under-map-insights-heading">
              <span className="section-kicker">ТОЧКИ ВХОДА</span>
              <h2 id="under-map-insights-title">Неочевидные точки входа на рынок</h2>
            </div>
            <div className="under-map-insights-list">
              {underMapInsights.map((insight) => (
                <article key={insight.title}>
                  <h3>{insight.title}</h3>
                  <p>{insight.body}</p>
                </article>
              ))}
            </div>
          </section>
        </section>
        </>
      )}
      {tab === "acquisition" && (
        <section className="acquisition-layout">
          <article className="panel acquisition-first-wave">
            <span className="section-kicker">{language === "en" ? "RECOMMENDED START" : "РЕКОМЕНДУЕМЫЙ СТАРТ"}</span>
            <h2>{language === "en" ? "Recommended first outreach wave" : "Рекомендуемая первая волна контактов"}</h2>
            <p>{language === "en" ? "Select up to five channels in each relevant market: 1) one high-intent payment audience, 2) one crypto or fintech publication, 3) one migrant, diaspora or freelancer community, 4) one current event, and 5) one unusual offline activation. In Canada and the United Kingdom, select the high-intent audience and community within a specific diaspora corridor. This creates a balanced test of intent, credibility, scale and local cultural relevance without over-investing in broad reach." : "Выберите до пяти каналов на каждом релевантном рынке: 1) один сегмент платежной аудитории с высокими намерениями, 2) одно издание о криптовалютах или финансовых технологиях, 3) одно сообщество мигрантов, диаспоры или фрилансеров, 4) одно текущее событие и 5) одну необычную офлайн-активацию. В Канаде и Соединенном Королевстве аудиторию с высоким намерением и сообщество следует выбирать внутри конкретного коридора диаспоры. Это создает сбалансированную проверку намерений, достоверности, масштаба и местной культурной значимости без чрезмерных инвестиций в широкий охват."}</p>
          </article>

          <div className="acquisition-market-picker" aria-label={language === "en" ? "Select a market for channel analysis" : "Выбор рынка для анализа каналов"}>
            {data.markets.map((market) => (
              <button key={market.code} type="button" className={selected.code === market.code ? "active" : ""} onClick={() => chooseMarket(market.code)}>
                <span>{market.code}</span>{market.name_ru}
              </button>
            ))}
          </div>

          <article className="panel acquisition-map-intro">
            <div className="acquisition-map-title">
              <div>
                <span className="section-kicker">{language === "en" ? "UPDATED PROMOTION CHANNEL MAP · 2026" : "ОБНОВЛЁННАЯ КАРТА КАНАЛОВ ПРОДВИЖЕНИЯ · 2026"}</span>
              </div>
              <div className="acquisition-map-count"><strong>{acquisitionChannelMap.meta.markets_count}</strong><span>{language === "en" ? "markets" : "рынков"}</span></div>
            </div>
          </article>

          <article className="panel acquisition-document-market">
            <div className="acquisition-document-head">
              <div>
                <span className="section-kicker">{selected.code} · {language === "en" ? "FULL PROMOTION CHANNEL MAP" : "ПОЛНАЯ КАРТА КАНАЛОВ ПРОДВИЖЕНИЯ"}</span>
                <h2>{selectedAcquisitionDocument.name[language]}</h2>
              </div>
            </div>
            <div className="acquisition-country-context">
              <div className="acquisition-country-head">
                <div>
                  <span className="section-kicker">{language === "en" ? "MARKET CONTEXT" : "КОНТЕКСТ РЫНКА"}</span>
                  <p>{selectedAcquisition.entry_mix}</p>
                </div>
                <div className="acquisition-source-date">Проверено<br /><strong>{data.acquisition_channels.checked_at}</strong></div>
              </div>

              <div className="acquisition-decision-grid">
                <div className="acquisition-decision-lead"><span>Что важнее на этом рынке</span><strong>{selectedAcquisition.strategy.decision.priority}</strong></div>
                <div><span>Брендинг</span><strong>{selectedAcquisition.strategy.decision.brand_level}</strong><p>{selectedAcquisition.strategy.decision.brand}</p></div>
                <div><span>Каналы продаж</span><strong>{selectedAcquisition.strategy.decision.sales_level}</strong><p>{selectedAcquisition.strategy.decision.sales}</p></div>
                <div className="acquisition-decision-avoid"><span>Не использовать как основу</span><p>{selectedAcquisition.strategy.decision.avoid}</p><div className="source-chips">{selectedAcquisition.strategy.decision.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div></div>
              </div>

              <div className="acquisition-profile-evidence">
                <div className="acquisition-profile-evidence-head"><span className="section-kicker">ИЗ ПРОФИЛЯ И ИНТЕРВЬЮ</span><h3>Конкретные основания решения</h3></div>
                <div className="acquisition-profile-evidence-list">
                  {selectedAcquisition.strategy.profile_evidence.map((item, index) => (
                    <article key={item.point}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        {"title" in item && Boolean(item.title) && <strong className="acquisition-evidence-title">{String(item.title)}</strong>}
                        <p>{item.point}</p>
                        <div className="source-chips">{item.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="acquisition-reach-grid">
                <div><span>Пользователи интернета</span><strong>{selectedAcquisition.digital_reach.internet_users_m.toLocaleString(locale)} млн</strong><small>январь 2025</small></div>
                <div><span>Активные профили в соцсетях</span><strong>{selectedAcquisition.digital_reach.social_identities_m.toLocaleString(locale)} млн</strong><small>{selectedAcquisition.digital_reach.social_pct_population.toLocaleString(locale)}% населения</small></div>
                <div><span>Рекламная аудитория Facebook</span><strong>{selectedAcquisition.digital_reach.facebook_ad_m.toLocaleString(locale)} млн</strong><small>потенциальный охват</small></div>
                <div><span>Рекламная аудитория YouTube</span><strong>{selectedAcquisition.digital_reach.youtube_ad_m.toLocaleString(locale)} млн</strong><small>потенциальный охват</small></div>
                <div><span>Рекламная аудитория TikTok 18+</span><strong>{selectedAcquisition.digital_reach.tiktok_adult_ad_m.toLocaleString(locale)} млн</strong><small>потенциальный охват</small></div>
              </div>

              <div className="acquisition-regulatory-point">
                <div>
                  <span className="section-kicker">{language === "en" ? "MARKET CONSTRAINT" : "ОГРАНИЧЕНИЕ РЫНКА"}</span>
                  <h3>{language === "en" ? "Regulatory constraints" : "Регуляторные ограничения"}</h3>
                </div>
                <div className="acquisition-regulatory-copy" dangerouslySetInnerHTML={{ __html: selectedRegulatoryConstraintHtml }} />
              </div>
            </div>

            <div className="acquisition-channels-heading">
              <div>
                <span className="section-kicker">{language === "en" ? "DETAILED CHANNEL LIST" : "ПОДРОБНЫЙ СПИСОК КАНАЛОВ"}</span>
                <h3>{language === "en" ? "Audiences, communities and activation points" : "Аудитории, сообщества и точки активации"}</h3>
              </div>
              <p>{language === "en" ? "The complete country-specific channel map follows below." : "Ниже приведена полная карта каналов для выбранной страны."}</p>
            </div>
            <div className="acquisition-source-content" dangerouslySetInnerHTML={{ __html: selectedAcquisitionDocumentHtml }} />
          </article>

          <section className="acquisition-document-global" aria-label={language === "en" ? "Channel-map rules" : "Общие правила карты каналов"}>
            <article className="panel acquisition-global-card" dangerouslySetInnerHTML={{ __html: acquisitionChannelMap.global.exclude[language] }} />
          </section>
        </section>
      )}

      {tab === "cases" && (
        <section className="cases-layout">
          <article className="panel cases-intro">
            <div>
              <span className="section-kicker">КЕЙСЫ И УРОКИ</span>
              <h2>{data.case_lessons.title}</h2>
              <p>{data.case_lessons.intro}</p>
            </div>
            <div className="cases-intro-metrics" aria-label="Состав анализа">
              <div><strong>{data.case_lessons.supporting_cases.length + marketCaseRows.length * 2}</strong><span>кейсов и примеров</span></div>
            </div>
          </article>

          <article className="panel primary-case">
            <div className="primary-case-heading">
              <div>
                <span className="case-evidence-type">{data.case_lessons.primary_case.evidence_type}</span>
                <h2>{data.case_lessons.primary_case.company}</h2>
                <p>{data.case_lessons.primary_case.title}</p>
              </div>
              <div className="source-chips">{data.case_lessons.primary_case.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
            </div>

            <div className="case-trajectory">
              {[data.case_lessons.primary_case.proof, data.case_lessons.primary_case.expansion].map((stage, index) => (
                <article key={stage.market} className={index === 0 ? "worked" : "stopped"}>
                  <div className="case-stage-topline"><span>{stage.label}</span><strong>{stage.market}</strong></div>
                  <h3>{stage.headline}</h3>
                  <p>{stage.body}</p>
                  <small>{stage.status}</small>
                </article>
              ))}
            </div>

            <div className="case-reasons-heading">
              <span className="section-kicker">ПОЧЕМУ НЕ СОСТОЯЛСЯ ВЫХОД В LATAM</span>
              <h3>Шесть ограничений, которые сложились в один стоп-сценарий</h3>
            </div>
            <div className="case-reasons-grid">
              {data.case_lessons.primary_case.reasons.map((reason, index) => (
                <article key={reason.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><h4>{reason.title}</h4><p>{reason.body}</p></div>
                </article>
              ))}
            </div>
            <div className="case-main-lesson"><span>Главный урок</span><p>{data.case_lessons.primary_case.lesson}</p></div>
          </article>

          <div className="cases-section-heading">
            <div><span className="section-kicker">ДОПОЛНИТЕЛЬНЫЕ ПРИМЕРЫ</span><h2>Что сработало — и что остановило рост</h2></div>
            <p>Факт или свидетельство отделены от аналитического вывода APS.</p>
          </div>
          <div className="supporting-cases-grid">
            {data.case_lessons.supporting_cases.map((study) => (
              <article className="panel supporting-case" key={`${study.company}-${study.market}`}>
                <div className="supporting-case-topline"><span>{study.evidence_type}</span><strong>{study.market}</strong></div>
                <h3>{study.company}</h3>
                <div className="case-fact"><span>Что произошло</span><p>{study.outcome}</p></div>
                <div className="case-fact constraint"><span>{study.constraint_label ?? "Что ограничило результат"}</span><p>{study.constraint}</p></div>
                <div className="source-chips">{study.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
                <div className="case-fact lesson"><span>Урок для нового игрока</span><p>{study.lesson}</p></div>
              </article>
            ))}
          </div>

          <div className="cases-section-heading market-cases-heading">
            <div><span className="section-kicker">КЕЙСЫ ПО РЫНКАМ</span><h2>Барьеры и драйверы в реальных запусках</h2></div>
            <p>По каждой стране собраны подтверждённые примеры того, что сработало и что ограничило результат.</p>
          </div>
          <div className="market-cases-list">
            {marketCaseRows.map(({ market, assessment }, index) => (
              <details className="panel market-cases-market" key={market.code} open={index === 0}>
                <summary>
                  <div className="market-cases-title">
                    <span>{market.code} / {market.region}</span>
                    <h3>{market.name_ru}</h3>
                  </div>
                  <div className="market-case-signals" aria-label="Контекст рынка">
                    <span><small>Сила потребности</small><strong>{assessment.need.score} / 5</strong></span>
                    <span><small>Сложность входа</small><strong>{assessment.entry_complexity.score} / 5</strong></span>
                  </div>
                  <div className="market-case-names">
                    <span><small>Сработало</small><strong>{market.case_studies.success.company}</strong></span>
                    <span><small>Ограничило результат</small><strong>{market.case_studies.failure.company}</strong></span>
                  </div>
                  <span className="market-cases-toggle" aria-hidden="true">+</span>
                </summary>
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
                <div className="market-cases-footer">
                  <p><strong>Условие входа:</strong> {assessment.entry_condition}</p>
                  <button type="button" onClick={() => chooseMarket(market.code, "profiles")}>Открыть профиль</button>
                </div>
              </details>
            ))}
          </div>

          <article className="panel case-patterns">
            <div className="cases-section-heading compact">
              <div><span className="section-kicker">ПОВТОРЯЮЩИЕСЯ ПРИЧИНЫ НЕУДАЧ</span><h2>Что проверять до выбора рынка</h2></div>
            </div>
            <div className="case-patterns-grid">
              {data.case_lessons.patterns.map((pattern, index) => (
                <article key={pattern.title}><span>0{index + 1}</span><h3>{pattern.title}</h3><p>{pattern.body}</p></article>
              ))}
            </div>
          </article>
        </section>
      )}

      {tab === "profiles" && (
        <section className="profiles-layout">
          <aside className="panel profile-nav">
            <span className="section-kicker">COUNTRY PROFILES</span>
            {data.markets.map((market) => (
              <button key={market.code} type="button" className={selectedCode === market.code ? "active" : ""} onClick={() => chooseMarket(market.code)}>
                <span>{market.code}</span><strong>{market.name_ru}</strong><small>{getUnifiedScore(market.code).final_score.toFixed(2)}</small>
              </button>
            ))}
          </aside>

          <article className="panel profile-detail">
            <div className="profile-hero">
              <div><span className="section-kicker">{selected.region} · {selected.currency}</span><h2>{selected.name_ru}</h2><p>{selectedAssessment.headline}</p></div>
              <div className="profile-rating-stack">
                <span className={`attractiveness-badge ${selectedUnified.level}`}>{selectedUnified.label} · {selectedUnified.final_score.toFixed(2)} / 5</span>
                <span className={`strategic-rating-label ${getStrategicRatingClass(selectedStrategic.rating)}`}>{selectedStrategic.rating}</span>
              </div>
            </div>
            <div className="profile-assessment-grid">
              <div><span>Итоговая привлекательность</span><strong>{selectedUnified.final_score.toFixed(2)} / 5</strong><p>{selectedUnified.label}</p></div>
              <div><span>Ограничитель</span><strong>{selectedUnified.gate ? `до ${selectedUnified.gate.cap.toFixed(2)}` : "Нет"}</strong><p>{selectedUnified.gate?.explanation ?? "Итог равен взвешенному расчёту без верхнего ограничения."}</p></div>
              <div><span>Незакрытая задача</span><p>{selectedAssessment.market_gap}</p></div>
              <div><span>Условие входа</span><p>{selectedAssessment.entry_condition}</p></div>
              <div><span>Приоритетная аудитория</span><p>{selectedAssessment.priority_audience}</p></div>
              <div><span>Основное сообщение</span><p>{selectedAssessment.core_message}</p></div>
            </div>
            <section className="profile-strategic-context">
              <div className="profile-strategic-heading">
                <div>
                  <span className="section-kicker">СТРАТЕГИЧЕСКИЙ КОНТЕКСТ</span>
                  <h3>Полная информация из обзора</h3>
                </div>
                <div className="profile-strategic-hashtags" aria-label="Хештеги рынка">
                  {selectedStrategic.hashtags.map((hashtag) => <span key={hashtag}>{hashtag}</span>)}
                </div>
              </div>
              <ul>
                {(language === "en" ? selectedStrategic.details_en : selectedStrategic.details_ru).map((item) => (
                  <li key={item}><StrategicDetail text={item} /></li>
                ))}
              </ul>
            </section>
            <div className="profile-confidence"><strong>Уровень подтверждения: {confidenceLabels[selectedAssessment.confidence]}</strong><div className="source-chips">{selectedAssessment.source_ids.map((id) => <SourceChip key={id} sourceId={id} plain />)}</div></div>
            <section className="profile-market-findings">
              <span className="section-kicker">ВЫВОДЫ ПО РЫНКУ</span>
              <h3>Продуктовые и коммуникационные направления</h3>
              <ul>
                {(marketConclusionItems[selected.code] ?? []).map((item) => (
                  <li key={`${selected.code}-${item.title}`}>
                    <strong>{item.title}</strong>{item.body ? <>{/^[,.;:!?]/.test(item.body) ? "" : " "}{item.body}</> : null}
                  </li>
                ))}
              </ul>
            </section>
            <div className="market-report">
              {selectedReport.sections.map((section, index) => (
                <section className="market-report-section" key={section.id}>
                  <span className="report-index">0{index + 1}</span><div><h3>{section.title}</h3>{section.paragraphs.some((paragraph) => paragraph.startsWith("::")) ? <RichReportContent paragraphs={section.paragraphs} language={language} allowLinks={false} /> : section.id === "audience" ? <AudienceGroups paragraphs={section.paragraphs} language={language} /> : section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}<div className="source-chips">{section.source_ids.map((id) => <SourceChip key={id} sourceId={id} plain />)}</div></div>
                </section>
              ))}
            </div>
            <div className="numbers-strip">
              <div><span>Переводы</span><strong>{formatMoney(selected.metrics.remittance_in_usd, language)}</strong><small>{selected.metrics.remittance_in_usd?.year}</small></div>
              <div><span>Инфляция</span><strong>{selected.metrics.imf_weo.inflation_2025_pct.toFixed(1)}%</strong><small>IMF 2025</small></div>
              <div><span>Account ownership</span><strong>{selected.metrics.findex_2024.account_ownership_pct.toFixed(1)}%</strong><small>Findex 2024</small></div>
              <div><span>Crypto rank</span><strong>{selected.metrics.chainalysis_rank_2025 ? `#${selected.metrics.chainalysis_rank_2025}` : ">20"}</strong><small>Chainalysis 2025</small></div>
            </div>
            <div className="case-studies-section">
              <div className="case-studies-heading">
                <div><span className="section-kicker">ПОДТВЕРЖДЁННЫЕ КЕЙСЫ</span><h3>Что уже работает или не работает</h3></div>
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
                      <div className="source-chips">{study.source_ids.map((id) => <SourceChip key={id} sourceId={id} plain />)}</div>
                    </article>
                  );
                })}
              </div>
            </div>
            <div className="regulatory-section">
              <div><span className="section-kicker">REGULATORY GATE</span><h3>{gateLabels[selected.regulatory.gate]}</h3><p>{selected.regulatory.status}</p></div>
              <div className="source-chips">{selected.regulatory.source_ids.map((id) => <SourceChip key={id} sourceId={id} plain />)}</div>
            </div>
            <div className="profile-fit-section unified-score-detail">
              <div className="unified-score-intro"><span className="section-kicker">ЕДИНАЯ ОЦЕНКА</span><h3>{selectedUnified.final_score.toFixed(2)} / 5 · {selectedUnified.label}</h3><p>{data.unified_scoring.formula}</p></div>
              <div className="unified-block-summary">
                {data.unified_scoring.blocks.map((block) => (
                  <div key={block.key}><span>{block.label}</span><strong>{selectedUnified.block_scores[block.key as keyof UnifiedScore["block_scores"]].toFixed(2)}</strong><small>{Math.round(block.weight * 100)}% итога</small></div>
                ))}
              </div>
              <div className="unified-criteria-list">
                {Object.entries(selectedUnified.components).map(([key, component]) => {
                  const criterion = getUnifiedCriterion(key);
                  return (
                    <article key={key}>
                      <div className="unified-criterion-head"><strong>{criterion.label}</strong><span>{component.score.toFixed(1)} / 5</span></div>
                      <div className="unified-criterion-bar"><i style={{ width: `${component.score * 20}%` }} /></div>
                      <p>{component.evidence}</p>
                      <div className="source-chips">{component.source_ids.map((id) => <SourceChip key={id} sourceId={id} plain />)}</div>
                    </article>
                  );
                })}
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
            <p>Имена приведены в формате «имя + инициал фамилии». Контактные данные не публикуются; роль и опыт переведены на русский с сохранением конкретики интервью.</p>
            <div className="respondent-metrics"><div><strong>{data.metadata.interviews_conducted}</strong><span>завершённых интервью</span></div><div><strong>{data.markets.length}</strong><span>рынков в охвате</span></div><div><strong>3</strong><span>критерия отбора</span></div></div>
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
                <dl><div><dt>Область опыта</dt><dd>{respondent.expertise}</dd></div><div><dt>Почему включён в исследование</dt><dd>{respondent.selection_rationale}</dd></div><div><dt>Рынки</dt><dd>{respondent.market_codes.map((code) => data.markets.find((market) => market.code === code)?.name_ru ?? code).join(" · ")}</dd></div></dl>
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
              <thead><tr><th>Рынок</th><th>Итог</th><th>Потребность</th><th>Коммерческий потенциал</th><th>Реализуемость входа</th><th>Входящие переводы</th><th>% ВВП</th><th>Население</th><th>Интернет</th><th>Account ownership</th><th>Digital payments</th><th>Smartphone</th><th>Инфляция 2025</th><th>Crypto rank</th></tr></thead>
              <tbody>
                {data.markets.map((market) => {
                  const unified = getUnifiedScore(market.code);
                  return <tr key={market.code} onClick={() => chooseMarket(market.code, "profiles")}>
                    <td><strong>{market.name_ru}</strong><small>{market.code}</small></td>
                    <td>{unified.final_score.toFixed(2)}<small>{unified.label}</small></td>
                    <td>{unified.block_scores.product_need.toFixed(2)}<small>35%</small></td>
                    <td>{unified.block_scores.commercial_viability.toFixed(2)}<small>30%</small></td>
                    <td>{unified.block_scores.entry_feasibility.toFixed(2)}<small>35%</small></td>
                    <td>{formatMoney(market.metrics.remittance_in_usd, language)}<small>{market.metrics.remittance_in_usd?.year}</small></td>
                    <td>{formatPct(market.metrics.remittance_pct_gdp, language)}<small>{market.metrics.remittance_pct_gdp?.year}</small></td>
                    <td>{formatPeople(market.metrics.population, language)}<small>{market.metrics.population?.year}</small></td>
                    <td>{market.metrics.internet_users_pct ? `${market.metrics.internet_users_pct.value.toFixed(1)}%` : "нет данных"}<small>{market.metrics.internet_users_pct?.year}</small></td>
                    <td>{market.metrics.findex_2024.account_ownership_pct.toFixed(1)}%<small>2024</small></td>
                    <td>{market.metrics.findex_2024.digital_payment_pct == null ? "нет данных" : `${market.metrics.findex_2024.digital_payment_pct.toFixed(1)}%`}<small>2024</small></td>
                    <td>{market.metrics.findex_2024.smartphone_pct.toFixed(1)}%<small>2024</small></td>
                    <td>{market.metrics.imf_weo.inflation_2025_pct.toFixed(1)}%<small>2025</small></td>
                    <td>{market.metrics.chainalysis_rank_2025 ? `#${market.metrics.chainalysis_rank_2025}` : ">20"}<small>2025</small></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "method" && (
        <section className="method-layout">
          <article className="panel methodology-card">
            <span className="section-kicker">METHODOLOGY</span>
            <h2>Одна оценка, девять непересекающихся критериев</h2>
            <div className="method-steps">
              <div><span>01</span><strong>Фактический слой</strong><p>World Bank, Global Findex, IMF, Chainalysis и регуляторы. Год хранится рядом с каждым значением.</p></div>
              <div><span>02</span><strong>Единая рубрика 1–5</strong><p>Одинаковые определения применены ко всем восьми рынкам. Балл — нормированная аналитическая оценка, а не внешняя статистика.</p></div>
              <div><span>03</span><strong>Полная конкурентная среда</strong><p>Учитываются KAST, прямые аналоги, exchanges, банки, кошельки и локальные платёжные сервисы.</p></div>
              <div><span>04</span><strong>Качественная проверка</strong><p>Интервью уточняют незакрытые задачи, экономику переключения и практический путь входа, но не добавляются отдельным бонусом.</p></div>
              <div><span>05</span><strong>Жёсткие ограничители</strong><p>Критически нерешённая лицензия, недоступный канал запуска или действительно неподтверждённый спрос ограничивают максимум, даже если другие показатели сильны.</p></div>
              <div><span>06</span><strong>Уровень подтверждения</strong><p>Confidence остаётся отдельной пометкой качества доказательств и не является второй оценкой рынка.</p></div>
            </div>
            <div className="formula-box"><code>{data.unified_scoring.formula}</code><p>Итог = сумма девяти баллов × их веса. Пример: Филиппины = 5×15% + 3,5×12% + 4,5×8% + 4×15% + 4×10% + 4,5×5% + 4×15% + 5×12% + 4,5×8% = 4,315 → <strong>{language === "en" ? "4.32" : "4,32"}</strong>.</p></div>
            <div className="method-blocks">
              {data.unified_scoring.blocks.map((block) => (
                <article key={block.key}>
                  <div><span>{Math.round(block.weight * 100)}%</span><h3>{block.label}</h3></div>
                  {block.criteria.map((criterion) => <p key={criterion.key}><strong>{Math.round(criterion.weight * 100)}% · {criterion.label}</strong>{criterion.definition}</p>)}
                </article>
              ))}
            </div>
            <div className="formula-box gate-formula"><code>Итог = min(взвешенный балл, применимый gate)</code>{data.unified_scoring.gates.map((gate) => <p key={gate.key}><strong>Максимум {gate.cap.toFixed(2)}:</strong> {gate.rule}</p>)}<p>Для Вьетнама входящие переводы 2024 рассчитаны как 3,4% от опубликованного World Bank ВВП 2024; производное значение отмечено в данных.</p></div>
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

    </main>
  );
}
