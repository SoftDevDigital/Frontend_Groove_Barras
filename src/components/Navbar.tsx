// src/components/Navbar.tsx
"use client";
import Link from "next/link";
import { getUser, logout, hasRole } from "@/lib/auth";
import styles from "@/styles/Buttons.module.css";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [name, setName] = useState<string>("");
  const [bartenderOnly, setBartenderOnly] = useState<boolean>(false);

  useEffect(() => {
    const u = getUser();
    setName(u?.name ?? "");

    // "Solo bartender" = tiene rol bartender y NO tiene roles administrativos
    const isOnlyBartender =
      hasRole(["bartender"]) &&
      !hasRole(["admin"]) &&
      !hasRole(["owner"]) &&
      !hasRole(["superadmin"]) &&
      !hasRole(["manager"]);
    setBartenderOnly(isOnlyBartender);
  }, []);

  return (
    <nav
      style={{
        display: "flex",
        gap: 16,
        alignItems: "center",
        padding: "10px 16px",
        borderBottom: "1px solid #eee",
      }}
    >
      {/* Si es SOLO bartender, mostramos únicamente Carrito */}
      {bartenderOnly ? (
        <>
          <Link href="/bartender">Carrito</Link>
          <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
            <span>{name}</span>
            <button
              className={styles.primary}
              onClick={() => {
                logout();
                location.href = "/login";
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </>
      ) : (
        // Menú completo para admin y demás roles (incluye Carrito si corresponde)
        <>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/products">Productos</Link>
          <Link href="/events">Eventos</Link>
          <Link href="/bars">Barras</Link>
          <Link href="/admin/users?role=admin">Usuarios</Link>
          <Link href="/employees">Empleados</Link>

          {/* Tickets para roles no restringidos */}
          <Link href="/tickets">Tickets</Link>

          {/* Solo admin */}
          {hasRole(["admin"]) && (
            <>
              <Link href="/stock/assign">Stock</Link>
              <Link href="/expenses">Gastos</Link>
            </>
          )}

          {/* Carrito para bartender y/o admin */}
          {hasRole(["bartender", "admin"]) && <Link href="/bartender">Carrito</Link>}

          <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
            <span>{name}</span>
            <button
              className={styles.primary}
              onClick={() => {
                logout();
                location.href = "/login";
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </nav>
  );
}
