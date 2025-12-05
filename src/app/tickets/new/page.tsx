// src/app/tickets/new/page.tsx
"use client";

import { useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import form from "@/styles/Forms.module.css";
import btn from "@/styles/Buttons.module.css";
import { useRouter } from "next/navigation";

type TicketItemInput = {
  productId: string;
  productName: string;
  quantity: number | string;
  price: number | string;
  total: number; // derivado
};

type TicketDTO = {
  id: string;
  eventId: string;
  barId: string;
  employeeId: string;
  customerName?: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: "cash" | "card" | "transfer" | "other" | string;
  notes?: string;
  createdAt: string;
};

export default function NewTicketPage() {
  const router = useRouter();

  // Campos principales
  const [eventId, setEventId] = useState("");
  const [barId, setBarId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [customerName, setCustomerName] = useState("");

  // Ítems
  const [items, setItems] = useState<TicketItemInput[]>([
    { productId: "", productName: "", quantity: 1, price: 0, total: 0 },
  ]);

  // Totales
  const [tax, setTax] = useState<number | string>(0);
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "card" | "transfer" | "other" | "dj"
  >("cash"); // 👈 agregado "dj"
  const [notes, setNotes] = useState("");

  // UI
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errs, setErrs] = useState<string[]>([]);

  // Cálculos
  const computed = useMemo(() => {
    const itemsNorm = items.map((it) => {
      const q = Number(it.quantity) || 0;
      const p = Number(it.price) || 0;
      return { ...it, total: q * p };
    });
    const subtotal = itemsNorm.reduce(
      (acc, it) => acc + (Number(it.total) || 0),
      0
    );
    const taxN = Number(tax) || 0;
    const total = subtotal + taxN;
    return { itemsNorm, subtotal, taxN, total };
  }, [items, tax]);

  function addRow() {
    setItems((prev) => [
      ...prev,
      { productId: "", productName: "", quantity: 1, price: 0, total: 0 },
    ]);
  }
  function removeRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }
  function updateRow(index: number, patch: Partial<TicketItemInput>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it))
    );
  }

  // Validación simple
  function validate(): string[] {
    const errs: string[] = [];
    if (!hasRole(["admin", "bartender"]))
      errs.push("No autorizado: requiere rol admin o bartender.");
    if (!eventId.trim()) errs.push("El evento es obligatorio.");
    if (!barId.trim()) errs.push("La barra es obligatoria.");
    if (!employeeId.trim()) errs.push("El empleado es obligatorio.");
    if (items.length === 0) errs.push("Agregá al menos un ítem.");

    items.forEach((it, i) => {
      const q = Number(it.quantity);
      const p = Number(it.price);
      if (!it.productId.trim())
        errs.push(`Ítem #${i + 1}: productId es obligatorio.`);
      if (!it.productName.trim())
        errs.push(`Ítem #${i + 1}: productName es obligatorio.`);
      if (!Number.isFinite(q) || q <= 0)
        errs.push(`Ítem #${i + 1}: quantity debe ser > 0.`);
      if (!Number.isFinite(p) || p < 0)
        errs.push(`Ítem #${i + 1}: price inválido.`);
    });
    return errs;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErrs([]);

    const v = validate();
    if (v.length) {
      setErrs(v);
      setMsg("Revisá los campos del formulario.");
      return;
    }

    try {
      setLoading(true);
      const token = getToken();

      const body = {
        eventId: eventId.trim(),
        barId: barId.trim(),
        employeeId: employeeId.trim(),
        customerName: customerName.trim() || undefined,
        items: computed.itemsNorm.map((it) => ({
          productId: it.productId.trim(),
          productName: it.productName.trim(),
          quantity: Number(it.quantity),
          price: Number(it.price),
          total: Number(it.total),
        })),
        subtotal: computed.subtotal,
        tax: computed.taxN,
        total: computed.total,
        paymentMethod,
        notes: notes.trim() || undefined,
      };

      const { data } = await api.post<TicketDTO>("/tickets", body, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      router.push(`/tickets`);
    } catch (err: any) {
      const payload = err?.response?.data;
      let message = "Error al crear ticket";
      if (payload?.message) {
        message =
          typeof payload.message === "string"
            ? payload.message
            : payload.message?.message || message;
      }
      setMsg(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Guard roles={["admin", "bartender"]}>
      <Navbar />
      <main className={form.container}>
        <form
          className={form.form}
          onSubmit={onSubmit}
          noValidate
        >
          <h1>Nuevo ticket</h1>

          <label>Evento (eventId)</label>
          <input
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder="event-123"
            required
          />

          <label>Barra (barId)</label>
          <input
            value={barId}
            onChange={(e) => setBarId(e.target.value)}
            placeholder="bar-123"
            required
          />

          <label>Empleado (employeeId)</label>
          <input
            value={employeeId}
            onChange={(e) =>
              setEmployeeId(e.target.value)
            }
            placeholder="employee-123"
            required
          />

          <label>Cliente</label>
          <input
            value={customerName}
            onChange={(e) =>
              setCustomerName(e.target.value)
            }
            placeholder="Cliente Test"
          />

          <hr style={{ opacity: 0.2 }} />

          <strong>Ítems</strong>
          {items.map((it, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1.3fr 1.2fr .7fr .8fr .8fr auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                placeholder="productId"
                value={it.productId}
                onChange={(e) =>
                  updateRow(i, { productId: e.target.value })
                }
              />
              <input
                placeholder="productName"
                value={it.productName}
                onChange={(e) =>
                  updateRow(i, {
                    productName: e.target.value,
                  })
                }
              />
              <input
                type="number"
                min={1}
                placeholder="quantity"
                value={it.quantity}
                onChange={(e) =>
                  updateRow(i, {
                    quantity: e.target.value,
                  })
                }
              />
              <input
                type="number"
                step="0.01"
                min={0}
                placeholder="price"
                value={it.price}
                onChange={(e) =>
                  updateRow(i, { price: e.target.value })
                }
              />
              <div
                style={{
                  fontWeight: 700,
                  textAlign: "right",
                }}
              >
                $
                {(Number(it.quantity) || 0) *
                  (Number(it.price) || 0)}
              </div>
              <button
                type="button"
                className={btn.secondary}
                onClick={() => removeRow(i)}
                disabled={items.length === 1}
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            className={btn.secondary}
            onClick={addRow}
          >
            + Agregar ítem
          </button>

          <hr style={{ opacity: 0.2 }} />

          <label>Impuesto / Tax</label>
          <input
            type="number"
            step="0.01"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            placeholder="0"
          />

          <label>Método de pago</label>
          <select
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(e.target.value as any)
            }
          >
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
            <option value="transfer">Transferencia</option>
            <option value="dj">DJ</option> {/* 👈 NUEVO */}
            <option value="other">Otro</option>
          </select>

          <label>Notas</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Sin hielo"
          />

          <div
            style={{
              display: "grid",
              gap: 4,
              textAlign: "right",
              marginTop: 8,
            }}
          >
            <div>
              Subtotal: <strong>${computed.subtotal}</strong>
            </div>
            <div>
              Impuesto: <strong>${computed.taxN}</strong>
            </div>
            <div style={{ fontSize: 18 }}>
              Total: <strong>${computed.total}</strong>
            </div>
          </div>

          {(msg || errs.length > 0) && (
            <div
              className={form.error}
              style={{ textAlign: "left" }}
            >
              {msg && (
                <p style={{ marginTop: 0 }}>{msg}</p>
              )}
              {errs.length > 0 && (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                  }}
                >
                  {errs.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={btn.primary}
              disabled={loading}
            >
              {loading ? "Creando…" : "Crear ticket"}
            </button>
          </div>
        </form>
      </main>
    </Guard>
  );
}
