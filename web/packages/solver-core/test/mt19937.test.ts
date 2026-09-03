import { describe, expect, it } from "vitest";
import { MT19937 } from "../src/rng/mt19937.js";

/** Vectors generated from CPython 3.11 `random.Random`. */
const REF = {
  getrandbits32: {
    0: [3626764237, 1654615998, 3255389356, 3823568514, 1806341205, 173879092, 1112038970, 4146640122],
    1: [577090037, 2444712010, 3639700191, 3445702192, 3280387012, 271041745, 1095513148, 506456969],
    42: [2746317213, 478163327, 107420369, 3184935163, 1181241943, 1051802512, 958682846, 599310825],
    12345: [1789368711, 3146859322, 43676229, 3522623596, 3544234957, 3448207591, 1282648386, 3672791226],
    2147483648: [1455117090, 1620553392, 2169224728, 3773848694, 3818853303, 3836444491, 699726885, 2729968541],
  } as Record<number, number[]>,
  getrandbits_k_seed7: {
    k: [1, 3, 5, 7, 10, 16, 31, 32, 33, 53, 64],
    v: [0, 7, 4, 50, 666, 3164, 155555737, 3527346212, 2301595691n, 5249289124956664n, 16781078052021535861n],
  },
  randbelow_seed123: {
    n: [1, 2, 3, 5, 7, 9, 10, 16, 17, 81, 100, 1000],
    v: [0, 1, 0, 3, 2, 1, 0, 12, 10, 43, 6, 163],
  },
  shuffle12: {
    0: [1, 9, 8, 5, 10, 2, 3, 7, 4, 0, 11, 6],
    1: [7, 11, 0, 8, 5, 6, 3, 10, 4, 1, 9, 2],
    2: [9, 11, 3, 4, 7, 6, 8, 2, 5, 10, 1, 0],
    42: [7, 5, 2, 8, 9, 6, 11, 3, 4, 0, 1, 10],
  } as Record<number, number[]>,
  choice_seed99: [40, 40, 20, 50, 20, 20, 20, 20, 70, 10, 30, 60, 40, 50, 60],
};

describe("MT19937 vs CPython", () => {
  it.each(Object.keys(REF.getrandbits32).map(Number))("genrand_uint32 stream, seed %i", (seed) => {
    const r = new MT19937(seed);
    const got = Array.from({ length: 8 }, () => r.genrandUint32());
    expect(got).toEqual(REF.getrandbits32[seed]);
  });

  it("getrandbits(k) small and large, seed 7", () => {
    const r = new MT19937(7);
    const got = REF.getrandbits_k_seed7.k.map((k) => r.getrandbits(k));
    const want = REF.getrandbits_k_seed7.v.map((v) => (typeof v === "bigint" ? v : v));
    expect(got).toEqual(want);
  });

  it("_randbelow(n) with rejection sampling, seed 123", () => {
    const r = new MT19937(123);
    const got = REF.randbelow_seed123.n.map((n) => r.randbelow(n));
    expect(got).toEqual(REF.randbelow_seed123.v);
  });

  it.each(Object.keys(REF.shuffle12).map(Number))("shuffle(range(12)), seed %i", (seed) => {
    const r = new MT19937(seed);
    const x = Array.from({ length: 12 }, (_, i) => i);
    r.shuffle(x);
    expect(x).toEqual(REF.shuffle12[seed]);
  });

  it("choice over a 7-element list, seed 99", () => {
    const r = new MT19937(99);
    const pool = [10, 20, 30, 40, 50, 60, 70];
    const got = Array.from({ length: 15 }, () => r.choice(pool));
    expect(got).toEqual(REF.choice_seed99);
  });
});
