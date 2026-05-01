import { Injectable } from "@nestjs/common";
import { ContentStyle, ContentVariantType } from "@prisma/client";
import {
  compactText,
  dedupe,
  parsePriceTier,
  splitKeywords,
  STYLE_LABELS,
  toHashtag
} from "./content.utils";
import {
  GenerateContentInput,
  GeneratedContentResult,
  GeneratedVariantResult
} from "./content.types";

@Injectable()
export class ContentGeneratorService {
  generate(input: GenerateContentInput): GeneratedContentResult {
    const resolvedStyle = this.resolveStyle(input);
    const keywordPool = splitKeywords([
      input.productName,
      input.productDescription,
      input.targetAudience,
      input.priceRange ?? "",
      input.usageScenario ?? "",
      ...input.keywords
    ]);

    const product = this.makeProductPhrase(input.productName);
    const audience = input.targetAudience.trim();
    const painPoint = this.buildPainPoint(resolvedStyle, product, audience, input.usageScenario);
    const solution = this.buildSolution(resolvedStyle, product, input.productDescription);
    const trigger = this.buildTrigger(resolvedStyle, input.priceRange, keywordPool);
    const cta = this.buildCTA(resolvedStyle, product);

    const titles = this.buildTitles({ resolvedStyle, product, audience, painPoint, trigger, keywordPool });
    const posts = this.buildPosts({ resolvedStyle, product, audience, painPoint, solution, trigger, cta, keywordPool });
    const scripts = this.buildScripts({ resolvedStyle, product, audience, painPoint, solution, trigger, cta, keywordPool });

    const variants = [...titles, ...posts, ...scripts];
    const summary = `${STYLE_LABELS[resolvedStyle]}：以 ${product} 為核心，圍繞 ${painPoint}、${solution} 與 ${trigger} 形成高轉換內容。`;

    return {
      resolvedStyle,
      summary,
      titles,
      posts,
      scripts,
      variants
    };
  }

  private resolveStyle(input: GenerateContentInput): ContentStyle {
    if (input.requestedStyle !== ContentStyle.AUTO) {
      return input.requestedStyle;
    }

    const text = compactText([
      input.productName,
      input.productDescription,
      input.targetAudience,
      input.priceRange,
      input.usageScenario,
      input.keywords.join(" ")
    ]).toLowerCase();

    if (parsePriceTier(input.priceRange) === "high" || /精品|高級|質感|限量|設計|輕奢|尊爵/.test(text)) {
      return ContentStyle.PREMIUM;
    }

    if (/搞笑|幽默|有趣|梗|反差|可愛|逗趣/.test(text)) {
      return ContentStyle.HUMOR;
    }

    if (/教學|知識|攻略|比較|原理|懶人包|科普|技巧/.test(text)) {
      return ContentStyle.EDUCATIONAL;
    }

    return ContentStyle.HOT_SALE;
  }

  private makeProductPhrase(productName: string) {
    return productName.trim().replace(/\s+/g, " ");
  }

  private buildPainPoint(
    style: ContentStyle,
    product: string,
    audience: string,
    usageScenario?: string | null
  ) {
    const scenario = usageScenario?.trim();

    switch (style) {
      case ContentStyle.PREMIUM:
        return scenario
          ? `${audience} 想要 ${scenario} 時，看起來有質感又不失手`
          : `${audience} 在挑選 ${product} 時，最怕外觀看起來普通、實際不夠到位`;
      case ContentStyle.HUMOR:
        return scenario
          ? `每次想在 ${scenario} 用得漂亮，結果一不小心又踩雷`
          : `${audience} 想買 ${product}，但又怕買回家只會放著吃灰`;
      case ContentStyle.EDUCATIONAL:
        return scenario
          ? `很多人以為 ${scenario} 只要便宜就好，結果最常遇到的是不耐用、不好用`
          : `${audience} 在挑 ${product} 時，最常卡在「到底怎麼選才不會浪費錢」`;
      case ContentStyle.HOT_SALE:
      default:
        return scenario
          ? `${audience} 想在 ${scenario} 直接找到一個省時、省錢、又省心的選擇`
          : `${audience} 想買 ${product}，但又不想花冤枉錢踩雷`;
    }
  }

