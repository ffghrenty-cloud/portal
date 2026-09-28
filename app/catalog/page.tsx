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

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-16 text-center text-xs uppercase tracking-widest">Загрузка...</div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <h1 className="text-xs uppercase tracking-[0.3em] mb-4">
        Каталог продукции
      </h1>
      <p className="text-5xl font-black uppercase mb-16">Все товары</p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <div key={product.id} className="group cursor-pointer">
            {/* Фото — квадратное */}
            <div className="aspect-square bg-gray-100 mb-4 flex items-center justify-center overflow-hidden">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
              ) : (
                <span className="text-xs uppercase tracking-widest text-gray-400">
                  Нет фото
                </span>
              )}
            </div>

            {/* Название */}
            <h3 className="text-sm font-bold uppercase mb-1">
              {product.name}
            </h3>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
              {product.category}
            </p>
            <p className="text-sm font-bold">{product.price} BYN</p>
          </div>
        ))}
      </div>
    </div>
  );
}