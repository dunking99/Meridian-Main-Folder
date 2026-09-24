export type Ccy = "USD" | "EUR" | "GBP" | "AUD" | "JPY" | "CHF" | "CAD";

export type Point = { t: string; value: number; bench?: number };

export type HoldingRow = {
  id: string;
  name: string;
  assetClass: string;
  sector: string;
  country: string;
  countryIso: string;
  currency: string;
  quantity: number;
  avgCost: number;
  price: number;
  dayChange: number;
  ret1M: number;
  value: number;
  weight: number;
  pl: number;
  plPct: number;
  color: string;
  spark: number[];
  pe?: number;
  divYield?: number;
  mcapB?: number;
};

export type Leader = {
  id: string;
  name: string;
  ret: number;
  weight: number;
  spark: number[];
  color: string;
  assetClass: string;
};

export type EventOut = {
  symbol: string;
  title: string;
  type: string;
  dateISO: string;
  inDays: number;
  importance: number;
};

export type NewsOut = {
  id: number;
  title: string;
  source: string;
  hoursAgo: number;
  summary: string;
  symbols: string[];
  sentiment: number;
  impact: number;
};

export type OverviewPayload = {
  asOf: string;
  marketsOpen: boolean;
  value: number;
  cash: number;
  invested: number;
  dayChange: number;
  dayChangePct: number;
  ret1M: number;
  retYTD: number;
  retInception: number;
  plTotal: number;
  plPct: number;
  holdingsCount: number;
  symbols: string[];
  series: Point[];
  allocation: { key: string; label: string; value: number; pct: number; color: string }[];
  capShape: { key: string; label: string; pct: number }[];
  risk: {
    score: number;
    grade: string;
    label: string;
    beta: number;
    vol: number;
    maxDd: number;
    equity: number;
    note: string;
  };
  health: { score: number; grade: string; parts: { key: string; label: string; score: number }[] };
  leaders: Leader[];
  laggards: Leader[];
  topHoldings: HoldingRow[];
  events: EventOut[];
  news: NewsOut[];
};

export type HoldingsPayload = {
  rows: HoldingRow[];
  cash: { value: number; pct: number };
  ribbon: { key: string; label: string; pct: number; color: string }[];
  regions: { key: string; label: string; pct: number; inPortfolio: boolean }[];
  total: number;
};

export type HoldingDetail = {
  holding: HoldingRow & { description: string; pe?: number; divYield?: number; mcapB?: number };
  series: { t: string; close: number; bench: number }[];
  stats: {
    ret1M: number;
    ret3M: number;
    ret6M: number;
    ret1Y: number;
    vol52w: number;
    beta: number;
    corrToBook: number;
    hi52: number;
    lo52: number;
    posIn52: number;
  };
  position: {
    quantity: number;
    avgCost: number;
    value: number;
    weight: number;
    pl: number;
    plPct: number;
    cost: number;
    contributionPct: number;
  };
  fundsHolding: { id: string; name: string; sharedWeight: number }[];
  news: NewsOut[];
  weightVsBook: { holding: number; rest: number };
};

export type PerformancePayload = {
  stats: {
    cagr: number;
    sharpe: number;
    sortino: number;
    vol: number;
    maxDd: number;
    beta: number;
    alpha: number;
    trackingErr: number;
    upMonthPct: number;
    winRateDaily: number;
    bestMonth: { label: string; ret: number };
    worstMonth: { label: string; ret: number };
    upCapture: number;
    downCapture: number;
  };
  cumulative: { t: string; port: number; bench: number }[];
  trailing: { window: string; port: number; bench: number }[];
  monthly: { year: number; months: (number | null)[]; total: number; vol: number }[];
  drawdown: { t: string; dd: number }[];
  rolling: { t: string; ret: number }[];
  hist: { label: string; count: number }[];
  yearly: { year: number; ret: number; vol: number; maxDd: number; sharpe: number }[];
  monthly24: { t: string; ret: number }[];
};

export type AnalysisPayload = {
  scorecard: { key: string; label: string; score: number; grade: string; note: string }[];
  sectors: { sector: string; port: number; bench: number | null }[];
  overlap: { id: string; name: string; overlap: number; shared: string[] }[];
  correlation: { labels: string[]; matrix: number[][] };
  homeBias: { us: number; intl: number; globalUs: number; globalIntl: number };
  currency: { ccy: string; value: number; pct: number }[];
  bubbles: { id: string; label: string; vol: number; ret: number; weight: number; color: string; isPortfolio: boolean }[];
  concentration: { hhi: number; grade: string; top3: number; top5: number; top10: number; maxSingle: number };
  factors: { name: string; tilt: number }[];
  attribution: { id: string; label: string; contrib: number; color: string }[];
};
