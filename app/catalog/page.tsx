"use client";

import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/useCart";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { Product } from "@/lib/Product";
import { ProductFilter, SortOption } from "@/lib/ProductFilter";
import { ProductsApiClient } from "@/lib/ProductsApiClient";

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("default");
  const { add: addToCart } = useCart();

  const searchParams = useSearchParams();

// Инициализация поиска из URL при загрузке
useEffect(() => {
  const q = searchParams?.get("q");
  if (q) setSearch(q);
}, [searchParams]);

  // Загрузка через класс ProductsApiClient
  useEffect(() => {
    const client = new ProductsApiClient();
    client
      .fetchAll()
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Категории с количеством — статический метод класса
  const categoriesWithCounts = useMemo(
    () => ProductFilter.getCategoriesWithCounts(products),
    [products]
  );

  // Границы цен — статический метод класса
  const priceBounds = useMemo(
    () => ProductFilter.getPriceBounds(products),
    [products]
  );

  // Фильтрация через объект ProductFilter (fluent API)
  const filteredProducts = useMemo(() => {
    const filter = new ProductFilter(products);
    return filter
      .setCategories(selectedCategories)
      .setPriceRange(priceMin, priceMax)
      .setSearch(search)
      .setSort(sort)
      .apply();
  }, [products, selectedCategories, priceMin, priceMax, search, sort]);

  function toggleCategory(name: string) {
    setSelectedCategories((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  }

  function resetFilters() {
    setSelectedCategories([]);
    setPriceMin("");
    setPriceMax("");
    setSearch("");
    setSort("default");
  }

  function removeCategory(name: string) {
    setSelectedCategories((prev) => prev.filter((c) => c !== name));
  }

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    priceMin !== "" ||
    priceMax !== "" ||
    search !== "";

  if (loading) {
    return (
      <div className="catalog-section">
        <div className="catalog-header">
          <div>
            <span className="eyebrow">КАТАЛОГ</span>
            <h1 className="catalog-title">Все товары</h1>
          </div>
        </div>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="catalog-section">
      <div className="catalog-header">
        <div>
          <span className="eyebrow">КАТАЛОГ</span>
          <h1 className="catalog-title">Все товары</h1>
        </div>
        <Link href="/" className="text-link">
          На главную <ArrowRight size={16} />
        </Link>
      </div>

      <div className="catalog-layout">
        <aside className="catalog-filters">
          <div className="filter-block">
            <h3 className="filter-block-title">Категории</h3>
            {categoriesWithCounts.map((cat) => (
              <label key={cat.name} className="filter-check">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat.name)}
                  onChange={() => toggleCategory(cat.name)}
                />
                <span>{cat.name}</span>
                <span className="count">{cat.count}</span>
              </label>
            ))}
          </div>

          <div className="filter-block">
            <h3 className="filter-block-title">Цена, BYN</h3>
            <div className="filter-price-row">
              <input
                type="number"
                className="filter-price-input"
                placeholder={`от ${priceBounds.min}`}
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
              />
              <span className="filter-price-sep">—</span>
              <input
                type="number"
                className="filter-price-input"
                placeholder={`до ${priceBounds.max}`}
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
              />
            </div>
          </div>

          {hasActiveFilters && (
            <button className="filter-reset" onClick={resetFilters}>
              Сбросить фильтры
            </button>
          )}
        </aside>

        <div>
          <div className="catalog-topbar">
            <div className="catalog-search">
              <Search size={18} color="#9a938a" />
              <input
                type="text"
                placeholder="Поиск по названию, категории, артикулу..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{
                    border: 0,
                    background: "transparent",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                  }}
                  aria-label="Очистить поиск"
                >
                  <X size={16} color="#9a938a" />
                </button>
              )}
            </div>

            <div className="catalog-sort">
              <span>Сортировка:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
              >
                <option value="default">По умолчанию</option>
                <option value="price-asc">Цена: по возрастанию</option>
                <option value="price-desc">Цена: по убыванию</option>
                <option value="name-asc">Название: А → Я</option>
              </select>
            </div>
          </div>

          {selectedCategories.length > 0 && (
            <div className="filter-chips">
              {selectedCategories.map((c) => (
                <span key={c} className="filter-chip">
                  {c}
                  <button onClick={() => removeCategory(c)} aria-label="Убрать">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="catalog-count">
            Найдено: {filteredProducts.length} из {products.length}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="profile-empty">
              <p>По вашему запросу ничего не найдено.</p>
              <button
                className="filter-reset"
                onClick={resetFilters}
                style={{ maxWidth: 240, margin: "0 auto" }}
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="products-grid">
              {filteredProducts.map((product) => (
                <article className="product-card" key={product.id}>
                  <div className="product-image">
                    {product.hasImage ? (
                      <img src={product.imageUrl!} alt={product.name} />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#928a81",
                          fontSize: "13px",
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                        }}
                      >
                        Нет фото
                      </div>
                    )}
                  </div>
                  <div className="product-info">
                    <span className="product-category">{product.category}</span>
                    <h3>{product.name}</h3>
                    <div className="product-stock">В наличии</div>
                    <div className="product-bottom">
                      <div className="product-price">
                        <b>{product.formattedPrice}</b>
                      </div>
                     <button
                       className="add-btn"
                          onClick={() => addToCart(product)}
                       >
                         В заявку
                       </button>
                    </div>
                    <small>{product.description}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}