"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";
import { Plus, Pencil, Trash2, X } from "lucide-react";

type Product = {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  price: number;
  description: string | null;
  image_url: string | null;
};

const EMPTY: Partial<Product> = {
  name: "",
  sku: "",
  category: "",
  price: 0,
  description: "",
  image_url: "",
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  async function load() {
    const res = await fetch("/api/admin/products", { cache: "no-store" });
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!editing) return;
    const isNew = !editing.id;
    const url = isNew
      ? "/api/admin/products"
      : `/api/admin/products/${editing.id}`;
    const method = isNew ? "POST" : "PUT";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setEditing(null);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Удалить товар?")) return;
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="admin-header">
          <div>
            <span className="eyebrow">АДМИНИСТРИРОВАНИЕ</span>
            <h1 className="admin-title">Товары</h1>
          </div>
          <button
            className="button dark"
            onClick={() => setEditing({ ...EMPTY })}
          >
            <Plus size={16} /> Добавить товар
          </button>
        </div>

        {loading ? (
          <p>Загрузка...</p>
        ) : (
          <div className="admin-table">
            <div className="admin-table-head">
              <div>Название</div>
              <div>Артикул</div>
              <div>Категория</div>
              <div>Цена</div>
              <div>Действия</div>
            </div>
            {products.map((p) => (
              <div className="admin-table-row" key={p.id}>
                <div>{p.name}</div>
                <div>{p.sku || "—"}</div>
                <div>{p.category || "—"}</div>
                <div>{p.price.toFixed(2).replace(".", ",")} BYN</div>
                <div className="admin-table-actions">
                  <button onClick={() => setEditing(p)} title="Редактировать">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => remove(p.id)} title="Удалить">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div className="admin-modal-overlay" onClick={() => setEditing(null)}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-head">
                <h2>{editing.id ? "Редактировать" : "Новый товар"}</h2>
                <button onClick={() => setEditing(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="auth-field">
                <label className="auth-label">Название *</label>
                <input
                  className="auth-input"
                  value={editing.name || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">Артикул</label>
                <input
                  className="auth-input"
                  value={editing.sku || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, sku: e.target.value })
                  }
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">Категория</label>
                <input
                  className="auth-input"
                  value={editing.category || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, category: e.target.value })
                  }
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">Цена, BYN *</label>
                <input
                  type="number"
                  step="0.01"
                  className="auth-input"
                  value={editing.price ?? 0}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      price: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">Описание</label>
                <textarea
                  className="auth-input checkout-textarea"
                  value={editing.description || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">URL фото</label>
                <input
                  className="auth-input"
                  value={editing.image_url || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, image_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="admin-modal-actions">
                <button className="button dark" onClick={save}>
                  Сохранить
                </button>
                <button
                  className="button light"
                  onClick={() => setEditing(null)}
                  style={{ color: "#292722", borderColor: "#292722" }}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}