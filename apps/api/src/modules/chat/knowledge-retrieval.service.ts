import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { IntentLabel, KnowledgeArticleType, KnowledgeRetrievalResult, KnowledgeBaseArticleInput } from "./chat.types";

type SearchRow = {
  id: string;
  title: string;
  content: string;
  summary?: string | null;
  keywords: string[];
  articleType: KnowledgeArticleType;
  isPublished: boolean;
};

@Injectable()
export class KnowledgeRetrievalService {
  constructor(private readonly prisma: PrismaService) {}

  async retrieve(input: {
    workspaceId: string;
    brandId?: string;
    query: string;
    intentLabel: IntentLabel;
  }): Promise<KnowledgeRetrievalResult> {
    const [articles, faqItems] = await Promise.all([
      (this.prisma as any).knowledgeBaseArticle.findMany({
        where: {
          workspaceId: input.workspaceId,
          brandId: input.brandId ?? undefined,
          isPublished: true
        },
        orderBy: [{ updatedAt: "desc" }]
      }),
      (this.prisma as any).faqItem.findMany({
        where: {
          workspaceId: input.workspaceId,
          brandId: input.brandId ?? undefined,
          isActive: true
        },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }]
      })
    ]);

    const rankedArticles = this.rankArticles(input.query, articles as SearchRow[]);
    const rankedFaq = this.rankFaq(input.query, faqItems as Array<{ id: string; question: string; answer: string; keywords: string[] }>);
    const prohibited = (articles as SearchRow[])
      .filter((article) => article.articleType === "PROHIBITED")
      .map((article) => article.summary ?? article.title)
      .filter(Boolean);

    const article = rankedArticles[0];
    const faq = rankedFaq[0];
    const answer = article?.summary || faq?.answer || "我先幫你確認一下這個問題，避免跟你說錯。";

    return {
      answer,
      articleIds: rankedArticles.slice(0, 3).map((item) => item.id),
      faqIds: rankedFaq.slice(0, 3).map((item) => item.id),
      guardrails: prohibited,
      hints: [
        article ? `優先採用知識庫文章：${article.title}` : null,
        faq ? `FAQ 命中：${faq.question}` : null,
        prohibited.length ? "先避開禁用承諾與違規說法" : null
      ].filter(Boolean) as string[]
    };
  }

  async upsertArticle(input: KnowledgeBaseArticleInput) {
    const article = await (this.prisma as any).knowledgeBaseArticle.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: input.workspaceId,
          slug: input.slug
        }
      },
      create: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        articleType: input.articleType ?? "FAQ",
        title: input.title,
        slug: input.slug,
        summary: input.summary ?? null,
        content: input.content,
        keywords: input.keywords ?? [],
        isPublished: input.isPublished ?? true,
        metadata: input.metadata ?? null
      },
      update: {
        brandId: input.brandId ?? null,
        articleType: input.articleType ?? "FAQ",
        title: input.title,
        summary: input.summary ?? null,
        content: input.content,
        keywords: input.keywords ?? [],
        isPublished: input.isPublished ?? true,
        metadata: input.metadata ?? null
      }
    });

    const faqItems = input.faqItems ?? [];
    for (const faq of faqItems) {
      await (this.prisma as any).faqItem.upsert({
        where: {
          workspaceId_question: {
            workspaceId: input.workspaceId,
            question: faq.question
          }
        },
        create: {
          workspaceId: input.workspaceId,
          brandId: input.brandId ?? null,
          articleId: article.id,
          question: faq.question,
          answer: faq.answer,
          keywords: faq.keywords ?? [],
          sortOrder: faq.sortOrder ?? 0
        },
        update: {
          brandId: input.brandId ?? null,
          articleId: article.id,
          answer: faq.answer,
          keywords: faq.keywords ?? [],
          sortOrder: faq.sortOrder ?? 0
        }
      });
    }

    return article;
  }

  async listKnowledgeBase(workspaceId?: string, brandId?: string) {
    const [articles, faqItems] = await Promise.all([
      (this.prisma as any).knowledgeBaseArticle.findMany({
        where: { workspaceId: workspaceId ?? undefined, brandId: brandId ?? undefined },
        orderBy: { updatedAt: "desc" }
      }),
      (this.prisma as any).faqItem.findMany({
        where: { workspaceId: workspaceId ?? undefined, brandId: brandId ?? undefined },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }]
      })
    ]);

    return { articles, faqItems };
  }

  private rankArticles(query: string, articles: SearchRow[]) {
    const normalized = query.toLowerCase();
    return articles
      .map((article) => ({
        ...article,
        score:
          article.keywords.reduce((acc, keyword) => (normalized.includes(keyword.toLowerCase()) ? acc + 3 : acc), 0) +
          (normalized.includes(article.title.toLowerCase()) ? 2 : 0) +
          (normalized.includes(article.content.toLowerCase().slice(0, 120)) ? 1 : 0)
      }))
      .sort((a, b) => b.score - a.score || Number(b.isPublished) - Number(a.isPublished));
  }

  private rankFaq(query: string, faqItems: Array<{ id: string; question: string; answer: string; keywords: string[] }>) {
    const normalized = query.toLowerCase();
    return faqItems
      .map((faq) => ({
        ...faq,
        score:
          faq.keywords.reduce((acc, keyword) => (normalized.includes(keyword.toLowerCase()) ? acc + 3 : acc), 0) +
          (normalized.includes(faq.question.toLowerCase()) ? 2 : 0)
      }))
      .sort((a, b) => b.score - a.score);
  }
}

