// src/app/bars/[id]/sales-summary/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import Link from "next/link";
import btn from "@/styles/Buttons.module.css";

type SalesSummary = {
  bar: {
    id: string;
    name: string;
    eventId: string;
    printer?: string;
    status?: "active" | "inactive" | "closed";
  };
  totalSales: number;
  totalTickets: number;
  totalRevenue: number;
  averageTicketValue: number;
  productsSold: {
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
    percentage: number;
  }[];
  salesByUser: {
    userId: string;
    userName: string;
    ticketCount: number;
    totalSales: number;
  }[];
  salesByPaymentMethod: {
    cash?: number;
    card?: number;
    mixed?: number;
    [k: string]: number | undefined;
  };
  hourlyDistribution: {
    hour: string; // "HH:00"
    ticketCount: number;
    revenue: number;
  }[];
};

export default function BarSalesSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      if (!hasRole(["admin"])) {
        setErr("No autorizado: requiere rol admin.");
        setLoading(false);
        return;
      }
      const token = getToken();
      const { data } = await api.get<SalesSummary>(`/bars/${id}/sales-summary`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setData(data);
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 404) setErr("No se encontró la barra o no hay resumen disponible.");
      else if (sc === 403) setErr("No autorizado: requiere rol admin.");
      else setErr(e?.response?.data?.message || "Error al cargar el resumen de ventas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const paymentRows = useMemo(() => {
    if (!data?.salesByPaymentMethod) return [];
    const entries = Object.entries(data.salesByPaymentMethod)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => ({ method: k, amount: v as number }));
    const total = entries.reduce((a, b) => a + b.amount, 0);
    return entries
      .map((r) => ({ ...r, pct: total > 0 ? (r.amount * 100) / total : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [data]);

  const hourly = useMemo(() => {
    const list = data?.hourlyDistribution ?? [];
    // Orden por hora (HH:MM) ascendente
    return [...list].sort((a, b) => a.hour.localeCompare(b.hour));
  }, [data]);

  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <main style={{ padding: 20, display: "grid", gap: 14, maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => router.back()}
            style={{ background: "transparent", border: "none", cursor: "pointer" }}
            title="Volver"
          >
            ← Volver
          </button>
          <h1 style={{ margin: 0 }}>Resumen de ventas por barra</h1>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {id && (
              <Link className={btn.secondary} href={`/bars/${id}`}>
                Ver detalle de barra
              </Link>
            )}
            <button className={btn.secondary} onClick={load} disabled={loading}>
              {loading ? "Actualizando…" : "Refrescar"}
            </button>
          </div>
        </div>

        {err && (
          <div style={{ border: "1px solid #fecaca", background: "#fee2e2", color: "#7f1d1d", padding: 12, borderRadius: 12 }}>
            {err}
          </div>
        )}

        {/* Meta de la barra */}
        <section style={cardSectionStyle}>
          <strong style={cardTitle}>Barra</strong>
          {loading ? (
            <span style={{ color: "#6b7280" }}>Cargando…</span>
          ) : !data ? (
            <span style={{ color: "#6b7280" }}>Sin datos para mostrar.</span>
          ) : (
            <div style={gridCols(5)}>
              <Card title="Nombre" value={data.bar?.name || "—"} />
              <Card title="Bar ID" value={<code style={codeStyle}>{data.bar?.id}</code>} />
              <Card title="Evento" value={<code style={codeStyle}>{data.bar?.eventId}</code>} />
              <Card title="Impresora" value={data.bar?.printer || "—"} />
              <Card title="Estado" value={data.bar?.status || "—"} />
            </div>
          )}
        </section>

        {/* Totales */}
        <section style={cardSectionStyle}>
          <strong style={cardTitle}>Totales</strong>
          {loading ? (
            <span style={{ color: "#6b7280" }}>Cargando…</span>
          ) : !data ? (
            <span style={{ color: "#6b7280" }}>—</span>
          ) : (
            <div style={gridCols(4)}>
              <Kpi title="Total ventas" value={data.totalSales} />
              <Kpi title="Tickets" value={data.totalTickets} />
              <Kpi title="Ingresos" value={money(data.totalRevenue)} />
              <Kpi title="Ticket promedio" value={money(data.averageTicketValue)} />
            </div>
          )}
        </section>

        {/* Productos vendidos */}
        <section style={cardSectionStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={cardTitle}>Productos vendidos</strong>
            <small style={{ color: "#6b7280" }}>Cantidad, ingresos y % del total</small>
          </div>
          {loading ? (
            <span style={{ color: "#6b7280" }}>Cargando…</span>
          ) : !data?.productsSold?.length ? (
            <span style={{ color: "#6b7280" }}>No hay productos vendidos en este rango.</span>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <Th>Producto</Th>
                    <Th style={{ textAlign: "right" }}>Cantidad</Th>
                    <Th style={{ textAlign: "right" }}>Ingresos</Th>
                    <Th style={{ textAlign: "right" }}>%</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.productsSold]
                    .sort((a, b) => b.quantitySold - a.quantitySold)
                    .map((p) => (
                      <tr key={p.productId}>
                        <Td>{p.productName}</Td>
                        <Td style={{ textAlign: "right" }}>{p.quantitySold}</Td>
                        <Td style={{ textAlign: "right" }}>{money(p.revenue)}</Td>
                        <Td style={{ textAlign: "right" }}>{p.percentage.toFixed(1)}%</Td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Ventas por bartender */}
        <section style={cardSectionStyle}>
          <strong style={cardTitle}>Ventas por bartender</strong>
          {loading ? (
            <span style={{ color: "#6b7280" }}>Cargando…</span>
          ) : !data?.salesByUser?.length ? (
            <span style={{ color: "#6b7280" }}>No hay ventas por usuario.</span>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <Th>Usuario</Th>
                    <Th style={{ textAlign: "right" }}>Tickets</Th>
                    <Th style={{ textAlign: "right" }}>Ventas</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.salesByUser]
                    .sort((a, b) => b.totalSales - a.totalSales)
                    .map((u) => (
                      <tr key={u.userId}>
                        <Td>{u.userName || u.userId}</Td>
                        <Td style={{ textAlign: "right" }}>{u.ticketCount}</Td>
                        <Td style={{ textAlign: "right" }}>{money(u.totalSales)}</Td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Métodos de pago */}
        <section style={cardSectionStyle}>
          <strong style={cardTitle}>Métodos de pago</strong>
          {loading ? (
            <span style={{ color: "#6b7280" }}>Cargando…</span>
          ) : paymentRows.length === 0 ? (
            <span style={{ color: "#6b7280" }}>Sin datos de métodos de pago.</span>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <Th>Método</Th>
                    <Th style={{ textAlign: "right" }}>Monto</Th>
                    <Th style={{ textAlign: "right" }}>%</Th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map((r) => (
                    <tr key={r.method}>
                      <Td>{labelPayment(r.method)}</Td>
                      <Td style={{ textAlign: "right" }}>{money(r.amount)}</Td>
                      <Td style={{ textAlign: "right" }}>{r.pct.toFixed(1)}%</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Distribución horaria */}
        <section style={cardSectionStyle}>
          <strong style={cardTitle}>Distribución por hora</strong>
          {loading ? (
            <span style={{ color: "#6b7280" }}>Cargando…</span>
          ) : hourly.length === 0 ? (
            <span style={{ color: "#6b7280" }}>Sin ventas por franja horaria.</span>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <Th>Hora</Th>
                    <Th style={{ textAlign: "right" }}>Tickets</Th>
                    <Th style={{ textAlign: "right" }}>Ingresos</Th>
                  </tr>
                </thead>
                <tbody>
                  {hourly.map((h) => (
                    <tr key={h.hour}>
                      <Td>{h.hour}</Td>
                      <Td style={{ textAlign: "right" }}>{h.ticketCount}</Td>
                      <Td style={{ textAlign: "right" }}>{money(h.revenue)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </Guard>
  );
}

/* ---------- UI helpers ---------- */
function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, display: "grid", gap: 6 }}>
      <span style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 22, fontWeight: 800 }}>{value ?? "—"}</span>
    </div>
  );
}
function Card({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, display: "grid", gap: 6 }}>
      <span style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 16, fontWeight: 700 }}>{value ?? "—"}</span>
    </div>
  );
}
const Th: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = (props) => (
  <th
    {...props}
    style={{
      textAlign: "left",
      padding: "8px 10px",
      borderBottom: "1px solid #e5e7eb",
      fontWeight: 700,
      whiteSpace: "nowrap",
      ...(props.style || {}),
    }}
  />
);
const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = (props) => (
  <td
    {...props}
    style={{
      padding: "8px 10px",
      borderBottom: "1px solid #f3f4f6",
      ...(props.style || {}),
    }}
  />
);

function money(n?: number, currency?: string) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  const cur = currency || "ARS";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${cur} ${n}`;
  }
}
function labelPayment(k: string) {
  if (k === "cash") return "Efectivo";
  if (k === "card") return "Tarjeta";
  if (k === "mixed") return "Mixto";
  return k;
}

/* ---------- styles ---------- */
const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};
const codeStyle: React.CSSProperties = {
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  padding: "1px 6px",
  borderRadius: 6,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: 12,
  color: "#374151",
};
const cardTitle: React.CSSProperties = { fontSize: 16 };
const cardSectionStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 10,
};
function gridCols(n: number): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fit, minmax(${Math.floor(1000 / n)}px, 1fr))`,
    gap: 12,
  };
}
