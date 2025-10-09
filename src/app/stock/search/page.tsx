// ✅ ARCHIVO: src/app/stock/search/page.tsx
"use client";

import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { Suspense, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import form from "@/styles/Forms.module.css";
import btn from "@/styles/Buttons.module.css";
import table from "@/styles/Table.module.css";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type StockRow = {
  id: string;
  productId: string;
  barId: string;
  quantity: number;
  status?: "assigned" | string;
  updatedAt?: string;
  notes?: string;
};

function StockSearchContent() {
  const qs = useSearchParams();

  // Form
  const [barId, setBarId] = useState("");
  const [productId, setProductId] = useState("");

  // UI
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errs, setErrs] = useState<string[]>([]);

  // Data
  const [items, setItems] = useState<StockRow[]>([]);

  // 🔧 Edición (PATCH /stock/:id)
  const [editId, setEditId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number | string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // 🗑️ Eliminación (DELETE /stock/:id)
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<StockRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  // Prefill (?barId=&productId=)
  useEffect(() => {
    const qb = qs.get("barId");
    const qp = qs.get("productId");
    if (qb && !barId) setBarId(qb);
    if (qp && !productId) setProductId(qp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientErrors = useMemo(() => {
    const list: string[] = [];
    if (!barId.trim()) list.push("El barId es obligatorio.");
    if (!productId.trim()) list.push("El productId es obligatorio.");
    return list;
  }, [barId, productId]);

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setMsg(null);
    setErrs([]);
    setItems([]);

    try {
      if (!hasRole(["admin"])) {
        setMsg("Solo admin puede buscar stock.");
        return;
      }
      if (clientErrors.length > 0) {
        setErrs(clientErrors);
        setMsg("Revisa los filtros.");
        return;
      }

      setLoading(true);
      const token = getToken();
      const { data } = await api.get<StockRow[]>("/stock/search", {
        params: { barId: barId.trim(), productId: productId.trim() },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      setItems(Array.isArray(data) ? data : []);
      if (!Array.isArray(data) || data.length === 0) {
        setMsg("Sin resultados para esos filtros.");
      }
    } catch (err: any) {
      const sc = err?.response?.status;
      if (sc === 403) setMsg("No autorizado: requiere rol admin.");
      else setMsg(err?.response?.data?.message || "Error al buscar stock");
    } finally {
      setLoading(false);
    }
  }

  // ====== PATCH /stock/:id ======
  function startEdit(row: StockRow) {
    setEditId(row.id);
    setEditQuantity(typeof row.quantity === "number" ? row.quantity : "");
    setEditNotes(row.notes || "");
    setSaveMsg(null);
    setSaveErr(null);
  }
  function cancelEdit() {
    setEditId(null);
    setEditQuantity("");
    setEditNotes("");
    setSaveMsg(null);
    setSaveErr(null);
  }
  async function saveEdit() {
    setSaveMsg(null);
    setSaveErr(null);
    try {
      if (!hasRole(["admin"])) {
        setSaveErr("Solo admin puede actualizar stock.");
        return;
      }
      if (!editId) return;

      if (editQuantity === "" || Number.isNaN(Number(editQuantity))) {
        setSaveErr("La cantidad es obligatoria y debe ser un número.");
        return;
      }
      const qNum = Number(editQuantity);
      if (!Number.isInteger(qNum) || qNum < 0) {
        setSaveErr("La cantidad debe ser un entero ≥ 0.");
        return;
      }

      setSaving(true);
      const token = getToken();
      const body: { quantity: number; notes?: string } = {
        quantity: qNum,
        notes: editNotes.trim() || undefined,
      };

      const { data } = await api.patch<{ id: string; quantity: number; notes?: string; updatedAt?: string }>(
        `/stock/${encodeURIComponent(editId)}`,
        body,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      setItems((prev) =>
        prev.map((r) =>
          r.id === data.id
            ? { ...r, quantity: data.quantity ?? r.quantity, notes: data.notes ?? r.notes, updatedAt: data.updatedAt ?? r.updatedAt }
            : r
        )
      );

      setSaveMsg("Stock actualizado correctamente.");
      // setTimeout(cancelEdit, 600);
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 403) setSaveErr("No autorizado: requiere rol admin.");
      else if (sc === 404) setSaveErr("Registro de stock no encontrado.");
      else setSaveErr(e?.response?.data?.message || "Error al actualizar stock.");
    } finally {
      setSaving(false);
    }
  }

  // ====== DELETE /stock/:id ======
  function askDelete(row: StockRow) {
    if (!hasRole(["admin"])) return;
    setDeleteErr(null);
    setDeleteMsg(null);
    setConfirmId(row.id);
    setConfirmRow(row);
  }
  function cancelDelete() {
    setConfirmId(null);
    setConfirmRow(null);
    setDeleteErr(null);
    setDeleteMsg(null);
  }
  async function doDelete() {
    if (!confirmId) return;
    try {
      if (!hasRole(["admin"])) {
        setDeleteErr("No autorizado: requiere rol admin.");
        return;
      }
      setDeleting(true);
      const token = getToken();
      const { data } = await api.delete<{ message?: string }>(`/stock/${encodeURIComponent(confirmId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      // Quitar del listado
      setItems((prev) => prev.filter((x) => x.id !== confirmId));
      setDeleteMsg(data?.message || "Stock assignment deleted successfully");

      // limpiar confirm
      setConfirmId(null);
      setConfirmRow(null);
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 404) setDeleteErr("Registro de stock no encontrado.");
      else if (sc === 403) setDeleteErr("No autorizado: requiere rol admin.");
      else setDeleteErr(e?.response?.data?.message || "Error al eliminar stock.");
    } finally {
      setDeleting(false);
    }
  }

  function formatDate(iso?: string) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return String(iso);
    }
  }

  return (
      <main className={form.container}>
        <form className={form.form} onSubmit={onSearch} noValidate>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ marginRight: "auto" }}>Buscar stock</h1>
            <Link className={btn.secondary} href="/stock/info">Info de stock</Link>
            <Link className={btn.secondary} href="/stock/assign">Asignar stock</Link>
            <Link className={btn.secondary} href="/stock/move">Mover stock</Link>
          </div>

          <label>barId</label>
          <input value={barId} onChange={(e) => setBarId(e.target.value)} placeholder="bar-123" required />

          <label>productId</label>
          <input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="product-123" required />

          {(msg || errs.length > 0) && (
            <div className={form.error} style={{ textAlign: "left" }}>
              {msg && <p style={{ marginTop: 0 }}>{msg}</p>}
              {errs.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {errs.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button className={btn.primary} disabled={loading}>
              {loading ? "Buscando…" : "Buscar"}
            </button>
            <button
              type="button"
              className={btn.secondary}
              onClick={() => {
                setBarId("");
                setProductId("");
                setItems([]);
                setErrs([]);
                setMsg(null);
              }}
              disabled={loading}
            >
              Limpiar
            </button>
          </div>
        </form>

        {/* 🗑️ Barra de confirmación de borrado */}
        {confirmId && (
          <div
            style={{
              marginTop: 12,
              marginBottom: 12,
              padding: 12,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              borderRadius: 10,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              ¿Eliminar el registro de stock <code>{confirmId}</code>?
            </div>
            <div style={{ color: "#6b7280", marginBottom: 8 }}>
              <div>
                Producto: <code>{confirmRow?.productId}</code> — Barra: <code>{confirmRow?.barId}</code>
              </div>
              <div>
                Cantidad: <strong>{confirmRow?.quantity}</strong>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className={btn.secondary}
                onClick={doDelete}
                disabled={deleting}
                style={{ background: "#dc2626", color: "#fff", borderColor: "#dc2626" }}
              >
                {deleting ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
              <button className={btn.secondary} onClick={cancelDelete} disabled={deleting}>
                Cancelar
              </button>
            </div>
            {deleteErr && <p style={{ color: "#b91c1c", marginTop: 8 }}>{deleteErr}</p>}
            {deleteMsg && <p style={{ color: "#065f46", marginTop: 8 }}>{deleteMsg}</p>}
          </div>
        )}

        {/* 🔧 Panel de edición inline */}
        {editId && (
          <section
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              background: "#fff",
              display: "grid",
              gap: 8,
              maxWidth: 760,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong style={{ fontSize: 16 }}>Editar stock</strong>
              <span style={{ marginLeft: "auto" }} />
              <button className={btn.secondary} onClick={saveEdit} disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
              <button className={btn.secondary} onClick={cancelEdit} disabled={saving}>
                Cancelar
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, alignItems: "center" }}>
              <span style={{ color: "#6b7280", fontWeight: 600 }}>ID</span>
              <code>{editId}</code>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, alignItems: "center" }}>
              <span style={{ color: "#6b7280", fontWeight: 600 }}>Cantidad</span>
              <input
                type="number"
                step="1"
                min={0}
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                placeholder="0"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, alignItems: "center" }}>
              <span style={{ color: "#6b7280", fontWeight: 600 }}>Notas</span>
              <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Ajuste de inventario" />
            </div>

            {(saveErr || saveMsg) && (
              <div className={saveErr ? form.error : ""} style={{ marginTop: 4 }}>
                {saveErr && <p style={{ margin: 0 }}>{saveErr}</p>}
                {saveMsg && !saveErr && <p style={{ margin: 0, color: "#065f46" }}>{saveMsg}</p>}
              </div>
            )}
          </section>
        )}

        <section style={{ marginTop: 12 }}>
          <div style={{ overflowX: "auto" }}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Producto</th>
                  <th>Barra</th>
                  <th style={{ textAlign: "right" }}>Cantidad</th>
                  <th>Estado</th>
                  <th>Actualizado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7}>Buscando…</td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7}>{msg ?? "Sin resultados."}</td>
                  </tr>
                ) : (
                  items.map((r, i) => (
                    <tr key={`${r.id}-${i}`}>
                      <td>
                        <code>{r.id}</code>
                      </td>
                      <td>
                        <code>{r.productId}</code>
                      </td>
                      <td>
                        <code>{r.barId}</code>
                      </td>
                      <td style={{ textAlign: "right" }}>{typeof r.quantity === "number" ? r.quantity : "—"}</td>
                      <td>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 999,
                            textTransform: "uppercase",
                            background: "#e5e7eb",
                            color: "#374151",
                          }}
                        >
                          {r.status || "—"}
                        </span>
                      </td>
                      <td>{formatDate(r.updatedAt)}</td>
                      <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className={btn.secondary}
                          type="button"
                          onClick={() => startEdit(r)}
                          disabled={saving && editId === r.id}
                          title="Editar cantidad y notas"
                        >
                          {editId === r.id && saving ? "Guardando…" : "Editar"}
                        </button>
                        <button
                          className={btn.secondary}
                          type="button"
                          onClick={() => askDelete(r)}
                          title="Eliminar registro de stock"
                          style={{ borderColor: "#ef4444", color: "#ef4444" }}
                        >
                          Eliminar
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
  );
}

export default function StockSearchPage() {
  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <Suspense fallback={<div style={{ padding: 20 }}>Cargando...</div>}>
        <StockSearchContent />
      </Suspense>
    </Guard>
  );
}
