import { pickWeightedCategory } from './dsh-pet-pickers.mjs';

function during(hour, [begin, end]) {
  return begin > end ? hour >= begin || hour < end : hour >= begin && hour < end;
}

export function pick(pool, settings, available, previous, date = new Date(), random = Math.random) {
  const hour = date.getHours();
  const month = date.getMonth();
  const options = (settings[pool] || []).filter(item => available[item.action] &&
    (!item.nightOnly || during(hour, settings.nightHours)))
    .map(item => {
      const seasonal = month >= 5 && month <= 7 ? item.summerWeight :
        month === 11 || month <= 1 ? item.winterWeight : undefined;
      const weight = during(hour, settings.morningHours) ? item.morningWeight ?? seasonal ?? item.weight :
        seasonal ?? item.weight;
      return { ...item, weight };
    }).filter(item => item.weight > 0);
  const other = options.filter(item => item.action !== previous);
  const candidates = other.length ? other : options;
  const categories = candidates.map(({ action, weight }) => ({ id: action, weight, actions: [action] }));
  return pickWeightedCategory(categories, 'left', random)?.id ?? null;
}

