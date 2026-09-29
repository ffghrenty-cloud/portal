export type ProductRaw = {
  id: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  description: string;
  image_url: string | null;
};

export class Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  description: string;
  imageUrl: string | null;

  constructor(raw: ProductRaw) {
    this.id = raw.id;
    this.name = raw.name;
    this.sku = raw.sku;
    this.category = raw.category;
    this.price = raw.price;
    this.description = raw.description;
    this.imageUrl = raw.image_url;
  }

  get formattedPrice(): string {
    return `${this.price.toFixed(2).replace(".", ",")} BYN`;
  }

  get hasImage(): boolean {
    return this.imageUrl !== null && this.imageUrl !== "";
  }

  matchesSearch(query: string): boolean {
    const q = query.trim().toLowerCase();
    if (q === "") return true;
    return (
      this.name.toLowerCase().includes(q) ||
      this.category.toLowerCase().includes(q) ||
      this.sku.toLowerCase().includes(q)
    );
  }

  matchesPrice(min: number | null, max: number | null): boolean {
    if (min !== null && this.price < min) return false;
    if (max !== null && this.price > max) return false;
    return true;
  }
}