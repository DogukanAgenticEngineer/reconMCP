const ALIAS_GROUPS = [
  ['customerid', 'clientid', 'custid', 'customerkey', 'clientkey'],
  ['invoiceid', 'invoiceno', 'billno', 'billingid'],
  ['transactionid', 'txnid', 'transactionno', 'paymentid'],
  ['orderid', 'orderno', 'purchaseorderid'],
  ['recordid', 'rowid', 'entryid'],
  ['email', 'emailaddress'],
  ['phonenumber', 'phone', 'mobile', 'telephone'],
] as const;

export function canonicalColumnName(name: string): string {
  const normalized = name.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '');
  return ALIAS_GROUPS.find((group) => (group as readonly string[]).includes(normalized))?.[0] ?? normalized;
}

export function inferFieldPairs(leftColumns: string[], rightColumns: string[]): Array<{ left: string; right: string }> {
  const rightByCanonical = new Map<string, string>();
  for (const column of rightColumns) {
    const canonical = canonicalColumnName(column);
    if (canonical && !rightByCanonical.has(canonical)) rightByCanonical.set(canonical, column);
  }
  const usedRight = new Set<string>();
  return leftColumns.flatMap((left) => {
    const right = rightByCanonical.get(canonicalColumnName(left));
    if (!right || usedRight.has(right)) return [];
    usedRight.add(right);
    return [{ left, right }];
  });
}

export function inferKeyPairs(pairs: Array<{ left: string; right: string }>): Array<{ left: string; right: string }> {
  const priority = ['id', 'uuid', 'recordid', 'customerid', 'invoiceid', 'transactionid', 'orderid'];
  return pairs
    .filter(({ left }) => priority.includes(canonicalColumnName(left)))
    .sort((a, b) => priority.indexOf(canonicalColumnName(a.left)) - priority.indexOf(canonicalColumnName(b.left)))
    .slice(0, 1);
}
