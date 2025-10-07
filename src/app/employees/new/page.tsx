"use client";

import { useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import form from "@/styles/Forms.module.css";
import btn from "@/styles/Buttons.module.css";
import { useRouter } from "next/navigation";

type EmployeeRole =
  | "bartender"
  | "barback"
  | "runner"
  | "cashier"
  | "manager"
  | "other";

type Employee = {
  id: string;
  name: string;
  document: string;
  contact: string;
  role: EmployeeRole | string;
  createdAt: string;
  updatedAt: string;
};

export default function NewEmployeePage() {
  const router = useRouter();

  // Campos (según contrato)
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState<EmployeeRole>("bartender");

  // UI
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errs, setErrs] = useState<string[]>([]);

  // Validación simple en cliente
  const clientErrors = useMemo(() => {
    const list: string[] = [];
    if (!name.trim()) list.push("El nombre es obligatorio.");
    if (!document.trim()) list.push("El documento es obligatorio.");
    if (!contact.trim()) list.push("El contacto (email o tel) es obligatorio.");
    // validación liviana de email si parece email
    if (contact.includes("@")) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
      if (!emailOk) list.push("El contacto parece un email inválido.");
    }
    if (!role) list.push("El rol es obligatorio.");
    return list;
  }, [name, document, contact, role]);

  // Normaliza error del backend
 function normalizeBackendError(payload: any): { message: string; list: string[] } {
  if (!payload) return { message: "Error al crear empleado", list: [] };

  // { message: { message, errorId } }
  if (payload?.message && typeof payload.message === "object") {
    const inner = payload.message;
    const text =
      (typeof inner.message === "string" && inner.message) ||
      (typeof inner.error === "string" && inner.error) ||
      JSON.stringify(inner);
    return { message: text, list: [] };
  }

  if (Array.isArray(payload?.errors)) {
    const list: string[] = [];
    for (const e of payload.errors) {
      const prop = e?.property ?? "field";
      const cs = e?.constraints ?? {};
      const csTexts = Object.values(cs).map(String);
      if (csTexts.length) list.push(`${prop}: ${csTexts.join(", ")}`);
    }
    return { message: String(payload?.message ?? "Validación fallida"), list };
  }

  if (typeof payload?.message === "string") return { message: payload.message, list: [] };

  try { return { message: JSON.stringify(payload), list: [] }; }
  catch { return { message: "Error al crear empleado", list: [] }; }
}


  async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  setMsg(null);
  setErrs([]);

  try {
    if (!hasRole(["admin"])) { setMsg("Solo admin puede crear empleados."); return; }
    if (clientErrors.length > 0) { setErrs(clientErrors); setMsg("Revisá los campos del formulario."); return; }

    setLoading(true);

    // 1) Normalización y sanitización
    const nameN = name.trim();
    const documentN = document.trim();
    const contactN = contact.trim();
    const roleLower = (role || "bartender").toString().trim().toLowerCase();
    const roleUpper = roleLower.toUpperCase();

    const token = getToken();
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    // 2) Intento “oficial”
    const attempts: Array<{ body: any; note: string }> = [
      // contrato que definiste
      { body: { name: nameN, document: documentN, contact: contactN, role: roleLower }, note: "contact+roleLower" },
      // 3) variantes comunes si falla validación
      { body: { name: nameN, document: documentN, contact: contactN, role: roleUpper }, note: "contact+roleUpper" },
      { body: { name: nameN, document: documentN, email: contactN,  role: roleLower }, note: "email+roleLower" },
      { body: { name: nameN, document: documentN, email: contactN,  role: roleUpper }, note: "email+roleUpper" },
    ];

    let ok = false;
    let lastErr: any = null;

    for (const a of attempts) {
      try {
        await api.post("/employees", a.body, { headers });
        ok = true;
        break;
      } catch (err: any) {
        lastErr = err;
        const sc = err?.response?.status;
        // sólo reintentamos si es error de contrato/validación
        if (sc === 400 || sc === 422) continue;
        // otros errores (401/403/404/500) cortan
        throw err;
      }
    }

    if (!ok) {
      const { message, list } = normalizeBackendError(lastErr?.response?.data);
      // Mensajes típicos por duplicado (a veces vienen como 400)
      const m = (message || "").toLowerCase();
      if (m.includes("duplicate") || m.includes("already exists") || m.includes("ya existe")) {
        setMsg("El documento o contacto ya existe. Probá con otro.");
      } else {
        setMsg(message || "No se pudo crear el empleado.");
      }
      if (list?.length) setErrs(list);
      return;
    }

    // 4) éxito
    router.push("/employees");
  } catch (err: any) {
    const { message, list } = normalizeBackendError(err?.response?.data);
    setMsg(message || "Error al crear empleado");
    if (list.length) setErrs(list);
  } finally {
    setLoading(false);
  }
}


  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <main className={form.container}>
        <form className={form.form} onSubmit={onSubmit} noValidate>
          <h1>Nuevo empleado</h1>

          <label>Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Juan Pérez"
            required
          />

          <label>Documento</label>
          <input
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            placeholder="12345678"
            required
          />

          <label>Contacto</label>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="juan@email.com / +54 9 ..."
            required
          />

          <label>Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as EmployeeRole)}
          >
            <option value="bartender">Bartender</option>
            <option value="barback">Barback</option>
            <option value="runner">Runner</option>
            <option value="cashier">Cajero/a</option>
            <option value="manager">Encargado/a</option>
            <option value="other">Otro</option>
          </select>

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
              {loading ? "Creando..." : "Crear empleado"}
            </button>
            <button
              className={btn.secondary}
              type="button"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancelar
            </button>
          </div>
        </form>
      </main>
    </Guard>
  );
}
