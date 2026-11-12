// URL signee de lecture (AWS Signature V4, parametres dans l'URL), calculee
// sans appel reseau ni promesse : les reponses de l'API en portent beaucoup.
// Le test compare le resultat a celui du SDK AWS. Date de signature arrondie a
// l'heure : la meme URL pendant une heure, donc le cache du navigateur sert [D167].
import { createHash, createHmac } from "node:crypto";

const REGION = "us-east-1"; // impose par le protocole, ignore par MinIO et RustFS
const ALGORITHM = "AWS4-HMAC-SHA256";

export interface PresignGetInput {
  /** URL vue par le navigateur, sans le bucket (ex. https://s3.example.fr). */
  publicUrl: string;
  bucket: string;
  key: string;
  accessKey: string;
  secretKey: string;
  signingDate: Date;
  /** Duree de validite en secondes. */
  expiresIn: number;
}

/** Encodage URI de la signature V4 (RFC 3986 strict). */
function encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const hmac = (key: Buffer | string, value: string) =>
  createHmac("sha256", key).update(value).digest();

/** Debut de l'heure en cours (UTC). */
export function signingHour(now: Date): Date {
  const date = new Date(now);
  date.setUTCMinutes(0, 0, 0);
  return date;
}

export function presignGetUrl(input: PresignGetInput): string {
  const base = new URL(input.publicUrl);
  const prefix = base.pathname.replace(/\/+$/, "");
  const path = `${prefix}/${input.bucket}/${input.key.split("/").map(encode).join("/")}`;

  const amzDate = input.signingDate
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${REGION}/s3/aws4_request`;

  const params: [string, string][] = [
    ["X-Amz-Algorithm", ALGORITHM],
    ["X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD"],
    ["X-Amz-Credential", `${input.accessKey}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(input.expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
    ["x-id", "GetObject"],
  ];
  const query = params
    .map(([name, value]) => `${encode(name)}=${encode(value)}`)
    .sort()
    .join("&");

  const canonicalRequest = [
    "GET",
    path,
    query,
    `host:${base.host}`,
    "",
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [ALGORITHM, amzDate, scope, sha256(canonicalRequest)].join("\n");

  let key = hmac(`AWS4${input.secretKey}`, day);
  for (const part of [REGION, "s3", "aws4_request"]) key = hmac(key, part);
  const signature = createHmac("sha256", key).update(stringToSign).digest("hex");

  const signed = [...params, ["X-Amz-Signature", signature]]
    .map(([name, value]) => `${encode(name ?? "")}=${encode(value ?? "")}`)
    .sort()
    .join("&");
  return `${base.protocol}//${base.host}${path}?${signed}`;
}
