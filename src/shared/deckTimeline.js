// Resolving from the current beat also handles replay and skip-to-verdict.
export function deckSlideAtBeat(deck, beatIndex) {
  if (!deck?.slides?.length) return -1;
  let current = 0;
  for (let i = 0; i < deck.slides.length; i++) {
    if (deck.slides[i].beatIndex > beatIndex) break;
    current = i;
  }
  return current;
}
