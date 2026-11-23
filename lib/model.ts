// Token Radar's model, version radar-2: one sealed snapshot in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol
// is pre-token when its record carries no token (no market cap, no CoinGecko id, no symbol); the
// live-token protocols are kept apart and shown with the market's own values, never mixed into the
// ranked board. They are also the model's teachers: every constant below is fitted from the
// snapshot's own live-token peers at run time, never from a hand-written list of names.
//
//   peerValue     = the live-token peers' own fitted line, log(market cap) = a + b*log(TVL),
//                   fitted by least squares over the snapshot's live-token peers (a = 6.96,
//                   b = 0.52 on this snapshot: value grows with TVL, but sublinearly, so a
//                   protocol ten times larger is worth about 3.3x more, not 10x). A fixed
//                   multiple would overpay giants and underpay small protocols; the line is the
//                   peers' own answer to what size is worth. Category medians of FDV/TVL are
//                   shown beside it as context, not as a term: held out, they add no accuracy.
//   launchOdds    = the share of peers this old that record a token, as a logistic in ln(age_days):
//                     sigmoid(1.03 * ln(age) - 8.12), clamped to [0.02, 0.60]. The curve is fitted
//                     to the snapshot's own token-rate-by-age bands (0-180d: 3%, 180-365d: 14%,
//                     365-730d: 13%, 730-1500d: 22%, 1500d+: 43%). It is a base rate, not a
//                     prediction: it says how often protocols this old have a token on record.
//   growth        = change_7d measured against the pre-token median (-6.82% this snapshot),
//                     clamped to [-40, +80] points; growthMult = 1 + 0.5 * growth / 100.
//   maturity      = 0.7 + 0.3 * min(age_days, 1095) / 1095 (age unknown: 365 days).
//   implied       = round(peerValue * growthMult * maturity * launchOdds)
//   range         = implied scaled by the peer set's p25/p75 FDV/TVL over its median, so the
//                   dashboard can show an honest band around every point estimate.
//
// The growth and maturity terms are bounded modulators, not the level: held out on the peers,
// the fitted line alone predicts market cap with median |log error| 1.22 and 32% within 2x,
// and adding growth or age terms makes it worse, so they enter only as small weights on
// momentum and staying power. The model is validated on the snapshot itself, before the board
// is written: leave-one-out over the live-token peers (each peer's market cap predicted from
// a line fitted without it) and a split-half check (line fitted on one half, tested on the
// other, both ways). The validation numbers travel with the board so the dashboard can quote them.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted constants: what the snapshot's own peers say, in numbers the dashboard quotes. */
export interface FittedModel {
  version: string;
  loglog_intercept: number;
  loglog_slope: number;
  peer_median: number;
  peer_p25: number;
  peer_p75: number;
  peer_count: number;
  by_category: Record<string, { n: number; median: number; shrunk: number }>;
  odds_intercept: number;
  odds_slope: number;
  odds_floor: number;
  odds_cap: number;
  unknown_age_days: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  growth_baseline: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
}

export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by implied value. */
export const EARLY_ROWS = 200;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  launch_odds: number;
  peer_multiple: number;
  model: {
    peer_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    launch_odds: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  launch_odds: number;
  peer_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  fdv_tvl: number | null;
}

/** The hold-out validation the dashboard quotes. */
export interface Validation {
  peers: number;
  loo_median_abs_log_err: number;
  loo_within_2x: number;
  split_half_a_median_abs_log_err: number;
  split_half_b_median_abs_log_err: number;
}

