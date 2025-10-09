"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import styles from "./users.module.css";
import Link from "next/link"; // 👈 agregado
import { useSearchParams } from "next/navigation"; // 👈 agregado

type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "bar_user" | "bartender"; // 👈 agregado bartender
  createdAt: string;
  updatedAt: string;
};

function UsersContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // UI: búsqueda y filtro
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"" | "admin" | "bar_user" | "bartender">(""); // 👈 incluye bartender

  // 👇 agregado para eliminar
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const searchParams = useSearchParams(); // 👈 agregado

  async function fetchUsers() {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const token = getToken();
      if (!token) {
        setErr("No hay sesión activa.");
        return;
      }
      const { data } = await api.get<User[]>("/auth/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setErr("No autorizado: requiere rol admin.");
      else setErr(e?.response?.data?.message || "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  // 👇 lee ?role=admin | bar_user | bartender y setea el filtro al cargar
  useEffect(() => {
    const r = (searchParams.get("role") || "").toLowerCase();
    if (r === "admin" || r === "bar_user" || r === "bartender") {
      setRole(r as "admin" | "bar_user" | "bartender");
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return users.filter(u => {
      const matchRole = role ? u.role === role : true;
      const matchQ =
        !term ||
        u.email.toLowerCase().includes(term) ||
        (u.name || "").toLowerCase().includes(term) ||
        u.id.toLowerCase().includes(term);
      return matchRole && matchQ;
    });
  }, [users, q, role]);

  // 👇 función para eliminar usuario
  async function handleDelete(userId: string) {
    const ok = window.confirm("¿Eliminar este usuario? Esta acción no se puede deshacer.");
    if (!ok) return;
    setErr(null);
    setMsg(null);
    setDeletingId(userId);
    try {
      const token = getToken();
      if (!token) {
        setErr("No hay sesión activa.");
        return;
      }
      await api.delete(`/auth/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // quitar de la lista local
      setUsers(prev => prev.filter(u => u.id !== userId));
      setMsg("Usuario eliminado correctamente.");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setErr("No autorizado: requiere rol admin.");
      else if (status === 404) setErr("Usuario no encontrado.");
      else setErr(e?.response?.data?.message || "Error al eliminar usuario");
    } finally {
      setDeletingId(null);
    }
  }

  return (
      <main className={styles.wrap}>
        <header className={styles.header}>
          <h1>Usuarios</h1>
          <div className={styles.actions}>
            <input
              className={styles.input}
              placeholder="Buscar por email, nombre o ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className={styles.select}
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
            >
              <option value="">Todos los roles</option>
              <option value="admin">Admin</option>
              <option value="bar_user">Usuario de barra</option>
              <option value="bartender">Bartender</option> {/* 👈 agregado */}
            </select>
            <button className={styles.btn} onClick={fetchUsers} disabled={loading}>
              {loading ? "Actualizando..." : "Refrescar"}
            </button>
          </div>
        </header>

        {err && <div className={styles.error}>{err}</div>}
        {msg && <div className={styles.muted}>{msg}</div>}

        {!err && (
          <div className={styles.card}>
            {loading ? (
              <p className={styles.muted}>Cargando usuarios…</p>
            ) : filtered.length === 0 ? (
              <p className={styles.muted}>No hay usuarios para mostrar.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Email</th>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>Creado</th>
                    <th>Actualizado</th>
                    <th>Acciones</th> {/* 👈 agregado */}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id}>
                      <td className={styles.idCell}>
                        <Link href={`/admin/users/${u.id}`} className={styles.linkId}>
                          {u.id}
                        </Link>
                      </td>
                      <td>{u.email}</td>
                      <td>{u.name || "—"}</td>
                      <td>
                        <span
                          className={
                            u.role === "admin"
                              ? styles.badgeAdmin
                              : u.role === "bar_user"
                              ? styles.badgeUser
                              : styles.badgeBartender /* 👈 agregado */
                          }
                        >
                          {u.role}
                        </span>
                      </td>
                      <td>{formatDate(u.createdAt)}</td>
                      <td>{formatDate(u.updatedAt)}</td>
                      <td>
                        <button
                          className={styles.btn}
                          onClick={() => handleDelete(u.id)}
                          disabled={deletingId === u.id}
                          title="Eliminar usuario"
                          style={{ background: "#b91c1c" }} // rojo discreto sin agregar CSS nuevo
                        >
                          {deletingId === u.id ? "Eliminando…" : "Eliminar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
  );
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    // dd/mm/yyyy hh:mm
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return iso;
  }
}

export default function UsersPage() {
  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <Suspense fallback={<div style={{ padding: 20 }}>Cargando...</div>}>
        <UsersContent />
      </Suspense>
    </Guard>
  );
}
