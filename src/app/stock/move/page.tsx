// ✅ NUEVO ARCHIVO: src/app/stock/move/page.tsx
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

type MoveBody = {
  fromBarId: string;
  toBarId: string;
  productId: string;
  quantity: number;
  notes?: string;
};

type MoveResponse = {
  id: string;
  fromBarId: string;
  toBarId: string;
  productId: string;
  quantity: number;
  notes?: string;
  createdAt: string; // ISO
};

export default function StockMovePage() {
  const qs = useSearchParams();

  // Campos del formulario
  const [fromBarId, setFromBarId] = useState("");
  const [toBarId, setToBarId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState<number | string>("");
  const [notes, setNotes] = useState("");

  // UI
  const [msg, setMsg] = useState<string | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Respuesta
  const [result, setResult] = useState<MoveResponse | null>(null);

  // Prefill (?fromBarId=&toBarId=&productId=&quantity=)
  useEffect(() => {
    const qp = (k: string) => qs.get(k) || "";
    if (!fromBarId) setFromBarId(qp("fromBarId"));
    if (!toBarId) setToBarId(qp("toBarId"));
    if (!productId) setProductId(qp("productId"));
    const qQty = qs.get("quantity");
    if (qQty && quantity === "") setQuantity(qQty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientErrors = useMemo(() => {
    const list: string[] = [];
    if (!fromBarId.trim()) list.push("El fromBarId es obligatorio.");
    if (!toBarId.trim()) list.push("El toBarId es obligatorio.");
    if (!productId.trim()) list.push("El productId es obligatorio.");
    if (fromBarId.trim() && toBarId.trim() && fromBarId.trim() === toBarId.trim()) {
      list.push("El origen y el destino no pueden ser la misma barra.");
    }
    if (quantity === "" || Number.isNaN(Number(quantity))) {
      list.push("La cantidad es obligatoria y debe ser un número.");
    } else {
      const q = Number(quantity);
      if (!Number.isInteger(q) || q <= 0) list.push("La cantidad debe ser un entero > 0.");
    }
    return list;
  }, [fromBarId, toBarId, productId, quantity]);

  function normalizeErrorPayload(payload: any): { message: string; list: string[] } {
    if (!payload) return { message: "Error al mover stock", list: [] };
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
    catch { return { message: "Error al mover stock", list: [] }; }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErrs([]);
    setResult(null);

    try {
      if (!hasRole(["admin"])) {
        setMsg("Solo admin puede mover stock.");
        return;
      }
      if (clientErrors.length > 0) {
        setErrs(clientErrors);
        setMsg("Revisa los campos del formulario.");
        return;
      }

      setLoading(true);

      const body: MoveBody = {
        fromBarId: fromBarId.trim(),
        toBarId: toBarId.trim(),
        productId: productId.trim(),
        quantity: Number(quantity),
        notes: notes.trim() || undefined,
      };

      const token = getToken();
      const { data } = await api.post<MoveResponse>("/stock/move", body, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      setResult(data);
      setMsg("Stock movido correctamente.");
      // Limpio cantidad y notas para permitir múltiples movimientos rápidos
      setQuantity("");
      setNotes("");
    } catch (err: any) {
      const { message, list } = normalizeErrorPayload(err?.response?.data);
      setMsg(message || "Error al mover stock");
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
            <h1 style={{ marginRight: "auto" }}>Mover stock</h1>
            <Link className={btn.secondary} href="/stock/assign">Asignar stock</Link>
            <Link className={btn.secondary} href="/products">Ver productos</Link>
            <Link className={btn.secondary} href="/bars">Ver barras</Link>
          </div>

          <label>fromBarId</label>
          <input
            value={fromBarId}
            onChange={(e) => setFromBarId(e.target.value)}
            placeholder="bar-123"
            required
          />

          <label>toBarId</label>
          <input
            value={toBarId}
            onChange={(e) => setToBarId(e.target.value)}
            placeholder="bar-456"
            required
          />

          <label>productId</label>
          <input
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="product-123"
            required
          />

          <label>Cantidad</label>
          <input
            type="number"
            step="1"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="10"
            required
          />

          <label>Notas (opcional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Transferencia"
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
            {loading ? "Moviendo…" : "Mover stock"}
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
              <strong>Movimiento creado</strong>
              <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                <Row label="ID"><code>{result.id}</code></Row>
                <Row label="Desde (fromBarId)"><code>{result.fromBarId}</code></Row>
                <Row label="Hacia (toBarId)"><code>{result.toBarId}</code></Row>
                <Row label="Producto"><code>{result.productId}</code></Row>
                <Row label="Cantidad">{result.quantity}</Row>
                <Row label="Notas">{result.notes || "—"}</Row>
                <Row label="Creado">{formatDate(result.createdAt)}</Row>
              </div>
            </div>
          )}

          {/* Tips para prellenar */}
          <small style={{ color: "#6b7280", marginTop: 8 }}>
            Tip: abrí con <code>?fromBarId=bar-123&toBarId=bar-456&productId=product-123&quantity=10</code> para prellenar.
          </small>
        </form>
      </main>
    </Guard>
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
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`;
  } catch {
    return String(iso);
  }
}
