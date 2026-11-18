import { describe, expect, it } from 'vitest';
import { inferFieldPairs, inferKeyPairs } from '../src/core/matching.js';

describe('intelligent column matching', () => {
  it('maps conservative semantic aliases across differently named headers', () => {
    expect(inferFieldPairs(
      ['customer_id', 'invoice_no', 'email_address', 'net_amount'],
      ['client_id', 'bill_no', 'email', 'net_amount'],
    )).toEqual([
      { left: 'customer_id', right: 'client_id' },
      { left: 'invoice_no', right: 'bill_no' },
      { left: 'email_address', right: 'email' },
      { left: 'net_amount', right: 'net_amount' },
    ]);
  });

  it('does not treat a customer name as a record key', () => {
    const pairs = inferFieldPairs(['customer_name', 'customer_id'], ['customer_name', 'client_id']);
    expect(inferKeyPairs(pairs)).toEqual([{ left: 'customer_id', right: 'client_id' }]);
  });
});
