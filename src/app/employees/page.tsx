"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import btn from "@/styles/Buttons.module.css";
import table from "@/styles/Table.module.css";
import Link from "next/link";

type Employee = {
  id: string;
  name: string;
  document: string;
  contact: string;
  role: string;           // el backend devuelve "bartender" (string)
  createdAt: string;
  updatedAt: string;
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch { return iso as string; }
}

function makeKeyEmp(e: Employee, i: number) {
  const base = (e.id || e.document || e.name || "row").toString();
  return `${base}__${i}`;
}

export default function EmployeesPage() {
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // UI: búsqueda y filtro
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>(""); // "", "bartender", etc.

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      if (!hasRole(["admin"])) {
        setItems([]);
        setErr("No autorizado: requiere rol admin.");
        return;
      }
      const token = getToken();
      const { data } = await api.get<Employee[]>("/employees", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setItems(Array.isArray(data) ? data.filter(Boolean) : []);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setErr("No autorizado: requiere rol admin.");
      else setErr(e?.response?.data?.message || "Error al cargar empleados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(e => {
      const matchRole = role ? e.role === role : true;
      const matchQ =
        !term ||
        e.name?.toLowerCase().includes(term) ||
        e.document?.toLowerCase().includes(term) ||
        e.contact?.toLowerCase().includes(term) ||
        e.id?.toLowerCase().includes(term);
      return matchRole && matchQ;
    });
  }, [items, q, role]);

  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <main style={{ padding: 20 }}>
        <header style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <h1 style={{ marginRight: "auto" }}>Empleados</h1>
          <input
            placeholder="Buscar por nombre, doc, contacto o ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Todos los roles</option>
            <option value="bartender">Bartender</option>
            <option value="barback">Barback</option>
            <option value="runner">Runner</option>
            <option value="cashier">Cashier</option>
            <option value="manager">Manager</option>
            <option value="other">Other</option>
          </select>
          <button className={btn.secondary} onClick={load} disabled={loading}>
            {loading ? "Actualizando…" : "Refrescar"}
          </button>
          <Link className={btn.primary} href="/employees/new">+ Nuevo</Link>
        </header>

        {err && <p style={{ color: "#b91c1c", marginTop: 8 }}>{err}</p>}

        <section style={{ marginTop: 12 }}>
          <div style={{ overflowX: "auto" }}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Documento</th>
                  <th>Contacto</th>
                  <th>Rol</th>
                  <th>Creado</th>
                  <th>Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6}>Cargando empleados…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6}>No hay empleados para mostrar.</td></tr>
                ) : (
                  filtered.map((e, i) => (
                    <tr key={makeKeyEmp(e, i)}>
                      <td>
  <Link className={btn.link} href={`/employees/${e.id}`}>{e.name}</Link>
</td>
                      <td>{e.document}</td>
                      <td>{e.contact}</td>
                      <td><span style={{ fontWeight: 700 }}>{e.role}</span></td>
                      <td>{formatDate(e.createdAt)}</td>
                      <td>{formatDate(e.updatedAt)}</td>
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
