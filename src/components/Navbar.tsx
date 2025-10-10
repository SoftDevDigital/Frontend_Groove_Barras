// src/components/Navbar.tsx
"use client";
import Link from "next/link";
import { getUser, logout, hasRole } from "@/lib/auth";
import styles from "./Navbar.module.css";
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
      !hasRole(["bar_user"]);
    setBartenderOnly(isOnlyBartender);
  }, []);

  return (
    <nav className={styles.navbar}>
      {/* Si es SOLO bartender, mostramos únicamente Carrito */}
      {bartenderOnly ? (
        <>
          <Link href="/bartender" className={styles.navLink}>Carrito</Link>
          <div className={styles.userSection}>
            <span className={styles.userName}>{name}</span>
            <button
              className={styles.logoutButton}
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
          <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
          <Link href="/products" className={styles.navLink}>Productos</Link>
          <Link href="/events" className={styles.navLink}>Eventos</Link>
          <Link href="/bars" className={styles.navLink}>Barras</Link>
          <Link href="/admin/users?role=admin" className={styles.navLink}>Usuarios</Link>
          <Link href="/employees" className={styles.navLink}>Empleados</Link>

          {/* Tickets para roles no restringidos */}
          <Link href="/tickets" className={styles.navLink}>Tickets</Link>

          {/* Solo admin */}
          {hasRole(["admin"]) && (
            <>
              <Link href="/stock/assign" className={styles.navLink}>Stock</Link>
              <Link href="/expenses" className={styles.navLink}>Gastos</Link>
            </>
          )}

          {/* Carrito para bartender y/o admin */}
          {hasRole(["bartender", "admin"]) && <Link href="/bartender" className={styles.navLink}>Carrito</Link>}

          <div className={styles.userSection}>
            <span className={styles.userName}>{name}</span>
            <button
              className={styles.logoutButton}
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
