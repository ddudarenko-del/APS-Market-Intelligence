"use client";

import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import acquisitionChannelMap from "./data/acquisition_channel_map.json";
import data from "./data/market_data.json";
import task5Conclusions from "./data/task5_conclusions.json";
import { type Language, translateCompositeText, translateText, translateTextNode } from "./localization";

type Tab = "overview" | "profiles" | "competition" | "cases" | "acquisition" | "respondents" | "data" | "method";
type MetricValue = { value: number; year: number } | null;
type UnifiedScore = (typeof data.unified_scoring.rows)[number];
type StrategicRating = (typeof data.strategic_ranking.rows)[number];
type MarketCompetitor = (typeof data.market_competitors)[number];
type CompetitionEntity = (typeof data.competition_by_market)[number]["entities"][number];
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
type AcquisitionTableRow = {
  category: string;
  channelHtml: string;
  contextHtml: string;
  activationHtml: string;
  linksHtml: string;
};
type UnifiedCompetitionRow = {
  competitor: MarketCompetitor;
  entity: CompetitionEntity | null;
  availability: Availability | null;
};

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

const strategicRatingLabelsRu: Record<string, string> = {
  "Priority Market": "Приоритетный рынок",
  "Priority Subject to Licensing": "Приоритетный рынок при условии лицензирования",
  "Conditional Opportunity": "Условная возможность",
  "High-Potential, High-Risk Test": "Тест с высоким потенциалом и высоким риском",
  "Secondary Opportunity": "Вторичная возможность",
  "Longer-Term, Corridor-Specific Opportunity": "Долгосрочная возможность для отдельных коридоров",
};

