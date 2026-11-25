import { describe, expect, it } from 'vitest';
import { verifyPrimeUnderGrh } from '../src/crypto/grh-primality.js';
import { generateLeanPrimeCertificateSource } from '../src/crypto/lean-certificate.js';

describe('GRH-conditional primality verification', () => {
  it('labels a prime result as conditional on GRH', () => {
    const result = verifyPrimeUnderGrh('18446744073709551629');
    expect(result.verdict).toBe('conditional_prime');
    expect(result.assurance).toBe('conditional_grh');
    expect(result.assumption).toBe('GRH_for_Dirichlet_L_functions');
    expect(result.basesChecked).toBeGreaterThan(0);
  });

  it('returns unconditional compositeness when a small factor is found', () => {
    const result = verifyPrimeUnderGrh('91');
    expect(result.verdict).toBe('composite');
    expect(result.assurance).toBe('unconditional');
    expect(result.assumption).toBe('none');
  });

  it('returns inconclusive when the full base interval exceeds budget', () => {
    const n = ((1n << 511n) + 1n).toString();
    const result = verifyPrimeUnderGrh(n, 100);
    expect(result.verdict).toBe('inconclusive');
    expect(result.assurance).toBe('not_verified');
    expect(result.basesChecked).toBe(0);
  });

  it('handles 2 without invoking GRH', () => {
    const result = verifyPrimeUnderGrh('2');
    expect(result.assurance).toBe('unconditional');
    expect(result.assumption).toBe('none');
  });

  it('rejects invalid work budgets', () => {
    expect(() => verifyPrimeUnderGrh('101', 0)).toThrow();
    expect(() => verifyPrimeUnderGrh('101', 1_000_001)).toThrow();
  });
});

describe('Lean proof-script generation', () => {
  it('returns a concrete theorem without claiming it was checked', () => {
    const result = generateLeanPrimeCertificateSource('97');
    expect(result.source).toContain('theorem recon_prime_certificate : Nat.Prime 97');
    expect(result.source).toContain('  norm_num');
    expect(result.verificationStatus).toBe('generated_not_checked');
    expect(result.dependency).toBe('Mathlib');
  });

  it('rejects values outside the supported input range', () => {
    expect(() => generateLeanPrimeCertificateSource('1')).toThrow();
    expect(() => generateLeanPrimeCertificateSource('x')).toThrow();
  });
});
