// Small deterministic PRNG helpers. Every "random" choice in an episode flows
// through one of these so the same pitch + seed always produces the same show.

export function hashString(input) {
  // cyrb53: fast, well-distributed 53-bit string hash.
  const text = String(input ?? "");
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function createRng(...seedParts) {
  // mulberry32 seeded from the hash of every seed part.
  let state = hashString(seedParts.join("|")) >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    float(min = 0, max = 1) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    chance(probability) {
      return next() < probability;
    },
    pick(list) {
      if (!Array.isArray(list) || list.length === 0) {
        return undefined;
      }

      return list[Math.floor(next() * list.length)];
    },
    shuffle(list) {
      const copy = [...list];

      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(next() * (index + 1));
        [copy[index], copy[swap]] = [copy[swap], copy[index]];
      }

      return copy;
    },
    fork(label) {
      return createRng(...seedParts, label);
    },
  };
}