  private buildSolution(style: ContentStyle, product: string, description: string) {
    const cleanDescription = description.trim().replace(/\s+/g, " ");
    const firstSentence = cleanDescription.split(/[。.!?\n]/).filter(Boolean)[0] ?? cleanDescription;

    switch (style) {
      case ContentStyle.PREMIUM:
        return `${product} 把 ${firstSentence} 變成更精緻、可感知的體驗，讓每一次使用都像在升級生活質感。`;
      case ContentStyle.HUMOR:
        return `${product} 不是走套路，而是直接把 ${firstSentence} 做到位，讓你用得爽、拍起來也有梗。`;
      case ContentStyle.EDUCATIONAL:
        return `${product} 的核心優勢就在於 ${firstSentence}，把重點拆給你看，讓你更快判斷值不值得入手。`;
      case ContentStyle.HOT_SALE:
      default:
        return `${product} 直接打中 ${firstSentence}，把你最在意的問題一次解掉，入手後就有感。`;
    }
  }

  private buildTrigger(style: ContentStyle, priceRange?: string | null, keywordPool: string[] = []) {
    const price = priceRange?.trim();
    const shortKeywords = keywordPool.slice(0, 3).map((keyword) => `#${keyword}`);

    switch (style) {
      case ContentStyle.PREMIUM:
        return price
          ? `現在把 ${price} 的預算直接換成更有感的質感升級，會比一直猶豫更划算。`
          : `把預算留給真正有質感的選擇，往往比一味比價更值得。`;
      case ContentStyle.HUMOR:
        return `看完這組內容，你大概會想直接把 ${shortKeywords.join("、") || "這組好物"} 加進購物車。`;
      case ContentStyle.EDUCATIONAL:
        return `先把選購邏輯弄懂，再下單，能少掉很多後悔成本。`;
      case ContentStyle.HOT_SALE:
      default:
        return price
          ? `如果你正在看 ${price} 區間，這個選擇的轉換力很高。`
          : `越早入手，越早把踩雷風險降下來。`;
    }
  }

  private buildCTA(style: ContentStyle, product: string) {
    switch (style) {
      case ContentStyle.PREMIUM:
        return `想要我幫你整理 ${product} 的適合族群與入手重點，留言「+1」或直接收藏。`;
      case ContentStyle.HUMOR:
        return `覺得有中就先收藏，晚點把 ${product} 丟進購物車，別讓理智先離線。`;
      case ContentStyle.EDUCATIONAL:
        return `如果你想看 ${product} 的選購清單與比較重點，先收藏這篇，下一篇我直接幫你拆解。`;
      case ContentStyle.HOT_SALE:
      default:
        return `現在就把 ${product} 收藏起來，想下單時直接回來看重點。`;
    }
  }

  private buildTitles(params: {
    resolvedStyle: ContentStyle;
    product: string;
    audience: string;
    painPoint: string;
    trigger: string;
    keywordPool: string[];
  }): GeneratedVariantResult[] {
    const { resolvedStyle, product, audience, painPoint, trigger, keywordPool } = params;
    const keywordA = keywordPool[0] ?? product;
    const keywordB = keywordPool[1] ?? audience;
    const titleTemplates: Array<() => string> = [
      () => `為什麼 ${audience} 最近都在看 ${product}？`,
      () => `${product} 到底值不值得買？3 秒先看這個重點`,
      () => `如果你也有「${painPoint}」，先把這篇收藏`,
      () => `懂買的人都先看：${keywordA} 的關鍵差異`,
      () => `${trigger}，讓 ${keywordB} 直接想下單的 ${product}`
    ];

    const titles = dedupe(titleTemplates.map((build) => build())).slice(0, 5);
    while (titles.length < 5) {
      titles.push(`${product} 的另一個看點 ${titles.length + 1}`);
    }

    return titles.map((title, index) => ({
      variantType: ContentVariantType.TITLE,
      variantIndex: index + 1,
      title,
      previewText: title,
      payload: {
        title,
        angle: this.titleAngle(resolvedStyle, index),
        rationale: this.titleRationale(resolvedStyle, product, painPoint, trigger, index)
      },
      hashtags: this.buildHashtags({
        product,
        resolvedStyle,
        keywordPool,
        extra: [audience, "標題", "爆款內容"]
      }),
      platforms: ["IG", "Threads", "TikTok", "FB"]
    }));
  }

