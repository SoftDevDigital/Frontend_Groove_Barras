// ✅ NUEVO ARCHIVO: src/app/stock/info/page.tsx
"use client";

import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import btn from "@/styles/Buttons.module.css";
import table from "@/styles/Table.module.css";
import form from "@/styles/Forms.module.css";
import Link from "next/link";

type RecentMovement = {
  id: string;
  productId: string;
  fromBarId: string;
  toBarId: string;
  quantity: number;
  createdAt: string;
};

type StockInfoResponse = {
  totalAssignments: number;
  totalProducts: number;
  lowStockItems: number;
  recentMovements: RecentMovement[];
};

export default function StockInfoPage() {
  const [data, setData] = useState<StockInfoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    setLoading(true);
    setData(null);
    try {
      if (!hasRole(["admin"])) {
        setErr("Solo admin puede ver la información de stock.");
        return;
      }
      const token = getToken();
      const { data } = await api.get<StockInfoResponse>("/stock/info", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setData(data);
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 403) setErr("No autorizado: requiere rol admin.");
      else setErr(e?.response?.data?.message || "Error al cargar información de stock");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function formatDate(iso?: string) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } catch {
      return String(iso);
    }
  }

  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <main style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ marginRight: "auto" }}>Información de stock</h1>
          <Link className={btn.secondary} href="/stock/search">Buscar stock</Link>
          <Link className={btn.secondary} href="/stock/assign">Asignar stock</Link>
          <Link className={btn.secondary} href="/stock/move">Mover stock</Link>
          <button className={btn.secondary} onClick={load} disabled={loading}>
            {loading ? "Actualizando…" : "Refrescar"}
          </button>
        </div>

        {err && <div className={form.error} style={{ marginTop: 10 }}>{err}</div>}

        {!err && (
          <>
            {/* Métricas principales */}
            <section
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                background: "#fafafa",
                display: "grid",
                gap: 12,
              }}
            >
              {loading && <p style={{ color: "#6b7280", margin: 0 }}>Cargando métricas…</p>}
              {!loading && !data && <p style={{ color: "#6b7280", margin: 0 }}>Sin datos para mostrar.</p>}
              {!loading && data && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <CardStat label="Asignaciones totales" value={data.totalAssignments} />
                  <CardStat label="Productos distintos" value={data.totalProducts} />
                  <CardStat label="Ítems con bajo stock" value={data.lowStockItems} />
                </div>
              )}
            </section>

            {/* Movimientos recientes */}
            <section style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <h3 style={{ margin: 0 }}>Movimientos recientes</h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Producto</th>
                      <th>Desde</th>
                      <th>Hacia</th>
                      <th style={{ textAlign: "right" }}>Cantidad</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6}>Cargando movimientos…</td></tr>
                    ) : !data || data.recentMovements?.length === 0 ? (
                      <tr><td colSpan={6}>No hay movimientos recientes.</td></tr>
                    ) : (
                      data.recentMovements.map((m, i) => (
                        <tr key={`${m.id}-${i}`}>
                          <td><code>{m.id}</code></td>
                          <td><code>{m.productId}</code></td>
                          <td><code>{m.fromBarId}</code></td>
                          <td><code>{m.toBarId}</code></td>
                          <td style={{ textAlign: "right" }}>{m.quantity}</td>
                          <td>{formatDate(m.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </Guard>
  );
}

function CardStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 14,
        display: "grid",
        gap: 6,
      }}
    >
      <span style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 800 }}>{value ?? 0}</span>
    </div>
  );
}
