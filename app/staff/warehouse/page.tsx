"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ClipboardList, Package } from "lucide-react";

type Product = { id: number; name: string; sku: string | null; category: string | null; stock_quantity: number; reserved_quantity: number; free_quantity: number };
type Movement = { id: number; product_id: number; product_name: string; sku: string | null; movement_type: string; quantity: number; balance_after: number; note: string | null; created_at: string; employee: string | null };
const field: React.CSSProperties = { width: "100%", padding: "11px 12px", border: "1px solid #d8d0c6", background: "#fff", borderRadius: 3, marginTop: 6, color: "#292722" };
const labels: Record<string, string> = { receive: "Приход", writeoff: "Списание", set: "Корректировка", shipment: "Отгрузка заказа" };
const signed = (n: number) => n > 0 ? `+${n}` : String(n);

export default function WarehousePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState("receive");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/staff/warehouse", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Нет доступа к складу"); return; }
      setProducts(data.products || []);
      setMovements(data.movements || []);
      setProductId(current => current || String(data.products?.[0]?.id || ""));
    } catch { setError("Не удалось связаться с сервером"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => products.filter(p => {
    const q = search.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q);
  }), [products]);

  const selected = products.find(p => p.id === Number(productId));
  const totalUnits = products.reduce((sum, p) => sum + Number(p.stock_quantity || 0), 0);
  const totalReserved = products.reduce((sum, p) => sum + Number(p.reserved_quantity || 0), 0);
  const totalFree = products.reduce((sum, p) => sum + Number(p.free_quantity || 0), 0);
  const lowStock = products.filter(p => Number(p.stock_quantity || 0) <= 5).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/staff/warehouse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: Number(productId), type, quantity: Number(quantity), note }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || "Не удалось выполнить операцию");
      else {
        setMessage(type === "receive" ? "Товар оприходован" : type === "writeoff" ? "Товар списан" : "Остаток скорректирован");
        setNote(""); await load();
      }
    } catch { setError("Не удалось связаться с сервером"); }
    finally { setBusy(false); }
  }

  return <main style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 22px 60px", color: "#292722" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
      <div><span className="eyebrow">УЧЁТ ТОВАРОВ</span><h1 style={{ fontSize: 30, margin: "8px 0" }}>Склад</h1><p style={{ color: "#777", margin: 0 }}>Приход, списание и корректировка остатков товаров.</p></div>
      <div style={{ display: "flex", gap: 14 }}><Link href="/staff" className="text-link">Рабочая панель</Link><Link href="/staff/tasks" className="text-link">Рабочие задания →</Link></div>
    </header>
    {error && <p role="alert" style={{ padding: 12, background: "#fff0ef", color: "#a33" }}>{error}</p>}
    {message && <p role="status" style={{ padding: 12, background: "#edf8f0", color: "#236b42" }}>{message}</p>}
    {loading ? <p>Загрузка склада...</p> : <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        <section style={{ padding: 18, background: "#fff", border: "1px solid #e8e1d8" }}><Package size={19}/><div style={{ fontSize: 26, marginTop: 10 }}>{products.length}</div><small style={{ color: "#777" }}>Позиций в каталоге</small></section>
        <section style={{ padding: 18, background: "#fff", border: "1px solid #e8e1d8" }}><ArrowDownToLine size={19}/><div style={{ fontSize: 26, marginTop: 10 }}>{totalUnits}</div><small style={{ color: "#777" }}>Единиц товара на складе</small></section>
        <section style={{ padding: 18, background: "#fff", border: "1px solid #e8e1d8" }}><ClipboardList size={19}/><div style={{ fontSize: 26, marginTop: 10 }}>{totalReserved}</div><small style={{ color: "#777" }}>Зарезервировано</small></section>
        <section style={{ padding: 18, background: "#fff", border: "1px solid #e8e1d8" }}><Package size={19}/><div style={{ fontSize: 26, marginTop: 10 }}>{totalFree}</div><small style={{ color: "#777" }}>Свободный остаток</small></section>
        <section style={{ padding: 18, background: "#fff", border: "1px solid #e8e1d8" }}><ClipboardList size={19}/><div style={{ fontSize: 26, marginTop: 10 }}>{lowStock}</div><small style={{ color: "#777" }}>Позиций с остатком 5 шт. или меньше</small></section>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, .8fr)", gap: 20, alignItems: "start" }}>
        <section style={{ background: "#fff", border: "1px solid #e8e1d8", padding: 20 }}>
          <h2 style={{ margin: "0 0 14px" }}>Остатки товаров</h2>
          <input aria-label="Поиск товара" placeholder="Поиск по названию или артикулу" value={search} onChange={e => setSearch(e.target.value)} style={field}/>
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead><tr style={{ color: "#777", fontSize: 12 }}><th style={{ padding: 10 }}>Товар</th><th style={{ padding: 10 }}>Артикул</th><th style={{ padding: 10, textAlign: "right" }}>Физически</th><th style={{ padding: 10, textAlign: "right" }}>Резерв</th><th style={{ padding: 10, textAlign: "right" }}>Свободно</th></tr></thead>
              <tbody>{filtered.map(p => <tr key={p.id} style={{ borderTop: "1px solid #eee8e0" }}><td style={{ padding: 10 }}>{p.name}<small style={{ display: "block", color: "#888" }}>{p.category || "Без категории"}</small></td><td style={{ padding: 10 }}>{p.sku || "—"}</td><td style={{ padding: 10, textAlign: "right" }}>{p.stock_quantity ?? 0} шт.</td><td style={{ padding: 10, textAlign: "right" }}>{p.reserved_quantity ?? 0} шт.</td><td style={{ padding: 10, textAlign: "right", fontWeight: 600 }}>{p.free_quantity ?? 0} шт.</td></tr>)}
                {filtered.length === 0 && <tr><td colSpan={5} style={{ padding: 18, color: "#777" }}>Ничего не найдено</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #e8e1d8", padding: 20 }}>
          <h2 style={{ margin: "0 0 14px" }}>Складская операция</h2>
          <label style={{ display: "block", marginBottom: 13 }}>Товар<select required value={productId} onChange={e => setProductId(e.target.value)} style={field}>{products.map(p => <option key={p.id} value={p.id}>{p.name} · свободно {p.free_quantity} шт.</option>)}</select></label>
          <label style={{ display: "block", marginBottom: 13 }}>Операция<select value={type} onChange={e => setType(e.target.value)} style={field}><option value="receive">Приход товара</option><option value="writeoff">Списание товара</option><option value="set">Установить точный остаток</option></select></label>
          <label style={{ display: "block", marginBottom: 13 }}>{type === "receive" ? "Количество к поступлению" : type === "writeoff" ? "Количество к списанию" : "Фактическое количество на складе"}<input required type="number" min={type === "set" ? Number(selected?.reserved_quantity || 0) : 1} step="1" value={quantity} onChange={e => setQuantity(e.target.value)} style={field}/></label>
          {selected && <p style={{ color: "#777", fontSize: 13 }}>Физический остаток: <strong>{selected.stock_quantity} шт.</strong> · резерв: <strong>{selected.reserved_quantity} шт.</strong> · свободно: <strong>{selected.free_quantity} шт.</strong>{type === "set" && <span> · новый остаток не может быть меньше резерва</span>}</p>}
          <label style={{ display: "block", marginBottom: 16 }}>Комментарий<input value={note} onChange={e => setNote(e.target.value)} placeholder="Номер накладной или причина операции" maxLength={300} style={field}/></label>
          <button className="button dark" type="submit" disabled={busy || !products.length} style={{ width: "100%" }}>{busy ? "Сохранение..." : "Провести операцию"}</button>
        </form>
      </div>
      <section style={{ marginTop: 22, background: "#fff", border: "1px solid #e8e1d8", padding: 20 }}>
        <h2 style={{ margin: "0 0 14px" }}>История складских операций</h2>
        {movements.length === 0 ? <p style={{ color: "#777" }}>Операций пока нет. Все новые приходы, списания и корректировки будут отображаться здесь.</p> :
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead><tr style={{ color: "#777", fontSize: 12 }}><th style={{ padding: 10 }}>Дата</th><th style={{ padding: 10 }}>Товар</th><th style={{ padding: 10 }}>Операция</th><th style={{ padding: 10, textAlign: "right" }}>Изменение</th><th style={{ padding: 10, textAlign: "right" }}>Остаток</th><th style={{ padding: 10 }}>Сотрудник / комментарий</th></tr></thead>
            <tbody>{movements.map(m => <tr key={m.id} style={{ borderTop: "1px solid #eee8e0" }}><td style={{ padding: 10, whiteSpace: "nowrap" }}>{new Date(m.created_at).toLocaleString("ru-RU")}</td><td style={{ padding: 10 }}>{m.product_name}<small style={{ display: "block", color: "#888" }}>{m.sku || "—"}</small></td><td style={{ padding: 10 }}>{labels[m.movement_type] || m.movement_type}</td><td style={{ padding: 10, textAlign: "right", fontWeight: 600 }}>{signed(m.quantity)} шт.</td><td style={{ padding: 10, textAlign: "right" }}>{m.balance_after} шт.</td><td style={{ padding: 10 }}>{m.employee || "—"}{m.note && <small style={{ display: "block", color: "#888" }}>{m.note}</small>}</td></tr>)}</tbody>
          </table></div>}
      </section>
    </>}
  </main>;
}
