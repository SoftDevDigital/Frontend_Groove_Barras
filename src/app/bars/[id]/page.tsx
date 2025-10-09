"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import Link from "next/link"; // ⬅️ NUEVO

type BarDetail = {
  id: string;
  name: string;
  eventId: string;
  location?: string;
  status?: "active" | "inactive" | "closed";
  createdAt?: string;
  updatedAt?: string;
};

export default function BarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [bar, setBar] = useState<BarDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 👇 edición (PATCH /bars/:id)
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive" | "closed">("active");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 👇 NUEVO: estado para eliminar (DELETE /bars/:id)
  const [deleting, setDeleting] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const token = getToken();
      const { data } = await api.get<BarDetail>(`/bars/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setBar(data);
      setEditName(data?.name ?? "");
      setEditStatus((data?.status as any) || "active");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) setErr("Barra no encontrada.");
      else if (status === 403) setErr("No autorizado: requiere rol admin o bartender.");
      else setErr(e?.response?.data?.message || "Error al cargar la barra.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // PATCH /bars/:id  (actualiza name/status)
  async function handleSave() {
    setErr(null);
    setMsg(null);

    if (!hasRole(["admin"])) {
      setErr("Solo admin puede actualizar la barra.");
      return;
    }
    if (!bar) return;

    const body: { name?: string; status?: "active" | "inactive" | "closed" } = {};
    if (editName && editName !== bar.name) body.name = editName.trim();
    if (editStatus && editStatus !== bar.status) body.status = editStatus;

    if (!("name" in body) && !("status" in body)) {
      setMsg("No hay cambios para guardar.");
      return;
    }

    try {
      setSaving(true);
      const token = getToken();
      const { data } = await api.patch<BarDetail>(`/bars/${id}`, body, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      setBar(data);
      setEditName(data?.name ?? "");
      setEditStatus((data?.status as any) || "active");
      setMsg("Barra actualizada correctamente.");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 400) setErr(e?.response?.data?.message || "Datos inválidos.");
      else if (status === 403) setErr("No autorizado: requiere rol admin.");
      else if (status === 404) setErr("Barra no encontrada.");
      else setErr(e?.response?.data?.message || "Error al actualizar la barra.");
    } finally {
      setSaving(false);
    }
  }

  // 👇 NUEVO: DELETE /bars/:id
  async function handleDelete() {
    setErr(null);
    setMsg(null);

    if (!hasRole(["admin"])) {
      setErr("Solo admin puede eliminar barras.");
      return;
    }
    if (!id) return;

    const ok = window.confirm("¿Eliminar esta barra? Esta acción no se puede deshacer.");
    if (!ok) return;

    try {
      setDeleting(true);
      const token = getToken();
      await api.delete(`/bars/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      // Éxito -> volver al listado
      router.push("/bars");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setErr("No autorizado: requiere rol admin.");
      else if (status === 404) setErr("Barra no encontrada.");
      else setErr(e?.response?.data?.message || "Error al eliminar la barra.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Guard roles={["admin", "bartender"]}>
      <Navbar />
      <main style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button
            onClick={() => router.back()}
            style={{ background: "transparent", border: "none", cursor: "pointer" }}
          >
            ← Volver
          </button>
          <h1 style={{ margin: 0 }}>Detalle de barra</h1>
        </div>

        {err && (
          <div
            style={{
              background: "#fef2f2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              padding: "10px 12px",
              borderRadius: 10,
              marginBottom: 12,
            }}
          >
            {err}
          </div>
        )}
        {msg && (
          <div
            style={{
              background: "#ecfdf5",
              color: "#065f46",
              border: "1px solid #a7f3d0",
              padding: "10px 12px",
              borderRadius: 10,
              marginBottom: 12,
            }}
          >
            {msg}
          </div>
        )}

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
          }}
        >
          {loading ? (
            <p style={{ color: "#6b7280" }}>Cargando barra…</p>
          ) : !bar ? (
            <p style={{ color: "#6b7280" }}>Sin datos para mostrar.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <Row label="ID">
                <code style={codeStyle}>{bar.id}</code>
              </Row>

              {/* Nombre: editable si es admin */}
              <Row label="Nombre">
                {hasRole(["admin"]) ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={inputStyle}
                    placeholder="Nombre de la barra"
                  />
                ) : (
                  <span>{bar.name}</span>
                )}
              </Row>

              <Row label="Evento">
                <code style={codeStyle}>{bar.eventId}</code>
              </Row>

              <Row label="Ubicación">{bar.location || "—"}</Row>

              {/* Estado: editable si es admin */}
              <Row label="Estado">
                {hasRole(["admin"]) ? (
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as "active" | "inactive" | "closed")
                    }
                    style={selectStyle}
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                    <option value="closed">closed</option>
                  </select>
                ) : (
                  <Badge status={bar.status} />
                )}
              </Row>

              <Row label="Creada">{formatDate(bar.createdAt)}</Row>
              <Row label="Actualizada">{formatDate(bar.updatedAt)}</Row>

              {hasRole(["admin"]) && (
                <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: "#111827",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <button
                    onClick={load}
                    disabled={saving}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      color: "#111827",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Refrescar
                  </button>

                  {/* ⬇️ NUEVO: acceso directo al resumen de ventas */}
                  <Link
                    href={`/bars/${id}/sales-summary`}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      color: "#111827",
                      fontWeight: 700,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                    title="Ver resumen de ventas de esta barra"
                  >
                    Resumen de ventas
                  </Link>

                  {/* 👇 botón rojo para eliminar */}
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    title="Eliminar barra"
                    style={{
                      marginLeft: "auto",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: "#b91c1c",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {deleting ? "Eliminando…" : "Eliminar"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </Guard>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, alignItems: "center" }}>
      <span style={{ color: "#6b7280", fontWeight: 600 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

function Badge({ status }: { status?: "active" | "inactive" | "closed" }) {
  const bg =
    status === "active" ? "#d1fae5" : status === "closed" ? "#e5e7eb" : "#fee2e2";
  const fg =
    status === "active" ? "#065f46" : status === "closed" ? "#374151" : "#991b1b";
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 999,
        textTransform: "uppercase",
        background: bg,
        color: fg,
      }}
    >
      {status || "—"}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  height: 34,
  padding: "6px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  height: 34,
  padding: "6px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  outline: "none",
  background: "#fff",
};

const codeStyle: React.CSSProperties = {
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  padding: "2px 6px",
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