  private titleAngle(style: ContentStyle, index: number) {
    const angles: Record<ContentStyle, string[]> = {
      AUTO: ["FOMO", "痛點", "省錢", "差異化", "轉換"],
      HOT_SALE: ["FOMO", "痛點", "限時", "比較", "轉換"],
      PREMIUM: ["質感", "品味", "升級", "稀缺", "信任"],
      HUMOR: ["反差", "梗感", "輕鬆", "共鳴", "分享"],
      EDUCATIONAL: ["教學", "比較", "方法", "重點", "懶人包"]
    };

    return angles[style][index] ?? angles[style][0];
  }

  private titleRationale(
    style: ContentStyle,
    product: string,
    painPoint: string,
    trigger: string,
    index: number
  ) {
    const reasonMap: Record<ContentStyle, string[]> = {
      AUTO: [
        `${product} 直接用問題切入，適合廣泛流量。`,
        `先放大猶豫感，再把關鍵價值拉出來。`,
        `用痛點帶出收藏動機，提高停留。`,
        `把關鍵字放進標題，提高搜尋與點擊。`,
        `加入 trigger，讓標題更有下單感。`
      ],
      HOT_SALE: [
        `直接用熱銷式問題吸住注意。`,
        `把 ${painPoint} 放進來，點出共鳴。`,
        `收藏型標題最容易拉高轉發。`,
        `關鍵字導向，適合賣貨文。`,
        `用 ${trigger} 形成強誘因。`
      ],
      PREMIUM: [
        `用高質感問句建立品牌感。`,
        `把 ${painPoint} 轉成精緻需求。`,
        `收藏感標題適合高單價產品。`,
        `關鍵字與品味感並存。`,
        `以 ${trigger} 強化決策理由。`
      ],
      HUMOR: [
        `先抓笑點，再帶回產品。`,
        `把 ${painPoint} 寫成共鳴梗。`,
        `輕鬆語氣更容易被分享。`,
        `關鍵字維持主題辨識度。`,
        `用 ${trigger} 做反差收尾。`
      ],
      EDUCATIONAL: [
        `用問題導向建立教學感。`,
        `把 ${painPoint} 變成知識切面。`,
        `適合做成收藏文。`,
        `關鍵字提高搜尋命中。`,
        `以 ${trigger} 收斂到行動。`
      ]
    };

    return reasonMap[style][index] ?? reasonMap[style][0];
  }

  private buildPosts(params: {
    resolvedStyle: ContentStyle;
    product: string;
    audience: string;
    painPoint: string;
    solution: string;
    trigger: string;
    cta: string;
    keywordPool: string[];
  }): GeneratedVariantResult[] {
    const { resolvedStyle, product, audience, painPoint, solution, trigger, cta, keywordPool } = params;

    const postVariants = [
      {
        angle: "直接轉換",
        copy: `${painPoint}，這就是很多 ${audience} 一直猶豫的原因。\n\n${product} 的做法很直接：${solution}\n\n${trigger}\n\n${cta}`
      },
      {
        angle: "故事感",
        copy: `如果你也曾經在挑 ${product} 時反覆猶豫，這篇先別滑走。\n\n真正好的選擇不是看起來便宜，而是用起來真的省心。\n\n${solution}\n\n${cta}`
      },
      {
        angle: "收藏教學",
        copy: `先收藏這篇，之後要選 ${product} 會快很多。\n\n1. 先看你是不是 ${audience}\n2. 再對照 ${painPoint}\n3. 最後看 ${trigger}\n\n${cta}`
      }
    ];

    return postVariants.map((variant, index) => ({
      variantType: ContentVariantType.POST_COPY,
      variantIndex: index + 1,
      title: `${product} 貼文文案 ${index + 1}`,
      previewText: variant.copy.slice(0, 90),
      payload: {
        title: `${product} 貼文文案 ${index + 1}`,
        copy: variant.copy,
        angle: variant.angle,
        rationale: index === 0 ? "轉換型文案，直接推動決策。" : index === 1 ? "故事型文案，降低抗拒感。" : "教學型文案，提高收藏與分享。",
        structure: ["痛點", "解法", "誘因", "CTA"]
      },
      hashtags: this.buildHashtags({
        product,
        resolvedStyle,
        keywordPool,
        extra: [audience, "貼文", "轉換", "好物"]
      }),
      platforms: ["IG", "Threads", "FB"]
    }));
  }

