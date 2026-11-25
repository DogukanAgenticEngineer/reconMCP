import { describe, expect, it } from 'vitest';
import { generateProbablePrime, verifyPrimeDecimal } from '../src/crypto/primality.js';

describe('cryptographic primality utilities', () => {
  it('handles small exact cases', () => {
    expect(verifyPrimeDecimal('1').verdict).toBe('composite');
    expect(verifyPrimeDecimal('2').verdict).toBe('prime');
    expect(verifyPrimeDecimal('37').verdict).toBe('prime');
    expect(verifyPrimeDecimal('91').verdict).toBe('composite');
  });

  it('uses the deterministic proven base set below 2^64', () => {
    expect(verifyPrimeDecimal('18446744073709551557')).toMatchObject({
      verdict: 'prime',
      assurance: 'deterministic_u64',
    });
    expect(verifyPrimeDecimal('18446744073709551617').assurance).toBe('probabilistic');
  });

  it('generates an exact-bit-length probable prime candidate', () => {
    const result = generateProbablePrime(128, 16);
    expect(BigInt(result.prime).toString(2)).toHaveLength(128);
    expect(result.assurance).toBe('probabilistic');
    expect(verifyPrimeDecimal(result.prime, 16).verdict).toBe('probable_prime');
  });

  it('rejects invalid input and unsafe round counts', () => {
    expect(() => verifyPrimeDecimal('-3')).toThrow();
    expect(() => verifyPrimeDecimal('17', 0)).toThrow();
    expect(() => generateProbablePrime(64)).toThrow();
  });
});
