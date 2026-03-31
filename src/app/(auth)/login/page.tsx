"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveSession, getToken, getUser } from "@/lib/auth";
import styles from "@/styles/Forms.module.css";
import btn from "@/styles/Buttons.module.css";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function redirectByRole() {
    const u = getUser();
    const role = u?.role;

    if (role === "admin" || role === "bar_user") {
      router.replace("/dashboard");
    } else if (role === "bartender") {
      router.replace("/bartender");
    } else {
      router.replace("/login");
    }
  }

  useEffect(() => {
    const t = getToken();
    const u = getUser();
    if (t && u) {
      redirectByRole();
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const { data } = await api.post(
        "/auth/login",
        { email, password },
        {
          headers: { "Content-Type": "application/json" },
          validateStatus: (s) => s >= 200 && s < 300,
        }
      );

      if (data?.token && data?.user) {
        saveSession(data.token, data.user);

        if (data.user.role === "admin" || data.user.role === "bar_user") {
          router.replace("/dashboard");
        } else if (data.user.role === "bartender") {
          router.replace("/bartender");
        } else {
          router.replace("/login");
        }
      } else {
        setMsg("Unexpected response from server");
      }
    } catch (err: any) {
      setMsg(err?.response?.data?.message || "Error de login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={onSubmit}>
        <h1>Iniciar sesión</h1>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Contraseña</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {msg && <p className={styles.error}>{msg}</p>}
        <button className={btn.primary} disabled={loading}>
          {loading ? "Ingresando..." : "Entrar"}
        </button>
        <p style={{ marginTop: 12 }}>
          ¿No tenés cuenta? <Link href="/register">Crear cuenta</Link>
        </p>
      </form>
    </div>
  );
}