'use client';

import { useEffect, useState } from 'react';

type Product = {
  id: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  description: string;
  image_url: string | null;
};

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8">Загрузка...</div>;
  if (error) return <div className="p-8 text-red-600">Ошибка: {error}</div>;

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Каталог продукции</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div
            key={product.id}
            className="border rounded-lg p-4 hover:shadow-lg transition"
          >
            <div className="bg-gray-100 h-48 rounded mb-4 flex items-center justify-center text-gray-400">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-full w-full object-cover rounded"
                />
              ) : (
                'Нет фото'
              )}
            </div>
            <h2 className="text-lg font-semibold mb-1">{product.name}</h2>
            <p className="text-sm text-gray-500 mb-2">{product.category}</p>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {product.description}
            </p>
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold">{product.price} BYN</span>
              <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                В корзину
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}