"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";

type EventDetail = {
  id: string;
  name: string;
  description?: string;
  date?: string;        // ISO
  location?: string;
  status?: "active" | "inactive" | "closed";
  createdAt?: string;
  updatedAt?: string;
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ev, setEv] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 👇 estados para edición (PATCH /events/:id)
  const [editName, setEditName] = useState<string>("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive" | "closed">("active");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 👇 NUEVO: estado para DELETE /events/:id
  const [deleting, setDeleting] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const token = getToken();
      const { data } = await api.get<EventDetail>(`/events/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setEv(data);
      setEditName(data?.name ?? "");
      setEditStatus((data?.status as any) || "active");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) setErr("Evento no encontrado.");
      else if (status === 403) setErr("No autorizado: requiere rol admin o bartender.");
      else setErr(e?.response?.data?.message || "Error al cargar el evento");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // PATCH /events/:id  (edita name/status por body)
  async function handleSave() {
    setMsg(null);
    setErr(null);

    if (!hasRole(["admin"])) {
      setErr("Solo admin puede actualizar el evento.");
      return;
    }
    if (!ev) return;

    const body: { name?: string; status?: "active" | "inactive" | "closed" } = {};
    if (editName && editName !== ev.name) body.name = editName.trim();
    if (editStatus && editStatus !== ev.status) body.status = editStatus;

    if (!("name" in body) && !("status" in body)) {
      setMsg("No hay cambios para guardar.");
      return;
    }

    try {
      setSaving(true);
      const token = getToken();
      const { data } = await api.patch<EventDetail>(`/events/${id}`, body, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      setEv(data);
      setEditName(data?.name ?? "");
      setEditStatus((data?.status as any) || "active");
      setMsg("Evento actualizado correctamente.");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 400) setErr(e?.response?.data?.message || "Datos inválidos.");
      else if (status === 403) setErr("No autorizado: requiere rol admin.");
      else if (status === 404) setErr("Evento no encontrado.");
      else setErr(e?.response?.data?.message || "Error al actualizar el evento.");
    } finally {
      setSaving(false);
    }
  }

  // 👇 NUEVO: PATCH /events/:id/status/:status (sin body)
  async function changeStatus(next: "active" | "inactive" | "closed") {
    setMsg(null);
    setErr(null);

    if (!hasRole(["admin"])) {
      setErr("Solo admin puede cambiar el estado.");
      return;
    }
    if (!id) return;

    try {
      setSaving(true);
      const token = getToken();
      const { data } = await api.patch<EventDetail>(`/events/${id}/status/${next}`, null, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setEv(data);
      setEditStatus((data?.status as any) || next);
      setMsg(`Estado cambiado a "${next}".`);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 400) setErr(e?.response?.data?.message || "Estado inválido.");
      else if (status === 403) setErr("No autorizado: requiere rol admin.");
      else if (status === 404) setErr("Evento no encontrado.");
      else setErr(e?.response?.data?.message || "Error al cambiar el estado.");
    } finally {
      setSaving(false);
    }
  }

  // 👇 NUEVO: DELETE /events/:id
  async function handleDelete() {
    setErr(null);
    setMsg(null);

    if (!hasRole(["admin"])) {
      setErr("Solo admin puede eliminar eventos.");
      return;
    }
    if (!id) return;

    const ok = window.confirm("¿Eliminar este evento? Esta acción no se puede deshacer.");
    if (!ok) return;

    try {
      setDeleting(true);
      const token = getToken();
      await api.delete(`/events/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      // Redirige al listado
      router.push("/events");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setErr("No autorizado: requiere rol admin.");
      else if (status === 404) setErr("Evento no encontrado.");
      else setErr(e?.response?.data?.message || "Error al eliminar evento.");
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
          <h1 style={{ margin: 0 }}>Detalle de evento</h1>
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
            <p style={{ color: "#6b7280" }}>Cargando evento…</p>
          ) : !ev ? (
            <p style={{ color: "#6b7280" }}>Sin datos para mostrar.</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <Row label="ID">
                <code style={codeStyle}>{ev.id}</code>
              </Row>

              {/* Nombre: editable si es admin */}
              <Row label="Nombre">
                {hasRole(["admin"]) ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={inputStyle}
                    placeholder="Nombre del evento"
                  />
                ) : (
                  <span>{ev.name}</span>
                )}
              </Row>

              <Row label="Descripción">{ev.description || "—"}</Row>

              <Row label="Fecha">{formatDate(ev.date)}</Row>

              <Row label="Ubicación">{ev.location || "—"}</Row>

              {/* Estado actual */}
              <Row label="Estado">
                <Badge status={ev.status} />
              </Row>

              <Row label="Creado">{formatDate(ev.createdAt)}</Row>
              <Row label="Actualizado">{formatDate(ev.updatedAt)}</Row>

              {hasRole(["admin"]) && (
                <>
                  {/* Acciones de edición tradicional (PATCH /events/:id) */}
                  <div style={{ display: "flex", gap: 10, marginTop: 6, alignItems: "center" }}>
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

                    {/* 👇 Nuevo botón rojo: Eliminar */}
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      title="Eliminar evento"
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

                  {/* NUEVO: Acciones rápidas (PATCH /events/:id/status/:status) */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <small style={{ color: "#6b7280" }}>Cambiar estado rápido:</small>
                    <button
                      onClick={() => changeStatus("active")}
                      disabled={saving || ev.status === "active"}
                      style={chipBtn(ev.status === "active")}
                      title="Cambiar a active"
                    >
                      Active
                    </button>
                    <button
                      onClick={() => changeStatus("inactive")}
                      disabled={saving || ev.status === "inactive"}
                      style={chipBtn(ev.status === "inactive")}
                      title="Cambiar a inactive"
                    >
                      Inactive
                    </button>
                    <button
                      onClick={() => changeStatus("closed")}
                      disabled={saving || ev.status === "closed"}
                      style={chipBtn(ev.status === "closed")}
                      title="Cambiar a closed"
                    >
                      Closed
                    </button>
                  </div>
                </>
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
  border: "1px solid #e5e7eb", // 👈 FIX: una sola string
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

function chipBtn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: active ? "1px solid #111827" : "1px solid #e5e7eb",
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#111827",
    cursor: active ? "default" : "pointer",
    fontWeight: 700,
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
