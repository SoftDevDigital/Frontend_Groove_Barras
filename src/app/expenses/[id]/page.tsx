// ===== ARCHIVO: src/app/expenses/[id]/page.tsx (con DELETE agregado) =====
"use client";

import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import btn from "@/styles/Buttons.module.css";
import form from "@/styles/Forms.module.css";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation"; // 👈 AGREGADO useRouter

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  eventId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // compat con backend
  type?: "supplies" | "staff" | "equipment" | "other";
};

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter(); // 👈 AGREGADO

  const [item, setItem] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ====== AGREGADO: edición (PATCH /expenses/:id) ======
  const [editing, setEditing] = useState(false);
  const [editAmount, setEditAmount] = useState<number | string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // ====== AGREGADO: eliminación (DELETE /expenses/:id) ======
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  // ====== normalizador de errores para no renderizar objetos ======
  function normalizeErrorPayload(payload: any): string {
    if (!payload) return "Ocurrió un error.";
    if (typeof payload === "string") return payload;
    if (typeof payload?.message === "string") return payload.message;
    if (payload?.message && typeof payload.message !== "string") {
      try { return JSON.stringify(payload.message); } catch {}
    }
    try { return JSON.stringify(payload); } catch { return "Ocurrió un error."; }
  }

  async function load() {
    setLoading(true);
    setErr(null);
    setItem(null);
    try {
      if (!hasRole(["admin"])) {
        setErr("No autorizado: requiere rol admin.");
        return;
      }
      const token = getToken();
      const { data } = await api.get<Expense>(`/expenses/${encodeURIComponent(id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setItem(data || null);
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 404) setErr("Gasto no encontrado.");
      else if (sc === 403) setErr("No autorizado: requiere rol admin.");
      else setErr(normalizeErrorPayload(e?.response?.data) || "Error al cargar el gasto");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ====== helpers de edición ======
  function startEdit() {
    if (!item) return;
    setEditing(true);
    setEditAmount(typeof item.amount === "number" ? item.amount : "");
    setEditNotes(item.notes || "");
    setSaveErr(null);
    setSaveMsg(null);
  }
  function cancelEdit() {
    setEditing(false);
    setSaveErr(null);
    setSaveMsg(null);
  }

  async function saveEdit() {
    setSaveErr(null);
    setSaveMsg(null);

    try {
      if (!hasRole(["admin"])) {
        setSaveErr("No autorizado: requiere rol admin.");
        return;
      }
      if (!item) return;

      // Construimos body solo con campos enviados (amount y/o notes)
      const body: { amount?: number; notes?: string } = {};

      if (editAmount !== "") {
        if (Number.isNaN(Number(editAmount))) {
          setSaveErr("El monto debe ser numérico.");
          return;
        }
        const a = Number(editAmount);
        if (!(a > 0)) {
          setSaveErr("El monto debe ser > 0.");
          return;
        }
        body.amount = a;
      }

      // Si las notas están vacías, no las enviamos (el backend las rechaza vacías)
      if (editNotes.trim() !== "") {
        body.notes = editNotes.trim();
      }

      if (Object.keys(body).length === 0) {
        setSaveErr("No hay cambios para guardar.");
        return;
      }

      setSaving(true);
      const token = getToken();
      const { data } = await api.patch<Expense>(
        `/expenses/${encodeURIComponent(item.id)}`,
        body,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      setItem((prev) =>
        prev
          ? {
              ...prev,
              amount: data.amount ?? prev.amount,
              notes: data.notes ?? prev.notes,
              updatedAt: data.updatedAt ?? prev.updatedAt,
            }
          : data
      );
      setSaveMsg("Gasto actualizado correctamente.");
      setEditing(false);
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 403) setSaveErr("No autorizado: requiere rol admin.");
      else if (sc === 404) setSaveErr("Gasto no encontrado.");
      else setSaveErr(normalizeErrorPayload(e?.response?.data) || "Error al actualizar el gasto.");
    } finally {
      setSaving(false);
    }
  }

  // ====== AGREGADO: eliminar gasto ======
  async function onDelete() {
    setDeleteErr(null);
    try {
      if (!hasRole(["admin"])) {
        setDeleteErr("No autorizado: requiere rol admin.");
        return;
      }
      if (!item) return;
      const ok = window.confirm("¿Eliminar este gasto? Esta acción no se puede deshacer.");
      if (!ok) return;

      setDeleting(true);
      const token = getToken();
      await api.delete(`/expenses/${encodeURIComponent(item.id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      // Redirigimos a la lista
      router.push("/expenses");
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 403) setDeleteErr("No autorizado: requiere rol admin.");
      else if (sc === 404) setDeleteErr("Gasto no encontrado.");
      else setDeleteErr(normalizeErrorPayload(e?.response?.data) || "Error al eliminar el gasto.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <main style={{ padding: 20 }}>
        <header style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <h1 style={{ marginRight: "auto" }}>Detalle de gasto</h1>
          <Link className={btn.secondary} href="/expenses">Volver a gastos</Link>
          <button className={btn.secondary} onClick={load} disabled={loading}>
            {loading ? "Actualizando…" : "Refrescar"}
          </button>
          {/* Botón Editar */}
          {!loading && !err && item && !editing && (
            <button className={btn.primary} onClick={startEdit}>Editar</button>
          )}
          {/* 👇 AGREGADO: Botón Eliminar */}
          {!loading && !err && item && (
            <button
              className={btn.secondary}
              onClick={onDelete}
              disabled={deleting}
              style={{ borderColor: "#ef4444", color: "#ef4444" }}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </button>
          )}
        </header>

        {err && <div className={form.error} style={{ marginTop: 10 }}>{err}</div>}
        {deleteErr && <div className={form.error} style={{ marginTop: 10 }}>{deleteErr}</div>}

        {!err && (
          <section
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
              display: "grid",
              gap: 8,
              maxWidth: 760,
            }}
          >
            {loading && <p style={{ color: "#6b7280", margin: 0 }}>Cargando gasto…</p>}
            {!loading && !item && <p style={{ color: "#6b7280", margin: 0 }}>Sin datos para mostrar.</p>}
            {!loading && item && (
              <>
                <div style={{ display: "grid", gap: 6 }}>
                  <Row label="ID"><code>{item.id}</code></Row>
                  <Row label="Descripción">{item.description}</Row>
                  <Row label="Monto">{formatMoney(item.amount)}</Row>
                  <Row label="Categoría"><code>{item.category}</code></Row>
                  {item.type && <Row label="Tipo (API)"><code>{item.type}</code></Row>}
                  <Row label="Evento"><code>{item.eventId || "—"}</code></Row>
                  <Row label="Notas">{item.notes || "—"}</Row>
                  <Row label="Creado">{formatDate(item.createdAt)}</Row>
                  <Row label="Actualizado">{formatDate(item.updatedAt)}</Row>
                </div>

                {/* Panel de edición inline */}
                {editing && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#fafafa",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontSize: 16 }}>Editar gasto</strong>
                      <span style={{ marginLeft: "auto" }} />
                      <button className={btn.secondary} onClick={saveEdit} disabled={saving}>
                        {saving ? "Guardando…" : "Guardar cambios"}
                      </button>
                      <button className={btn.secondary} onClick={cancelEdit} disabled={saving}>
                        Cancelar
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, alignItems: "center" }}>
                      <span style={{ color: "#6b7280", fontWeight: 600 }}>Monto</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        placeholder="6000"
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, alignItems: "center" }}>
                      <span style={{ color: "#6b7280", fontWeight: 600 }}>Notas</span>
                      <input
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Actualizado"
                      />
                    </div>

                    {(saveErr || saveMsg) && (
                      <div className={saveErr ? form.error : ""} style={{ marginTop: 4 }}>
                        {saveErr && <p style={{ margin: 0 }}>{saveErr}</p>}
                        {saveMsg && !saveErr && <p style={{ margin: 0, color: "#065f46" }}>{saveMsg}</p>}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
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

function formatMoney(n?: number) {
  if (typeof n !== "number") return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(n);
  } catch {
    return n.toFixed(2);
  }
}
