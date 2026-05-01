import { Injectable } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface WikimediaMediaResult {
  title: string;
  sourceUrl: string;
  localPath: string;
  mimeType: string;
}

interface WikimediaSearchItem {
  title: string;
  mime: string;
  url: string;
  thumbnail?: string;
}

@Injectable()
export class WikimediaMediaLibraryService {
  async searchAndDownload(query: string, outputDir: string, limit = 6): Promise<WikimediaMediaResult[]> {
    const candidates = await this.searchCandidates(query, limit * 2);
    const results: WikimediaMediaResult[] = [];

    await mkdir(outputDir, { recursive: true });

    for (const candidate of candidates) {
      if (!candidate.url || !candidate.mime) {
        continue;
      }

      if (!candidate.mime.startsWith("image/") && !candidate.mime.startsWith("video/")) {
        continue;
      }

      const localPath = path.join(outputDir, `${randomUUID()}${this.extensionFromMime(candidate.mime, candidate.url)}`);
      try {
        const response = await fetch(candidate.url);
        if (!response.ok || !response.body) {
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        await writeFile(localPath, buffer);
        results.push({
          title: candidate.title,
          sourceUrl: candidate.url,
          localPath,
          mimeType: candidate.mime
        });

        if (results.length >= limit) {
          break;
        }
      } catch {
        continue;
      }
    }

    return results;
  }

  private async searchCandidates(query: string, limit: number) {
    const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
    endpoint.searchParams.set("action", "query");
    endpoint.searchParams.set("generator", "search");
    endpoint.searchParams.set("gsrsearch", query);
    endpoint.searchParams.set("gsrlimit", String(limit));
    endpoint.searchParams.set("prop", "imageinfo");
    endpoint.searchParams.set("iiprop", "url|mime");
    endpoint.searchParams.set("iiurlwidth", "1280");
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("origin", "*");

    const response = await fetch(endpoint.toString());
    if (!response.ok) {
      return [];
    }

    const json = (await response.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            imageinfo?: Array<{
              url?: string;
              mime?: string;
              thumburl?: string;
            }>;
          }
        >;
      };
    };

    const pages = Object.values(json.query?.pages ?? {});
    return pages
      .map((page) => ({
        title: page.title ?? query,
        mime: page.imageinfo?.[0]?.mime ?? "",
        url: page.imageinfo?.[0]?.url ?? page.imageinfo?.[0]?.thumburl ?? ""
      }))
      .filter((item) => Boolean(item.url));
  }

  private extensionFromMime(mime: string, fallbackUrl: string) {
    if (mime.includes("jpeg")) return ".jpg";
    if (mime.includes("png")) return ".png";
    if (mime.includes("gif")) return ".gif";
    if (mime.includes("webp")) return ".webp";
    if (mime.includes("mp4")) return ".mp4";
    if (mime.includes("quicktime")) return ".mov";
    if (mime.includes("webm")) return ".webm";

    const urlExt = path.extname(new URL(fallbackUrl).pathname);
    return urlExt || ".bin";
  }
}
