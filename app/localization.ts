import machineTranslations from "./data/translations.en.json";

export type Language = "ru" | "en";

const reviewedTranslations: Record<string, string> = {
  "Обзор": "Overview",
  "Выводы": "Conclusions",
  "Сравнение": "Comparison",
  "Профили": "Profiles",
  "Профили рынков": "Market profiles",
  "Конкуренты": "Competitors",
  "Конкуренты / тарифы": "Competitors / pricing",
  "Барьеры": "Barriers",
  "Барьеры и драйверы": "Barriers and drivers",
  "Кейсы": "Cases",
  "Кейсы и уроки": "Cases and lessons",
  "Каналы": "Channels",
  "Каналы привлечения": "Acquisition channels",
  "Респонденты": "Interviewees",
  "Данные": "Data",
  "Сырые данные": "Raw data",
  "Методология": "Methodology",
  "Методология / источники": "Methodology / sources",
  "Потребность в продукте": "Product need",
  "Коммерческий потенциал": "Commercial potential",
  "Реализуемость входа": "Entry feasibility",
  "Единая привлекательность рынка": "Overall market attractiveness",
  "Итоговая привлекательность рынка": "Overall market attractiveness",
  "Сила потребности": "Strength of need",
  "Сложность входа": "Entry complexity",
  "Незакрытая задача": "Unmet need",
  "Незакрытая задача:": "Unmet need:",
  "Условие входа": "Entry requirement",
  "Условие входа:": "Entry requirement:",
  "Подтверждение": "Evidence confidence",
  "Доступность привлечения": "Acquisition feasibility",
  "Партнёрская реализуемость": "Partner feasibility",
  "Экономика пользователя": "User economics",
  "Входящие переводы": "Inbound remittances",
  "Переводы / ВВП": "Remittances / GDP",
  "Трансграничные деньги": "Cross-border money flows",
  "Прямые аналоги": "Direct analogues",
  "Массовые финансовые сервисы": "Mainstream financial services",
  "Криптосервисы": "Crypto services",
  "Локальные платежи и инфраструктура": "Local payments and infrastructure",
  "Партнёр / авторизация": "Partner / authorisation",
  "Лицензированный партнёр": "Licensed partner",
  "Только fiat-wrapper": "Fiat wrapper only",
  "Полностью": "Full",
  "Частично": "Partial",
  "Недоступно": "Unavailable",
  "Полностью:": "Full availability:",
  "Частично:": "Partial availability:",
  "Не подтверждено": "Unconfirmed",
  "не подтверждено": "unconfirmed",
  "нет данных": "no data",
  "да": "yes",
  "нет": "no",
  "СТРАТЕГИЯ ПРИВЛЕЧЕНИЯ": "ACQUISITION STRATEGY",
  "Аналитический вывод APS": "APS interpretation",
  "Вывод для APS": "Implication for APS",
  "Подтверждённый факт": "Verified fact",
  "Подтверждённый рост": "Verified growth",
  "Закрытие / сбой": "Shutdown / failure",
  "Курс COP": "COP exchange rate",
  "Курс IDR": "IDR exchange rate",
  "CAD/USD курс": "CAD/USD exchange rate",
  "Лучший курс": "Better exchange rate",
  "Конкурентный курс": "Competitive exchange rate",
  "Ниже комиссии": "Lower fees",
  "Комиссии": "Fees",
  "Цена и комиссии": "Pricing and fees",
  "Доходность": "Yield",
  "Дешевый вывод в PHP": "Low-cost cash-out in PHP",
  "Общий вывод": "Overall conclusion",
  "Универсальный аналог KAST не дает достаточного отличия": "A generic KAST analogue is not sufficiently differentiated",
  "СКВОЗНЫЕ ИНСАЙТЫ": "CROSS-MARKET INSIGHTS",
  "Что повторяется между рынками": "What repeats across markets",
  "ВЫВОДЫ ПО РЫНКАМ": "MARKET-SPECIFIC FINDINGS",
  "Продуктовые и коммуникационные направления": "Product and communication directions",
  "Разверните рынок, чтобы увидеть полный набор выводов.": "Expand a market to see the full set of findings.",
  "Нельзя строить один продукт вокруг карты.": "A single product cannot be built around the card.",
  "На рынках типа Индонезии, Филиппин и Вьетнама основой повседневного использования должны быть QR, локальные переводы, счета и мобильные сервисы. Карта дает доступ к внешнему миру. В Канаде и Великобритании карта и банковские платежные системы остаются гораздо более центральными.": "In markets such as Indonesia, the Philippines and Vietnam, everyday use should centre on QR payments, local transfers, bill payments and mobile services. The card provides access to the wider world. In Canada and the UK, cards and bank payment systems remain far more central.",
  "Не просто «международные платежи», а конкретный денежный коридор.": "Not just international payments, but a specific money corridor.",
  "Азия ближе к суперприложению, развитые западные рынки к системе управления финансами.": "Asia is closer to a super-app; developed Western markets are closer to a financial-management system.",
  "Основной кормилец семьи может стать отдельной стратегической территорией.": "The primary family breadwinner can define a distinct strategic territory.",
  "Продукт может быть не только про личную финансовую свободу, но и про ответственность за людей, которые зависят от твоего дохода. Зарабатывай глобально и проще заботься о семье.": "The product can be about more than personal financial freedom: it can also address responsibility for people who depend on the user's income. Earn globally and take care of the family more easily.",
  "Прямое пополнение из Binance в один клик": "One-click top-up from Binance",
  "может быть сильнее идеи еще одного отдельного crypto-кошелька. Пользователю не обязательно переносить основное хранение активов в APS.": "may be more compelling than another standalone crypto wallet. Users do not need to move their primary asset holdings into APS.",
  "Логика суперприложения особенно релевантна:": "The super-app model is particularly relevant:",
  "Логика суперприложения естественна:": "The super-app model is a natural fit:",
  "Принцип суперприложения особенно важен:": "The super-app principle is particularly important:",
  "платежи, телефон, счета, бонусы, игровые механики и дополнительные сервисы внутри одного интерфейса.": "payments, mobile top-ups, bill payments, rewards, gamified mechanics and additional services in one interface.",
  "переводы, оплата телефона, счетов, повседневные платежи, бонусы и дополнительные сервисы должны ощущаться как единая среда.": "transfers, mobile top-ups, bill payments, everyday payments, rewards and additional services should feel like one integrated environment.",
  "переводы, QR, телефон, счета, бонусы и дополнительные финансовые сервисы должны быть собраны в одном месте.": "transfers, QR payments, mobile top-ups, bill payments, rewards and additional financial services should all sit in one place.",
  "Геймификация, бонусы и lucky-механики потенциально органичнее, чем в Великобритании и Канаде.": "Gamification, rewards and chance-based mechanics may feel more natural than in the UK and Canada.",
  "Счет в CAD и USD должен быть ядром предложения:": "A CAD and USD account should be at the core of the proposition:",
  "Все в одном сценарии:": "One end-to-end flow:",
  "помогает превратить продукт из инструмента получения денег в основной повседневный счет.": "helps turn the product from a way to receive money into the user's primary everyday account.",
  "Локальные банковские переводы непосредственно из баланса в USD или stablecoin": "Local bank transfers directly from a USD or stablecoin balance",
  "снимают главное ограничение многих crypto-приложений: необходимость постоянно входить и выходить из банковской системы.": "remove a major limitation of many crypto apps: the need to move in and out of the banking system repeatedly.",
  "акции, казначейские инструменты и другие токенизированные активы круглосуточно прямо из того же кошелька. Но это скорее следующий слой продукта, а не причина первичного привлечения.": "stocks, Treasury instruments and other tokenised assets available around the clock from the same wallet. This is more likely to be a later product layer than a primary acquisition driver.",
  "Физическая карта должна символизировать глобальный доступ, а не быть центром продукта.": "The physical card should represent global access rather than sit at the centre of the product.",
  "Качественные условия входа": "Qualitative entry conditions",
  "РЕАЛЬНОСТЬ ВХОДА НА РЫНОК": "MARKET-ENTRY REALITY",
  "Сила потребности против сложности входа": "Strength of need vs entry complexity",
  "По сложности входа": "By entry complexity",
  "Критическая сложность": "Critical entry complexity",
  "ДОСТУПНОСТЬ ГЛОБАЛЬНЫХ ПРОДУКТОВ": "GLOBAL PRODUCT AVAILABILITY",
  "Итог": "Overall score",
  "Проверено": "Verified",
  "Переводы": "Remittances",
  "Выбор языка": "Language selector",
  "млрд": "bn",
  "млн": "m",
  "Очень сильная": "Very strong",
  "Сильная": "Strong",
  "Сегментная": "Segment-specific",
  "Нишевая": "Niche",
  "Слабая": "Weak",
  "Критическая": "Critical",
  "Высокая": "High",
  "Средняя": "Medium",
  "Существенная": "Substantial",
  "Управляемая": "Manageable",
  "Низкая": "Low",
  "Хорошо подтверждено": "Well-supported",
  "Требует дополнительной проверки": "Requires further validation",
  "Диагностический инструмент, не юридическое заключение": "Diagnostic tool, not legal advice",
  "Исследование обновлено 01.09.2026": "Study updated 1 Sep 2026",
  "КОНКУРЕНТНАЯ СРЕДА · 01.09.2026": "COMPETITIVE LANDSCAPE · 1 SEP 2026",
  "Анализ продуктового соответствия stablecoin-powered global money app на восьми рынках с учетом открытых данных и экспертных интервью.": "Product-market fit assessment for a stablecoin-powered global money app across eight markets, based on open data and expert interviews.",
  "Восемь рынков в одном поле": "Eight markets at a glance",
  "Весь мир": "Whole world",
  "средний · 2,80–3,39": "medium · 2.80–3.39",
  "Получение зарубежного дохода и переводов семье до момента, когда деньги входят в привычную локальную платежную инфраструктуру.": "A seamless route for receiving foreign income and sending money to family through familiar local payment infrastructure.",
  "Главный спрос - трансграничные деньги": "Primary demand comes from cross-border money flows",
  "Зарубежный доход, семейные переводы и международные специалисты дают наиболее понятные сценарии.": "Foreign income, family remittances and international professionals provide the clearest use cases.",
  "Регулирование и партнеры определяют реальный вход": "Regulation and partners determine viable market entry",
  "Уровень подтверждения:": "Evidence confidence:",
  "Уровень подтверждения": "Evidence confidence",
  "Подтверждение:": "Evidence confidence:",
  "Средняя. Сила конкретной задачи и надежность партнерской инфраструктуры важнее самостоятельной известности нового бренда.": "Medium. The strength of the specific use case and the reliability of partner infrastructure matter more than standalone awareness of a new brand.",
  "Принцип выхода": "Go-to-market principle",
  "Активные профили в соцсетях": "Active social media identities",
  "Приоритетный набор для запуска": "Priority channel mix for launch",
  "Глобальный доход → QRIS": "Global income → QRIS",
  "Сложный международный доход": "Complex international income",
  "Цвет отражает единую оценку привлекательности рынка для запуска KAST-подобного продукта. Карта открывается по клику, тапу и клавиатуре.": "Colour reflects the overall market-attractiveness score for launching a KAST-like product. Select a country by click, tap or keyboard.",
  "Цвет отражает единую оценку привлекательности рынка для запуска KAST-подобного продукта. Клик выбирает рынок и обновляет блок под картой.": "Colour reflects the overall market-attractiveness score for launching a KAST-like product. Click a market to update the panel below the map.",
  "В выигрыше может оказаться продукт, который не заменяет GCash, QRIS или локальный банк, а становится для них «входом глобальных денег». На Филиппинах и в Индонезии это особенно выражено.": "The strongest opportunity may belong to a product that does not replace GCash, QRIS or a local bank, but instead becomes their gateway for global money. This is particularly pronounced in the Philippines and Indonesia.",
  "Наиболее логичная основа продукта — трансграничный долларовый счёт. Пользователь должен иметь возможность получать зарубежный доход в USD и других ключевых валютах, принимать USDC/USDT через регулируемую инфраструктуру, хранить часть заработка в долларах и переводить только необходимую часть в PHP.": "The most logical product foundation is a cross-border US dollar account. Users should be able to receive foreign income in USD and other key currencies, accept USDC/USDT through regulated infrastructure, hold part of their earnings in dollars and convert only the amount they need into PHP.",
  "Ключевой элемент — простой и дешёвый вывод в существующую локальную систему: банковские счета, GCash, Maya и другие распространённые каналы.": "The key element is simple, low-cost cash-out into the existing local system: bank accounts, GCash, Maya and other widely used channels.",
  "Для семей работающих за рубежом особенно важны регулярные переводы домой и возможность максимально сократить количество промежуточных сервисов.": "For families of overseas workers, recurring remittances home and minimising the number of intermediary services are especially important.",
  "Физическая карта полезна как дополнительный способ расходования средств, но не является главным преимуществом на фоне уже очень развитых цифровых платежей.": "A physical card is useful as an additional way to spend, but it is not the main advantage in a market with highly developed digital payments.",
  "Для фрилансеров и удалённых специалистов может быть полезен дополнительный слой подтверждения дохода и происхождения средств, особенно если продукт становится основным местом получения зарубежной оплаты.": "Freelancers and remote professionals may benefit from an additional layer for documenting income and source of funds, especially if the product becomes their primary destination for foreign payments.",
  "Массовое инвестирование распространено ограниченно: чаще инвестируют пользователи с располагаемым доходом, при этом средний класс постепенно растёт. Можно рассмотреть игровые и высокорисковые инвестиционные функции, включая лотерейные и казино-механики, заметные в местной культуре.": "Mass-market investing remains limited and is more common among users with disposable income, while the middle class is gradually expanding. Gamified and higher-risk investment features could be considered, including lottery and casino-style mechanics that are visible in local culture.",
  "На Филиппинах очень популярны суперприложения. Например, Maya позволяет в одном приложении оплачивать коммунальные услуги, пополнять телефон и пользоваться игровыми и казино-механиками.": "Super-apps are highly popular in the Philippines. Maya, for example, lets users pay utility bills, top up their phones and access gaming and casino-style mechanics within one app.",
  "Сообщение. В отличие от UK и Канады здесь сама пользовательская боль значительно сильнее и может быть главным двигателем привлечения.": "Message. Unlike in the UK and Canada, the underlying user pain is significantly stronger here and can become the main acquisition driver.",
  "Коммуникацию логичнее строить не вокруг криптовалюты и не вокруг карты, а вокруг конкретных жизненных задач: получение зарплаты за рубежом, сохранение части заработка в долларах, быстрый перевод семье и удобный доступ к заработанным деньгам внутри Филиппин.": "Communication should focus neither on crypto nor on the card, but on concrete life needs: receiving income from abroad, keeping part of earnings in dollars, transferring money to family quickly and accessing earned funds conveniently within the Philippines.",
  "Для местной культуры не характерно долгосрочное мышление, поэтому обещания должны быть краткосрочными и показывать выгоду здесь и сейчас.": "Long-term thinking is less characteristic of the local culture, so promises should be short-term and demonstrate an immediate benefit.",
  "Таргетирование. Особенно перспективна сегментированная коммуникация по конкретным жизненным сценариям: моряки, семьи OFW, медицинские работники, фрилансеры и специалисты с зарубежными клиентами.": "Targeting. Segmented communication around specific life situations is particularly promising: seafarers, OFW families, healthcare workers, freelancers and professionals with overseas clients.",
  "Финансовое поведение в столицах и провинциях сильно различается. Концентрация происхождения OFW в CALABARZON, Central Luzon и Western Visayas позволяет тестировать региональное community acquisition вместо общенационального mass marketing.": "Financial behaviour differs substantially between major cities and the provinces. The concentration of OFW origin communities in CALABARZON, Central Luzon and Western Visayas makes it possible to test regional community acquisition instead of nationwide mass marketing.",
  "Продвижение. Для филиппинской культуры характерна высокая дистанция власти, поэтому бренду особенно важно выстраивать доверие и демонстрировать легальность и серьёзность.": "Promotion. Filipino culture is characterised by high power distance, making it especially important for a brand to build trust and demonstrate legitimacy and credibility.",
  "Инфлюенсеры часто помогают финтех-брендам и представляют канал с высоким потенциалом для входа. Эксперты рекомендуют привлекать специалистов, которые будут управлять работой с инфлюенсерами, включая скидки и другие бонусы для продвижения.": "Influencers often support fintech brands and represent a high-potential market-entry channel. Experts recommend hiring specialists to manage influencer relationships, including discounts and other promotional incentives.",
  "Reddit и Facebook популярны среди местных криптосообществ.": "Reddit and Facebook are popular among local crypto communities.",
  "Важны акции и игровые механики — например, ограниченные подарки первым клиентам, такие как брендированные стаканы Starbucks.": "Promotions and gamified mechanics matter—for example, limited gifts for the first customers, such as branded Starbucks cups.",
  "Двусторонняя награда после KYC и первой международной выплаты; отдельные коды для OFW families и BPO-команд.": "Use a two-sided reward after KYC and the first international payment, with dedicated codes for OFW families and BPO teams.",
  "Профили и покрытие": "Profiles and coverage",
  "вся география": "all markets",
  "— эталон и прямой конкурент": "— product benchmark and direct competitor",
  "Аккаунт, обмен и выпуск карты": "Account, exchange and card issuance",
  "Выпуск карты": "Card issuance",
  "Сначала показана реальная конкурентная среда выбранной страны, затем — подтверждённая доступность глобальных сервисов.": "The selected market's local competitive landscape is shown first, followed by verified availability of global products.",
  "Полный продукт и карты подтверждены в Великобритании и Мексике; Аргентина и Колумбия находятся на стадии waitlist / подготовки запуска.": "The full product and cards are confirmed in the UK and Mexico; Argentina and Colombia remain at the waitlist or pre-launch stage.",
  "Non-custodial crypto credit card, расходы под обеспечение on-chain баланса": "Non-custodial crypto credit card with spending backed by an on-chain balance",
  "0 exchange fee*; 100 обменов/24ч; ATM £3 000/24ч; £100 000/операцию": "0 exchange fee*; 100 exchanges per 24h; ATM £3,000 per 24h; £100,000 per transaction",
  "Нет отдельного режима": "No dedicated regime",
  "Не запускать до подтверждения аудитории, масштаба проблемы и допустимой юридической архитектуры продукта.": "Do not launch until the target audience, scale of the problem and a legally viable product structure have been validated.",
  "Сила потребности показывает выраженность пользовательской задачи. Сложность входа показывает конкуренцию, регулирование и требования к модели запуска. Одна оценка не вычитается из другой.": "Strength of need reflects how pronounced the user problem is. Entry complexity reflects competition, regulation and launch-model requirements. The two scores are not netted against each other.",
  "Факт компании отделён от аналитического вывода APS.": "Verified company facts are separated from APS interpretation.",
  "Факт или свидетельство отделены от аналитического вывода APS.": "Facts and evidence are separated from APS interpretation.",
  "Что уже работает или не работает": "What already works — and what does not",
  "Локальный UX, карта и прозрачные резервы превращают crypto-инфраструктуру в ежедневный финансовый продукт.": "Local UX, a card and transparent reserves turn crypto infrastructure into an everyday financial product.",
  "Успех exchange и интеграции с SPEI не гарантирует жизнеспособность карточного слоя: его экономика, эмиссия и повседневная ценность должны подтверждаться отдельно.": "A successful exchange and SPEI integration do not guarantee a viable card layer: its unit economics, issuance model and everyday value must be validated separately.",
  "Высокий crypto-спрос не отменяет market-entry gate: без модели, совместимой с новым локальным лицензированием, даже давно работающий VND-продукт приходится сворачивать.": "Strong crypto demand does not remove the market-entry gate: without a model compatible with the new local licensing regime, even a long-running VND product may have to shut down.",
  "отказ 25.05.2026": "licence denial · 25 May 2026",
  "выход в 2023 году": "market exit in 2023",
  "Эксперт, участвовавший в запуске Simple в LATAM, связывает остановку экспансии с сочетанием продуктовых, экономических, инфраструктурных и регуляторных ограничений.": "An expert involved in Simple's LATAM launch attributes the halt in expansion to a combination of product, economic, infrastructure and regulatory constraints.",
  "Шесть ограничений, которые сложились в один стоп-сценарий": "Six constraints that combined into a stop scenario",
  "Эксперт оценивает расходы Belo примерно в $80 тыс. в месяц на страну — ориентир масштаба инвестиций, необходимого для заметности в категории.": "The expert estimates Belo's marketing spend at approximately $80,000 per month in each country, indicating the investment required to achieve category visibility.",
  "Локальная модель допуска и регуляторная экономика изменили приоритет рынка.": "The local entry model and regulatory economics reduced the market's priority.",
  "Хуже экономика": "Weaker unit economics",
  "Очень высокая. Главная альтернатива — не другая криптокарта, а привычный банк, Revolut или Wise.": "Very high. The primary alternatives are incumbent banks, Revolut and Wise, rather than another crypto card.",
  "Очень высокая. Базовый набор «счет + стейблкоины + карта» стал стандартом категории.": "Very high. The basic account, stablecoin and card bundle has become the category standard.",
  "Высокая и растущая, но пространство для нового игрока шире, чем в Аргентине. Ключевые локальные ориентиры — Littio и Bitso.": "High and growing, although the space for a new entrant is wider than in Argentina. Littio and Bitso are the key local benchmarks.",
  "ЭКСПЕРТНАЯ ПРОВЕРКА": "EXPERT VALIDATION",
  "Имена приведены в формате «имя + инициал фамилии». Контактные данные не публикуются; роль и опыт переведены на русский с сохранением конкретики интервью.": "Names are shown as first name plus surname initial. Contact details are not published; roles and experience are presented without disclosing personal contact information.",
  "Практический опыт локализации, маркетинга и регуляторных ограничений при запуске одного продукта на нескольких рынках LATAM": "Hands-on experience with localisation, marketing and regulatory constraints when launching one product across multiple LATAM markets",
  "Владелец crypto- и fintech-продуктов; создаёт банк на Филиппинах": "Crypto and fintech product owner; building a bank in the Philippines",
  "Локальный опыт коммуникации, привлечения аудитории и продвижения технологических финансовых продуктов": "Local experience in communications, audience acquisition and marketing digital financial products",
  "Одна оценка, девять непересекающихся критериев": "One score across nine non-overlapping criteria",
  "Фактический слой": "Evidence layer",
  "Качественная проверка": "Qualitative validation",
  "Жёсткие ограничители": "Hard caps",
  "Для Вьетнама входящие переводы 2024 рассчитаны как 3,4% от опубликованного World Bank ВВП 2024; производное значение отмечено в данных.": "Vietnam's 2024 inbound remittances are calculated as 3.4% of the World Bank's published 2024 GDP figure; the derived value is flagged in the data.",
  "базовых источников": "source records",
  "GCash, Maya и Coins.ph закрывают локальные платежи; окно остаётся в получении зарубежного дохода и его дешёвом выводе в эти rails.": "GCash, Maya and Coins.ph cover local payments; the remaining opportunity is receiving foreign income and cashing it out into these rails at low cost.",
  "Цифровые платежи и QR Ph имеют массовый масштаб, поэтому локальный вывод можно строить на готовой инфраструктуре.": "Digital payments and QR Ph have mass adoption, so local cash-out can be built on existing infrastructure.",
  "Карточный и банковский вывод реализуем через локальных финансовых партнёров.": "Card and bank cash-out is feasible through local financial partners.",
  "Критическая при функционально похожих предложениях. Пользователь проверяет локальные социальные сети, отзывы, основателей и рекомендации. При этом бренд не компенсирует худший курс или слабый продукт.": "Critical when offers are functionally similar. Users check local social media, reviews, founders and recommendations. Brand strength cannot compensate for an inferior exchange rate or a weak product.",
  "Карта, долларовый счет, хранение стейблкоинов и базовая конвертация уже воспринимаются как стандартный набор. Возможность возникает вокруг конкретной аудитории, незакрытой задачи и измеримого преимущества: курса, комиссии, доходности, локальной функции, платежного маршрута, налогового сопровождения или упрощения сложного финансового сценария.": "A card, a USD account, stablecoin custody and basic conversion are already expected category features. The opportunity lies in a specific audience, an unmet need and a measurable advantage: exchange rate, fees, yield, a local feature, a payment route, tax support or a simpler complex financial workflow.",
};

