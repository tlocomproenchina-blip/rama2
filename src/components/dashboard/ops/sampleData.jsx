// Sample realistic data generators for shipments and claims
// Services: Maritime DDP, Air DDP, Consolidation, Assisted Purchase

const SERVICES = [
  'Maritime DDP',
  'Air DDP',
  'Consolidation',
  'Assisted Purchase'
];

const CATEGORIES = ['Damage', 'Missing Items', 'Delay', 'Billing', 'Other'];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }

export function generateSampleData(days = 90) {
  const shipments = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);

    // Daily shipments volume varies by weekday
    const base = [5,6,8,9,10,12,7][d.getDay()];
    const count = base + rand(-2, 4);

    for (let j = 0; j < Math.max(1, count); j++) {
      const service = pick(SERVICES);
      const volume = Math.max(0.2, Number((Math.random() * 3.5).toFixed(2))); // m3 or kg-equivalent
      const costUsd = Number((
        (service === 'Air DDP' ? 120 : service === 'Maritime DDP' ? 90 : 60) * (0.8 + Math.random()*0.6)
        * (0.7 + volume/4)
      ).toFixed(2));
      const deliveryDays = service === 'Air DDP' ? rand(5, 10) : service === 'Maritime DDP' ? rand(15, 30) : rand(8, 22);
      const delayed = Math.random() < (service === 'Air DDP' ? 0.12 : 0.18);
      const status = delayed ? 'delayed' : 'delivered';

      shipments.push({
        id: `${dayStr}-${j}-${service.substring(0,2)}-${rand(100,999)}`,
        date: dayStr,
        service,
        costUsd,
        deliveryDays,
        status,
        volume: Number(volume.toFixed(2)),
      });
    }
  }

  // Claims derived loosely from shipments
  const claims = [];
  for (let k = 0; k < Math.floor(shipments.length * 0.07); k++) {
    const s = pick(shipments);
    const isClosed = Math.random() < 0.6;
    const category = pick(CATEGORIES);
    const amountUsd = Number((Math.random() * 180 + (category === 'Damage' ? 50 : 20)).toFixed(2));
    claims.push({
      id: `CLM-${rand(10000, 99999)}`,
      date: s.date,
      service: s.service,
      status: isClosed ? 'Closed' : 'Open',
      category,
      amountUsd,
      customer: `cust_${rand(1000, 9999)}@tlec.com`,
      notes: `${category} reported for ${s.id}. Investigation ${isClosed ? 'completed' : 'in progress'}.`
    });
  }

  return { shipments, claims };
}

export const ALL_SERVICES = SERVICES;