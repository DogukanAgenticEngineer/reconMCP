import { verifyPrimeDecimal } from './primality.js';

const LN2_UPPER_NUMERATOR = 693_147_181n;
const LN2_DENOMINATOR = 1_000_000_000n;

function gcd(a: bigint, b: bigint): bigint {
  let x = a;
  let y = b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let factor = base % modulus;
  let power = exponent;
  while (power > 0n) {
    if ((power & 1n) === 1n) result = (result * factor) % modulus;
    factor = (factor * factor) % modulus;
    power >>= 1n;
  }
  return result;
}

function isStrongProbablePrime(n: bigint, base: bigint): boolean {
  const a = base % n;
  if (a === 0n) return true;
  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) { d >>= 1n; s += 1; }
  let x = modPow(a, d, n);
  if (x === 1n || x === n - 1n) return true;
  for (let i = 1; i < s; i += 1) {
    x = (x * x) % n;
    if (x === n - 1n) return true;
  }
  return false;
}

function bachBoundFromBitLength(n: bigint): bigint {
  const bits = BigInt(n.toString(2).length);
  const numerator = 2n * bits * bits * LN2_UPPER_NUMERATOR * LN2_UPPER_NUMERATOR;
  const denominator = LN2_DENOMINATOR * LN2_DENOMINATOR;
  return (numerator + denominator - 1n) / denominator;
}

export interface GrhPrimeVerification {
  n: string;
  verdict: 'composite' | 'prime' | 'conditional_prime' | 'inconclusive';
  assurance: 'unconditional' | 'conditional_grh' | 'not_verified';
  assumption: 'none' | 'GRH_for_Dirichlet_L_functions';
  method: string;
  theoreticalBaseBound: string;
  effectiveBaseBound: string;
  basesChecked: number;
  maxBaseChecks: number;
  caveat: string;
}

export function verifyPrimeUnderGrh(value: string, maxBaseChecks = 100_000): GrhPrimeVerification {
  if (!/^(?:0|[1-9][0-9]{0,1233})$/.test(value)) throw new Error('n must be a non-negative decimal integer with at most 1234 digits.');
  if (!Number.isInteger(maxBaseChecks) || maxBaseChecks < 1 || maxBaseChecks > 1_000_000) {
    throw new Error('maxBaseChecks must be an integer from 1 to 1000000.');
  }

  const n = BigInt(value);
  const baseResult = (verdict: GrhPrimeVerification['verdict'], assurance: GrhPrimeVerification['assurance'], assumption: GrhPrimeVerification['assumption'], theoretical: bigint, effective: bigint, checked: number, caveat: string): GrhPrimeVerification => ({
    n: value, verdict, assurance, assumption,
    method: 'Miller-Rabin scan over every integer base from 2 through the conservative Bach bound',
    theoreticalBaseBound: theoretical.toString(),
    effectiveBaseBound: effective.toString(),
    basesChecked: checked,
    maxBaseChecks,
    caveat,
  });

  if (n < 2n) return baseResult('composite', 'unconditional', 'none', 0n, 0n, 0, 'Values below 2 are not prime.');
  if (n === 2n) return baseResult('prime', 'unconditional', 'none', 0n, 0n, 0, '2 is prime by direct exact check; no GRH assumption is needed.');
  if ((n & 1n) === 0n) return baseResult('composite', 'unconditional', 'none', 0n, 0n, 0, 'An even integer greater than 2 is composite.');

  if (n < (1n << 64n)) {
    const small = verifyPrimeDecimal(value);
    return baseResult(
      small.verdict === 'prime' ? 'prime' : 'composite',
      'unconditional',
      'none', 0n, 0n, 0,
      'Handled by the separate proven deterministic 64-bit path; no GRH assumption is used.',
    );
  }

  const theoreticalBound = bachBoundFromBitLength(n);
  const effectiveBound = theoreticalBound < n - 2n ? theoreticalBound : n - 2n;
  const totalBases = effectiveBound >= 2n ? effectiveBound - 1n : 0n;
  if (totalBases > BigInt(maxBaseChecks)) {
    return baseResult(
      'inconclusive', 'not_verified', 'GRH_for_Dirichlet_L_functions',
      theoreticalBound, effectiveBound, 0,
      'The complete conditional base interval exceeds the configured work budget. No primality conclusion was made.',
    );
  }

  let checked = 0;
  for (let a = 2n; a <= effectiveBound; a += 1n) {
    checked += 1;
    const divisor = gcd(a, n);
    if (divisor > 1n && divisor < n) {
      return baseResult('composite', 'unconditional', 'none', theoreticalBound, effectiveBound, checked,
        'A non-trivial gcd is an unconditional compositeness witness.');
    }
    if (divisor === 1n && !isStrongProbablePrime(n, a)) {
      return baseResult('composite', 'unconditional', 'none', theoreticalBound, effectiveBound, checked,
        'A Miller-Rabin strong witness proves compositeness without any RH/GRH assumption.');
    }
  }

  const exhaustive = effectiveBound === n - 2n;
  return baseResult(
    exhaustive ? 'prime' : 'conditional_prime',
    exhaustive ? 'unconditional' : 'conditional_grh',
    exhaustive ? 'none' : 'GRH_for_Dirichlet_L_functions',
    theoreticalBound, effectiveBound, checked,
    exhaustive
      ? 'Every non-trivial base was checked; this finite exhaustive result is unconditional.'
      : 'Prime only conditional on GRH for Dirichlet L-functions and the explicit Bach bound. This is not an unconditional proof or a Lean certificate.',
  );
}
