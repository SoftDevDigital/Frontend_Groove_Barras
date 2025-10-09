"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { saveSession, getToken, getUser } from "@/lib/auth"; // 👈 agregado getUser
import styles from "@/styles/Forms.module.css";
import btn from "@/styles/Buttons.module.css";

type Role = "admin" | "bar_user" | "bartender"; // 👈 incluye bartender para tipos
type EmployeeRole = "manager" | "bartender" | "cashier" | string;

// 👇 helper único para decidir a dónde ir según el rol
function redirectByRole() {
  try {
    const u = getUser?.(); // por si no existe, defensivo
    const role = u?.role;
    if (role === "admin" || role === "bar_user") {
      window.location.href = "/dashboard";
    } else if (role === "bartender") {
      window.location.href = "/tickets";
    } else {
      // fallback seguro
      window.location.href = "/tickets";
    }
  } catch {
    window.location.href = "/tickets";
  }
}

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  // ⬇️ AHORA sí se envía al backend:
  const [role, setRole] = useState<Role>("bartender"); 
  const [document, setDocument] = useState(""); // DNI / documento
  const [employeeRole, setEmployeeRole] = useState<EmployeeRole>("bartender");

  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Si ya hay token => redirige según rol
  useEffect(() => {
    const t = getToken();
    if (t) redirectByRole();
  }, []);

  // Validación simple en cliente (match con la doc del backend)
  const clientErrors = useMemo(() => {
    const errs: string[] = [];
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.push("email must be an email");
    if (!password || password.length < 6)
      errs.push("password must be longer than or equal to 6 characters");
    if (!name || name.trim().length < 2)
      errs.push("name must be longer than or equal to 2 characters");
    if (!role) errs.push("role should not be empty");
    if (!employeeRole) errs.push("employeeRole should not be empty");
    if (!document || document.trim().length < 6)
      errs.push("document must be longer than or equal to 6 characters");
    return errs;
  }, [email, password, name, role, employeeRole, document]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);

    if (clientErrors.length > 0) {
      setErrors(clientErrors);
      return;
    }

    setLoading(true);
    try {
      // ⬇️ Enviar EXACTAMENTE lo que acepta el endpoint según tus cURLs
      const body = { email, password, name, role, document, employeeRole };

      const { data } = await api.post("/auth/register", body, {
        headers: { "Content-Type": "application/json" },
        validateStatus: (s) => s >= 200 && s < 300,
      });

      if (data?.token && data?.user) {
        saveSession(data.token, data.user);
        redirectByRole(); // 👈 en lugar de /dashboard fijo
      } else {
        setErrors(["Unexpected response from server"]);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const payload = err?.response?.data;

      if (status === 400) {
        const list: string[] = [];
        const arrMsg = Array.isArray(payload?.message) ? payload.message : [];
        if (arrMsg.length) list.push(...arrMsg);
        if (Array.isArray(payload?.errors)) {
          payload.errors.forEach((e: any) => {
            if (e?.constraints) {
              Object.values(e.constraints).forEach((v: any) => list.push(String(v)));
            }
          });
        }
        setErrors(list.length ? list : ["Bad Request"]);
      } else if (status === 409) {
        setErrors([payload?.message || "User already exists"]);
      } else {
        setErrors([payload?.message || "Registration error"]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <h1>Crear cuenta</h1>

        <label>Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          required
        />

        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          inputMode="email"
          required
        />

        <label>Contraseña</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          minLength={6}
          required
        />

        {/* Ahora el rol se envía al backend */}
        <label>Rol</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          required
        >
          <option value="admin">Admin</option>
          <option value="bartender">Bartender</option>
          <option value="bar_user">Usuario de barra</option>
        </select>

        {/* Nuevos campos según tus cURLs */}
        <label>Documento</label>
        <input
          value={document}
          onChange={(e) => setDocument(e.target.value)}
          placeholder="12345678"
          required
        />

        <label>Rol de empleado</label>
        <select
          value={employeeRole}
          onChange={(e) => setEmployeeRole(e.target.value)}
          required
        >
          {/* Valores de ejemplo: manager/bartender tal como en tus cURLs */}
          <option value="manager">manager</option>
          <option value="bartender">bartender</option>
          {/* Podés agregar más opciones si tu backend las contempla */}
          <option value="cashier">cashier</option>
        </select>

        {errors.length > 0 && (
          <div className={styles.error} style={{ textAlign: "left" }}>
            <ul style={{ margin: 0, paddingLeft: "18px" }}>
              {errors.map((er, i) => (
                <li key={i}>{er}</li>
              ))}
            </ul>
          </div>
        )}

        <button className={btn.primary} disabled={loading}>
          {loading ? "Creando..." : "Registrarme"}
        </button>
      </form>
    </div>
  );
}
