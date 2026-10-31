/**
 * Cloudflare R2 para as Edge Functions do Locker (locker, locker-public): links
 * assinados e chamadas à API compatível com S3. As chaves vêm dos segredos:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 */
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

export interface R2 {
  /**
   * Link assinado: o R2 confere a assinatura e a validade (segundos). `query` entra
   * na assinatura (ex.: response-content-disposition para baixar com o nome certo).
   */
  presign(
    method: 'GET' | 'PUT',
    key: string,
    expires: number,
    headers?: Record<string, string>,
    query?: Record<string, string>,
  ): Promise<string>;
  /** Chamada direta (apagar, enviar do servidor). */
  fetch(key: string, init: RequestInit): Promise<Response>;
  /** Cópia dentro do bucket, sem baixar o arquivo ("Fazer uma cópia" no Locker web). */
  copy(from: string, to: string): Promise<Response>;
}

/** null = as chaves do R2 ainda não foram configuradas. */
export function r2FromEnv(): R2 | null {
  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucket = Deno.env.get('R2_BUCKET');
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;

  const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
  const objectUrl = (key: string) => `${endpoint}/${key.split('/').map(encodeURIComponent).join('/')}`;

  return {
    async presign(method, key, expires, headers, query) {
      const url = new URL(objectUrl(key));
      url.searchParams.set('X-Amz-Expires', String(expires));
      for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
      const signed = await client.sign(new Request(url, { method, headers }), { aws: { signQuery: true } });
      return signed.url;
    },
    fetch(key, init) {
      return client.fetch(objectUrl(key), init);
    },
    copy(from, to) {
      const source = `/${bucket}/${from.split('/').map(encodeURIComponent).join('/')}`;
      return client.fetch(objectUrl(to), { method: 'PUT', headers: { 'x-amz-copy-source': source } });
    },
  };
}
