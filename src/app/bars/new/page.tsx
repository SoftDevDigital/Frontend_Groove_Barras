// src/app/bars/new/page.tsx
"use client";

import { useState, useEffect } from "react";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import { useRouter } from "next/navigation";
import btn from "@/styles/Buttons.module.css";

type IBar = {
  id: string;
  name: string;
  eventId: string;
  printer: string;
  status?: "active" | "inactive" | "closed";
  createdAt?: string;
  updatedAt?: string;
};

type EventOption = {
  id: string;
  name: string;
  date?: string;
};

/* 🔒 Convierte cualquier cosa en string legible para UI (incluye constraints) */
function safeText(v: any): string {
  try {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "object") {
      if (typeof (v as any).message === "string" && !(v as any).errors) {
        return (v as any).message;
      }
      if (Array.isArray((v as any).errors)) {
        const errs = (v as any).errors
          .map((e: any) => {
            if (!e) return null;
            // Preferimos constraints si existen
            const cons = e.constraints
              ? Object.values(e.constraints).join(" • ")
              : null;
            if (cons) return `${e.property ? `${e.property}: ` : ""}${cons}`;
            if (e.message) return e.message;
            try { return JSON.stringify(e); } catch { return String(e); }
          })
          .filter(Boolean)
          .join(" | ");
        if (errs) return errs;
      }
      if ((v as any).message) return String((v as any).message);
      try { return JSON.stringify(v); } catch { return String(v); }
    }
    return String(v);
  } catch {
    return "Ocurrió un error.";
  }
}

export default function NewBarPage() {
  const router = useRouter();

  // form state
  const [name, setName] = useState("");
  const [eventId, setEventId] = useState("");
  const [printer, setPrinter] = useState("Epson_TM-T20"); // 👈 valor por defecto útil

  // ui state
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // eventos (para el select)
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsErr, setEventsErr] = useState<string | null>(null);

  function normalizeEvents(data: any): EventOption[] {
    const arr = Array.isArray(data) ? data : (data?.items || data?.data || []);
    return (arr || [])
      .map((e: any) => ({
        id: e?.id ?? e?.eventId ?? e?.uuid ?? "",
        name: e?.name ?? e?.title ?? e?.eventName ?? "(sin nombre)",
        date: e?.date ?? e?.startDate ?? e?.fecha,
      }))
      .filter((e: EventOption) => e.id);
  }

  async function fetchEvents() {
    setEventsErr(null);
    setLoadingEvents(true);
    try {
      const token = getToken();
      let res = await api.get("/events?status=active", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        validateStatus: () => true,
      });
      if (res.status >= 400) {
        res = await api.get("/events", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      }
      const list = normalizeEvents(res.data);
      setEvents(list);
      if (eventId && !list.some((e) => e.id === eventId)) setEventId("");
    } catch (e: any) {
      setEventsErr(safeText(e?.response?.data) || "No se pudieron cargar los eventos.");
    } finally {
      setLoadingEvents(false);
    }
  }

  useEffect(() => {
    if (!hasRole(["admin"])) {
      setErr("No autorizado: requiere rol admin.");
    }
  }, []);

  useEffect(() => {
    void fetchEvents();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!hasRole(["admin"])) {
      setErr("No autorizado: requiere rol admin.");
      return;
    }
    if (!name.trim()) {
      setErr("Ingresá un nombre para la barra.");
      return;
    }
    if (!eventId.trim()) {
      setErr("Seleccioná un evento.");
      return;
    }
    if (!printer.trim()) {
      setErr("Ingresá la impresora (obligatorio).");
      return;
    }

    try {
      setSaving(true);
      const token = getToken();

      const body = {
        name: name.trim(),
        eventId: eventId.trim(),
        printer: printer.trim(), // 👈 siempre string no vacío
      };

      const { data, status } = await api.post<IBar>("/bars", body, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        validateStatus: () => true,
      });

      if (status === 201) {
        setMsg("Barra creada correctamente.");
        if ((data as any)?.id) {
          router.replace(`/bars/${(data as any).id}`);
          return;
        }
        router.replace("/bars");
        return;
      }

      const backendMsg = safeText(data);
      if (status === 400) setErr(backendMsg || "Datos inválidos.");
      else if (status === 403) setErr(backendMsg || "No autorizado: requiere rol admin.");
      else setErr(backendMsg || "No se pudo crear la barra.");
    } catch (e: any) {
      setErr(safeText(e?.response?.data) || "Error inesperado al crear la barra.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <main style={{ padding: 20, maxWidth: 720, margin: "0 auto", display: "grid", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Nueva barra</h1>

        {err && (
          <div style={{ border: "1px solid #fecaca", background: "#fee2e2", color: "#7f1d1d", padding: 12, borderRadius: 10 }}>
            {err}
          </div>
        )}
        {msg && (
          <div style={{ border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#065f46", padding: 12, borderRadius: 10 }}>
            {msg}
          </div>
        )}

        <form onSubmit={handleCreate} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label>Nombre de la barra</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Barra Principal"
              required
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label>Evento</label>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              disabled={loadingEvents}
              required
            >
              <option value="">{loadingEvents ? "Cargando eventos…" : "Seleccioná un evento"}</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}{ev.date ? ` — ${ev.date}` : ""}
                </option>
              ))}
            </select>
            {eventsErr && <small style={{ color: "#b91c1c" }}>{eventsErr}</small>}
            <small style={{ color: "#6b7280" }}>
              Identificador del evento al que pertenece la barra.
            </small>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label>Impresora</label> {/* 👈 ya no dice (opcional) */}
            <input
              value={printer}
              onChange={(e) => setPrinter(e.target.value)}
              placeholder="Epson_TM-T20"
              required
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className={btn.primary} type="submit" disabled={saving}>
              {saving ? "Creando…" : "Crear barra"}
            </button>
            <button
              className={btn.secondary}
              type="button"
              disabled={saving}
              onClick={() => router.back()}
            >
              Cancelar
            </button>
            <button
              className={btn.secondary}
              type="button"
              onClick={fetchEvents}
              disabled={loadingEvents}
              title="Volver a cargar los eventos"
            >
              {loadingEvents ? "Actualizando eventos…" : "Refrescar eventos"}
            </button>
          </div>
        </form>
      </main>
    </Guard>
  );
}
