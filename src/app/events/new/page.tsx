"use client";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { useState } from "react";
import { api } from "@/lib/api";
import form from "@/styles/Forms.module.css";
import btn from "@/styles/Buttons.module.css";
import { hasRole, getToken } from "@/lib/auth";

export default function NewEventPage() {
  const [name, setName] = useState("");
  const [startLocal, setStartLocal] = useState<string>(defaultDateTimeLocal(2)); // ahora +2h
  const [endLocal, setEndLocal] = useState<string>(defaultDateTimeLocal(4));   // ahora +4h

  const [msg, setMsg] = useState<string | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function defaultDateTimeLocal(offsetHours = 0) {
    const d = new Date();
    d.setHours(d.getHours() + offsetHours);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  // Convierte "YYYY-MM-DDTHH:mm" (local) -> ISO UTC (YYYY-MM-DDTHH:mm:ss.sssZ)
  function localToIsoUtc(dtLocal: string) {
    const m = dtLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!m) return dtLocal;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const h = Number(m[4]);
    const mi = Number(m[5]);
    const jsDate = new Date(y, mo - 1, d, h, mi, 0);
    return jsDate.toISOString();
  }

  function normalizeErrorPayload(payload: any): { message: string; list: string[] } {
    if (!payload) return { message: "Error al crear evento", list: [] };
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
    catch { return { message: "Error al crear evento", list: [] }; }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErrs([]);

    try {
      if (!hasRole(["admin"])) {
        setMsg("Solo admin puede crear eventos");
        return;
      }
      if (!name.trim()) {
        setMsg("El nombre es obligatorio");
        return;
      }
      if (!startLocal || !endLocal) {
        setMsg("Las fechas de inicio y fin son obligatorias");
        return;
      }

      setLoading(true);

      const body = {
        name: name.trim(),
        startDate: localToIsoUtc(startLocal),
        endDate: localToIsoUtc(endLocal),
        // IMPORTANTE: no enviar description/location/status si el backend no los acepta
      };

      const token = getToken();
      await api.post("/events", body, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      window.location.href = "/events";
    } catch (err: any) {
      const { message, list } = normalizeErrorPayload(err?.response?.data);
      setMsg(message);
      setErrs(list);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <main className={form.container}>
        <form className={form.form} onSubmit={onSubmit} noValidate>
          <h1>Nuevo evento</h1>

          <label>Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Fiesta de Año Nuevo"
          />

          <label>Inicio</label>
          <input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            required
          />

          <label>Fin</label>
          <input
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
            required
          />

          {msg && (
            <div className={form.error} style={{ textAlign: "left" }}>
              <p style={{ marginTop: 0 }}>{msg}</p>
              {errs.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {errs.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button className={btn.primary} disabled={loading}>
            {loading ? "Creando..." : "Crear evento"}
          </button>
        </form>
      </main>
    </Guard>
  );
}

