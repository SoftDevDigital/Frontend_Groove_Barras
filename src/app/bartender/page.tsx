// src/app/bartender/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import btn from "@/styles/Buttons.module.css";
import Link from "next/link";

type CartItem = {
  productId: string;
  productName: string;
  productCode: string;
  price: number;
  quantity: number;
  total: number;
  unit?: string;
};

type CartSummary = {
  totalItems: number;
  totalQuantity: number;
  subtotal: number;
  tax: number;
  total: number;
  items: CartItem[];
};

type InputResponse = {
  success: boolean;
  message: string;
  product: {
    name: string;
    code: string;
    price: number;
    quantity: number;
    total: number;
  };
  cartSummary: CartSummary;
};

/* 👇 GET /bartender/cart */
type CartResponse = {
  id: string;
  bartenderId: string;
  bartenderName: string;
  eventId: string;
  items: {
    productId: string;
    productName: string;
    productCode: string;
    price: number;
    quantity: number;
    total: number;
    unit?: string;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  totalItems: number;
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
};

/* 👇 NUEVO: POST /bartender/cart/confirm */
type ConfirmBody = {
  customerName?: string;
  paymentMethod: "cash" | "card" | "transfer" | "other" | string;
  notes?: string;
};
type TicketItem = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
};
type TicketDTO = {
  id: string;
  eventId: string;
  barId: string;
  employeeId: string;
  customerName?: string;
  items: TicketItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
};
type ConfirmResponse = {
  success: boolean;
  message: string;
  ticket: TicketDTO;
  cartCleared: boolean;
};

