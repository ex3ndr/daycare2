import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

type AiBotWebhookDeliverInput = {
  webhookUrl: string;
  payload: Record<string, unknown>;
};

class WebhookUrlDisallowedError extends Error {}

function ipv4Restricted(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }
  const first = parts[0] ?? -1;
  const second = parts[1] ?? -1;
  const third = parts[2] ?? -1;

  if (first === 0) {
    return true;
  }

  if (first === 10) {
    return true;
  }

  if (first === 100 && second >= 64 && second <= 127) {
    return true;
  }

  if (first === 127) {
    return true;
  }

  if (first === 169 && second === 254) {
    return true;
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }

  if (first === 192 && second === 168) {
    return true;
  }

  if (first === 192 && second === 0 && (third === 0 || third === 2)) {
    return true;
  }

  if (first === 198 && second === 51 && third === 100) {
    return true;
  }

  if (first === 198 && (second === 18 || second === 19)) {
    return true;
  }

  if (first === 203 && second === 0 && third === 113) {
    return true;
  }

  if (first >= 224) {
    return true;
  }

  return false;
}

function ipv4MappedTailToIpv4(mapped: string): string | null {
  if (isIP(mapped) === 4) {
    return mapped;
  }

  const parts = mapped.split(":");
  if (parts.length !== 2 || parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) {
    return null;
  }

  const high = Number.parseInt(parts[0] ?? "0", 16);
  const low = Number.parseInt(parts[1] ?? "0", 16);
  if (Number.isNaN(high) || Number.isNaN(low)) {
    return null;
  }

  return [
    (high >> 8) & 0xff,
    high & 0xff,
    (low >> 8) & 0xff,
    low & 0xff
  ].join(".");
}

function ipv4MappedExtract(address: string): string | null {
  if (address.startsWith("::ffff:")) {
    return ipv4MappedTailToIpv4(address.slice("::ffff:".length));
  }

  const expanded = address.match(/^(?:0{1,4}:){5}ffff:(.+)$/i);
  if (expanded) {
    return ipv4MappedTailToIpv4(expanded[1] ?? "");
  }

  return null;
}

function ipv6Restricted(address: string): boolean {
  const normalized = (address.toLowerCase().split("%")[0] ?? address.toLowerCase());

  if (normalized === "::" || normalized === "::1") {
    return true;
  }

  const mappedIpv4 = ipv4MappedExtract(normalized);
  if (mappedIpv4) {
    return ipv4Restricted(mappedIpv4);
  }

  const firstHextet = normalized.split(":")[0] ?? "";
  if (/^f[cd][0-9a-f]{0,2}$/.test(firstHextet)) {
    return true;
  }

  if (/^fe[89ab][0-9a-f]{0,1}$/.test(firstHextet)) {
    return true;
  }

  if (/^ff[0-9a-f]{0,2}$/.test(firstHextet)) {
    return true;
  }

  return false;
}

function ipAddressRestricted(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return ipv4Restricted(address);
  }

  if (version === 6) {
    return ipv6Restricted(address);
  }

  return true;
}

async function webhookUrlAllowed(webhookUrl: string): Promise<boolean> {
  try {
    const url = new URL(webhookUrl);
    const rawHost = url.hostname.toLowerCase();
    const host = rawHost.startsWith("[") && rawHost.endsWith("]")
      ? rawHost.slice(1, -1)
      : rawHost;

    if (url.protocol !== "https:") {
      return false;
    }

    if (host === "localhost" || host === "::1" || host.endsWith(".localhost") || host.endsWith(".local")) {
      return false;
    }

    if (isIP(host) > 0) {
      return !ipAddressRestricted(host);
    }

    const resolved = await lookup(host, {
      all: true,
      verbatim: true
    });

    if (resolved.length === 0) {
      return false;
    }

    return resolved.every((entry) => !ipAddressRestricted(entry.address));
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function deliver(webhookUrl: string, payload: Record<string, unknown>): Promise<void> {
  if (!(await webhookUrlAllowed(webhookUrl))) {
    throw new WebhookUrlDisallowedError("Webhook URL is not allowed");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
    redirect: "manual"
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error("Webhook redirects are not allowed");
  }

  if (!response.ok) {
    throw new Error(`Webhook delivery failed with status ${response.status}`);
  }
}

export async function aiBotWebhookDeliver(input: AiBotWebhookDeliverInput): Promise<boolean> {
  try {
    await deliver(input.webhookUrl, input.payload);
    return true;
  } catch (error) {
    if (error instanceof WebhookUrlDisallowedError) {
      return false;
    }

    try {
      await sleep(5_000);
      await deliver(input.webhookUrl, input.payload);
      return true;
    } catch (retryError) {
      if (retryError instanceof WebhookUrlDisallowedError) {
        return false;
      }

      return false;
    }
  }
}
