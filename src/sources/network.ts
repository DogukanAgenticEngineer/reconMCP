import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { Agent } from 'undici';

export interface PinnedHost {
  address: string;
  family: 4 | 6;
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '');
}

function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}

function allowlisted(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  const list = (process.env.RECONCILE_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((value) => normalizeHostname(value.trim()))
    .filter(Boolean);
  return list.includes(host);
}

export async function resolveAllowedPublicHost(hostname: string): Promise<PinnedHost> {
  const host = normalizeHostname(hostname);
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || !allowlisted(host)) {
    throw new Error('Bu bağlantı hedefi sunucu izin listesinde değil.');
  }
  if (ipaddr.isValid(host)) {
    if (!isPublicAddress(host)) throw new Error('Özel ağ adreslerine bağlantı izni yok.');
    const parsed = ipaddr.process(host);
    return { address: parsed.toString(), family: parsed.kind() === 'ipv6' ? 6 : 4 };
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(host, { all: true, verbatim: true }) as unknown as Array<{ address: string; family: number }>;
  } catch {
    throw new Error('Bağlantı hedefinin DNS kaydı doğrulanamadı.');
  }
  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Bağlantı hedefi public IP adresine çözümlenmiyor.');
  }
  const selected = addresses[0];
  if (!selected) throw new Error('Bağlantı hedefi çözümlenemedi.');
  return { address: selected.address, family: selected.family as 4 | 6 };
}

export function createPinnedAgent(hostname: string, pinned: PinnedHost): Agent {
  const lookupPinned = (_host: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void): void => {
    callback(null, pinned.address, pinned.family);
  };
  return new Agent({
    connect: {
      lookup: lookupPinned,
      servername: hostname,
      rejectUnauthorized: true,
    },
    headersTimeout: 6_000,
    bodyTimeout: 6_000,
  });
}

export function exactHostname(url: URL): string {
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('Harici REST kaynaklarında yalnız kimlik bilgisi içermeyen HTTPS URL ve standart 443 portu kullanılabilir.');
  }
  return normalizeHostname(url.hostname);
}
