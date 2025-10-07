// ===== FILE 1 (LISTA) — SIN SACAR NADA, SOLO LINKÉO EL ID A /expenses/:id =====
"use client";

import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import table from "@/styles/Table.module.css";
import btn from "@/styles/Buttons.module.css";
import form from "@/styles/Forms.module.css";
import Link from "next/link";

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  eventId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;

  // 👇 AGREGADO: el backend puede devolver "type"
  type?: "supplies" | "staff" | "equipment" | "other";
};

// (sin cambios)
const CATEGORIES = [
  { value: "", label: "Todas las categorías" },
  { value: "supplies", label: "Supplies" },
  { value: "logistics", label: "Logistics" },
  { value: "staff", label: "Staff" },
  { value: "rent", label: "Rent" },
  { value: "other", label: "Other" },
];

// 👇 AGREGADO: tipo para /expenses/stats
type ExpenseStats = {
  totalExpenses: number;
  totalCount: number;
  averageExpense: number;
  todayExpenses: number;
  byCategory: Record<string, number>;
};

export default function ExpensesListPage() {
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 👇 AGREGADO: estado para estadísticas
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsErr, setStatsErr] = useState<string | null>(null);

  // Filtros UI
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [eventId, setEventId] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      if (!hasRole(["admin"])) {
        setItems([]);
        setErr("No autorizado: requiere rol admin.");
        return;
      }
      const token = getToken();
      const { data } = await api.get<Expense[]>("/expenses", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setItems(Array.isArray(data) ? data.filter(Boolean) : []);
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 403) setErr("No autorizado: requiere rol admin.");
      else setErr(e?.response?.data?.message || "Error al cargar gastos");
    } finally {
      setLoading(false);
    }
  }

  // 👇 AGREGADO: fetch de estadísticas
  async function loadStats() {
    setStatsLoading(true);
    setStatsErr(null);
    setStats(null);
    try {
      if (!hasRole(["admin"])) {
        setStatsErr("No autorizado: requiere rol admin.");
        return;
      }
      const token = getToken();
      const { data } = await api.get<ExpenseStats>("/expenses/stats", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setStats(data);
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 403) setStatsErr("No autorizado: requiere rol admin.");
      else setStatsErr(e?.response?.data?.message || "Error al cargar estadísticas");
    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void loadStats(); // 👈 AGREGADO: cargar stats al montar
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((g) => {
      // 👇 AGREGADO: compatibilidad con "type" del backend
      const catOrType = (g.type ?? g.category);
      const matchCategory = category ? catOrType === category : true;

      const matchEvent = eventId ? (g.eventId || "").toLowerCase() === eventId.trim().toLowerCase() : true;
      const matchQ =
        !term ||
        g.description?.toLowerCase().includes(term) ||
        g.notes?.toLowerCase().includes(term) ||
        (g.category || "").toLowerCase().includes(term) ||
        (g.type || "").toLowerCase().includes(term) || // 👈 AGREGADO
        (g.eventId || "").toLowerCase().includes(term) ||
        g.id.toLowerCase().includes(term);
      return matchCategory && matchEvent && matchQ;
    });
  }, [items, q, category, eventId]);

  const total = useMemo(
    () => filtered.reduce((acc, it) => acc + (typeof it.amount === "number" ? it.amount : 0), 0),
    [filtered]
  );

  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <main style={{ padding: 20 }}>
        <header style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <h1 style={{ marginRight: "auto" }}>Gastos</h1>

          <input
            placeholder="Buscar (desc, notas, categoría, ID, evento)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <input
            placeholder="Filtrar por eventId (opcional)"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
          />

          <button className={btn.secondary} onClick={load} disabled={loading}>
            {loading ? "Actualizando…" : "Refrescar"}
          </button>
          {/* 👇 AGREGADO: refrescar estadísticas */}
          <button className={btn.secondary} onClick={loadStats} disabled={statsLoading}>
            {statsLoading ? "Actualizando stats…" : "Refrescar stats"}
          </button>
          <Link className={btn.primary} href="/expenses/new">+ Nuevo gasto</Link>
        </header>

        {/* Resumen */}
        <section
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fafafa",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <CardStat label="Cantidad de gastos" value={filtered.length} />
          <CardStat label="Total filtrado" value={formatMoney(total)} />
        </section>

        {/* 👇 AGREGADO: Estadísticas de la API */}
        <section
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fff",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 style={{ margin: 0 }}>Estadísticas</h3>
            {statsLoading && <span style={{ color: "#6b7280" }}>Cargando…</span>}
            {statsErr && <span className={form.error} style={{ marginLeft: "auto" }}>{statsErr}</span>}
          </div>

          {!statsErr && (
            <>
              {!stats ? (
                <p style={{ color: "#6b7280", margin: 0 }}>Sin datos de estadísticas.</p>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                    <CardStat label="Total de gastos" value={formatMoney(stats.totalExpenses)} />
                    <CardStat label="Cantidad total" value={stats.totalCount} />
                    <CardStat label="Promedio por gasto" value={formatMoney(stats.averageExpense)} />
                    <CardStat label="Gastos de hoy" value={formatMoney(stats.todayExpenses)} />
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <h4 style={{ margin: "6px 0" }}>Gasto por categoría</h4>
                    <div style={{ overflowX: "auto" }}>
                      <table className={table.table}>
                        <thead>
                          <tr>
                            <th>Categoría</th>
                            <th style={{ textAlign: "right" }}>Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(stats.byCategory || {}).length === 0 ? (
                            <tr><td colSpan={2}>Sin datos.</td></tr>
                          ) : (
                            Object.entries(stats.byCategory).map(([cat, amount]) => (
                              <tr key={cat}>
                                <td><span style={{ fontWeight: 700 }}>{cat}</span></td>
                                <td style={{ textAlign: "right" }}>{formatMoney(amount)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </section>

        {err && <div className={form.error} style={{ marginTop: 10 }}>{err}</div>}

        {/* Tabla */}
        <section style={{ marginTop: 12 }}>
          <div style={{ overflowX: "auto" }}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th style={{ textAlign: "right" }}>Monto</th>
                  <th>Categoría</th>
                  <th>Evento</th>
                  <th>Notas</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6}>Cargando gastos…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6}>No hay gastos para mostrar.</td></tr>
                ) : (
                  filtered.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          {/* 👇 ID ahora linkea al detalle */}
                          <strong>
                            <Link href={`/expenses/${g.id}`}><code>{g.id}</code></Link>
                          </strong>
                          <span>{g.description}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>{formatMoney(g.amount)}</td>
                      <td>
                        <span style={{ fontWeight: 700 }}>{g.category}</span>
                        {/* muestra el type del backend si viene */}
                        {g.type && (
                          <span style={{ marginLeft: 6, color: "#6b7280", fontSize: 12 }}>
                            (API: {g.type})
                          </span>
                        )}
                      </td>
                      <td><code>{g.eventId || "—"}</code></td>
                      <td>{g.notes || "—"}</td>
                      <td>{formatDate(g.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </Guard>
  );
}

function CardStat({ label, value }: { label: string; value: number | string }) {
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

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch { return String(iso); }
}

function formatMoney(n?: number) {
  if (typeof n !== "number") return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(n);
  } catch {
    return n.toFixed(2);
  }
}
