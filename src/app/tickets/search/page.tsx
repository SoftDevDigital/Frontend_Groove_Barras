// (1) TicketSearchPage - agrega acción "Marcar como impreso" (PATCH /tickets/:id/print) sin borrar nada

"use client";

import { useState } from "react";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import table from "@/styles/Table.module.css";
import btn from "@/styles/Buttons.module.css";
import Link from "next/link";

type TicketSearchItem = {
  id: string;
  eventId: string;
  employeeId: string;
  customerName?: string;
  total: number;
  createdAt?: string;

  // ➕ NUEVO (opcional si tu backend lo devuelve en el search)
  printed?: boolean;
  printedAt?: string;
};

export default function TicketSearchPage() {
  const [eventId, setEventId] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const [items, setItems] = useState<TicketSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ---- estado DELETE
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---- ➕ estado PATCH imprimir
  const [printingId, setPrintingId] = useState<string | null>(null);

  async function search() {
    setErr(null);
    setItems([]);
    if (!hasRole(["admin"])) { setErr("No autorizado: requiere rol admin."); return; }
    if (!eventId.trim() || !employeeId.trim()) {
      setErr("Completá eventId y employeeId.");
      return;
    }
    try {
      setLoading(true);
      const token = getToken();
      const { data } = await api.get<TicketSearchItem[]>("/tickets/search", {
        params: { eventId: eventId.trim(), employeeId: employeeId.trim() },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 403) setErr("No autorizado: requiere rol admin.");
      else setErr(e?.response?.data?.message || "Error al buscar tickets");
    } finally {
      setLoading(false);
    }
  }

  // ---- DELETE /tickets/:id
  async function handleDelete(id: string) {
    setErr(null);
    if (!hasRole(["admin"])) { setErr("No autorizado: requiere rol admin."); return; }
    const ok = window.confirm("¿Eliminar este ticket? Esta acción no se puede deshacer.");
    if (!ok) return;
    try {
      setDeletingId(id);
      const token = getToken();
      await api.delete(`/tickets/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setItems(prev => prev.filter(t => t.id !== id));
    } catch (e: any) {
      const sc = e?.response?.status;
      setErr(
        sc === 404 ? "Ticket no encontrado."
        : sc === 403 ? "No autorizado: requiere rol admin."
        : e?.response?.data?.message || "Error al eliminar ticket"
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ---- ➕ PATCH /tickets/:id/print (marcar como impreso)
  async function handleMarkPrinted(id: string) {
    setErr(null);
    // Nota: El endpoint permite admin y bartender; aquí esta vista ya requiere admin
    try {
      setPrintingId(id);
      const token = getToken();
      const { data } = await api.patch<{ id: string; printed: boolean; printedAt?: string }>(
        `/tickets/${id}/print`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      // Actualiza el item en memoria si el search incluye printed/printedAt
      setItems(prev => prev.map(t => t.id === id ? { ...t, printed: data.printed, printedAt: data.printedAt } : t));
    } catch (e: any) {
      const sc = e?.response?.status;
      setErr(
        sc === 404 ? "Ticket no encontrado."
        : sc === 403 ? "No autorizado para marcar como impreso."
        : e?.response?.data?.message || "Error al marcar como impreso"
      );
    } finally {
      setPrintingId(null);
    }
  }

  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <main style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <h1 style={{ marginRight: "auto" }}>Buscar tickets</h1>
          <Link className={btn.secondary} href="/tickets">Volver a Tickets</Link>
        </div>

        <section
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            background: "#fafafa",
            display: "grid",
            gap: 8,
            maxWidth: 760,
          }}
        >
          <label>eventId</label>
          <input
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder="event-123"
          />

          <label>employeeId</label>
          <input
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="employee-123"
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button className={btn.primary} onClick={search} disabled={loading}>
              {loading ? "Buscando…" : "Buscar"}
            </button>
            <button
              className={btn.secondary}
              type="button"
              onClick={() => { setEventId(""); setEmployeeId(""); setItems([]); setErr(null); }}
              disabled={loading}
            >
              Limpiar
            </button>
          </div>

          {err && <p style={{ color: "#b91c1c", margin: 0 }}>{err}</p>}
        </section>

        <section style={{ marginTop: 14 }}>
          <div style={{ overflowX: "auto" }}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Evento</th>
                  <th>Empleado</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7}>Buscando…</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={7}>Sin resultados.</td></tr>
                ) : (
                  items.map((t) => (
                    <tr key={t.id}>
                      <td><code>{t.id}</code></td>
                      <td><code>{t.eventId}</code></td>
                      <td><code>{t.employeeId}</code></td>
                      <td>{t.customerName || "—"}</td>
                      <td>${t.total}</td>
                      <td>{formatDate(t.createdAt)}</td>
                      <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {/* ➕ opcional: ir a imprimir */}
                        <Link className={btn.secondary} href={`/tickets/${t.id}/print`} title="Imprimir">
                          Imprimir
                        </Link>

                        {/* ➕ nuevo: marcar como impreso */}
                        <button
                          className={btn.secondary}
                          onClick={() => handleMarkPrinted(t.id)}
                          disabled={printingId === t.id}
                          title="Marcar ticket como impreso"
                        >
                          {printingId === t.id ? "Marcando…" : "Marcar impreso"}
                        </button>

                        <button
                          className={btn.secondary}
                          onClick={() => handleDelete(t.id)}
                          disabled={deletingId === t.id}
                          style={{ borderColor: "#ef4444", color: "#ef4444" }}
                          title="Eliminar ticket"
                        >
                          {deletingId === t.id ? "Eliminando…" : "Eliminar"}
                        </button>
                      </td>
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

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`;
  } catch { return String(iso); }
}
