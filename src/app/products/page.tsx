"use client";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import table from "@/styles/Table.module.css";
import btn from "@/styles/Buttons.module.css";
import Link from "next/link";
import { getToken, hasRole } from "@/lib/auth";

type Product = {
  id: string; name: string; price: number; stock?: number;
  quickKey?: string; category?: string; available?: boolean; active?: boolean;
  description?: string; code?: string; unit?: string; createdAt?: string; updatedAt?: string;
};

type ProductStats = {
  totalProducts?: number; totalStock?: number | null; totalValue?: number | null;
  lowStockProducts?: number; categories?: Record<string, number>;
  active?: number; inactive?: number; withKeys?: number; outOfStock?: number;
};

function makeKeyProduct(p: Product, index: number) {
  const anyP = p as any;
  const base = (anyP.id ?? anyP._id ?? p.code ?? p.name ?? "row").toString();
  return `${base}__${index}`;
}

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // stats (si las usás)
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [statsErr, setStatsErr] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // 🔴 eliminar
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      if (!hasRole(["admin", "bartender", "bar_user"])) {
        setItems([]); setErr("No autorizado: requiere rol admin o bartender."); return;
      }
      const token = getToken();
      const { data } = await api.get<Product[]>("/products", {
        params: { search: search || undefined },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setItems(Array.isArray(data) ? data.filter(Boolean) : []);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setErr("No autorizado: requiere rol admin o bartender.");
      else setErr(e?.response?.data?.message || "Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }

  function normalizeStats(d: any): ProductStats {
    if (d && typeof d === "object" && ("total" in d || "totalStockValue" in d)) {
      return {
        totalProducts: d.total ?? d.totalProducts ?? 0,
        totalStock: d.totalStock ?? null,
        totalValue: d.totalStockValue ?? d.totalValue ?? null,
        lowStockProducts: d.lowStock ?? d.lowStockProducts ?? 0,
        categories: d.categories ?? {},
        active: d.active, inactive: d.inactive, withKeys: d.withKeys, outOfStock: d.outOfStock,
      };
    }
    return {
      totalProducts: d?.totalProducts ?? 0,
      totalStock: d?.totalStock ?? null,
      totalValue: d?.totalValue ?? null,
      lowStockProducts: d?.lowStockProducts ?? 0,
      categories: d?.categories ?? {},
    };
  }

  async function loadStats() {
    setStatsLoading(true); setStatsErr(null); setStats(null);
    try {
      if (!hasRole(["admin"])) { setStatsErr("No autorizado: las estadísticas requieren rol admin."); return; }
      const token = getToken();
      const { data } = await api.get<ProductStats>("/products/stats/summary", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setStats(normalizeStats(data));
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setStatsErr("No autorizado: las estadísticas requieren rol admin.");
      else setStatsErr(e?.response?.data?.message || "Error al cargar estadísticas");
    } finally { setStatsLoading(false); }
  }

  // 🔴 preparar confirmación
  function askDelete(p: Product) {
    if (!hasRole(["admin"])) return;
    setDeleteErr(null); setDeleteMsg(null);
    setConfirmId(p.id); setConfirmName(p.name);
  }
  function cancelDelete() {
    setConfirmId(null); setConfirmName(null); setDeleteErr(null);
  }

  // 🔴 ejecutar DELETE /products/:id
  async function doDelete() {
    if (!confirmId) return;
    try {
      if (!hasRole(["admin"])) { setDeleteErr("No autorizado: requiere rol admin."); return; }
      setDeleting(true); setDeleteErr(null); setDeleteMsg(null);

      const token = getToken();
      const { data } = await api.delete<{ message?: string }>(`/products/${confirmId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      // quitar del listado
      setItems(prev => prev.filter(x => x.id !== confirmId));
      setDeleteMsg(data?.message || "Product deleted successfully");

      // limpiar confirm
      setConfirmId(null); setConfirmName(null);

      // (opcional) refrescar estadísticas
      if (hasRole(["admin"])) { void loadStats(); }
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) setDeleteErr("Producto no encontrado.");
      else if (status === 403) setDeleteErr("No autorizado: requiere rol admin.");
      else setDeleteErr(e?.response?.data?.message || "Error al eliminar producto");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    load();
    if (hasRole(["admin"])) { void loadStats(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Guard roles={["admin","bar_user","bartender"]}>
      <Navbar />
      <main style={{padding:20}}>
        <div style={{display:"flex", gap:12, alignItems:"center", flexWrap:"wrap"}}>
          <h1 style={{marginRight:"auto"}}>Productos</h1>
          <input placeholder="Buscar..." value={search} onChange={(e)=>setSearch(e.target.value)} />
          <button className={btn.secondary} onClick={load} disabled={loading}>
            {loading ? "Buscando…" : "Buscar"}
          </button>
          <Link className={btn.primary} href="/products/new">+ Nuevo</Link>
        </div>

        {/* 🔴 barra de confirmación de borrado */}
        {confirmId && hasRole(["admin"]) && (
          <div style={{
            marginTop:12, marginBottom:12, padding:12,
            border:"1px solid #fecaca", background:"#fef2f2", borderRadius:10
          }}>
            <div style={{fontWeight:700, marginBottom:6}}>
              ¿Eliminar el producto “{confirmName}”?
            </div>
            <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
              <button
                className={btn.secondary}
                onClick={doDelete}
                disabled={deleting}
                style={{ background:"#dc2626", color:"#fff", borderColor:"#dc2626" }}
              >
                {deleting ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
              <button className={btn.secondary} onClick={cancelDelete} disabled={deleting}>
                Cancelar
              </button>
            </div>
            {deleteErr && <p style={{color:"#b91c1c", marginTop:8}}>{deleteErr}</p>}
            {deleteMsg && <p style={{color:"#065f46", marginTop:8}}>{deleteMsg}</p>}
          </div>
        )}

        {/* stats (si las usás) */}
        {hasRole(["admin"]) && (
          <section
            style={{
              marginTop: 12, marginBottom: 12, padding: 12,
              border: "1px solid #e5e7eb", borderRadius: 12, background: "#fafafa",
            }}
          >
            <div style={{display:"flex", gap:12, alignItems:"center", marginBottom:8, flexWrap:"wrap"}}>
              <strong style={{fontSize:16}}>Estadísticas</strong>
              <button className={btn.secondary} onClick={loadStats} disabled={statsLoading}>
                {statsLoading ? "Actualizando…" : "Actualizar"}
              </button>
            </div>
            {statsErr && <p style={{color:"#b91c1c", marginTop: 4}}>{statsErr}</p>}
            {/* … (tu bloque de stats existente) … */}
          </section>
        )}

        {err && <p style={{ color:"#b91c1c", marginTop:8 }}>{err}</p>}

        <table className={table.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Key</th>
              <th>Código</th>
              <th>Unidad</th>
              <th>Categoría</th>
              <th>Creado</th>
              <th>Actualizado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10}>Cargando productos…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={10}>No hay productos para mostrar.</td></tr>
            ) : (
              items.map((p, i)=>(
                <tr key={makeKeyProduct(p, i)}>
                  <td>{p.name}</td>
                  <td>${p.price}</td>
                  <td>{p.stock ?? "-"}</td>
                  <td>{p.quickKey ?? "-"}</td>
                  <td><code>{p.code ?? "-"}</code></td>
                  <td>{p.unit ?? "-"}</td>
                  <td>{p.category ?? "-"}</td>
                  <td>{formatDate(p.createdAt)}</td>
                  <td>{formatDate(p.updatedAt)}</td>
                  <td style={{display:"flex", gap:8}}>
                    <Link className={btn.link} href={`/products/${p.id}`}>Ver</Link>
                    {hasRole(["admin"]) && (
                      <button
                        className={btn.secondary}
                        type="button"
                        onClick={()=>askDelete(p)}
                        style={{ borderColor:"#ef4444", color:"#ef4444" }}
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </main>
    </Guard>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch { return iso; }
}
