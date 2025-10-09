// (3) TicketDetailPage - agrega "Marcar como impreso" (PATCH /tickets/:id/print) + muestra estado impreso

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import btn from "@/styles/Buttons.module.css";
import table from "@/styles/Table.module.css";

type TicketItem = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
};

type TicketDTO = {
  id: string;
  eventId: string;
  barId: string;
  employeeId: string;
  customerName?: string;
  items: TicketItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: "cash" | "card" | "transfer" | "other" | string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;

  // ➕ NUEVO: campos de impresión
  printed?: boolean;
  printedAt?: string;
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ticket, setTicket] = useState<TicketDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ---- estado de edición PATCH
  const [editing, setEditing] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ---- estado DELETE
  const [deleting, setDeleting] = useState(false);

  // ---- ➕ estado PATCH imprimir
  const [marking, setMarking] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      const token = getToken();
      const { data } = await api.get<TicketDTO>(`/tickets/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setTicket(data);
      // precarga campos del editor
      setCustomerName(data.customerName || "");
      setNotes(data.notes || "");
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 404) setErr("Ticket no encontrado.");
      else if (sc === 403) setErr("No autorizado: requiere rol admin.");
      else setErr(e?.response?.data?.message || "Error al cargar el ticket");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- PATCH /tickets/:id
  async function updateTicket() {
    if (!ticket) return;
    setSaving(true);
    setMsg(null);
    try {
      const token = getToken();
      const body: { customerName?: string; notes?: string } = {};
      body.customerName = customerName.trim() || "";
      body.notes = notes.trim() || "";

      const { data } = await api.patch<{
        id: string; customerName?: string; notes?: string; updatedAt?: string;
      }>(`/tickets/${ticket.id}`, body, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      // aplica los cambios en memoria
      setTicket(t => t ? ({
        ...t,
        customerName: data.customerName ?? t.customerName,
        notes: data.notes ?? t.notes,
        updatedAt: data.updatedAt ?? t.updatedAt,
      }) : t);

      setMsg("Ticket actualizado correctamente.");
      setEditing(false);
    } catch (e: any) {
      const payload = e?.response?.data;
      const text =
        typeof payload?.message === "string"
          ? payload.message
          : payload?.message?.message || "Error al actualizar ticket";
      setMsg(text);
    } finally {
      setSaving(false);
    }
  }

  // ---- DELETE /tickets/:id
  async function deleteTicket() {
    if (!ticket) return;
    const ok = window.confirm("¿Eliminar este ticket? Esta acción no se puede deshacer.");
    if (!ok) return;
    try {
      setDeleting(true);
      const token = getToken();
      await api.delete(`/tickets/${ticket.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      router.push("/tickets");
    } catch (e: any) {
      const sc = e?.response?.status;
      const text =
        sc === 404 ? "Ticket no encontrado."
        : sc === 403 ? "No autorizado: requiere rol admin."
        : e?.response?.data?.message || "Error al eliminar ticket";
      setMsg(text);
    } finally {
      setDeleting(false);
    }
  }

  // ---- ➕ PATCH /tickets/:id/print (marcar como impreso)
  async function markAsPrinted() {
    if (!ticket) return;
    setMsg(null);
    try {
      setMarking(true);
      const token = getToken();
      const { data } = await api.patch<{ id: string; printed: boolean; printedAt: string }>(
        `/tickets/${ticket.id}/print`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      setTicket(t => t ? ({ ...t, printed: data.printed, printedAt: data.printedAt }) : t);
      setMsg("Ticket marcado como impreso.");
    } catch (e: any) {
      const sc = e?.response?.status;
      const text =
        sc === 404 ? "Ticket no encontrado."
        : sc === 403 ? "No autorizado para marcar como impreso."
        : e?.response?.data?.message || "Error al marcar como impreso";
      setMsg(text);
    } finally {
      setMarking(false);
    }
  }

  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <main style={{ padding: 20, maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <button className={btn.secondary} type="button" onClick={() => router.back()}>
            ← Volver
          </button>
          <h1 style={{ margin: 0 }}>Ticket</h1>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className={btn.secondary} onClick={load} disabled={loading}>
              {loading ? "Actualizando…" : "Refrescar"}
            </button>

            {/* ya lo tenías en otra versión, lo mantenemos */}
            <button
              className={btn.secondary}
              onClick={() => ticket && router.push(`/tickets/${ticket.id}/print`)}
              disabled={loading || !ticket}
              title="Imprimir ticket"
            >
              Imprimir
            </button>

            {/* ➕ NUEVO: marcar como impreso */}
            <button
              className={btn.secondary}
              onClick={markAsPrinted}
              disabled={loading || !ticket || marking}
              title="Marcar ticket como impreso"
              style={{ borderColor: "#10b981", color: "#10b981" }}
            >
              {marking ? "Marcando…" : "Marcar impreso"}
            </button>

            <button
              className={btn.secondary}
              onClick={() => setEditing(e => !e)}
              disabled={loading || !ticket}
              title="Editar cliente y notas"
            >
              {editing ? "Cancelar edición" : "Editar"}
            </button>
            <button
              className={btn.secondary}
              onClick={deleteTicket}
              disabled={loading || deleting || !ticket}
              title="Eliminar ticket"
              style={{ borderColor: "#ef4444", color: "#ef4444" }}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </div>

        {err && <p style={{ color: "#b91c1c" }}>{err}</p>}
        {!err && loading && <p style={{ color: "#6b7280" }}>Cargando…</p>}

        {!err && !loading && ticket && (
          <>
            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 12,
                background: "#fff",
                display: "grid",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Row label="ID"><code>{ticket.id}</code></Row>
              <Row label="Evento"><code>{ticket.eventId}</code></Row>
              <Row label="Barra"><code>{ticket.barId}</code></Row>
              <Row label="Empleado"><code>{ticket.employeeId}</code></Row>

              {/* ➕ NUEVO: muestra estado de impresiones si está disponible */}
              {typeof ticket.printed !== "undefined" && (
                <>
                  <Row label="Impreso">
                    <strong style={{ color: ticket.printed ? "#065f46" : "#6b7280" }}>
                      {ticket.printed ? "Sí" : "No"}
                    </strong>
                  </Row>
                  <Row label="Imp. en">{formatDate(ticket.printedAt)}</Row>
                </>
              )}

              {!editing ? (
                <>
                  <Row label="Cliente">{ticket.customerName || "—"}</Row>
                  <Row label="Pago"><strong>{ticket.paymentMethod}</strong></Row>
                  <Row label="Notas">{ticket.notes || "—"}</Row>
                  <Row label="Creado">{formatDate(ticket.createdAt)}</Row>
                  <Row label="Actualizado">{formatDate(ticket.updatedAt)}</Row>
                </>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8 }}>
                    <span style={{ color: "#6b7280", fontWeight: 600 }}>Cliente</span>
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Cliente Actualizado"
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8 }}>
                    <span style={{ color: "#6b7280", fontWeight: 600 }}>Notas</span>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Con hielo"
                    />
                  </div>

                  {msg && (
                    <p style={{ margin: 0, color: msg.includes("Error") ? "#b91c1c" : "#065f46" }}>
                      {msg}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button className={btn.primary} onClick={updateTicket} disabled={saving}>
                      {saving ? "Guardando…" : "Guardar cambios"}
                    </button>
                    <button className={btn.secondary} onClick={() => setEditing(false)} disabled={saving}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section>
              <h3 style={{ margin: "8px 0" }}>Ítems</h3>
              <div style={{ overflowX: "auto" }}>
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>productId</th>
                      <th style={{ textAlign: "right" }}>Cant.</th>
                      <th style={{ textAlign: "right" }}>Precio</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticket.items?.length ? (
                      ticket.items.map((it, i) => (
                        <tr key={`${it.productId || i}-${i}`}>
                          <td>{it.productName}</td>
                          <td><code>{it.productId}</code></td>
                          <td style={{ textAlign: "right" }}>{it.quantity}</td>
                          <td style={{ textAlign: "right" }}>{money(it.price)}</td>
                          <td style={{ textAlign: "right" }}>{money(it.total)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={5}>Sin ítems.</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>Subtotal</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{money(ticket.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>Impuesto</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{money(ticket.tax)}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} style={{ textAlign: "right", fontSize: 16, fontWeight: 800 }}>Total</td>
                      <td style={{ textAlign: "right", fontSize: 16, fontWeight: 800 }}>{money(ticket.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </Guard>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8 }}>
      <span style={{ color: "#6b7280", fontWeight: 600 }}>{label}</span>
      <span>{children}</span>
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
function money(n?: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  } catch { return `$${n}`; }
}
