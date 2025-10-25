/**
 * IP address and CIDR utilities
 */

export interface IPPool {
  id?: number;
  name: string;
  cidr: string;
  description?: string;
  parentId?: number | null;
  createdAt?: string;
}

export interface IPPoolWithStats extends IPPool {
  totalIps: number;
  usedIps: number;
  availableIps: number;
  children?: IPPoolWithStats[];
}

/**
 * Convert IP address string to number
 */
export function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Convert number to IP address string
 */
export function numberToIp(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join('.');
}

/**
 * Validate IP address format
 */
export function isValidIp(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255;
  });
}

/**
 * Validate CIDR format
 */
export function isValidCIDR(cidr: string): boolean {
  const parts = cidr.split('/');
  if (parts.length !== 2) return false;
  const [ip, prefix] = parts;
  const prefixNum = parseInt(prefix, 10);
  return isValidIp(ip) && !isNaN(prefixNum) && prefixNum >= 8 && prefixNum <= 32;
}

/**
 * Parse CIDR notation
 */
export function parseCIDR(cidr: string): {
  networkAddress: string;
  broadcastAddress: string;
  firstIp: string;
  lastIp: string;
  totalIps: number;
  prefix: number;
} {
  const [ip, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  const ipNum = ipToNumber(ip);
  const mask = (-1 << (32 - prefix)) >>> 0;
  const network = (ipNum & mask) >>> 0;
  const broadcast = (network | ~mask) >>> 0;

  return {
    networkAddress: numberToIp(network),
    broadcastAddress: numberToIp(broadcast),
    firstIp: numberToIp(network + 1),
    lastIp: numberToIp(broadcast - 1),
    totalIps: Math.pow(2, 32 - prefix),
    prefix,
  };
}

/**
 * Check if two CIDR ranges overlap
 */
export function cidrsOverlap(cidr1: string, cidr2: string): boolean {
  const range1 = parseCIDR(cidr1);
  const range2 = parseCIDR(cidr2);

  const start1 = ipToNumber(range1.networkAddress);
  const end1 = ipToNumber(range1.broadcastAddress);
  const start2 = ipToNumber(range2.networkAddress);
  const end2 = ipToNumber(range2.broadcastAddress);

  return (start1 <= end2 && end1 >= start2);
}

/**
 * Check if child CIDR is within parent CIDR
 */
export function isChildOfParent(childCidr: string, parentCidr: string): boolean {
  const child = parseCIDR(childCidr);
  const parent = parseCIDR(parentCidr);

  const childStart = ipToNumber(child.networkAddress);
  const childEnd = ipToNumber(child.broadcastAddress);
  const parentStart = ipToNumber(parent.networkAddress);
  const parentEnd = ipToNumber(parent.broadcastAddress);

  return childStart >= parentStart && childEnd <= parentEnd;
}

/**
 * Calculate network address from IP and prefix
 */
export function getNetworkAddress(ip: string, prefix: number): string {
  const ipNum = ipToNumber(ip);
  const mask = (-1 << (32 - prefix)) >>> 0;
  const network = (ipNum & mask) >>> 0;
  return numberToIp(network);
}

/**
 * Normalize CIDR notation (ensure network address is correct)
 */
export function normalizeCIDR(cidr: string): string {
  const [ip, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  const network = getNetworkAddress(ip, prefix);
  return `${network}/${prefix}`;
}