export default function BartenderCartPage() {
  const [eventId, setEventId] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [sending, setSending] = useState(false);

  const [lastMsg, setLastMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [productInfo, setProductInfo] = useState<InputResponse["product"] | null>(null);
  const [summary, setSummary] = useState<CartSummary | null>(null);

  /* GET /bartender/cart */
  const [cartMeta, setCartMeta] = useState<{
    id?: string;
    bartenderName?: string;
    bartenderId?: string;
    eventId?: string;
    createdAt?: string;
    updatedAt?: string;
  } | null>(null);
  const [loadingCart, setLoadingCart] = useState(false);
  const [cartErr, setCartErr] = useState<string | null>(null);

  /* 👇 NUEVO: confirmación */
  const [customerName, setCustomerName] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<ConfirmBody["paymentMethod"]>("cash");
  const [notes, setNotes] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<TicketDTO | null>(null);

  // 🔴 NUEVO: estado para limpiar carrito (DELETE /bartender/cart)
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const [clearErr, setClearErr] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const eventRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  async function loadCart() {
    setCartErr(null);
    try {
      if (!hasRole(["bartender", "admin"])) {
        setCartErr("No autorizado: requiere rol bartender o admin.");
        return;
      }
      setLoadingCart(true);
      const token = getToken();
      const { data } = await api.get<CartResponse>("/bartender/cart", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const mappedSummary: CartSummary = {
        totalItems: data.totalItems,
        totalQuantity: data.totalQuantity,
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        items: (data.items || []).map((it) => ({
          productId: it.productId,
          productName: it.productName,
          productCode: it.productCode,
          price: it.price,
          quantity: it.quantity,
          total: it.total,
          unit: it.unit,
        })),
      };

      setSummary(mappedSummary);
      setCartMeta({
        id: data.id,
        bartenderName: data.bartenderName,
        bartenderId: data.bartenderId,
        eventId: data.eventId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 401 || sc === 403) setCartErr("No autorizado para obtener el carrito actual.");
      else setCartErr(e?.response?.data?.message || "Error al obtener el carrito actual");
    } finally {
      setLoadingCart(false);
    }
  }

  async function sendInput() {
    setLastMsg(null);
    setError(null);

    if (!hasRole(["bartender", "admin"])) {
      setError("No autorizado: requiere rol bartender o admin.");
      return;
    }
    const code = input.trim();
    if (!code) { setError("Ingresá un código (ej: CCC2)."); return; }
    const ev = eventId.trim();
    if (!ev) { setError("Ingresá el ID de evento (eventId)."); eventRef.current?.focus(); return; }

    try {
      setSending(true);
      const token = getToken();

      const { data } = await api.post<InputResponse>(
        "/bartender/input",
        { input: code, eventId: ev },
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          validateStatus: (s) => s >= 200 && s < 300,
        }
      );

      setProductInfo(data.product);
      setSummary(data.cartSummary);
      setLastMsg(data.message || "Agregado al carrito.");
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 400) setError(e?.response?.data?.message || "Formato inválido o stock insuficiente");
      else if (sc === 404) setError(e?.response?.data?.message || "Producto no encontrado");
      else setError(e?.response?.data?.message || "Error al procesar la entrada");
    } finally {
      setSending(false);
    }
  }

  /* 👇 NUEVO: POST /bartender/cart/confirm */
  async function confirmCart() {
    setConfirmMsg(null);
    setConfirmErr(null);
    setCreatedTicket(null);

    if (!hasRole(["bartender", "admin"])) {
      setConfirmErr("No autorizado: requiere rol bartender o admin.");
      return;
    }
    if (!summary || !summary.items?.length) {
      setConfirmErr("El carrito está vacío.");
      return;
    }

    const body: ConfirmBody = {
      customerName: customerName.trim() || undefined,
      paymentMethod: paymentMethod || "cash",
      notes: notes.trim() || undefined,
    };

    try {
      setConfirming(true);
      const token = getToken();
      const { data } = await api.post<ConfirmResponse>(
        "/bartender/cart/confirm",
        body,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          // espera 201 Created
          validateStatus: (s) => s >= 200 && s < 300,
        }
      );

      setConfirmMsg(data.message || "Ticket generado exitosamente.");
      setCreatedTicket(data.ticket || null);

      // si el backend limpia el carrito, lo reflejamos en UI
      if (data.cartCleared) {
        setSummary(null);
        setProductInfo(null);
        // refresca metadatos de carrito (id/fechas) si querés ver el "nuevo" carrito vacío
        // opcional: await loadCart();
      }
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 400) setConfirmErr(e?.response?.data?.message || "Validación fallida");
      else if (sc === 401 || sc === 403) setConfirmErr("No autorizado para confirmar el carrito.");
      else setConfirmErr(e?.response?.data?.message || "Error al confirmar el carrito");
    } finally {
      setConfirming(false);
    }
  }

  // 🔴 NUEVO: DELETE /bartender/cart (vaciar carrito)
  async function clearCart() {
    setClearMsg(null);
    setClearErr(null);

    if (!hasRole(["bartender", "admin"])) {
      setClearErr("No autorizado: requiere rol bartender o admin.");
      return;
    }
    if (!summary || !summary.items?.length) {
      setClearErr("El carrito ya está vacío.");
      return;
    }

    try {
      setClearing(true);
      const token = getToken();
      const { data } = await api.delete<{ message?: string }>("/bartender/cart", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        validateStatus: (s) => s >= 200 && s < 300, // espera 200 OK
      });

      // limpiar UI
      setSummary(null);
      setProductInfo(null);
      setClearMsg(data?.message || "Cart cleared successfully");

      // opcional: actualizar metadatos (updatedAt) para reflejar el cambio
      setCartMeta((m) => (m ? { ...m, updatedAt: new Date().toISOString() } : m));
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 401 || sc === 403) setClearErr("No autorizado para limpiar el carrito.");
      else setClearErr(e?.response?.data?.message || "Error al limpiar el carrito");
    } finally {
      setClearing(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendInput();
  }

  return (
    <Guard roles={["bartender","admin"]}>
      <Navbar />
      <main style={{ padding: 20, display: "grid", gap: 12, maxWidth: 1000, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ marginRight: "auto" }}>Carrito (Bartender)</h1>

          <button className={btn.secondary} onClick={loadCart} disabled={loadingCart}>
            {loadingCart ? "Cargando carrito…" : (summary ? "Refrescar carrito" : "Cargar carrito actual")}
          </button>
        </header>

        {cartMeta && (
          <section style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
            <strong style={{ fontSize: 16 }}>Carrito actual</strong>
            {cartErr && (
              <div style={{ border:"1px solid #fecaca", background:"#fee2e2", color:"#7f1d1d", padding:10, borderRadius:10 }}>
                {cartErr}
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Card title="Cart ID" value={cartMeta.id || "—"} />
              <Card title="Bartender" value={cartMeta.bartenderName || cartMeta.bartenderId || "—"} />
              <Card title="Evento" value={cartMeta.eventId || "—"} />
              <Card title="Creado" value={formatDate(cartMeta.createdAt)} />
              <Card title="Actualizado" value={formatDate(cartMeta.updatedAt)} />
            </div>
          </section>
        )}

        {/* Entrada de códigos */}
        <section style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label>Evento (eventId)</label>
            <input
              ref={eventRef}
              placeholder="event-123"
              value={eventId}
              onChange={(e)=>setEventId(e.target.value)}
            />
            <small style={{ color: "#6b7280" }}>
              Este ID asocia el carrito al evento en curso.
            </small>
          </div>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 6 }}>
            <label>Entrada del bartender</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                ref={inputRef}
                placeholder='Ej: "CCC2" agrega 2x del producto con código CCC'
                value={input}
                onChange={(e)=>setInput(e.target.value)}
                onKeyDown={(e)=>{ if (e.key === "Enter") { e.preventDefault(); void sendInput(); } }}
                style={{ flex: 1, minWidth: 260 }}
              />
              <button className={btn.primary} type="submit" disabled={sending}>
                {sending ? "Procesando…" : "Agregar"}
              </button>
            </div>

            {lastMsg && !error && (
              <div style={{ border:"1px solid #bbf7d0", background:"#ecfdf5", color:"#065f46", padding:10, borderRadius:10 }}>
                {lastMsg}
              </div>
            )}
            {error && (
              <div style={{ border:"1px solid #fecaca", background:"#fee2e2", color:"#7f1d1d", padding:10, borderRadius:10 }}>
                {error}
              </div>
            )}
          </form>
        </section>

        {/* Último producto reconocido */}
        {productInfo && (
          <section style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
            <strong style={{ fontSize: 16 }}>Último ítem agregado</strong>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <Card title="Producto" value={productInfo.name} />
              <Card title="Código" value={productInfo.code} />
              <Card title="Precio" value={money(productInfo.price)} />
              <Card title="Cantidad" value={productInfo.quantity} />
              <Card title="Total" value={money(productInfo.total)} />
            </div>
          </section>
        )}

        {/* Resumen del carrito */}
        <section style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 style={{ margin: 0 }}>Carrito</h3>
          </div>

          {!summary ? (
            <span style={{ color: "#6b7280" }}>Aún no hay ítems en el carrito.</span>
          ) : (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <Card title="Items" value={summary.totalItems} />
                <Card title="Cantidad total" value={summary.totalQuantity} />
                <Card title="Subtotal" value={money(summary.subtotal)} />
                <Card title="Impuesto" value={money(summary.tax)} />
                <Card title="Total" value={money(summary.total)} />
              </div>

              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr>
                      <Th>Producto</Th>
                      <Th>Código</Th>
                      <Th style={{ textAlign: "right" }}>Precio</Th>
                      <Th style={{ textAlign: "right" }}>Cant.</Th>
                      <Th style={{ textAlign: "right" }}>Total</Th>
                      <Th>Unidad</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.items?.length ? summary.items.map((it, i) => (
                      <tr key={`${it.productId}-${i}`}>
                        <Td>{it.productName}</Td>
                        <Td><code>{it.productCode}</code></Td>
                        <Td style={{ textAlign: "right" }}>{money(it.price)}</Td>
                        <Td style={{ textAlign: "right" }}>{it.quantity}</Td>
                        <Td style={{ textAlign: "right" }}>{money(it.total)}</Td>
                        <Td>{it.unit || "—"}</Td>
                      </tr>
                    )) : (
                      <tr><Td colSpan={6}>Carrito vacío.</Td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 👇 NUEVO: formulario de confirmación */}
              <div style={{ marginTop: 12, display:"grid", gap: 10 }}>
                <h4 style={{ margin: 0 }}>Confirmar y generar ticket</h4>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <div style={{ display:"grid", gap: 6 }}>
                    <label>Cliente (opcional)</label>
                    <input
                      placeholder="Cliente Test"
                      value={customerName}
                      onChange={(e)=>setCustomerName(e.target.value)}
                    />
                  </div>

                  <div style={{ display:"grid", gap: 6 }}>
                    <label>Método de pago</label>
                    <select value={paymentMethod} onChange={(e)=>setPaymentMethod(e.target.value)}>
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                </div>

                <div style={{ display:"grid", gap: 6 }}>
                  <label>Notas (opcional)</label>
                  <textarea
                    rows={2}
                    placeholder="Sin hielo"
                    value={notes}
                    onChange={(e)=>setNotes(e.target.value)}
                  />
                </div>

                {confirmMsg && !confirmErr && (
                  <div style={{ border:"1px solid #bbf7d0", background:"#ecfdf5", color:"#065f46", padding:10, borderRadius:10 }}>
                    {confirmMsg}
                    {createdTicket?.id && (
                      <div style={{ marginTop: 6 }}>
                        Ver ticket:{" "}
                        <Link href={`/tickets/${createdTicket.id}`} style={{ textDecoration:"underline" }}>
                          {createdTicket.id}
                        </Link>
                      </div>
                    )}
                  </div>
                )}
                {confirmErr && (
                  <div style={{ border:"1px solid #fecaca", background:"#fee2e2", color:"#7f1d1d", padding:10, borderRadius:10 }}>
                    {confirmErr}
                  </div>
                )}

                <div style={{ display:"flex", gap: 8, flexWrap:"wrap" }}>
                  <button
                    className={btn.primary}
                    onClick={confirmCart}
                    disabled={confirming || !summary.items?.length}
                    title="Confirmar carrito y generar ticket"
                  >
                    {confirming ? "Generando…" : "Confirmar carrito"}
                  </button>
                  <button
                    className={btn.secondary}
                    onClick={()=>{ setCustomerName(""); setNotes(""); setPaymentMethod("cash"); }}
                    disabled={confirming}
                    title="Limpiar campos de confirmación"
                  >
                    Limpiar
                  </button>

                  {/* 👇 NUEVO: Vaciar carrito (DELETE /bartender/cart) */}
                  <button
                    className={btn.secondary}
                    onClick={clearCart}
                    disabled={clearing || !summary.items?.length}
                    title="Vaciar todo el carrito"
                    style={{ borderColor:"#ef4444", color:"#ef4444" }}
                  >
                    {clearing ? "Vaciando…" : "Vaciar carrito"}
                  </button>
                </div>

                {/* 👇 NUEVO: mensajes de vaciado */}
                {clearMsg && !clearErr && (
                  <div style={{ border:"1px solid #bbf7d0", background:"#ecfdf5", color:"#065f46", padding:10, borderRadius:10, marginTop:8 }}>
                    {clearMsg}
                  </div>
                )}
                {clearErr && (
                  <div style={{ border:"1px solid #fecaca", background:"#fee2e2", color:"#7f1d1d", padding:10, borderRadius:10, marginTop:8 }}>
                    {clearErr}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </Guard>
  );
}

/* UI helpers */
function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:14,display:"grid",gap:6}}>
      <span style={{ color:"#6b7280", fontSize:13, fontWeight:600 }}>{title}</span>
      <span style={{ fontSize:22, fontWeight:800 }}>{value ?? "—"}</span>
    </div>
  );
}

const Th: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = (props) => (
  <th {...props} style={{ textAlign:"left", padding:"8px 10px", borderBottom:"1px solid #e5e7eb", fontWeight:700, ...(props.style||{}) }} />
);
const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = (props) => (
  <td {...props} style={{ padding:"8px 10px", borderBottom:"1px solid #f3f4f6", ...(props.style||{}) }} />
);

function money(n?: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
  } catch { return `$${n}`; }
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`;
  } catch { return String(iso); }
}
