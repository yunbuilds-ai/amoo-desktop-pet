// dsh-pet 725088735a3ecc0933fae2c13e38beed87903ba7 src/shared/pickers.ts (MIT, PC2005-cloud)
// Adaptations: injectable random source and AOMM interval boundary. See dsh-pet-LICENSE.txt.
export const pickWeightedCategory = (categories            , facing        , random               = Math.random)                  => {
  const cats = categories.filter((c) => c.actions.length > 0);
  if (!cats.length) return null;
  const filtered = cats.filter((c) => !(c.noMirror && facing === 'right'));
  const eligible = filtered.length ? filtered : cats;
  const totalW = eligible.reduce((s, c) => s + c.weight, 0) || 1;
  let t = random() * totalW;
  for (const c of eligible) {
    t -= c.weight;
    if (t < 0) return c;
  }
  return eligible[eligible.length - 1];
};

