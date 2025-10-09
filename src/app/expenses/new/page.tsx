// ===== FILE 2: Expense New Page (SIN CAMBIOS respecto a lo que me pasaste) =====
"use client";

import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { Suspense, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import form from "@/styles/Forms.module.css";
import btn from "@/styles/Buttons.module.css";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type CreateExpenseBody = {
  description: string;
  amount: number;          // en la moneda base (ej. ARS)
  category: string;        // "supplies" | "logistics" | "staff" | "rent" | "other" | ...
  eventId?: string;
  notes?: string;

  // 👇 AGREGADO: lo que realmente espera el backend
  type?: "supplies" | "staff" | "equipment" | "other";
};

type CreateExpenseResponse = {
  id: string;
  description: string;
  amount: number;
  category: string;
  eventId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;

  // 👇 AGREGADO: puede venir del backend
  type?: "supplies" | "staff" | "equipment" | "other";
};

// (sin cambios, seguimos mostrando estas opciones en UI)
const CATEGORIES = [
  { value: "supplies", label: "Supplies" },
  { value: "logistics", label: "Logistics" },
  { value: "staff", label: "Staff" },
  { value: "rent", label: "Rent" },
  { value: "other", label: "Other" },
];

// 👇 AGREGADO: mapeo UI->API (backend enum)
function mapCategoryToType(c: string): "supplies" | "staff" | "equipment" | "other" {
  switch ((c || "").toLowerCase()) {
    case "supplies":
      return "supplies";
    case "staff":
      return "staff";
    case "equipment":
      return "equipment";
    case "other":
      return "other";
    // categorías de UI que el backend no acepta → "other"
    case "logistics":
    case "rent":
    default:
      return "other";
  }
}

function ExpenseNewContent() {
  const qs = useSearchParams();

  // Campos
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | string>("");
  const [category, setCategory] = useState("supplies");
  const [eventId, setEventId] = useState("");
  const [notes, setNotes] = useState("");

  // UI
  const [msg, setMsg] = useState<string | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Respuesta
  const [result, setResult] = useState<CreateExpenseResponse | null>(null);

  // Prefill (?eventId=...)
  useEffect(() => {
    const ev = qs.get("eventId");
    if (ev && !eventId) setEventId(ev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientErrors = useMemo(() => {
    const list: string[] = [];
    if (!description.trim()) list.push("La descripción es obligatoria.");
    if (amount === "" || Number.isNaN(Number(amount))) list.push("El monto es obligatorio y debe ser número.");
    const a = Number(amount);
    if (!(a > 0)) list.push("El monto debe ser > 0.");
    if (!category.trim()) list.push("La categoría es obligatoria.");
    return list;
  }, [description, amount, category]);

  function normalizeErrorPayload(payload: any): { message: string; list: string[] } {
    if (!payload) return { message: "Error al crear gasto", list: [] };
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
    catch { return { message: "Error al crear gasto", list: [] }; }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErrs([]);
    setResult(null);

    try {
      if (!hasRole(["admin"])) {
        setMsg("Solo admin puede crear gastos.");
        return;
      }
      if (clientErrors.length > 0) {
        setErrs(clientErrors);
        setMsg("Revisa los campos del formulario.");
        return;
      }

      setLoading(true);

      // 👇 AGREGADO: armamos el payload que el backend acepta (sin "category")
      const payload: Omit<CreateExpenseBody, "category"> & { type: NonNullable<CreateExpenseBody["type"]> } = {
        description: description.trim(),
        amount: Number(amount),
        type: mapCategoryToType(category.trim()),
        eventId: eventId.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const token = getToken();
      const { data } = await api.post<CreateExpenseResponse>("/expenses", payload, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      setResult(data);
      setMsg("Gasto creado correctamente.");
      // limpiar para cargar otro rápido (dejamos eventId/categoría por comodidad)
      setDescription("");
      setAmount("");
      setNotes("");
    } catch (err: any) {
      const { message, list } = normalizeErrorPayload(err?.response?.data);
      setMsg(message || "Error al crear gasto");
      if (list.length) setErrs(list);
    } finally {
      setLoading(false);
    }
  }

  return (
      <main className={form.container}>
        <form className={form.form} onSubmit={onSubmit} noValidate>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ marginRight: "auto" }}>Crear gasto</h1>
            <Link className={btn.secondary} href="/events">Ver eventos</Link>
          </div>

          <label>Descripción</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Compra de bebidas"
            required
          />

          <label>Monto</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
            required
          />

          <label>Categoría</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <label>Evento (opcional)</label>
          <input
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder="event-123"
          />

          <label>Notas (opcional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Compra mayorista"
          />

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
            {loading ? "Creando…" : "Crear gasto"}
          </button>

          {/* Resultado OK */}
          {result && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid #a7f3d0",
                background: "#ecfdf5",
                borderRadius: 10,
              }}
            >
              <strong>Gasto creado</strong>
              <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                <Row label="ID"><code>{result.id}</code></Row>
                <Row label="Descripción">{result.description}</Row>
                <Row label="Monto">{formatMoney(result.amount)}</Row>
                <Row label="Categoría"><code>{result.category}</code></Row>
                {/* 👇 AGREGADO: mostrar el tipo que guardó la API */}
                <Row label="Tipo (API)"><code>{result.type || mapCategoryToType(result.category)}</code></Row>
                <Row label="Evento"><code>{result.eventId || "—"}</code></Row>
                <Row label="Notas">{result.notes || "—"}</Row>
                <Row label="Creado">{formatDate(result.createdAt)}</Row>
                <Row label="Actualizado">{formatDate(result.updatedAt)}</Row>
              </div>
            </div>
          )}

          <small style={{ color: "#6b7280", marginTop: 8 }}>
            Tip: podés abrir con <code>?eventId=event-123</code> para prellenar.
          </small>
        </form>
      </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8 }}>
      <span style={{ color: "#6b7280", fontWeight: 600 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch { return String(iso); }
}

function formatMoney(n?: number) {
  if (typeof n !== "number") return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

export default function ExpenseNewPage() {
  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <Suspense fallback={<div style={{ padding: 20 }}>Cargando...</div>}>
        <ExpenseNewContent />
      </Suspense>
    </Guard>
  );
}
