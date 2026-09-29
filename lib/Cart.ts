import { Product } from "./Product";

export type CartItemRaw = {
  productId: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  imageUrl: string | null;
  quantity: number;
};

export class CartItem {
  productId: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  imageUrl: string | null;
  quantity: number;

  constructor(raw: CartItemRaw) {
    this.productId = raw.productId;
    this.name = raw.name;
    this.sku = raw.sku;
    this.category = raw.category;
    this.price = raw.price;
    this.imageUrl = raw.imageUrl;
    this.quantity = raw.quantity;
  }

  /** Стоимость позиции: цена × количество */
  get subtotal(): number {
    return this.price * this.quantity;
  }

  /** Формат «12,80 BYN» */
  get formattedPrice(): string {
    return `${this.price.toFixed(2).replace(".", ",")} BYN`;
  }

  /** Формат «38,40 BYN» */
  get formattedSubtotal(): string {
    return `${this.subtotal.toFixed(2).replace(".", ",")} BYN`;
  }

  get hasImage(): boolean {
    return this.imageUrl !== null && this.imageUrl !== "";
  }
}

export class Cart {
  private items: CartItem[] = [];
  private static readonly STORAGE_KEY = "orshalen_cart";

  constructor(items: CartItem[] = []) {
    this.items = items;
  }

  /** Текущее состояние — только для чтения */
  getItems(): CartItem[] {
    return this.items;
  }

  /** Общее количество единиц товара */
  getCount(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  /** Общая стоимость корзины */
  getTotal(): number {
    return this.items.reduce((sum, item) => sum + item.subtotal, 0);
  }

  getFormattedTotal(): string {
    return `${this.getTotal().toFixed(2).replace(".", ",")} BYN`;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** Добавить товар (или увеличить количество, если уже есть) */
  add(product: Product, quantity = 1): void {
    const existing = this.items.find((i) => i.productId === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.items.push(
        new CartItem({
          productId: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          price: product.price,
          imageUrl: product.imageUrl,
          quantity,
        })
      );
    }
    this.save();
  }

  /** Удалить позицию полностью */
  remove(productId: number): void {
    this.items = this.items.filter((i) => i.productId !== productId);
    this.save();
  }

  /** Изменить количество (если <= 0 — удаляем) */
  setQuantity(productId: number, quantity: number): void {
    const item = this.items.find((i) => i.productId === productId);
    if (!item) return;
    if (quantity <= 0) {
      this.remove(productId);
      return;
    }
    item.quantity = quantity;
    this.save();
  }

  clear(): void {
    this.items = [];
    this.save();
  }

  /** Сохранить в localStorage */
  save(): void {
    if (typeof window === "undefined") return;
    const raw: CartItemRaw[] = this.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      sku: i.sku,
      category: i.category,
      price: i.price,
      imageUrl: i.imageUrl,
      quantity: i.quantity,
    }));
    window.localStorage.setItem(Cart.STORAGE_KEY, JSON.stringify(raw));
  }

  /** Загрузить из localStorage */
  static load(): Cart {
    if (typeof window === "undefined") return new Cart();
    const raw = window.localStorage.getItem(Cart.STORAGE_KEY);
    if (!raw) return new Cart();
    try {
      const parsed: CartItemRaw[] = JSON.parse(raw);
      return new Cart(parsed.map((r) => new CartItem(r)));
    } catch {
      return new Cart();
    }
  }
}