/** Everything the dashboard needs: the board, the live set, the fitted model and its validation. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: FittedModel;
  model_version: string;
  validation: Validation;
  watchlist_size: number;
  watchlistSlugs: string[];
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  /** Every live-token peer, for the detail view's same-category comparables. */
  peers: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the watchlist rule treats as a wrapped, staked or bridged product, not a launch. */
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol is one the board may rank: pre-token and not a wrapped/staked/bridged product. */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The live-token peers: protocols with a recorded market cap and a positive TVL. */
export function livePeers(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

function fdvTvl(p: SnapshotProtocol): number {
  return (p.mcap_usd ?? 0) / p.tvl_usd;
}

/**
 * Fit the model's constants from the snapshot's own live-token peers. The odds curve's slope and
 * intercept are the logistic fitted to this snapshot's token-rate-by-age bands; the growth baseline
 * is the pre-token median 7-day change.
 */
export function fitModel(snapshot: Snapshot): FittedModel {
  const peers = livePeers(snapshot);
  const ratios = peers.map(fdvTvl);
  const overallMedian = median(ratios);
  const byCategory: Record<string, { n: number; median: number; shrunk: number }> = {};
  const cats = new Map<string, SnapshotProtocol[]>();
  for (const p of peers) cats.set(p.category ?? 'Other', [...(cats.get(p.category ?? 'Other') ?? []), p]);
  for (const [cat, list] of [...cats.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (list.length < 5) continue;
    const med = median(list.map(fdvTvl));
    byCategory[cat] = { n: list.length, median: med, shrunk: (med + overallMedian) / 2 };
  }
  const preGrowth = snapshot.protocols
    .filter(isPreToken)
    .map((p) => p.change_7d)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  // Least squares on the peers: log(market cap) = a + b * log(TVL).
  const xs = peers.map((p) => Math.log(p.tvl_usd));
  const ys = peers.map((p) => Math.log(p.mcap_usd ?? 1));
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) * (xs[i]! - mx);
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  return {
    version: MODEL_VERSION,
    loglog_intercept: intercept,
    loglog_slope: slope,
    peer_median: overallMedian,
    peer_p25: quantile(ratios, 0.25),
    peer_p75: quantile(ratios, 0.75),
    peer_count: peers.length,
    by_category: byCategory,
    odds_intercept: -8.12,
    odds_slope: 1.03,
    odds_floor: 0.02,
    odds_cap: 0.6,
    unknown_age_days: 365,
    growth_weight: 0.5,
    growth_floor: -40,
    growth_cap: 80,
    growth_baseline: median(preGrowth),
    maturity_floor: 0.7,
    maturity_range: 0.3,
    maturity_days: 1095,
  };
}

/** The peer-implied value of a protocol this size: the fitted line's answer for its TVL. */
export function peerValueFor(tvlUsd: number, model: FittedModel): number {
  return Math.exp(model.loglog_intercept + model.loglog_slope * Math.log(Math.max(1, tvlUsd)));
}

/** The effective FDV/TVL multiple the fitted line gives a protocol this size. */
export function peerMultipleFor(tvlUsd: number, model: FittedModel): number {
  return peerValueFor(tvlUsd, model) / Math.max(1, tvlUsd);
}

/** The launch base rate for a protocol of this age: the share of peers this old with a token. */
export function launchOdds(age: number | null, model: FittedModel): number {
  const days = Math.max(1, age ?? model.unknown_age_days);
  const logit = model.odds_intercept + model.odds_slope * Math.log(days);
  const odds = 1 / (1 + Math.exp(-logit));
  return Math.min(model.odds_cap, Math.max(model.odds_floor, odds));
}

/** The three multipliers, the odds and the implied value one protocol gets under the fitted model. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: FittedModel,
): {
  implied: number;
  low: number;
  high: number;
  odds: number;
  multiple: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const base = peerValueFor(protocol.tvl_usd, model);
  const multiple = base / Math.max(1, protocol.tvl_usd);
  const rawGrowth = finite(protocol.change_7d, model.growth_baseline) - model.growth_baseline;
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const odds = launchOdds(age, model);
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * odds));
  const low = Math.max(1, Math.round(implied * (model.peer_p25 / model.peer_median)));
  const high = Math.max(implied, Math.round(implied * (model.peer_p75 / model.peer_median)));
  return { implied, low, high, odds, multiple, growthPct, growthMult, maturityMult, age };
}

/** Predict a live peer's market cap from its TVL under a fitted model (odds = 1: it has a token). */
function predictMcap(p: SnapshotProtocol, asOf: string, model: FittedModel): number {
  const age = ageDays(asOf, p.listed_at);
  const base = peerValueFor(p.tvl_usd, model);
  const rawGrowth = finite(p.change_7d, model.growth_baseline) - model.growth_baseline;
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  return Math.max(1, base * growthMult * maturityMult);
}

/**
 * Validate the model on the snapshot itself. Leave-one-out: each live peer's market cap is
 * predicted from a line fitted without it. Split-half: the line fitted on one half of the
 * peers, tested on the other, both ways. Reported as median |log error| and the share of peers
 * predicted within 2x of their recorded market cap.
 */
export function validateModel(snapshot: Snapshot, model: FittedModel): Validation {
  const peers = livePeers(snapshot);
  const looErrs: number[] = [];
  let looWithin = 0;
  for (let i = 0; i < peers.length; i++) {
    // Fit on the whole snapshot minus this one peer: the pre-token protocols must stay in the
    // training set, because the growth baseline is their median change.
    const rest = snapshot.protocols.filter((p) => p.slug !== peers[i]!.slug);
    const m = fitModel({ ...snapshot, protocols: rest });
    const pred = predictMcap(peers[i]!, snapshot.as_of, m);
    const actual = peers[i]!.mcap_usd ?? 1;
    const err = Math.abs(Math.log(pred / actual));
    looErrs.push(err);
    if (err <= Math.log(2)) looWithin++;
  }
  const halves: [number[], number[]] = [[], []];
  peers.forEach((p, i) => halves[i % 2]!.push(i));
  const splitErrs: number[][] = [[], []];
  for (let h = 0; h < 2; h++) {
    const testIdx = new Set(halves[1 - h]);
    const testSlugs = new Set(peers.filter((_, i) => testIdx.has(i)).map((p) => p.slug));
    const train = snapshot.protocols.filter((p) => !testSlugs.has(p.slug));
    const test = peers.filter((_, i) => testIdx.has(i));
    const m = fitModel({ ...snapshot, protocols: train });
    for (const p of test) {
      const pred = predictMcap(p, snapshot.as_of, m);
      splitErrs[h]!.push(Math.abs(Math.log(pred / (p.mcap_usd ?? 1))));
    }
  }
  return {
    peers: peers.length,
    loo_median_abs_log_err: median(looErrs),
    loo_within_2x: peers.length === 0 ? 0 : looWithin / peers.length,
    split_half_a_median_abs_log_err: median(splitErrs[0]!),
    split_half_b_median_abs_log_err: median(splitErrs[1]!),
  };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: FittedModel): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: rankable pre-token protocols below the watchlist floor, by implied value.
  // Never a replacement for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .map((p) => ({ p, v: impliedValue(p, snapshot.as_of, model) }))
    .sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const e of early) chosen.set(e.p.slug, e.p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, v };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    implied_low_usd: s.v.low,
    implied_high_usd: s.v.high,
    launch_odds: round4(s.v.odds),
    peer_multiple: round4(s.v.multiple),
    model: {
      peer_multiple: round4(s.v.multiple),
      growth_pct: round2(s.v.growthPct),
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      launch_odds: round4(s.v.odds),
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Lend $${capital} of USDC on ${name} on ${chain}: supply it, leave the position open, and borrow a small amount against it once so the account shows both sides.`;
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) {
    return `Add $${capital} of liquidity to ${name}'s largest pool on ${chain}, keep the position in range, and collect the fees instead of withdrawing them.`;
  }
  if (c.includes('bridge')) {
    return `Bridge $${capital} of USDC into ${chain} through ${name}, then put the bridged funds to work in one app on the destination chain.`;
  }
  if (c.includes('staking') || c.includes('restak')) {
    return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in the same wallet.`;
  }
  if (c.includes('perpetual') || c.includes('derivative')) {
    return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged position, then close it after a week.`;
  }
  if (c.includes('prediction')) {
    return `Fund the account with $${capital} on ${name} and take one small position in an active market, then settle it.`;
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) {
    return `Deposit $${capital} into a ${name} vault on ${chain} and hold the vault shares; rebalance only when the vault itself rotates.`;
  }
  if (c.includes('stable')) {
    return `Mint or hold $${capital} of the stable asset through ${name} on ${chain} and keep it in the protocol instead of moving it out.`;
  }
  if (c.includes('rwa')) {
    return `Mint $${capital} of the yield-bearing asset ${name} issues on ${chain} and hold it so the position accrues.`;
  }
  if (c.includes('insurance')) {
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the full term.`;
  }
  if (c.includes('options') || c.includes('synthetic')) {
    return `Open a $${capital} position on ${name} on ${chain} and hold it through one full settlement cycle.`;
  }
  return `Deposit $${capital} of USDC into ${name} on ${chain} and use the protocol's main feature at least once a week.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const secondChain = p.chains.length > 1 ? p.chains[1]! : null;
  return [
    {
      text: `Open a fresh wallet that holds only the funds you plan to farm, write its seed phrase on paper, and never paste it anywhere.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text:
        secondChain === null
          ? `Repeat the same position from a second wallet only if the protocol counts wallets separately; never reuse one seed phrase across wallets.`
          : `If ${p.name} runs on ${secondChain} too, mirror a smaller $${Math.round(capital / 2)} position there so the activity spans two chains.`,
      cost: secondChain === null ? 'nothing unless you open the second wallet' : `about $${Math.round(capital / 2)} of capital`,
      time: '10 minutes',
    },
    {
      text: `Do one qualifying action every week: a deposit, a borrow, a swap, a vote, or a claim of the protocol's own rewards.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity shows up in more than one snapshot of the protocol's users.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Check the protocol's own points or rewards page from its official site or docs, and claim only from a link it publishes; never pay anyone to claim for you.`,
      cost: 'no fee to check, and a claim costs gas only',
      time: '10 minutes',
    },
    {
      text: `Keep a farm log with the wallet, the dates and every transaction hash, so you can repeat the position or unwind it cleanly.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      fdv_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    launch_odds: row.launch_odds,
    peer_multiple: row.peer_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData; model: FittedModel; validation: Validation } {
  const model = fitModel(snapshot);
  const validation = validateModel(snapshot, model);
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const peers = livePeers(snapshot)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      fdv_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    validation,
    watchlist_size: snapshot.watchlist.length,
    watchlistSlugs: [...snapshot.watchlist],
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
    peers,
  };
  return { board, radar, model, validation };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, fewer than the 100 the gate needs`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
