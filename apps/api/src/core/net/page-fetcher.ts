// Lecture d'une page web pour l'import (C3.8), protegee contre le SSRF :
// a chaque saut (5 redirections au plus), le nom est resolu, toutes ses
// adresses doivent etre publiques, et la connexion se fait sur l'adresse
// verifiee (pas de second DNS, donc pas de "rebinding"). Delai total, taille
// et decompression bornes.
import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import type { Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

export type PageFetchFailure = "BLOCKED" | "UNREACHABLE" | "NOT_HTML";

export class PageFetchError extends Error {
  readonly reason: PageFetchFailure;
  constructor(reason: PageFetchFailure, detail?: string) {
    super(detail ?? reason);
    this.name = "PageFetchError";
    this.reason = reason;
  }
}

export interface FetchedPage {
  /** Adresse finale, apres les redirections. */
  url: string;
  html: string;
}

export type PageFetcher = (url: string) => Promise<FetchedPage>;

export interface PageFetcherOptions {
  /** Tests seulement : autorise 127.0.0.0/8 et ::1 (serveur de fixtures local). */
  allowLoopback?: boolean;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

// Adresses non publiques : privees, locales, partagees, reservees, multicast,
// documentation, traduction IPv4/IPv6 (qui peut cacher une adresse privee).
const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

/** Adresse IPv4 cachee dans une adresse IPv6 "mappee" (::ffff:a.b.c.d). */
function mappedIpv4(address: string): string | null {
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (dotted?.[1]) return dotted[1];
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address);
  if (!hex?.[1] || !hex[2]) return null;
  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  if (family === 6) {
    const v4 = mappedIpv4(address);
    if (v4) return isPublicAddress(v4);
    if (/^::ffff:/i.test(address)) return false;
  }
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

const isLoopback = (address: string) => address.startsWith("127.") || address === "::1";

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

function decompress(res: http.IncomingMessage): Readable {
  const encoding = (res.headers["content-encoding"] ?? "").toLowerCase().trim();
  if (encoding === "gzip" || encoding === "x-gzip") return res.pipe(createGunzip());
  if (encoding === "deflate") return res.pipe(createInflate());
  if (encoding === "br") return res.pipe(createBrotliDecompress());
  return res;
}

function readText(res: http.IncomingMessage, maxBytes: number): Promise<string> {
  const declared = Number(res.headers["content-length"] ?? 0);
  if (declared > maxBytes) {
    res.destroy();
    return Promise.reject(new PageFetchError("UNREACHABLE", "too large"));
  }
  const charset = /charset=["']?([\w-]+)/i.exec(res.headers["content-type"] ?? "")?.[1];
  const stream = decompress(res);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const fail = (error: unknown) => {
      res.destroy();
      stream.destroy();
      reject(error instanceof PageFetchError ? error : new PageFetchError("UNREACHABLE"));
    };
    stream.on("data", (chunk: Buffer) => {
      size += chunk.length;
      // Limite comptee apres decompression (pas de "bombe" gzip).
      if (size > maxBytes) fail(new PageFetchError("UNREACHABLE", "too large"));
      else chunks.push(chunk);
    });
    stream.on("error", fail);
    res.on("error", fail);
    stream.on("end", () => {
      const body = Buffer.concat(chunks);
      try {
        resolve(new TextDecoder(charset ?? "utf-8").decode(body));
      } catch {
        resolve(new TextDecoder("utf-8").decode(body)); // jeu de caracteres inconnu
      }
    });
  });
}

export function createPageFetcher(options: PageFetcherOptions = {}): PageFetcher {
  const {
    allowLoopback = false,
    timeoutMs = 10_000,
    maxBytes = 3 * 1024 * 1024,
    maxRedirects = 5,
  } = options;
  const allowed = (address: string) =>
    isPublicAddress(address) || (allowLoopback && isLoopback(address));

  /** Adresse verifiee du nom : toutes ses adresses doivent etre permises. */
  async function resolve(hostname: string): Promise<{ address: string; family: number }> {
    const host = hostname.replace(/^\[|\]$/g, "");
    if (isIP(host)) {
      if (!allowed(host)) throw new PageFetchError("BLOCKED", host);
      return { address: host, family: isIP(host) };
    }
    let addresses: { address: string; family: number }[];
    try {
      addresses = await dnsLookup(host, { all: true, order: "verbatim" });
    } catch {
      throw new PageFetchError("UNREACHABLE", "dns");
    }
    const first = addresses[0];
    if (!first) throw new PageFetchError("UNREACHABLE", "dns");
    if (addresses.some((a) => !allowed(a.address))) throw new PageFetchError("BLOCKED", host);
    return first;
  }

  function get(
    url: URL,
    target: { address: string; family: number },
    signal: AbortSignal
  ): Promise<http.IncomingMessage> {
    // La connexion part sur l'adresse deja verifiee, quel que soit le DNS ensuite.
    const lookup: LookupFunction = (_host, opts, callback) => {
      if (opts.all) callback(null, [target]);
      else callback(null, target.address, target.family);
    };
    const client = url.protocol === "https:" ? https : http;
    return new Promise((resolvePromise, reject) => {
      const req = client.get(
        url,
        {
          lookup,
          agent: false,
          signal,
          headers: {
            "user-agent": "ForestManager/2.0 (import de recettes)",
            accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
            "accept-language": "fr,en;q=0.5",
            "accept-encoding": "gzip, deflate, br",
          },
        },
        resolvePromise
      );
      req.on("error", () => {
        reject(new PageFetchError("UNREACHABLE"));
      });
    });
  }

  return async (input) => {
    const signal = AbortSignal.timeout(timeoutMs);
    let url = new URL(input);
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new PageFetchError("BLOCKED", url.protocol);
      }
      const target = await resolve(url.hostname);
      const res = await get(url, target, signal);
      const status = res.statusCode ?? 0;
      if (REDIRECTS.has(status)) {
        res.resume();
        const location = res.headers.location;
        if (!location) throw new PageFetchError("UNREACHABLE", "redirect");
        try {
          url = new URL(location, url);
        } catch {
          throw new PageFetchError("UNREACHABLE", "redirect");
        }
        continue;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        throw new PageFetchError("UNREACHABLE", String(status));
      }
      if (!/html/i.test(res.headers["content-type"] ?? "")) {
        res.destroy();
        throw new PageFetchError("NOT_HTML");
      }
      return { url: url.toString(), html: await readText(res, maxBytes) };
    }
    throw new PageFetchError("UNREACHABLE", "too many redirects");
  };
}
