"use client";
import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>Sistema de Gestión de Barras</h1>
        <p className={styles.subtitle}>
          Administra productos, eventos y ventas de manera simple y rápida.
        </p>

        <div className={styles.buttons}>
          <Link href="/login" className={styles.btnPrimary}>
            Iniciar sesión
          </Link>
          <Link href="/register" className={styles.btnSecondary}>
            Crear cuenta
          </Link>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} Groove Bars — Todos los derechos reservados</p>
      </footer>
    </div>
  );
}
