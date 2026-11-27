import db from "./db";

export type AssistantProduct = {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  price: number;
  description: string | null;
  image_url: string | null;
  stock_quantity: number;
};

export type AssistantMessage = { role: "user" | "assistant"; text: string; suggestions?: string[] };
export type AssistantResponse = {
  text: string;
  suggestions?: string[];
  products?: AssistantProduct[];
  provider?: "deepseek" | "fallback";
};

type ChatHistoryMessage = { role: "user" | "assistant"; content: string };

const QUICK_SUGGESTIONS = [
  "Каталог продукции",
  "Полотенца дешевле 30 BYN",
  "Постельное бельё в наличии",
  "Как оформить заказ?",
  "Вызвать администратора",
];

const STOP_WORDS = new Set([
  "найди", "найти", "покажи", "показать", "подбери", "подобрать", "мне", "нужны", "нужен", "нужна",
  "хочу", "есть", "ли", "товары", "товар", "продукцию", "продукция", "каталог", "ассортимент",
  "дешевле", "дороже", "до", "от", "цена", "цене", "стоимостью", "стоимость", "руб", "byn",
  "больше", "меньше", "штук", "шт", "остаток", "наличии", "наличие", "складе", "на", "в", "по",
  "для", "с", "и", "или", "а", "из", "какие", "какой", "какая", "сколько", "продукция",
]);

export class Assistant {
  private userId: number | null;

  constructor(userId: number | null = null) { this.userId = userId; }

  async ask(question: string, history: ChatHistoryMessage[] = []): Promise<AssistantResponse> {
    const q = question.trim();
    if (!q) return { text: "Здравствуйте! Помогу подобрать продукцию и разобраться с заказами.", suggestions: QUICK_SUGGESTIONS, provider: "fallback" };

    const intent = await this.parseCatalogIntent(q);
    const [products, orders] = await Promise.all([
      this.searchCatalog(intent),
      this.getOrdersContext(),
    ]);

    if (process.env.DEEPSEEK_API_KEY) {
      try {
        const text = await this.askDeepSeek(q, history, products, orders, intent);
        return { text, suggestions: QUICK_SUGGESTIONS, products, provider: "deepseek" };
      } catch (error) {
        console.error("DeepSeek assistant error:", error);
      }
    }

    return this.answerFallback(q, products);
  }

  private async parseCatalogIntent(question: string): Promise<{ terms: string[]; category: string | null; minPrice: number | null; maxPrice: number | null; minStock: number | null }> {
    const lower = question.toLocaleLowerCase("ru");
    const minPriceMatch = lower.match(/(?:от|дороже|выше)\s*(\d+(?:[.,]\d+)?)/);
    const maxPriceMatch = lower.match(/(?:до|дешевле|ниже|не дороже)\s*(\d+(?:[.,]\d+)?)/);
    const stockMatch = lower.match(/(?:больше|минимум|от)\s*(\d+)\s*(?:шт|штук|единиц)/);
    const [categories] = await Promise.all([this.getCategories()]);
    const category = categories.find((item) => lower.includes(item.toLocaleLowerCase("ru"))) || null;
    const normalized = lower
      .replace(/\d+(?:[.,]\d+)?/g, " ")
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
    const terms = Array.from(new Set(normalized)).slice(0, 8);
    return {
      terms,
      category,
      minPrice: minPriceMatch ? Number(minPriceMatch[1].replace(",", ".")) : null,
      maxPrice: maxPriceMatch ? Number(maxPriceMatch[1].replace(",", ".")) : null,
      minStock: stockMatch ? Number(stockMatch[1]) : (/(в наличии|есть на складе|доступн)/i.test(lower) ? 1 : null),
    };
  }

  private getCategories(): Promise<string[]> {
    return new Promise((resolve) => db.all("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND TRIM(category) <> ''", (err, rows: any[]) => {
      if (err) return resolve([]);
      resolve((rows || []).map((row) => String(row.category)));
    }));
  }

  private searchCatalog(intent: { terms: string[]; category: string | null; minPrice: number | null; maxPrice: number | null; minStock: number | null }): Promise<AssistantProduct[]> {
    return new Promise((resolve) => {
      const where: string[] = [];
      const args: Array<string | number> = [];
      if (intent.category) { where.push("LOWER(category) = LOWER(?)"); args.push(intent.category); }
      if (intent.minPrice !== null) { where.push("price >= ?"); args.push(intent.minPrice); }
      if (intent.maxPrice !== null) { where.push("price <= ?"); args.push(intent.maxPrice); }
      if (intent.minStock !== null) { where.push("COALESCE(stock_quantity, 0) >= ?"); args.push(intent.minStock); }
      if (intent.terms.length) {
        const termConditions = intent.terms.map(() => "(LOWER(name) LIKE ? OR LOWER(COALESCE(category,'')) LIKE ? OR LOWER(COALESCE(sku,'')) LIKE ? OR LOWER(COALESCE(description,'')) LIKE ?)");
        where.push("(" + termConditions.join(" OR ") + ")");
        for (const term of intent.terms) {
          const like = `%${term}%`;
          args.push(like, like, like, like);
        }
      }
      const sql = `SELECT id, name, sku, category, price, description, image_url, COALESCE(stock_quantity, 0) AS stock_quantity
        FROM products ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY name LIMIT 8`;
      db.all(sql, args, (err, rows: any[]) => {
        if (err) { console.error("Assistant catalog search error:", err); return resolve([]); }
        resolve((rows || []).map((row) => ({
          id: Number(row.id), name: String(row.name), sku: row.sku ?? null, category: row.category ?? null,
          price: Number(row.price), description: row.description ?? null, image_url: row.image_url ?? null,
          stock_quantity: Number(row.stock_quantity || 0),
        })));
      });
    });
  }

