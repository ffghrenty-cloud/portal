import { Product, ProductRaw } from "./Product";

export class ProductsApiClient {
  private readonly endpoint: string;

  constructor(endpoint = "/api/products") {
    this.endpoint = endpoint;
  }

  async fetchAll(): Promise<Product[]> {
    const res = await fetch(this.endpoint);
    if (!res.ok) {
      throw new Error(`Ошибка загрузки: ${res.status}`);
    }
    const data: ProductRaw[] = await res.json();
    return data.map((raw) => new Product(raw));
  }
}