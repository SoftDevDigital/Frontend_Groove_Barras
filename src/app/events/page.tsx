// src/app/events/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import table from "@/styles/Table.module.css";
import btn from "@/styles/Buttons.module.css";
import Link from "next/link";

type EventItem = {
  id: string;
  name: string;
  date?: string; // ISO (active/closed)
  status?: "active" | "inactive" | "closed";
  description?: string;
  location?: string;
  createdAt?: string;
  updatedAt?: string;
};

type View = "all" | "active" | "closed";

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("all");

  async function fetchEvents(v: View = view) {
    setLoading(true);
    setErr(null);
    try {
      if (v === "closed" && !hasRole(["admin"])) {
        setErr("No autorizado: requiere rol admin.");
        setEvents([]);
        setLoading(false);
        return;
      }

      const token = getToken();
      const url = v === "active" ? "/events/active" : v === "closed" ? "/events/closed" : "/events";
      const { data } = await api.get<EventItem[]>(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setEvents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setErr("No autorizado.");
      else setErr(e?.response?.data?.message || "Error al cargar eventos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return events;
    return events.filter((ev) =>
      [ev.name, ev.location, ev.status, ev.description]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [events, q]);

  return (
    <Guard roles={["admin", "bartender"]}>
      <Navbar />
      <main style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
          <h1 style={{ marginRight: "auto" }}>Eventos</h1>

          <input
            placeholder="Buscar por nombre, ubicación, estado…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div style={{ display: "inline-flex", border: "1px solid #e5e7eb", borderRadius: 10 }}>
            <button
              onClick={() => setView("all")}
              disabled={loading}
              style={segBtnStyle(view === "all")}
              title="Todos los eventos"
            >
              Todos
            </button>
            <button
              onClick={() => setView("active")}
              disabled={loading}
              style={segBtnStyle(view === "active")}
              title="Eventos activos"
            >
              Activos
            </button>
            <button
              onClick={() => setView("closed")}
              disabled={loading || !hasRole(["admin"])}
              style={segBtnStyle(view === "closed")}
              title="Eventos cerrados (solo admin)"
            >
              Cerrados
            </button>
          </div>

          <button className={btn.secondary} onClick={() => fetchEvents()} disabled={loading}>
            {loading ? "Actualizando…" : "Refrescar"}
          </button>

          {hasRole(["admin"]) && view !== "active" && view !== "closed" && (
            <Link className={btn.primary} href="/events/new">
              + Nuevo
            </Link>
          )}
        </div>

        {err && <p style={{ color: "#b91c1c", marginTop: 8 }}>{err}</p>}

        <table className={table.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Fecha</th>
              <th>Ubicación</th>
              <th>Estado</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>Cargando eventos…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5}>No hay eventos para mostrar.</td>
              </tr>
            ) : (
              filtered.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {/* 👇 Link al detalle */}
                      <strong>
                        <Link href={`/events/${ev.id}`}>{ev.name}</Link>
                      </strong>
                      {ev.description && (
                        <span style={{ color: "#6b7280", fontSize: 12 }}>{ev.description}</span>
                      )}
                    </div>
                  </td>
                  <td>{formatDate(ev.date)}</td>
                  <td>{ev.location || "—"}</td>
                  <td>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 999,
                        textTransform: "uppercase",
                        background:
                          ev.status === "active"
                            ? "#d1fae5"
                            : ev.status === "closed"
                            ? "#e5e7eb"
                            : "#fee2e2",
                        color:
                          ev.status === "active"
                            ? "#065f46"
                            : ev.status === "closed"
                            ? "#374151"
                            : "#991b1b",
                      }}
                    >
                      {ev.status || "—"}
                    </span>
                  </td>
                  <td>{formatDate(ev.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </main>
    </Guard>
  );
}

function segBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    border: "none",
    background: active ? "#111827" : "transparent",
    color: active ? "#fff" : "#111827",
    cursor: "pointer",
    fontWeight: 600,
    borderRadius: active ? 10 : 0,
  };
}

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
