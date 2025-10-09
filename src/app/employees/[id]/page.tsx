"use client";

import { useEffect, useState } from "react";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useParams, useRouter } from "next/navigation";
import form from "@/styles/Forms.module.css";
import btn from "@/styles/Buttons.module.css";

type Employee = {
  id: string;
  name: string;
  document: string;
  contact: string;
  role: string;
  createdAt: string;
  updatedAt: string;
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [emp, setEmp] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      const token = getToken();
      const { data } = await api.get<Employee>(`/employees/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setEmp(data);
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 404) setErr("Empleado no encontrado.");
      else if (sc === 403) setErr("No autorizado: requiere rol admin.");
      else setErr(e?.response?.data?.message || "Error al cargar el empleado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <main className={form.container}>
        <div className={form.form}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <button className={btn.secondary} type="button" onClick={() => router.back()}>
              ← Volver
            </button>
            <h1 style={{ margin: 0 }}>Empleado</h1>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className={btn.secondary} onClick={load} disabled={loading}>
                {loading ? "Actualizando…" : "Refrescar"}
              </button>
            </div>
          </div>

          {err && <p className={form.error}>{err}</p>}
          {!err && loading && <p style={{ color: "#6b7280" }}>Cargando…</p>}

          {!err && !loading && emp && (
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                background: "#fff",
                padding: 12,
                display: "grid",
                gap: 8,
              }}
            >
              <Row label="ID"><code>{emp.id}</code></Row>
              <Row label="Nombre">{safeText(emp.name)}</Row>
              <Row label="Documento">{safeText(emp.document)}</Row>
              <Row label="Contacto">{safeText(emp.contact)}</Row>
              <Row label="Rol"><strong>{safeText(emp.role)}</strong></Row>
              <Row label="Creado">{formatDate(emp.createdAt)}</Row>
              <Row label="Actualizado">{formatDate(emp.updatedAt)}</Row>
            </div>
          )}
        </div>
      </main>
    </Guard>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
      <span style={{ color: "#6b7280", fontWeight: 600 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

function safeText(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}
function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch { return String(iso); }
}
