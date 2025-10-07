"use client";
import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import form from "@/styles/Forms.module.css";
import btn from "@/styles/Buttons.module.css";
import Link from "next/link";

type EventOption = {
  id: string;
  name: string;
  status?: "active" | "inactive" | "closed";
  date?: string;
};

type BarStatus = "active" | "inactive";

export default function NewBarPage() {
  // Form state
  const [name, setName] = useState("");
  const [eventId, setEventId] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<BarStatus>("active"); // 👈 se mantiene en UI, pero NO se envía
  const [printer, setPrinter] = useState("");                 // 👈 OBLIGATORIO en backend

  // UI
  const [msg, setMsg] = useState<string | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Events to select (GET /events/active)
  const [events, setEvents] = useState<EventOption[]>([]);
  const [evLoading, setEvLoading] = useState(false);
  const [evErr, setEvErr] = useState<string | null>(null);

  useEffect(() => {
    void fetchActiveEvents();
  }, []);

  async function fetchActiveEvents() {
    setEvLoading(true);
    setEvErr(null);
    try {
      const token = getToken();
      const { data } = await api.get<EventOption[]>("/events/active", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const list = Array.isArray(data) ? data : [];
      setEvents(list);
      if (list.length > 0 && !eventId) setEventId(list[0].id);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setEvErr("No autorizado para listar eventos activos.");
      else setEvErr(e?.response?.data?.message || "Error al cargar eventos activos");
    } finally {
      setEvLoading(false);
    }
  }

  const clientErrors = useMemo(() => {
    const arr: string[] = [];
    if (!name.trim()) arr.push("El nombre es obligatorio.");
    if (!eventId.trim()) arr.push("Debes seleccionar un evento.");
    if (!printer.trim()) arr.push("La impresora (printer) es obligatoria.");
    if (!status) arr.push("Debes seleccionar un estado."); // solo UI, no se envía
    return arr;
  }, [name, eventId, status, printer]);

  function normalizeErrorPayload(payload: any): { message: string; list: string[] } {
    if (!payload) return { message: "Error al crear barra", list: [] };
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
    catch { return { message: "Error al crear barra", list: [] }; }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErrs([]);

    try {
      if (!hasRole(["admin"])) {
        setMsg("Solo admin puede crear barras");
        return;
      }

      if (clientErrors.length > 0) {
        setErrs(clientErrors);
        setMsg("Revisa los campos del formulario.");
        return;
      }

      setLoading(true);

      const body = {
        name: name.trim(),
        eventId: eventId.trim(),
        printer: printer.trim(),
        location: location.trim() || undefined,
        // status: status, // ❌ NO enviar: backend lo rechaza en POST /bars
      };

      const token = getToken();
      await api.post("/bars", body, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      window.location.href = "/bars";
    } catch (err: any) {
      const { message, list } = normalizeErrorPayload(err?.response?.data);
      setMsg(message || "Error al crear barra");
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
          <h1>Nueva barra</h1>

          <label>Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Barra Principal"
            required
          />

          <label>Evento</label>
          {evErr && <p style={{ color: "#b91c1c", margin: 0, marginBottom: 8 }}>{evErr}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              required
              style={{ flex: 1, height: 36, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}
              disabled={evLoading || events.length === 0}
            >
              {events.length === 0 ? (
                <option value="">{evLoading ? "Cargando eventos…" : "Sin eventos activos"}</option>
              ) : (
                events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))
              )}
            </select>
            <Link href="/events" className={btn.link} title="Ver eventos">
              Ver eventos
            </Link>
          </div>

          <label>Impresora</label>
          <input
            value={printer}
            onChange={(e) => setPrinter(e.target.value)}
            placeholder="Nombre/ID de la impresora"
            required
          />

          <label>Ubicación (opcional)</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Entrada Principal"
          />

          <label>Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BarStatus)}
            required
            style={{ height: 36, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
          <small style={{ color: "#6b7280", marginTop: -6 }}>
            Este campo no se envía al crear: el servidor lo rechaza en <code>POST /bars</code>.
          </small>

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

          <button className={btn.primary} disabled={loading}>
            {loading ? "Creando..." : "Crear barra"}
          </button>
        </form>
      </main>
    </Guard>
  );
}