const translations = machineTranslations as Record<string, string>;

function polishTranslation(source: string, translated: string) {
  let result = translated;

  if (/курс/i.test(source)) {
    result = result.replace(/\bcourses?\b/gi, (match) => match[0] === "C" ? "Exchange rate" : "exchange rate");
  }
  if (/незакрыт|нереш[её]нн/i.test(source)) {
    result = result
      .replace(/\ban? (?:unclosed|unfinished|open|unsolved) (?:mass |user )?(?:task|problem)\b/gi, "an unmet need")
      .replace(/\b(?:unclosed|unfinished|open|unsolved) (?:mass |user )?(?:task|problem)\b/gi, "unmet need")
      .replace(/\bopen scenario\b/gi, "unmet use case");
  }
  if (/сценари/i.test(source)) {
    result = result.replace(/\bscripts?\b/gi, (match) => match.toLowerCase() === "scripts" ? "use cases" : "use case");
  }
  if (/привлеч/i.test(source)) {
    result = result
      .replace(/\brecruitment\b/gi, "acquisition")
      .replace(/\battraction\b/gi, "acquisition")
      .replace(/\bpaid acquisition attraction\b/gi, "paid acquisition");
  }
  if (/доходност/i.test(source)) {
    result = result.replace(/\bprofitability\b/gi, "yield");
  }
  if (/вывод/i.test(source) && !/(общий вывод|вывод для|выводы|аналитическ)/i.test(source)) {
    result = result
      .replace(/\bcheap output\b/gi, "low-cost cash-out")
      .replace(/\blocal output\b/gi, "local cash-out")
      .replace(/\boutput to\b/gi, "cash-out to")
      .replace(/\boutput in\b/gi, "cash-out in");
  }
  if (/партн[её]рск/i.test(source) && !/affiliate/i.test(source)) {
    result = result
      .replace(/\baffiliate feasibility\b/gi, "partner feasibility")
      .replace(/\baffiliate card models\b/gi, "partner-led card models")
      .replace(/\baffiliate financial products\b/gi, "partner financial products")
      .replace(/\baffiliate channel\b/gi, "partner channel");
  }
  if (/комисси/i.test(source) && !/(affiliate|referral|приглаш|вознаграж)/i.test(source)) {
    result = result
      .replace(/\bcommissions\b/gi, "fees")
      .replace(/\bcommission\b/gi, "fee");
  }
  if (/закрывают/i.test(source)) {
    result = result
      .replace(/\bshut down\b/gi, "cover")
      .replace(/\bare already closing\b/gi, "already cover")
      .replace(/\bare closing\b/gi, "cover")
      .replace(/\bis being actively closed by\b/gi, "is already well served by")
      .replace(/\bclose the needs\b/gi, "meet the needs")
      .replace(/\bclose ((?:most|a significant part) of)\b/gi, "cover $1");
  }

  return result;
}

export function translateText(value: string, language: Language) {
  if (language === "ru" || !value) return value;
  const reviewed = reviewedTranslations[value];
  if (reviewed) return reviewed;
  const machine = translations[value];
  return machine ? polishTranslation(value, machine) : value;
}

const fragmentKeys = Array.from(new Set([...Object.keys(translations), ...Object.keys(reviewedTranslations)]))
  .filter((key) => key.length >= 4 && /[А-Яа-яЁё]/.test(key))
  .sort((left, right) => right.length - left.length);

export function translateCompositeText(value: string, language: Language) {
  if (language === "ru" || !/[А-Яа-яЁё]/.test(value)) return value;
  const direct = translateText(value, language);
  if (direct !== value) return direct;
  let result = value;
  for (const key of fragmentKeys) {
    if (result.includes(key)) result = result.replaceAll(key, translateText(key, language));
  }
  return result;
}

export function translateTextNode(value: string, language: Language) {
  if (language === "ru" || !value.trim()) return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.slice(leading.length, value.length - trailing.length);
  return `${leading}${translateCompositeText(core, language)}${trailing}`;
}