function getStrategicRatingLabel(rating: string, language: Language) {
  return language === "ru" ? strategicRatingLabelsRu[rating] ?? rating : rating;
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

const competitorWebsiteById: Record<string, string> = {
  kast: "https://www.kast.xyz/",
  redotpay: "https://www.redotpay.com/",
  bleap: "https://www.bleap.finance/",
  etherfi_cash: "https://www.ether.fi/",
  gnosis_pay: "https://gnosispay.com/",
  nexo: "https://nexo.com/",
  crypto_com: "https://crypto.com/",
  wirex: "https://wirexapp.com/",
  coinbase: "https://www.coinbase.com/",
  revolut: "https://www.revolut.com/",
  wise: "https://wise.com/",
  kraken: "https://www.kraken.com/",
  lemfi: "https://www.lemfi.com/",
  taptap_send: "https://www.taptapsend.com/",
  remitly: "https://www.remitly.com/",
  p3_money: "https://privat3money.com/",
  "3s_money": "https://3s.money/",
  lemon: "https://lemon.me/",
  belo: "https://www.belo.app/",
  arq: "https://www.arqfinance.com/",
  bitso: "https://bitso.com/",
  bybit: "https://www.bybit.com/",
  bitget_wallet: "https://web3.bitget.com/",
  tria: "https://www.tria.so/",
  tangem_wallet: "https://tangem.com/",
  meru: "https://www.getmeru.com/",
  takenos: "https://takenos.com/",
  kontigo: "https://www.kontigo.com/",
  brighty: "https://brighty.app/",
  littio: "https://littio.co/",
  td: "https://www.td.com/ca/en/personal-banking",
  rbc: "https://www.rbcroyalbank.com/",
  cibc: "https://www.cibc.com/",
  moonpay: "https://www.moonpay.com/",
  binance: "https://www.binance.com/",
  digifinex: "https://www.digifinex.com/",
  gcash: "https://gcash.com/",
  maya: "https://www.maya.ph/",
  coins_ph: "https://www.coins.ph/",
  pdax: "https://pdax.ph/",
  qris: "https://www.bi.go.id/QRIS/default.aspx",
  gopay: "https://gopay.co.id/",
  shopeepay: "https://shopeepay.co.id/",
  dana: "https://www.dana.id/",
  ovo: "https://www.ovo.id/",
  pintu: "https://pintu.co.id/",
  indodax: "https://indodax.com/",
  tokocrypto: "https://www.tokocrypto.com/",
  reku: "https://reku.id/",
  vietqr_napas: "https://en.napas.com.vn/",
  momo: "https://www.momo.vn/",
  zalopay: "https://zalopay.vn/",
  viettel_money: "https://www.viettelmoney.vn/",
  coin98: "https://coin98.com/",
};

function CompetitorWebsiteLink({ competitor }: { competitor: (typeof data.market_competitors)[number] }) {
  const website = competitorWebsiteById[competitor.id];
  if (!website) return <>{competitor.provider}</>;
  return (
    <a
      className="competitor-website-link"
      href={website}
      target="_blank"
      rel="noreferrer"
    >
      {competitor.provider}<span aria-hidden="true">↗</span>
    </a>
  );
}

const sourceLabelOverrides: Record<string, string> = {
  kast_series_a_2026: "KAST · показатели",
  kast_card_fees_2026: "KAST · тарифы",
  kast_crypto_card: "KAST · карты",
  kast_physical_card_shipping_2026: "KAST · доставка карт",
  kast_country_availability_2026: "KAST · география",
  kast_account_creation_2026: "KAST · регистрация",
};

const sourceTierLabels: Record<string, { ru: string; en: string }> = {
  primary_dataset: { ru: "Основной набор данных", en: "Primary dataset" },
  industry_methodology: { ru: "Отраслевая методология", en: "Industry methodology" },
  regulator: { ru: "Регулятор", en: "Regulator" },
  law: { ru: "Законодательство", en: "Legislation" },
  official_product_terms: { ru: "Официальные условия продукта", en: "Official product terms" },
  card_network: { ru: "Платёжная сеть", en: "Card network" },
  official_company_claim: { ru: "Официальное заявление компании", en: "Official company statement" },
  official_company_data: { ru: "Официальные данные компании", en: "Official company data" },
  regulator_primary: { ru: "Первичный источник регулятора", en: "Primary regulatory source" },
  independent_reporting: { ru: "Независимое издание", en: "Independent reporting" },
  company_financial_filing: { ru: "Финансовая отчётность компании", en: "Company financial filing" },
  official_incident_report: { ru: "Официальный отчёт об инциденте", en: "Official incident report" },
  industry_dataset: { ru: "Отраслевой набор данных", en: "Industry dataset" },
  official_acquisition_program: { ru: "Официальная программа привлечения", en: "Official acquisition programme" },
  official_partnership: { ru: "Официальное партнёрство", en: "Official partnership" },
  official_social_channel: { ru: "Официальный социальный канал", en: "Official social channel" },
  official_acquisition_page: { ru: "Официальная страница привлечения", en: "Official acquisition page" },
  official_content_marketing: { ru: "Официальный контент-маркетинг", en: "Official content marketing" },
  official_partnership_product: { ru: "Официальный партнёрский продукт", en: "Official partnership product" },
  official_partnership_campaign: { ru: "Официальная партнёрская кампания", en: "Official partnership campaign" },
  official_community_program: { ru: "Официальная программа сообщества", en: "Official community programme" },
  official_brand_campaign: { ru: "Официальная бренд-кампания", en: "Official brand campaign" },
  official_partnerships: { ru: "Официальные партнёрства", en: "Official partnerships" },
  expert_interview: { ru: "Экспертное интервью", en: "Expert interview" },
  official_data: { ru: "Официальные данные", en: "Official data" },
};

function getSourceTierLabel(tier: string, language: Language) {
  return sourceTierLabels[tier]?.[language] ?? tier.replaceAll("_", " ");
}

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

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanAcquisitionHtml(html: string) {
  return removeAcquisitionEvidenceMarkers(html)
    .replace(/\s+[—–]\s+/g, ": ")
    .replace(/^[—–]\s*/g, "");
}

function parseAcquisitionChannelTable(html: string, language: Language): AcquisitionTableRow[] {
  if (language === "ru") {
    const russianSourceLabels: Record<string, string> = {
      "Superteam Vietnam Education only": "Superteam Vietnam, только образовательные активности",
      "Coworking and startup spaces in HCMC and Hanoi": "Коворкинги и стартап-пространства в Хошимине и Ханое",
      "Developer and export-tech communities": "Сообщества разработчиков и экспортных технологических компаний",
      "University blockchain and fintech clubs": "Университетские блокчейн- и финтех-клубы",
      "Gaming Web3 and DeFi companies": "Игровые Web3- и DeFi-компании",
      "Sky Mavis and other Vietnamese gaming ecosystems": "Sky Mavis и другие вьетнамские игровые экосистемы",
      "Foreign residents and crypto-paid digital nomads": "Иностранные резиденты и цифровые кочевники с доходом в криптовалюте",
      "Private partner-led events": "Закрытые мероприятия с партнёрами",
      "Local BD and KOL product seeding": "Локальные бизнес-партнёрства и посев продукта через лидеров мнений",
      "Licensed financial QR and off-ramp partners": "Лицензированные финансовые партнёры для QR-платежей и вывода средств",
      "CryptoFemmes Baguio with pre-check": "CryptoFemmes Baguio, с предварительной проверкой",
      "Women founders and startup networks": "Сообщества женщин-основателей и стартапов",
      "Airdrop hunters and trader communities": "Охотники за аирдропами и сообщества трейдеров",
      "Channel hierarchy": "Иерархия каналов",
      "OFW family associations seafarer unions and maritime schools": "Ассоциации семей OFW, профсоюзы моряков и морские учебные заведения",
      "Church-based OFW family ministries": "Церковные сообщества семей OFW",
      "Filipino churches community centres and grocery clusters": "Филиппинские церкви, общественные центры и продуктовые кластеры",
      "NHS Filipino staff networks and community nursing groups": "Сети филиппинских сотрудников NHS и сообщества медработников",
      "London fintech and stablecoin communities": "Лондонские финтех- и стейблкоин-сообщества",
    };
    for (const [source, target] of Object.entries(russianSourceLabels)) html = html.replaceAll(source, target);
  }
  const rows: AcquisitionTableRow[] = [];
  const blocks = html.match(/<h3>[\s\S]*?<\/h3>|<table>[\s\S]*?<\/table>|<p(?:\s+class="[^"]*")?>[\s\S]*?<\/p>/gi) ?? [];
  let category = language === "en" ? "Other channels and cases" : "Другие каналы и кейсы";

  for (const rawBlock of blocks) {
    if (/^<h3>/i.test(rawBlock)) {
      category = stripHtml(rawBlock);
      continue;
    }

    if (/^<table>/i.test(rawBlock)) {
      const tableRows = rawBlock.match(/<tr>[\s\S]*?<\/tr>/gi) ?? [];
      tableRows.forEach((tableRow, index) => {
        const cells = [...tableRow.matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((match) => cleanAcquisitionHtml(match[1]));
        if (!cells.length || (index === 0 && /acq-table-head/.test(tableRow))) return;
        rows.push({
          category,
          channelHtml: cells[0] ?? "",
          contextHtml: cells[1] ?? "",
          activationHtml: cells[2] ?? "",
          linksHtml: "",
        });
      });
      continue;
    }

    const className = rawBlock.match(/^<p(?:\s+class="([^"]*)")?>/i)?.[1] ?? "";
    const body = cleanAcquisitionHtml(rawBlock.replace(/^<p(?:\s+class="[^"]*")?>/i, "").replace(/<\/p>$/i, ""));
    if (className.includes("acq-link")) {
      const previous = rows.at(-1);
      if (previous) previous.linksHtml = `${previous.linksHtml}${previous.linksHtml ? "<br />" : ""}${body}`;
      else rows.push({ category, channelHtml: language === "en" ? "Source" : "Источник", contextHtml: "", activationHtml: "", linksHtml: body });
      continue;
    }

    const strongMatch = body.match(/<strong>([\s\S]*?)<\/strong>/i);
    if (strongMatch) {
      const context = body.replace(strongMatch[0], "").replace(/^\s*[:,-]\s*/, "");
      rows.push({ category, channelHtml: strongMatch[1], contextHtml: context, activationHtml: "", linksHtml: "" });
    } else {
      rows.push({
        category,
        channelHtml: language === "en" ? "Additional context" : "Дополнительный контекст",
        contextHtml: body,
        activationHtml: "",
        linksHtml: "",
      });
    }
  }

  return rows.filter((row) => stripHtml(`${row.channelHtml}${row.contextHtml}${row.activationHtml}${row.linksHtml}`));
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
  const [rankingMode, setRankingMode] = useState<"strategic" | "base">("strategic");

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
  const selectedAcquisitionRows = parseAcquisitionChannelTable(selectedAcquisitionDocumentHtml, language);
  const selectedCompetition = competitorMarket === "ALL" ? null : data.competition_by_market.find((item) => item.market_code === competitorMarket) ?? null;
  const selectedCompetitionAssessment = competitorMarket === "ALL" ? null : data.market_assessments.find((item) => item.market_code === competitorMarket) ?? null;
  const globalCompetitors = data.market_competitors.filter((item) => item.scope === "global" && item.availability);
  const rankedVisibleMarkets = [...visibleMarkets].sort((a, b) => {
    if (rankingMode === "base") return getUnifiedScore(b.code).final_score - getUnifiedScore(a.code).final_score;
    const aPosition = data.strategic_ranking.rows.findIndex((row) => row.market_code === a.code);
    const bPosition = data.strategic_ranking.rows.findIndex((row) => row.market_code === b.code);
    return aPosition - bPosition;
  });
  const selectedCompetitionRows: UnifiedCompetitionRow[] = selectedCompetition
    ? (() => {
        const localIds = new Set(selectedCompetition.entities.map((entity) => entity.competitor_id));
        const localRows = selectedCompetition.entities.flatMap((entity) => {
          const competitor = data.market_competitors.find((item) => item.id === entity.competitor_id);
          if (!competitor) return [];
          return [{
            competitor,
            entity,
            availability: competitor.availability ? getAvailability(competitor, competitorMarket) : null,
          }];
        });
        const remainingGlobalRows = globalCompetitors
          .filter((competitor) => !localIds.has(competitor.id))
          .map((competitor) => ({
            competitor,
            entity: null,
            availability: getAvailability(competitor, competitorMarket),
          }));

        return [...localRows, ...remainingGlobalRows].sort((a, b) => {
          const aGroup = a.entity ? (a.competitor.scope === "global" ? 1 : 0) : 2;
          const bGroup = b.entity ? (b.competitor.scope === "global" ? 1 : 0) : 2;
          if (aGroup !== bGroup) return aGroup - bGroup;
          if (a.entity && b.entity && a.entity.display_order !== b.entity.display_order) return a.entity.display_order - b.entity.display_order;
          if (a.availability && b.availability) return availabilityOrder[a.availability.status] - availabilityOrder[b.availability.status];
          return a.competitor.provider.localeCompare(b.competitor.provider, locale);
        });
      })()
    : [];
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
            <span className="update-stamp">Исследование обновлено 24.09.2026</span>
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
                <span className="section-kicker">КАРТА РЫНКОВ</span>
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
                    <span className={`strategic-rating-label ${getStrategicRatingClass(selectedStrategic.rating)}`}>{getStrategicRatingLabel(selectedStrategic.rating, language)}</span>
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
            <div className="ranking-mode-switch" role="group" aria-label="Порядок рейтинга">
              <button type="button" aria-pressed={rankingMode === "strategic"} onClick={() => setRankingMode("strategic")}><span>Стратегический</span></button>
              <button type="button" aria-pressed={rankingMode === "base"} onClick={() => setRankingMode("base")}><span>Базовый</span></button>
            </div>
            <div className="ranking-columns" aria-hidden="true">
              <span>Страна</span>
              <span>Базовый</span>
              <span>Стратегический</span>
            </div>
            <div className="ranking-list">
              {rankedVisibleMarkets.map((market, index) => (
                <button key={market.code} type="button" onClick={() => chooseOverviewMarket(market.code)} className={selectedCode === market.code ? "active" : ""}>
                  <span className="rank-country">
                    <span className="rank-number">{index + 1}</span>
                    <span className="rank-name"><strong>{market.name_ru}</strong><small>{market.region}</small></span>
                  </span>
                  <ScoreBadge score={getUnifiedScore(market.code).final_score} />
                  <span className={`strategic-rating-label ${getStrategicRatingClass(getStrategicRating(market.code).rating)}`}>{getStrategicRatingLabel(getStrategicRating(market.code).rating, language)}</span>
                </button>
              ))}
            </div>
            <p className="strategic-rating-note">
              Стратегический рейтинг был сформирован на стратегической сессии с командой 14 сентября. Он учитывает готовность выходить на рынки со сложным регулированием, ограничениями на рекламу и высокими требованиями к лицензированию ради более значимых возможностей.
            </p>
            <p className="strategic-rating-note">Для Канады и Великобритании требуется пересмотр критерия трансграничных денег с учётом исходящих переводов. Их базовые рейтинги пока предварительные.</p>
          </aside>
        </section>
        <section className="conclusions-layout overview-conclusions">
          <article className="panel research-conclusion">
            <span className="section-kicker">ИТОГ ИССЛЕДОВАНИЯ</span>
            <p>Карта, долларовый счет, хранение стейблкоинов и базовая конвертация уже воспринимаются как стандартный набор. Возможность возникает вокруг конкретной аудитории, незакрытой задачи и измеримого преимущества: курса, комиссии, доходности, локальной функции, платежного маршрута, налогового сопровождения или упрощения сложного финансового сценария.</p>
          </article>
          <div className="research-observations">
            {[
              ["Главный спрос - трансграничные деньги и снижение налоговой нагрузки", "Зарубежный доход, семейные переводы и международные специалисты дают наиболее понятные сценарии. При этом использование криптовалюты для платежей часто связано со стремлением снизить налоговую нагрузку"],
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

          <article className="panel acquisition-document-market">
            <div className="acquisition-document-head">
              <div>
                <span className="section-kicker">{language === "en" ? "UPDATED PROMOTION CHANNEL MAP · 2026" : "ОБНОВЛЁННАЯ КАРТА КАНАЛОВ ПРОДВИЖЕНИЯ · 2026"}</span>
                <h2>{selectedAcquisitionDocument.name[language]}</h2>
              </div>
              <div className="acquisition-map-count"><strong>{selectedAcquisitionRows.length}</strong><span>{language === "en" ? "channels and cases" : "каналов и кейсов"}</span></div>
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

            <div className="acquisition-channels-heading acquisition-unified-heading">
              <div>
                <span className="section-kicker">{language === "en" ? "ONE COUNTRY TABLE" : "ЕДИНАЯ ТАБЛИЦА ПО СТРАНЕ"}</span>
                <h3>{language === "en" ? "International and local channels and cases" : "Международные и локальные каналы и кейсы"}</h3>
              </div>
              <p>{language === "en" ? "All audiences, media, events, communities, expert suggestions, local activations and source links from the updated document are consolidated below." : "В таблице сохранены все аудитории, медиа, события, сообщества, предложения экспертов, локальные активации и ссылки из обновлённого документа."}</p>
            </div>
            <div className="acquisition-unified-table-wrap">
              <table className="acquisition-unified-table">
                <thead>
                  <tr>
                    <th>{language === "en" ? "Channel or case" : "Канал или кейс"}</th>
                    <th>{language === "en" ? "Context and role" : "Контекст и роль"}</th>
                    <th>{language === "en" ? "Recommended activation" : "Рекомендуемая активация"}</th>
                    <th>{language === "en" ? "Links" : "Ссылки"}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAcquisitionRows.map((row, index) => {
                    const previousCategory = selectedAcquisitionRows[index - 1]?.category;
                    return (
                      <Fragment key={`${row.category}-${index}`}>
                        {row.category !== previousCategory && <tr className="acquisition-table-group"><th colSpan={4}>{row.category}</th></tr>}
                        <tr>
                          <td dangerouslySetInnerHTML={{ __html: row.channelHtml }} />
                          <td dangerouslySetInnerHTML={{ __html: row.contextHtml }} />
                          <td dangerouslySetInnerHTML={{ __html: row.activationHtml }} />
                          <td className="acquisition-table-links" dangerouslySetInnerHTML={{ __html: row.linksHtml }} />
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
            <span className="section-kicker">ПРОФИЛИ СТРАН</span>
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
                <span className={`strategic-rating-label ${getStrategicRatingClass(selectedStrategic.rating)}`}>{getStrategicRatingLabel(selectedStrategic.rating, language)}</span>
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
              <div><span>Инфляция</span><strong>{selected.metrics.imf_weo.inflation_2025_pct.toFixed(1)}%</strong><small>МВФ 2025</small></div>
              <div><span>Владеют счётом</span><strong>{selected.metrics.findex_2024.account_ownership_pct.toFixed(1)}%</strong><small>Global Findex 2024</small></div>
              <div><span>Рейтинг криптоадаптации</span><strong>{selected.metrics.chainalysis_rank_2025 ? `#${selected.metrics.chainalysis_rank_2025}` : ">20"}</strong><small>Chainalysis 2025</small></div>
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
              <div><span className="section-kicker">РЕГУЛЯТОРНОЕ УСЛОВИЕ</span><h3>{gateLabels[selected.regulatory.gate]}</h3><p>{selected.regulatory.status}</p></div>
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
              <h2>Конкуренты по рынкам</h2>
              <p>Локальные и глобальные продукты собраны в одном сравнении. Выберите страну, чтобы увидеть их роль, присутствие и окно для APS.</p>
            </div>
            <span key={`competition-count-${language}`} className="count-pill">{language === "en" ? `${data.market_competitors.length} competitors across ${data.markets.length} markets` : `${data.market_competitors.length} конкурента на ${data.markets.length} рынках`}</span>
          </div>
          <div className="reference-note">
            <strong>{data.competition_availability.reference_product}: эталон и прямой конкурент</strong>
            <span>{data.competition_availability.reference_note}</span>
          </div>
          <div className="competitor-filter" aria-label="Фильтр конкурентов по рынку">
            <button type="button" className={competitorMarket === "ALL" ? "active" : ""} onClick={() => setCompetitorMarket("ALL")}>Все рынки</button>
            {data.markets.map((market) => <button key={market.code} type="button" className={competitorMarket === market.code ? "active" : ""} onClick={() => setCompetitorMarket(market.code)}>{market.name_ru}</button>)}
          </div>
          {competitorMarket === "ALL" ? (
            <section className="competition-overview">
              <div className="subsection-heading global-availability-heading">
                <div>
                  <h2>Присутствие глобальных продуктов</h2>
                  <p>Матрица показывает, где подтверждены аккаунт и выпуск карты. Выбор статуса открывает единое сравнение по стране.</p>
                </div>
                <span key={`global-competition-count-${language}`} className="count-pill">{language === "en" ? `${globalCompetitors.length} global products` : `${globalCompetitors.length} глобальных продуктов`}</span>
              </div>
              <div className="availability-legend" aria-label="Обозначения доступности">
                {(Object.entries(data.competition_availability.definitions) as Array<[AvailabilityStatus, string]>).map(([status, definition]) => (
                  <div key={status}><AvailabilityBadge status={status} /><span>{definition}</span></div>
                ))}
              </div>
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
                  {globalCompetitors.map((item) => (
                    <tr key={item.provider}>
                      <td><strong><CompetitorWebsiteLink competitor={item} /></strong></td>
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
            </section>
          ) : selectedCompetition && selectedCompetitionAssessment ? (
            <section className="unified-competition">
              <div className="competition-market-summary">
                <div className="competition-market-summary-main">
                  <span className="competition-market-code">{competitorMarket}</span>
                  <h3>{selectedCompetitionAssessment.competition_summary}</h3>
                  <div className="source-chips">{selectedCompetitionAssessment.source_ids.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
                </div>
                <dl>
                  <div><dt>Незакрытая задача</dt><dd>{selectedCompetitionAssessment.market_gap}</dd></div>
                  <div><dt>Условие входа</dt><dd>{selectedCompetitionAssessment.entry_condition}</dd></div>
                </dl>
                <div className="must-win-list">{selectedCompetitionAssessment.must_win_on.map((item) => <span key={item}>{item}</span>)}</div>
              </div>
              <div className="unified-competition-heading">
                <div>
                  <h2>{data.markets.find((market) => market.code === competitorMarket)?.name_ru}</h2>
                  <p>Один реестр локальных игроков, глобальных продуктов и инфраструктуры. Детальные факты и источники раскрываются в строке.</p>
                </div>
                <span key={`market-competition-count-${language}`} className="count-pill">{language === "en" ? `${selectedCompetitionRows.length} players` : `${selectedCompetitionRows.length} игроков`}</span>
              </div>
              <div className="unified-competition-table-scroll">
                <table className="unified-competition-table">
                  <thead>
                    <tr>
                      <th>Конкурент</th>
                      <th>Тип и присутствие</th>
                      <th>Позиция на рынке</th>
                      <th>Продукт и сильная сторона</th>
                      <th>Вывод для APS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCompetitionRows.map(({ competitor, entity, availability }) => {
                      const detailSourceIds = Array.from(new Set([
                        ...competitor.source_ids,
                        ...(entity?.expert_insight?.source_ids ?? []),
                        ...(availability?.source_ids ?? []),
                      ]));
                      return (
                        <tr key={`unified-${competitor.id}`}>
                          <td className="unified-competitor-name">
                            <strong><CompetitorWebsiteLink competitor={competitor} /></strong>
                            <small>{competitor.profile}</small>
                            <details className="competitor-row-details">
                              <summary>Подробнее</summary>
                              <div>
                                <p><strong>Продукт</strong>{competitor.product}</p>
                                <p><strong>Публичные условия</strong>{competitor.public_terms}</p>
                                {entity?.expert_insight?.text && <p><strong>Что отмечают эксперты</strong>{entity.expert_insight.text}</p>}
                                {entity?.project_implication && <p><strong>Вывод для APS</strong>{entity.project_implication}</p>}
                                <div className="source-chips">{detailSourceIds.map((id) => <SourceChip key={id} sourceId={id} />)}</div>
                              </div>
                            </details>
                          </td>
                          <td className="unified-competitor-type">
                            <span className={`competitor-scope ${competitor.scope === "global" ? "global" : "local"}`}>{competitor.scope === "global" ? "Глобальный продукт" : "Локальный игрок"}</span>
                            {entity && <><small>{competitionGroupLabels[entity.group_type]}</small><small>{competitionRoleLabels[entity.role]}</small></>}
                            {availability && <AvailabilityBadge status={availability.status} />}
                          </td>
                          <td>{entity?.relevance || availability?.note || competitor.profile}</td>
                          <td>{entity?.strength || competitor.product}</td>
                          <td>{entity?.gap || entity?.project_implication || competitor.evidence}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          <div className="subsection-heading">
            <div><span className="section-kicker">ПОДТВЕРЖДЁННЫЕ ТАРИФЫ</span><h2>Сопоставимые тарифы и лимиты</h2><p>Только опубликованные цифры с официальных страниц; условия разных регионов не переносятся автоматически.</p></div>
            <span className="count-pill">{data.competitor_benchmarks.length} точек</span>
          </div>
          <div className="benchmark-grid">
            {data.competitor_benchmarks.map((item, index) => {
              const market = data.markets.find((entry) => entry.code === item.market_code);
              const source = data.sources.find((entry) => entry.id === item.source_id);
              return (
                <article className="benchmark-card" key={`${item.provider}-${index}`}>
                  <div className="benchmark-head">
                    <span>{item.market_code === "GLOBAL" ? (language === "en" ? "Global benchmark" : "Глобальный ориентир") : market?.name_ru ?? item.market_code}</span>
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
            <p>Сравнивать нужно полную стоимость сценария: пополнение → конвертация → оплата картой или QR → вывод средств. Заявление «0%» недостаточно без учёта ограничений, обменного курса и стоимости вывода.</p>
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
            <div><span className="section-kicker">ИСХОДНЫЕ ДАННЫЕ</span><h2>Сопоставимые значения</h2><p>Статистика приведена за указанный год; оценки и расчёты отмечены отдельно. «Нет данных» означает отсутствие значения в выбранной серии. Рейтинговые баллы — экспертная модель APS, а не статистика первоисточников.</p><p>Для Канады и Великобритании требуется пересмотр критерия трансграничных денег с учётом исходящих переводов. Их базовые рейтинги пока предварительные.</p></div>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Рынок</th><th>Итог</th><th>Потребность</th><th>Коммерческий потенциал</th><th>Реализуемость входа</th><th>Входящие личные переводы, $</th><th>Исходящие личные переводы, $</th><th>Входящие / ВВП</th><th>Население</th><th>Интернет</th><th>Имеют счёт, 15+</th><th>Совершали или получали цифровые платежи, 15+</th><th>Основной телефон — смартфон, 15+</th><th>Среднегодовая инфляция 2025</th><th>Рейтинг криптоадаптации</th></tr></thead>
              <tbody>
                {data.markets.map((market) => {
                  const unified = getUnifiedScore(market.code);
                  return <tr key={market.code} onClick={() => chooseMarket(market.code, "profiles")}>
                    <td><strong>{market.name_ru}</strong><small>{market.code}</small></td>
                    <td>{unified.final_score.toFixed(2)}<small>{unified.label}</small>{["CAN", "GBR"].includes(market.code) && <small>Предварительный</small>}</td>
                    <td>{unified.block_scores.product_need.toFixed(2)}<small>35%</small></td>
                    <td>{unified.block_scores.commercial_viability.toFixed(2)}<small>30%</small></td>
                    <td>{unified.block_scores.entry_feasibility.toFixed(2)}<small>35%</small></td>
                    <td>{formatMoney(market.metrics.remittance_in_usd, language)}<small>{market.metrics.remittance_in_usd?.year}</small>{"estimate" in market.metrics.remittance_in_usd && <small>Оценка Всемирного банка</small>}</td>
                    <td>{formatMoney(market.metrics.remittance_out_usd, language)}<small>{market.metrics.remittance_out_usd?.year}</small></td>
                    <td>{formatPct(market.metrics.remittance_pct_gdp, language)}<small>{market.metrics.remittance_pct_gdp?.year}</small>{"derived" in market.metrics.remittance_pct_gdp && <small>Расчёт по ВВП WDI</small>}</td>
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
          <p>Личные переводы WDI включают трансферты между домохозяйствами и оплату труда определённых категорий работников. Это не все международные платежи и не объём криптопереводов. Переводы BSP через банковскую систему в профиле Филиппин — отдельный показатель.</p>
          <div className="source-chips"><SourceChip sourceId="wb_api" /><SourceChip sourceId="vn_remittances_2025" /><SourceChip sourceId="wb_vietnam_data" /><SourceChip sourceId="wb_findex_2025" /><SourceChip sourceId="imf_weo_2026" /><SourceChip sourceId="chainalysis_2025" /></div>
        </section>
      )}

      {tab === "method" && (
        <section className="method-layout">
          <article className="panel methodology-card">
            <span className="section-kicker">МЕТОДОЛОГИЯ</span>
            <h2>Одна оценка, девять непересекающихся критериев</h2>
            <div className="method-steps">
              <div><span>01</span><strong>Фактический слой</strong><p>Всемирный банк, Global Findex, МВФ, Chainalysis и регуляторы. Год хранится рядом с каждым значением.</p></div>
              <div><span>02</span><strong>Единая рубрика 1–5</strong><p>Одинаковые определения применены ко всем восьми рынкам. Балл — нормированная аналитическая оценка, а не внешняя статистика.</p></div>
              <div><span>03</span><strong>Полная конкурентная среда</strong><p>Учитываются KAST, прямые аналоги, криптобиржи, банки, кошельки и локальные платёжные сервисы.</p></div>
              <div><span>04</span><strong>Качественная проверка</strong><p>Интервью уточняют незакрытые задачи, экономику переключения и практический путь входа, но не добавляются отдельным бонусом.</p></div>
              <div><span>05</span><strong>Жёсткие ограничители</strong><p>Критически нерешённая лицензия, недоступный канал запуска или действительно неподтверждённый спрос ограничивают максимум, даже если другие показатели сильны.</p></div>
              <div><span>06</span><strong>Уровень подтверждения</strong><p>Уровень подтверждения остаётся отдельной пометкой качества доказательств и не является второй оценкой рынка.</p></div>
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
            <div className="formula-box gate-formula"><code>Итог = min(взвешенный балл, применимый ограничитель)</code>{data.unified_scoring.gates.map((gate) => <p key={gate.key}><strong>Максимум {gate.cap.toFixed(2)}:</strong> {gate.rule}</p>)}<p>Для Вьетнама используется опубликованная оценка Всемирного банка: $16,0 млрд за 2024 год. Доля 3,36% рассчитана по ВВП WDI за тот же год.</p><p>Баллы критериев являются экспертными оценками, а не автоматическим пересчётом статистики. Исправление суммы Вьетнама не меняет его итог 3,19: действует регуляторный ограничитель.</p><p>Для Канады и Великобритании требуется пересмотр критерия трансграничных денег с учётом исходящих переводов. Их базовые рейтинги пока предварительные.</p></div>
          </article>

          <article className="panel sources-card">
            <div className="panel-heading compact"><div><span className="section-kicker">РЕЕСТР ИСТОЧНИКОВ</span><h2>{data.sources.length} базовых источников</h2></div></div>
            <div className="sources-list">
              {data.sources.map((source) => (
                <article key={source.id}>
                  <span className="source-tier">{getSourceTierLabel(source.tier, language)}</span>
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
