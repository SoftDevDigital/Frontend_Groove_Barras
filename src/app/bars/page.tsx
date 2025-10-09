"use client";
import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import table from "@/styles/Table.module.css";
import btn from "@/styles/Buttons.module.css";
import Link from "next/link";

type BarItem = {
  id: string;
  name: string;
  eventId: string;
  location?: string;
  status: "active" | "inactive" | "closed"; // 👈 ahora admite "closed"
  createdAt?: string;
  updatedAt?: string;
};

export default function BarsPage() {
  const [bars, setBars] = useState<BarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // 👇 ya existía
  const [eventFilter, setEventFilter] = useState(""); // eventId a filtrar

  // 👇 NUEVO: filtro por estado (usa /bars/status/:status)
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");

  // ⬇️ Ampliada para aceptar status sin romper usos anteriores
  async function fetchBars(eventId?: string, status?: "active" | "inactive") {
    setLoading(true);
    setErr(null);
    try {
      const token = getToken();

      // Reglas de acceso:
      // - listar general o por evento: admin o bartender
      // - listar por estado: solo admin (según requisito)
      if (status) {
        if (!hasRole(["admin"])) {
          setBars([]);
          setErr("No autorizado: filtrar por estado requiere rol admin.");
          setLoading(false);
          return;
        }
      } else {
        if (!hasRole(["admin", "bartender"])) {
          setBars([]);
          setErr("No autorizado: requiere rol admin o bartender.");
          setLoading(false);
          return;
        }
      }

      // Selección de endpoint
      const url = status
        ? `/bars/status/${encodeURIComponent(status)}`
        : eventId?.trim()
        ? `/bars/event/${encodeURIComponent(eventId.trim())}`
        : "/bars";

      const { data } = await api.get<BarItem[]>(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setBars(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const statusCode = e?.response?.status;
      if (statusCode === 403) {
        setErr(status ? "No autorizado: requiere rol admin." : "No autorizado: requiere rol admin o bartender.");
      } else if (statusCode === 404) {
        setErr(status ? "No se encontraron barras para ese estado." : "No se encontraron barras para ese evento.");
      } else {
        setErr(e?.response?.data?.message || "Error al cargar barras");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return bars;
    return bars.filter((b) =>
      [b.name, b.location, b.status, b.eventId]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [bars, q]);

  return (
    <Guard roles={["admin", "bartender"]}>
      <Navbar />
      <main style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <h1 style={{ marginRight: "auto" }}>Barras</h1>

          {/* Filtro por eventId (llama a /bars/event/:eventId) */}
          <input
            placeholder="Filtrar por eventId (ej: event-123)…"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <button
            className={btn.secondary}
            onClick={() => fetchBars(eventFilter || undefined)}
            disabled={loading}
            title="Buscar por eventId (si está vacío lista todas)"
          >
            {loading ? "Buscando…" : "Buscar por evento"}
          </button>

          {/* NUEVO: Filtro por estado (solo admin) -> /bars/status/:status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "inactive")}
            style={{ height: 36, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}
            title="Filtrar por estado (solo admin)"
          >
            <option value="">Todos (sin filtro por estado)</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </select>
          <button
            className={btn.secondary}
            onClick={() => fetchBars(undefined, statusFilter || undefined)}
            disabled={loading}
            title="Si eliges un estado, usa /bars/status/:status (requiere admin)"
          >
            {loading ? "Buscando…" : "Buscar por estado"}
          </button>

          {/* Búsqueda local en resultados */}
          <input
            placeholder="Buscar en la tabla…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <button className={btn.secondary} onClick={() => fetchBars()} disabled={loading}>
            {loading ? "Actualizando…" : "Refrescar"}
          </button>

          {hasRole(["admin"]) && (
            <Link className={btn.primary} href="/bars/new">
              + Nueva
            </Link>
          )}
        </div>

        {err && <p style={{ color: "#b91c1c", marginTop: 8, width: "100%" }}>{err}</p>}

        <table className={table.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Evento</th>
              <th>Ubicación</th>
              <th>Estado</th>
              <th>Creada</th>
              <th>Actualizada</th>
            </tr>
          </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>Cargando barras…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>No hay barras para mostrar.</td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>
                        <Link href={`/bars/${b.id}`}>{b.name}</Link>
                      </strong>
                    </td>
                    <td>
                      <code style={codeStyle}>{b.eventId}</code>
                    </td>
                    <td>{b.location || "—"}</td>
                    <td>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 999,
                          textTransform: "uppercase",
                          background:
                            b.status === "active" ? "#d1fae5" : b.status === "closed" ? "#e5e7eb" : "#fee2e2",
                          color:
                            b.status === "active" ? "#065f46" : b.status === "closed" ? "#374151" : "#991b1b",
                        }}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td>{formatDate(b.createdAt)}</td>
                    <td>{formatDate(b.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
        </table>
      </main>
    </Guard>
  );
}

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

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return iso;
  }
}