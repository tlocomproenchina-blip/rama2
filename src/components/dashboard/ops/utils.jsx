import { parseISO, isAfter, isBefore, format } from 'date-fns';

export function withinRange(dateStr, start, end) {
  const d = parseISO(dateStr);
  if (start && isBefore(d, parseISO(start))) return false;
  if (end && isAfter(d, parseISO(end))) return false;
  return true;
}

export function filterData(data, { startDate, endDate, service }) {
  return data.filter((item) => {
    const passDate = withinRange(item.date, startDate, endDate);
    const passService = !service || service === 'All' ? true : item.service === service;
    return passDate && passService;
  });
}

export function aggregateDaily(shipments) {
  const map = new Map();
  shipments.forEach((s) => {
    const key = s.date;
    if (!map.has(key)) map.set(key, { date: key, cost: 0, volume: 0, count: 0, daysSum: 0 });
    const r = map.get(key);
    r.cost += s.costUsd;
    r.volume += s.volume;
    r.count += 1;
    r.daysSum += s.deliveryDays;
  });
  return Array.from(map.values())
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => ({ ...r, avgDays: r.count ? r.daysSum / r.count : 0 }));
}

export function computeKPIs(shipments) {
  const totalShipments = shipments.length;
  const totalVolume = shipments.reduce((a, s) => a + s.volume, 0);
  const totalCosts = shipments.reduce((a, s) => a + s.costUsd, 0);
  const avgDelivery = totalShipments ? shipments.reduce((a, s) => a + s.deliveryDays, 0) / totalShipments : 0;
  const delivered = shipments.filter((s) => s.status === 'delivered').length;
  const delayed = shipments.filter((s) => s.status === 'delayed').length;
  const onTime = Math.max(0, Math.min(totalShipments, delivered - delayed));
  const onTimeRate = totalShipments ? (onTime / totalShipments) * 100 : 0;
  const avgCostPerShipment = totalShipments ? totalCosts / totalShipments : 0;
  return { totalShipments, totalVolume, totalCosts, avgDelivery, onTimeRate, avgCostPerShipment };
}

export function distributionByService(shipments) {
  const map = new Map();
  shipments.forEach((s) => {
    map.set(s.service, (map.get(s.service) || 0) + 1);
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

export function claimsSummary(claims) {
  const open = claims.filter((c) => c.status === 'Open');
  const closed = claims.filter((c) => c.status === 'Closed');
  const compAmount = closed.reduce((a, c) => a + (c.amountUsd || 0), 0);
  const freq = new Map();
  claims.forEach((c) => freq.set(c.category, (freq.get(c.category) || 0) + 1));
  let top = null; let max = -1;
  freq.forEach((v, k) => { if (v > max) { max = v; top = k; } });
  return { openCount: open.length, closedCount: closed.length, compAmount, topCategory: top || '—' };
}

export function formatMoney(n) { return `$${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }
export function formatMoney2(n) { return `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }