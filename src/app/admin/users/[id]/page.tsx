"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import styles from "./user-detail.module.css";

type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "bar_user" | "bartender"; // 👈 agregado bartender
  createdAt: string;
  updatedAt: string;
};

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<null | "id" | "email">(null);

  // 👇 estado para actualizar rol
  const [newRole, setNewRole] = useState<"admin" | "bar_user" | "bartender">("bar_user");
  const [savingRole, setSavingRole] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 👇 estado para eliminar
  const [deleting, setDeleting] = useState(false);

  async function fetchUser() {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const token = getToken();
      if (!token) {
        setErr("No hay sesión activa.");
        return;
      }
      const { data } = await api.get<User>(`/auth/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(data);
      setNewRole(data.role); // 👈 sincroniza select con rol actual
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) setErr("Usuario no encontrado.");
      else if (status === 403) setErr("No autorizado: requiere rol admin.");
      else setErr(e?.response?.data?.message || "Error al cargar el usuario");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userId) fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function formatDate(iso?: string) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } catch { return iso; }
  }

  async function copy(text: string, which: "id" | "email") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  }

  // 👇 PATCH /auth/users/:id/role
  async function updateRole() {
    setSavingRole(true);
    setMsg(null);
    try {
      const token = getToken();
      if (!token) {
        setErr("No hay sesión activa.");
        return;
      }
      const { data } = await api.patch<User>(`/auth/users/${userId}/role`, { role: newRole }, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      setUser(data);
      setMsg("Rol actualizado correctamente.");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 400) setMsg(e?.response?.data?.message || "Rol inválido.");
      else if (status === 403) setMsg("No autorizado: requiere rol admin.");
      else if (status === 404) setMsg("Usuario no encontrado.");
      else setMsg(e?.response?.data?.message || "Error al actualizar el rol.");
    } finally {
      setSavingRole(false);
    }
  }

  // 👇 DELETE /auth/users/:id
  async function deleteUser() {
    const ok = window.confirm("¿Eliminar este usuario? Esta acción no se puede deshacer.");
    if (!ok) return;
    setDeleting(true);
    setErr(null);
    setMsg(null);
    try {
      const token = getToken();
      if (!token) {
        setErr("No hay sesión activa.");
        return;
      }
      await api.delete(`/auth/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // volver a la lista tras eliminar
      router.push("/admin/users");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setErr("No autorizado: requiere rol admin.");
      else if (status === 404) setErr("Usuario no encontrado.");
      else setErr(e?.response?.data?.message || "Error al eliminar usuario");
    } finally {
      setDeleting(false);
    }
  }

  const canSave = user && newRole !== user.role && !savingRole;

  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <main className={styles.wrap}>
        <div className={styles.topbar}>
          <button className={styles.btnGhost} onClick={() => router.back()}>&larr; Volver</button>
          <h1>Detalle de usuario</h1>
          <div />
        </div>

        {err && <div className={styles.error}>{err}</div>}
        {msg && <div className={styles.success}>{msg}</div>}

        {!err && (
          <div className={styles.card}>
            {loading ? (
              <p className={styles.muted}>Cargando usuario…</p>
            ) : !user ? (
              <p className={styles.muted}>Sin datos para mostrar.</p>
            ) : (
              <div className={styles.grid}>
                <div className={styles.row}>
                  <span className={styles.label}>ID</span>
                  <div className={styles.value}>
                    <code className={styles.code}>{user.id}</code>
                    <button className={styles.btnTiny} onClick={() => copy(user.id, "id")}>
                      {copied === "id" ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>

                <div className={styles.row}>
                  <span className={styles.label}>Email</span>
                  <div className={styles.value}>
                    {user.email}
                    <button className={styles.btnTiny} onClick={() => copy(user.email, "email")}>
                      {copied === "email" ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>

                <div className={styles.row}>
                  <span className={styles.label}>Nombre</span>
                  <span className={styles.value}>{user.name || "—"}</span>
                </div>

                <div className={styles.row}>
                  <span className={styles.label}>Rol</span>
                  <span className={
                    user.role === "admin" ? styles.badgeAdmin :
                    user.role === "bar_user" ? styles.badgeUser :
                    styles.badgeBartender /* 👈 agregado */
                  }>
                    {user.role}
                  </span>
                </div>

                {/* 👇 Editor de rol */}
                <div className={styles.row}>
                  <span className={styles.label}>Actualizar rol</span>
                  <div className={styles.value}>
                    <select
                      className={styles.select}
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as "admin" | "bar_user" | "bartender")}
                    >
                      <option value="bar_user">Usuario de barra</option>
                      <option value="bartender">Bartender</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      className={styles.btn}
                      onClick={updateRole}
                      disabled={!canSave}
                    >
                      {savingRole ? "Guardando…" : "Guardar rol"}
                    </button>
                  </div>
                </div>

                <div className={styles.row}>
                  <span className={styles.label}>Creado</span>
                  <span className={styles.value}>{formatDate(user.createdAt)}</span>
                </div>

                <div className={styles.row}>
                  <span className={styles.label}>Actualizado</span>
                  <span className={styles.value}>{formatDate(user.updatedAt)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {!err && (
          <div className={styles.footer} style={{ display: "flex", gap: 8 }}>
            <button className={styles.btn} onClick={fetchUser} disabled={loading}>
              {loading ? "Actualizando…" : "Refrescar"}
            </button>
            <button
              className={styles.btn}
              onClick={deleteUser}
              disabled={deleting}
              style={{ background: "#b91c1c" }} // rojo discreto sin CSS nuevo
              title="Eliminar usuario"
            >
              {deleting ? "Eliminando…" : "Eliminar usuario"}
            </button>
          </div>
        )}
      </main>
    </Guard>
  );
}