  private buildScripts(params: {
    resolvedStyle: ContentStyle;
    product: string;
    audience: string;
    painPoint: string;
    solution: string;
    trigger: string;
    cta: string;
    keywordPool: string[];
  }): GeneratedVariantResult[] {
    const { resolvedStyle, product, audience, painPoint, solution, trigger, cta, keywordPool } = params;

    const scriptVariants = [
      {
        title: `${product} 15 秒快攻腳本`,
        hook: `先停 3 秒，${audience} 最怕的就是 ${painPoint}。`,
        middle: `${product} 直接把問題解掉：${solution}\n畫面可以帶使用前後對比，讓差異一眼看懂。`,
        cta: `${trigger}\n想要完整重點，先收藏，或直接留言「想看細節」。`
      },
      {
        title: `${product} 場景式腳本`,
        hook: `如果你現在就在 ${audience} 的情境裡，這個畫面一定很熟。`,
        middle: `先展示最常見的困擾，再切到 ${product} 如何處理 ${painPoint}，節奏要快、字幕要短。`,
        cta: `${cta}\n字幕最後加上「現在就看重點」，提升轉換感。`
      },
      {
        title: `${product} 教學型腳本`,
        hook: `今天用 15 秒告訴你，為什麼 ${product} 值得看。`,
        middle: `核心只有三件事：${solution}\n接著補上最容易忽略的使用情境，讓觀眾知道它不是噱頭。`,
        cta: `看完如果有幫助，先收藏，下一支我直接幫你拆 ${product} 的選購重點。`
      }
    ];

    return scriptVariants.map((script, index) => ({
      variantType: ContentVariantType.SCRIPT,
      variantIndex: index + 1,
      title: script.title,
      previewText: script.hook,
      payload: {
        title: script.title,
        hook: script.hook,
        middle: script.middle,
        cta: script.cta,
        angle: index === 0 ? "痛點型" : index === 1 ? "場景型" : "教學型",
        structure: ["Hook (0-3秒)", "中段內容 (3-10秒)", "CTA (10-15秒)"]
      },
      hashtags: this.buildHashtags({
        product,
        resolvedStyle,
        keywordPool,
        extra: [audience, "短影音", "Reels", "TikTok", "腳本"]
      }),
      platforms: ["TikTok", "IG", "Reels"]
    }));
  }

  private buildHashtags(params: {
    product: string;
    resolvedStyle: ContentStyle;
    keywordPool: string[];
    extra?: string[];
  }) {
    const { product, resolvedStyle, keywordPool, extra = [] } = params;
    const styleTags: Record<ContentStyle, string[]> = {
      AUTO: ["爆款內容", "內容生成", "品牌行銷"],
      HOT_SALE: ["熱銷帶貨", "下單不後悔", "限時必買"],
      PREMIUM: ["質感生活", "高級品牌", "品味選物"],
      HUMOR: ["搞笑文案", "反差感", "有梗內容"],
      EDUCATIONAL: ["知識型內容", "選購攻略", "內容行銷"]
    };

    const tags = [
      product,
      ...keywordPool,
      ...extra,
      ...styleTags[resolvedStyle],
      "IG內容",
      "Threads文案",
      "TikTok腳本",
      "FB貼文"
    ];

    return dedupe(tags.map((token) => toHashtag(token)).filter(Boolean)).slice(0, 20);
  }
}
