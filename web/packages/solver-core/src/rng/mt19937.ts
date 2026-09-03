/**
 * CPython-compatible Mersenne Twister (MT19937) plus the slices of
 * `random.Random` that `min_conflicts` uses: `getrandbits`, `_randbelow`
 * (rejection sampling on random bits, *not* modulo), `shuffle`
 * (Fisher-Yates descending), and `choice`.
 *
 * This exists so the TypeScript `min_conflicts` reproduces the Python
 * reference seed-for-seed. Verified against generated CPython 3.11 vectors in
 * mt19937.test.ts.
 *
 * All 32-bit math is done with `Math.imul` and `>>> 0`. `getrandbits(k>32)`
 * returns a bigint; the solver only ever needs k <= 7, which stays on the
 * `number` fast path.
 */

const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;

export class MT19937 {
  private mt = new Uint32Array(N);
  private mti = N + 1;

  constructor(seed?: number) {
    if (seed !== undefined) this.seedInt(seed);
  }

  /** `random.Random(seed).seed(int)` — init_by_array over the LE 32-bit words of |seed|. */
  seedInt(seed: number): void {
    let n = BigInt(Math.trunc(Math.abs(seed)));
    const key: number[] = [];
    do {
      key.push(Number(n & 0xffffffffn));
      n >>= 32n;
    } while (n > 0n);
    this.initByArray(key);
  }

  private initGenrand(s: number): void {
    const mt = this.mt;
    mt[0] = s >>> 0;
    for (let i = 1; i < N; i++) {
      const prev = mt[i - 1];
      mt[i] = (Math.imul(1812433253, prev ^ (prev >>> 30)) + i) >>> 0;
    }
    this.mti = N;
  }

  private initByArray(key: number[]): void {
    this.initGenrand(19650218);
    const mt = this.mt;
    let i = 1;
    let j = 0;
    let k = Math.max(N, key.length);
    for (; k; k--) {
      const prev = mt[i - 1];
      mt[i] = (((mt[i] ^ Math.imul(prev ^ (prev >>> 30), 1664525)) >>> 0) + key[j] + j) >>> 0;
      i++;
      j++;
      if (i >= N) {
        mt[0] = mt[N - 1];
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (k = N - 1; k; k--) {
      const prev = mt[i - 1];
      mt[i] = (((mt[i] ^ Math.imul(prev ^ (prev >>> 30), 1566083941)) >>> 0) - i) >>> 0;
      i++;
      if (i >= N) {
        mt[0] = mt[N - 1];
        i = 1;
      }
    }
    mt[0] = 0x80000000;
  }

  /** One 32-bit output word. */
  genrandUint32(): number {
    const mt = this.mt;
    let y: number;
    if (this.mti >= N) {
      let kk = 0;
      for (; kk < N - M; kk++) {
        y = (mt[kk] & UPPER_MASK) | (mt[kk + 1] & LOWER_MASK);
        mt[kk] = mt[kk + M] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      for (; kk < N - 1; kk++) {
        y = (mt[kk] & UPPER_MASK) | (mt[kk + 1] & LOWER_MASK);
        mt[kk] = mt[kk + (M - N)] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      y = (mt[N - 1] & UPPER_MASK) | (mt[0] & LOWER_MASK);
      mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      this.mti = 0;
    }
    y = mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  /** k <= 32: `genrand_uint32() >> (32 - k)` as a Number. */
  private getrandbits32(k: number): number {
    if (k === 32) return this.genrandUint32();
    return this.genrandUint32() >>> (32 - k);
  }

  /** Full CPython `getrandbits(k)`; returns bigint for k > 32. */
  getrandbits(k: number): number | bigint {
    if (k <= 0) throw new RangeError("getrandbits: k must be > 0");
    if (k <= 32) return this.getrandbits32(k);
    const words = ((k - 1) >> 5) + 1;
    let result = 0n;
    let rem = k;
    for (let i = 0; i < words; i++, rem -= 32) {
      let r = this.genrandUint32();
      if (rem < 32) r >>>= 32 - rem;
      result |= BigInt(r >>> 0) << BigInt(32 * i);
    }
    return result;
  }

  /** `Random._randbelow_with_getrandbits(n)` — reject r >= n on k random bits. */
  randbelow(n: number): number {
    if (n <= 0) return 0;
    const k = 32 - Math.clz32(n); // n.bit_length()
    let r = this.getrandbits32(k);
    while (r >= n) r = this.getrandbits32(k);
    return r;
  }

  /** In-place `Random.shuffle` (Fisher-Yates, i descending from len-1 to 1). */
  shuffle<T>(x: T[]): void {
    for (let i = x.length - 1; i >= 1; i--) {
      const j = this.randbelow(i + 1);
      const tmp = x[i];
      x[i] = x[j];
      x[j] = tmp;
    }
  }

  /** `Random.choice(seq)`. */
  choice<T>(seq: readonly T[]): T {
    if (seq.length === 0) throw new RangeError("Cannot choose from an empty sequence");
    return seq[this.randbelow(seq.length)];
  }
}
