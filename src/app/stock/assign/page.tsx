// ✅ NUEVO ARCHIVO: src/app/stock/assign/page.tsx
"use client";

import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import form from "@/styles/Forms.module.css";
import btn from "@/styles/Buttons.module.css";
import { getToken, hasRole } from "@/lib/auth";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type AssignBody = {
  productId: string;
  barId: string;
  quantity: number;
  notes?: string;
};

type AssignResponse = {
  id: string;
  productId: string;
  barId: string;
  quantity: number;
  notes?: string;
  status: "assigned";
  createdAt: string; // ISO
};

export default function StockAssignPage() {
  const qs = useSearchParams();

  // Campos del formulario
  const [productId, setProductId] = useState("");
  const [barId, setBarId] = useState("");
  const [quantity, setQuantity] = useState<number | string>("");
  const [notes, setNotes] = useState("");

  // UI
  const [msg, setMsg] = useState<string | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Respuesta
  const [result, setResult] = useState<AssignResponse | null>(null);

  // Prefill por querystring (?productId=...&barId=...)
  useEffect(() => {
    const qpProduct = qs.get("productId");
    const qpBar = qs.get("barId");
    if (qpProduct && !productId) setProductId(qpProduct);
    if (qpBar && !barId) setBarId(qpBar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientErrors = useMemo(() => {
    const list: string[] = [];
    if (!productId.trim()) list.push("El productId es obligatorio.");
    if (!barId.trim()) list.push("El barId es obligatorio.");
    if (quantity === "" || Number.isNaN(Number(quantity))) list.push("La cantidad es obligatoria y debe ser un número.");
    const q = Number(quantity);
    if (!Number.isInteger(q) || q <= 0) list.push("La cantidad debe ser un entero > 0.");
    return list;
  }, [productId, barId, quantity]);

  function normalizeErrorPayload(payload: any): { message: string; list: string[] } {
    if (!payload) return { message: "Error al asignar stock", list: [] };
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
    catch { return { message: "Error al asignar stock", list: [] }; }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErrs([]);
    setResult(null);

    try {
      if (!hasRole(["admin"])) {
        setMsg("Solo admin puede asignar stock.");
        return;
      }
      if (clientErrors.length > 0) {
        setErrs(clientErrors);
        setMsg("Revisa los campos del formulario.");
        return;
      }

      setLoading(true);

      const body: AssignBody = {
        productId: productId.trim(),
        barId: barId.trim(),
        quantity: Number(quantity),
        notes: notes.trim() || undefined,
      };

      const token = getToken();
      const { data } = await api.post<AssignResponse>("/stock/assign", body, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      setResult(data);
      setMsg("Stock asignado correctamente.");
      // opcional: limpiar cantidad / notas para repetir asignaciones rápidas
      setQuantity("");
      setNotes("");
    } catch (err: any) {
      const { message, list } = normalizeErrorPayload(err?.response?.data);
      setMsg(message || "Error al asignar stock");
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ marginRight: "auto" }}>Asignar stock</h1>
            <Link className={btn.secondary} href="/products">Ver productos</Link>
            <Link className={btn.secondary} href="/bars">Ver barras</Link>
          </div>

          <label>productId</label>
          <input
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="product-123"
            required
          />

          <label>barId</label>
          <input
            value={barId}
            onChange={(e) => setBarId(e.target.value)}
            placeholder="bar-123"
            required
          />

          <label>Cantidad</label>
          <input
            type="number"
            step="1"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="50"
            required
          />

          <label>Notas (opcional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Stock inicial"
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
            {loading ? "Asignando…" : "Asignar stock"}
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
              <strong>Asignación creada</strong>
              <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                <Row label="ID"><code>{result.id}</code></Row>
                <Row label="Producto"><code>{result.productId}</code></Row>
                <Row label="Barra"><code>{result.barId}</code></Row>
                <Row label="Cantidad">{result.quantity}</Row>
                <Row label="Notas">{result.notes || "—"}</Row>
                <Row label="Estado"><span style={{ fontWeight: 700 }}>{result.status}</span></Row>
                <Row label="Creado">{formatDate(result.createdAt)}</Row>
              </div>
            </div>
          )}

          {/* Tips para prellenar */}
          <small style={{ color: "#6b7280", marginTop: 8 }}>
            Tip: podés abrir esta página con <code>?productId=product-123&barId=bar-123</code> para prellenar.
          </small>
        </form>
      </main>
    </Guard>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
      <span style={{ color: "#6b7280", fontWeight: 600 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`;
  } catch {
    return String(iso);
  }
}
