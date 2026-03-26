export interface Rng {
  nextU32(): number;
  next01(): number; // [0,1)
  int(minInclusive: number, maxInclusive: number): number;
  pick<T>(arr: readonly T[]): T;
}

// Deterministic, fast PRNG for repeatable rounds (xorshift32).
export function createRng(seed: number): Rng {
  let x = seed | 0;
  if (x === 0) x = 0x1a2b3c4d;

  const nextU32 = () => {
    // xorshift32
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    // force uint32
    return x >>> 0;
  };

  const next01 = () => nextU32() / 2 ** 32;

  const int = (minInclusive: number, maxInclusive: number) => {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new Error("int bounds must be integers");
    }
    if (maxInclusive < minInclusive) throw new Error("maxInclusive < minInclusive");
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + (nextU32() % span);
  };

  const pick = <T,>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error("pick() from empty array");
    return arr[int(0, arr.length - 1)]!;
  };

  return { nextU32, next01, int, pick };
}

