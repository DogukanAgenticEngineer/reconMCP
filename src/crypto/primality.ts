import { randomBytes } from 'node:crypto';

const U64_LIMIT = 1n << 64n;
const DETERMINISTIC_U64_BASES = [2n, 325n, 9375n, 28178n, 450775n, 9780504n, 1795265022n] as const;
const SMALL_PRIMES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n] as const;

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let factor = base % modulus;
  let power = exponent;
  while (power > 0n) {
    if (power & 1n) result = (result * factor) % modulus;
    factor = (factor * factor) % modulus;
    power >>= 1n;
  }
  return result;
}

function passesMillerRabin(n: bigint, base: bigint): boolean {
  const a = base % n;
  if (a === 0n) return true;
  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) { d >>= 1n; s += 1; }
  let x = modPow(a, d, n);
  if (x === 1n || x === n - 1n) return true;
  for (let r = 1; r < s; r += 1) {
    x = (x * x) % n;
    if (x === n - 1n) return true;
  }
  return false;
}

function parseInteger(value: string): bigint {
  if (!/^(?:0|[1-9][0-9]{0,1233})$/.test(value)) throw new Error('n must be a non-negative decimal integer with at most 1234 digits.');
  return BigInt(value);
}

export interface PrimeVerification {
  n: string;
  verdict: 'composite' | 'prime' | 'probable_prime';
  assurance: 'deterministic_u64' | 'probabilistic';
  method: string;
  rounds: number;
  caveat: string;
}

export function verifyPrimeDecimal(value: string, rounds = 32): PrimeVerification {
  const n = parseInteger(value);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 64) throw new Error('rounds must be an integer from 1 to 64.');
  if (n < 2n) return { n: value, verdict: 'composite', assurance: 'deterministic_u64', method: 'range-check', rounds: 0, caveat: 'Values below 2 are not prime.' };
  for (const p of SMALL_PRIMES) {
    if (n === p) return { n: value, verdict: 'prime', assurance: 'deterministic_u64', method: 'small-prime equality', rounds: 0, caveat: 'Exact result.' };
    if (n % p === 0n) return { n: value, verdict: 'composite', assurance: 'deterministic_u64', method: 'small-prime division', rounds: 0, caveat: 'Exact result.' };
  }
  if ((n & 1n) === 0n) return { n: value, verdict: 'composite', assurance: 'deterministic_u64', method: 'evenness check', rounds: 0, caveat: 'Exact result.' };

  if (n < U64_LIMIT) {
    const passed = DETERMINISTIC_U64_BASES.every((base) => passesMillerRabin(n, base));
    return {
      n: value,
      verdict: passed ? 'prime' : 'composite',
      assurance: 'deterministic_u64',
      method: 'Miller-Rabin with the proven 64-bit base set',
      rounds: DETERMINISTIC_U64_BASES.length,
      caveat: 'Deterministic only for integers below 2^64; no RH/GRH assumption is used.',
    };
  }

  for (let i = 0; i < rounds; i += 1) {
    const base = 2n + randomBelow(n - 3n);
    if (!passesMillerRabin(n, base)) {
      return { n: value, verdict: 'composite', assurance: 'probabilistic', method: 'Miller-Rabin', rounds: i + 1, caveat: 'A witness proves compositeness; a passing result is not a primality proof.' };
    }
  }
  return {
    n: value,
    verdict: 'probable_prime',
    assurance: 'probabilistic',
    method: 'Miller-Rabin with cryptographically random bases',
    rounds,
    caveat: 'Passing rounds do not prove primality. Under the standard independent-uniform-base model, the false-positive upper bound is at most 4^-rounds; this is not a Lean certificate or a GRH-based proof.',
  };
}

function randomBelow(limit: bigint): bigint {
  if (limit <= 0n) throw new Error('random range must be positive.');
  const bits = limit.toString(2).length;
  const bytes = Math.ceil(bits / 8);
  const mask = (1n << BigInt(bits)) - 1n;
  for (;;) {
    const candidate = BigInt(`0x${randomBytes(bytes).toString('hex')}`) & mask;
    if (candidate < limit) return candidate;
  }
}

export interface PrimeGeneration {
  prime: string;
  bits: number;
  assurance: 'probabilistic';
  rounds: number;
  candidatesTested: number;
  caveat: string;
}

export function generateProbablePrime(bits: number, rounds = 32): PrimeGeneration {
  if (!Number.isInteger(bits) || bits < 128 || bits > 4096) throw new Error('bits must be an integer from 128 to 4096.');
  if (!Number.isInteger(rounds) || rounds < 16 || rounds > 64) throw new Error('rounds must be an integer from 16 to 64 for generation.');
  const byteLength = Math.ceil(bits / 8);
  const excessBits = byteLength * 8 - bits;
  let candidatesTested = 0;
  for (;;) {
    const bytes = randomBytes(byteLength);
    if (excessBits > 0) bytes[0] = bytes[0]! & (0xff >>> excessBits);
    bytes[0] = bytes[0]! | (1 << (7 - excessBits));
    bytes[byteLength - 1] = bytes[byteLength - 1]! | 1;
    const candidate = BigInt(`0x${bytes.toString('hex')}`);
    candidatesTested += 1;
    if (verifyPrimeDecimal(candidate.toString(), rounds).verdict === 'probable_prime') {
      return {
        prime: candidate.toString(),
        bits,
        assurance: 'probabilistic',
        rounds,
        candidatesTested,
        caveat: 'Generated with CSPRNG and Miller-Rabin screening only. Not a certified prime; not suitable as a drop-in RSA key-generation implementation without independent cryptographic review and a standards-compliant key-generation pipeline.',
      };
    }
  }
}
