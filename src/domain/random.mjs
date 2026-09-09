const MODULUS = 2_147_483_647;
const MULTIPLIER = 16_807;

export function createSeededRandom(seed) {
  let state = Math.trunc(Number(seed)) % MODULUS;
  if (!Number.isFinite(state) || state === 0) state = 1;
  if (state < 0) state += MODULUS - 1;

  return {
    nextInt() {
      state = (state * MULTIPLIER) % MODULUS;
      return state;
    },
    next() {
      return (this.nextInt() - 1) / (MODULUS - 1);
    },
  };
}

