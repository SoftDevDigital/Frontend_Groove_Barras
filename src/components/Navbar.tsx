// ✅ ACTUALIZA TU NAVBAR: src/components/Navbar.tsx
"use client";
import Link from "next/link";
import { getUser, logout, hasRole } from "@/lib/auth"; // 👈 ya estaba
import styles from "@/styles/Buttons.module.css";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [name, setName] = useState<string>("");

  useEffect(() => {
    const u = getUser();
    setName(u?.name ?? "");
  }, []);

  return (
    <nav style={{ display:"flex", gap:16, alignItems:"center", padding:"10px 16px", borderBottom:"1px solid #eee" }}>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/products">Productos</Link>
      <Link href="/events">Eventos</Link>
      <Link href="/bars">Barras</Link>
      <Link href="/admin/users?role=admin">Usuarios</Link>
      <Link href="/employees">Empleados</Link>
      {/* 👇 visible para admin y bartender */}
      <Link href="/tickets">Tickets</Link>

      {/* ➕ NUEVO: acceso rápido a Asignar Stock (solo admin) */}
      {hasRole(["admin"]) && (
        <>
          <Link href="/stock/assign">Stock</Link>
          {/* 👇 nuevo */}
          <Link href="/expenses">Gastos</Link>
        </>
      )}

      {/* ➕ NUEVO: Carrito para bartenders (admin también puede verlo) */}
      {hasRole(["bartender","admin"]) && (
        <Link href="/bartender">Carrito</Link>
      )}

      <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
        <span>{name}</span>
        <button className={styles.primary} onClick={() => { logout(); location.href="/login"; }}>
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
