import { Product } from "./Product";

export type SortOption = "default" | "price-asc" | "price-desc" | "name-asc";

export class ProductFilter {
  private products: Product[];
  private categories: string[] = [];
  private priceMin: number | null = null;
  private priceMax: number | null = null;
  private search = "";
  private sort: SortOption = "default";

  constructor(products: Product[]) {
    this.products = products;
  }

  setCategories(categories: string[]): this {
    this.categories = categories;
    return this;
  }

  setPriceRange(
    min: string | number | null,
    max: string | number | null
  ): this {
    const toNum = (v: string | number | null): number | null => {
      if (v === null || v === "") return null;
      const n = typeof v === "number" ? v : parseFloat(v);
      return isNaN(n) ? null : n;
    };
    this.priceMin = toNum(min);
    this.priceMax = toNum(max);
    return this;
  }

  setSearch(query: string): this {
    this.search = query;
    return this;
  }

  setSort(sort: SortOption): this {
    this.sort = sort;
    return this;
  }

  apply(): Product[] {
    let result = this.products.filter((p) => this.matchesOne(p));

    switch (this.sort) {
      case "price-asc":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "name-asc":
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return result;
  }

  private matchesOne(p: Product): boolean {
    if (this.categories.length > 0 && !this.categories.includes(p.category)) {
      return false;
    }
    if (!p.matchesPrice(this.priceMin, this.priceMax)) return false;
    if (!p.matchesSearch(this.search)) return false;
    return true;
  }

  static getCategoriesWithCounts(
    products: Product[]
  ): { name: string; count: number }[] {
    const counts = new Map<string, number>();
    products.forEach((p) => {
      counts.set(p.category, (counts.get(p.category) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  static getPriceBounds(products: Product[]): { min: number; max: number } {
    if (products.length === 0) return { min: 0, max: 0 };
    const prices = products.map((p) => p.price);
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }
}