  private async askDeepSeek(question: string, history: ChatHistoryMessage[], products: AssistantProduct[], orders: Array<Record<string, unknown>>, intent: unknown): Promise<string> {
    const systemPrompt = `Ты — ИИ-консультант оптового портала Оршанского льнокомбината. Отвечай по-русски, кратко и доброжелательно.
Используй только переданные данные. Не придумывай товары, цены, остатки, скидки, сроки доставки, оплату и гарантии.
Товары в контексте уже отобраны SQL-поиском по всему каталогу с учётом запроса. Если список пуст, сообщи, что точных совпадений нет, и предложи изменить запрос.
Цены указывай в BYN. Остаток 0 означает, что наличие не подтверждено. Не обещай оформить заказ, изменить заказ или связаться с менеджером самостоятельно.
По персональным заказам используй только переданные заказы текущего пользователя. Если пользователь просит рекомендацию или подбор, сначала учитывай категории и товары из его прошлых заказов: предлагай близкие товары из текущего каталога, объясняй связь с историей покупок и не утверждай, что пользователь предпочитает товар, если это не подтверждается заказами. Не рекомендуй товар, которого нет в результатах SQL-поиска. Если история заказов пуста, подбирай только по текущему запросу. Если пользователь спрашивает статус заказа, опирайся на переданные заказы. Для человека предложи «Вызвать администратора».
Результаты поиска: ${JSON.stringify(products)}
Параметры поиска: ${JSON.stringify(intent)}
Последние заказы пользователя: ${JSON.stringify(orders)}
Авторизация: ${this.userId ? "да" : "нет"}.`;
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10).map((item) => ({ role: item.role, content: item.content.slice(0, 1500) })),
      { role: "user", content: question },
    ];
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || "deepseek-flash", messages, temperature: 0.2, max_tokens: 700, stream: false, thinking: { type: "disabled" } }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`DeepSeek API returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) throw new Error("DeepSeek returned an empty response");
    return answer.trim();
  }

  private async getOrdersContext(): Promise<Array<Record<string, unknown>>> {
    if (!this.userId) return [];
    return new Promise((resolve) => db.all(
      `SELECT
        o.id,
        o.status,
        o.total,
        o.created_at,
        GROUP_CONCAT(DISTINCT COALESCE(oi.product_name, p.name)) AS purchased_products,
        GROUP_CONCAT(DISTINCT p.category) AS purchased_categories
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.user_id = ?
      GROUP BY o.id, o.status, o.total, o.created_at
      ORDER BY o.created_at DESC
      LIMIT 5`,
      [this.userId],
      (err, rows: any[]) => resolve(err ? [] : (rows || []).map((row) => ({
        order_number: row.id,
        status: row.status,
        total: row.total,
        created_at: row.created_at,
        purchased_products: row.purchased_products || "",
        purchased_categories: row.purchased_categories || "",
      })))
    ));
  }

  private answerFallback(question: string, products: AssistantProduct[]): AssistantResponse {
    const lower = question.toLowerCase();
    if (/вызвать администратора|вызвать админа|позвать админа|живой человек/.test(lower)) {
      return { text: "Нажмите кнопку «Вызвать администратора», чтобы перейти к переписке.", suggestions: ["Вызвать администратора"], products, provider: "fallback" };
    }
    if (/привет|здравств|добрый|hello|hi/.test(lower)) {
      return { text: "Здравствуйте! Я помощник оптового портала. Могу найти товары по названию, категории, цене и наличию или подсказать по заказам.", suggestions: QUICK_SUGGESTIONS, provider: "fallback" };
    }
    if (products.length) {
      return { text: `Нашёл ${products.length} подходящих товаров. Ниже показал результаты из каталога.`, suggestions: ["Каталог продукции", "Вызвать администратора"], products, provider: "fallback" };
    }
    if (/мой заказ|мои заказ|статус|где заказ/.test(lower)) {
      return { text: this.userId ? "Подробный статус ваших заказов доступен в разделе «Мои заказы»." : "Чтобы посмотреть заказы, войдите в личный кабинет.", suggestions: ["Открыть мои заказы"], provider: "fallback" };
    }
    return { text: "Не нашёл точных совпадений. Попробуйте указать название, категорию, артикул или диапазон цены. Также можно вызвать администратора.", suggestions: QUICK_SUGGESTIONS, provider: "fallback" };
  }
}
