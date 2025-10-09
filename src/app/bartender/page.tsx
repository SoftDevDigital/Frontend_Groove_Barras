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

/* 👇 GET /bartender/cart (soporta respuesta simple y extendida) */
type CartResponse = {
  totalItems: number;
  totalQuantity: number;
  subtotal: number;
  tax: number;
  total: number;
  items: {
    productId: string;
    productName: string;
    productCode: string;
    price: number;
    quantity: number;
    total: number;
    unit?: string;
  }[];

  // opcionales
  id?: string;
  bartenderId?: string;
  bartenderName?: string;
  eventId?: string;
  createdAt?: string;
  updatedAt?: string;
};

/* ======================== NUEVO SEGÚN SPEC ======================== */
type ConfirmBody = {
  barId: string; // OBLIGATORIO
  customerName?: string; // default backend: "Cliente"
  paymentMethod?: "cash" | "card" | "mixed"; // default backend: "cash"
  notes?: string;
};

type PrintFormat = {
  header: {
    businessName: string;
    businessAddress: string;
    businessPhone: string;
    businessTaxId: string;
    businessEmail: string;
  };
  ticket: {
    ticketNumber: string;
    userName: string;
    barName: string;
    eventName: string;
    date: string; // "DD/MM/YYYY"
    time: string; // "HH:mm"
    currency: string; // p.ej. "ARS" o "USD"
  };
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    taxRate: number;
    tax: number;
  }[];
  totals: {
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
  };
  payment: {
    method: string; // "EFECTIVO" | "TARJETA" | "MIXTO"
    paidAmount: number;
    changeAmount: number;
    currency: string;
  };
  footer: {
    thankYouMessage: string;
    businessWebsite: string;
    receiptFooter: string;
  };
  printerSettings: {
    paperWidth: number; // 58 u 80
    fontSize: number;
    fontFamily: string;
  };
};

type ConfirmResponse = {
  success: boolean;
  ticketId: string;
  message: string;
  printFormat: PrintFormat;
};
/* ================================================================== */

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

/* ========= NUEVO: Tipos para selects ========= */
type EventOption = { id: string; name: string; date?: string };
type BarOption = { id: string; name: string; eventId?: string };

export default function BartenderCartPage() {
  const [eventId, setEventId] = useState<string>("");
  const [barId, setBarId] = useState<string>(""); // 👈 OBLIGATORIO PARA CONFIRMAR
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

  /* Confirmación */
  const [customerName, setCustomerName] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<ConfirmBody["paymentMethod"]>("cash");
  const [notes, setNotes] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);
  const [lastTicketId, setLastTicketId] = useState<string | null>(null);

  // guardar último printFormat para reimpresión
  const [lastPrintFormat, setLastPrintFormat] = useState<PrintFormat | null>(null);

  // Vaciar carrito (opcional)
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const [clearErr, setClearErr] = useState<string | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const eventRef = useRef<HTMLSelectElement>(null);
  const barRef = useRef<HTMLSelectElement>(null);

  // ========= NUEVO: estado de selects
  const [events, setEvents] = useState<EventOption[]>([]);
  const [bars, setBars] = useState<BarOption[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingBars, setLoadingBars] = useState(false);
  const [eventsErr, setEventsErr] = useState<string | null>(null);
  const [barsErr, setBarsErr] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  /* ===== NUEVO: helpers de normalización ===== */
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

  function normalizeBars(data: any): BarOption[] {
    const arr = Array.isArray(data) ? data : (data?.items || data?.data || []);
    return (arr || [])
      .map((b: any) => ({
        id: b?.id ?? b?.barId ?? b?.uuid ?? "",
        name: b?.name ?? b?.barName ?? "(sin nombre)",
        eventId: b?.eventId,
      }))
      .filter((b: BarOption) => b.id);
  }

  /* ===== NUEVO: fetch de eventos y barras ===== */
  async function fetchEvents() {
    setEventsErr(null);
    setLoadingEvents(true);
    try {
      const token = getToken();
      // intento 1: activos
      let res = await api.get("/events?status=active", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        validateStatus: () => true,
      });
      // fallback: todos
      if (res.status >= 400) {
        res = await api.get("/events", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      }
      const list = normalizeEvents(res.data);
      setEvents(list);
      if (eventId && !list.some((e) => e.id === eventId)) setEventId("");
    } catch (err: any) {
      setEventsErr(err?.response?.data?.message || "No se pudieron cargar los eventos.");
    } finally {
      setLoadingEvents(false);
    }
  }

  async function fetchBarsByEvent(evId: string) {
    setBarsErr(null);
    setLoadingBars(true);
    try {
      const token = getToken();
      // intento 1: query
      let res = await api.get(`/bars?eventId=${encodeURIComponent(evId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        validateStatus: () => true,
      });
      // fallback: nested
      if (res.status >= 400) {
        res = await api.get(`/events/${encodeURIComponent(evId)}/bars`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      }
      const list = normalizeBars(res.data);
      setBars(list);
      if (barId && !list.some((b) => b.id === barId)) setBarId("");
    } catch (err: any) {
      setBarsErr(err?.response?.data?.message || "No se pudieron cargar las barras del evento.");
      setBars([]);
      setBarId("");
    } finally {
      setLoadingBars(false);
    }
  }

  // Carga inicial de eventos
  useEffect(() => {
    void fetchEvents();
  }, []);

  // Cuando cambia el evento, cargo sus barras
  useEffect(() => {
    if (eventId) void fetchBarsByEvent(eventId);
    else {
      setBars([]);
      setBarId("");
    }
  }, [eventId]);

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
    if (!code) {
      setError("Ingresá un código (ej: CCC2).");
      return;
    }
    const ev = eventId.trim();
    if (!ev) {
      setError("Elegí un evento.");
      eventRef.current?.focus();
      return;
    }

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

  /* =================== ACTUALIZADO: POST /bartender/cart/confirm =================== */
  async function confirmCart() {
    setConfirmMsg(null);
    setConfirmErr(null);
    setLastTicketId(null);
    setLastPrintFormat(null);

    if (!hasRole(["bartender", "admin"])) {
      setConfirmErr("No autorizado: requiere rol bartender o admin.");
      return;
    }
    if (!summary || !summary.items?.length) {
      setConfirmErr("El carrito está vacío.");
      return;
    }
    const bar = barId.trim();
    if (!bar) {
      setConfirmErr("Elegí una barra.");
      barRef.current?.focus();
      return;
    }

    const body: ConfirmBody = {
      barId: bar,
      customerName: customerName.trim() || undefined,
      paymentMethod: paymentMethod || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      setConfirming(true);
      const token = getToken();
      const { data } = await api.post<ConfirmResponse>("/bartender/cart/confirm", body, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        validateStatus: (s) => s >= 200 && s < 300,
      });

      setConfirmMsg(data.message || "Ticket generado exitosamente.");
      setLastTicketId(data.ticketId || null);
      setLastPrintFormat(data.printFormat || null);

      // el backend limpia el carrito; reflejamos en UI
      setSummary(null);
      setProductInfo(null);

      if (data.printFormat) {
        try {
          printFromFormat(data.printFormat);
        } catch {
          // no bloquear si la impresión falla
        }
      }
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 400) setConfirmErr(e?.response?.data?.message || "Carrito vacío o stock insuficiente");
      else if (sc === 401 || sc === 403) setConfirmErr("No autorizado para confirmar el carrito.");
      else setConfirmErr(e?.response?.data?.message || "Error al confirmar el carrito");
    } finally {
      setConfirming(false);
    }
  }
  /* ============================================================================= */

  // DELETE /bartender/cart (opcional)
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
        validateStatus: (s) => s >= 200 && s < 300,
      });

      setSummary(null);
      setProductInfo(null);
      setClearMsg(data?.message || "Carrito vaciado.");
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
    <Guard roles={["bartender", "admin"]}>
      <Navbar />
      <main style={{ padding: 20, display: "grid", gap: 12, maxWidth: 1000, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ marginRight: "auto" }}>Carrito (Bartender)</h1>

          <button className={btn.secondary} onClick={loadCart} disabled={loadingCart}>
            {loadingCart ? "Cargando carrito…" : summary ? "Refrescar carrito" : "Cargar carrito actual"}
          </button>
        </header>

        {cartMeta && (
          <section
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              borderRadius: 12,
              padding: 12,
              display: "grid",
              gap: 8,
            }}
          >
            <strong style={{ fontSize: 16 }}>Carrito actual</strong>
            {cartErr && (
              <div style={{ border: "1px solid #fecaca", background: "#fee2e2", color: "#7f1d1d", padding: 10, borderRadius: 10 }}>
                {cartErr}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Card title="Cart ID" value={cartMeta.id || "—"} />
              <Card title="Bartender" value={cartMeta.bartenderName || cartMeta.bartenderId || "—"} />
              <Card title="Evento" value={cartMeta.eventId || "—"} />
              <Card title="Creado" value={formatDate(cartMeta.createdAt)} />
              <Card title="Actualizado" value={formatDate(cartMeta.updatedAt)} />
            </div>
          </section>
        )}

        {/* Entrada de datos base */}
        <section style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
          {/* ===== Evento (select) ===== */}
          <div style={{ display: "grid", gap: 6 }}>
            <label>Evento (eventId)</label>
            <select
              ref={eventRef}
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              disabled={loadingEvents}
            >
              <option value="">{loadingEvents ? "Cargando eventos…" : "Seleccioná un evento"}</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                  {ev.date ? ` — ${ev.date}` : ""}
                </option>
              ))}
            </select>
            {eventsErr && <small style={{ color: "#b91c1c" }}>{eventsErr}</small>}
            <small style={{ color: "#6b7280" }}>Este ID asocia el carrito al evento en curso.</small>
          </div>

          {/* ===== Barra (select) ===== */}
          <div style={{ display: "grid", gap: 6 }}>
            <label>
              Barra (barId) <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              ref={barRef}
              value={barId}
              onChange={(e) => setBarId(e.target.value)}
              disabled={!eventId || loadingBars}
              required
            >
              {!eventId && <option value="">Elegí un evento primero…</option>}
              {eventId && <option value="">{loadingBars ? "Cargando barras…" : "Seleccioná una barra"}</option>}
              {bars.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {barsErr && <small style={{ color: "#b91c1c" }}>{barsErr}</small>}
            <small style={{ color: "#6b7280" }}>Obligatorio para confirmar el carrito.</small>
          </div>

          {/* Entrada bartender */}
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 6 }}>
            <label>Entrada del bartender</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                ref={inputRef}
                placeholder="Ej: CCC2 (2x Coca Cola 500ml)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void sendInput();
                  }
                }}
                style={{ flex: 1, minWidth: 260 }}
              />
              <button className={btn.primary} type="submit" disabled={sending}>
                {sending ? "Procesando…" : "Agregar"}
              </button>
            </div>

            {lastMsg && !error && (
              <div style={{ border: "1px solid #bbf7d0", background: "#ecfdf5", color: "#065f46", padding: 10, borderRadius: 10 }}>
                {lastMsg}
              </div>
            )}
            {error && (
              <div style={{ border: "1px solid #fecaca", background: "#fee2e2", color: "#7f1d1d", padding: 10, borderRadius: 10 }}>
                {error}
              </div>
            )}
          </form>
        </section>

        {/* Último producto reconocido */}
        {productInfo && (
          <section style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
            <strong style={{ fontSize: 16 }}>Último ítem agregado</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <Card title="Items" value={summary.totalItems} />
                <Card title="Cantidad total" value={summary.totalQuantity} />
                <Card title="Subtotal" value={money(summary.subtotal)} />
                <Card title="Impuesto" value={money(summary.tax)} />
                <Card title="Total" value={money(summary.total)} />
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                    {summary.items?.length ? (
                      summary.items.map((it, i) => (
                        <tr key={`${it.productId}-${i}`}>
                          <Td>{it.productName}</Td>
                          <Td>
                            <code>{it.productCode}</code>
                          </Td>
                          <Td style={{ textAlign: "right" }}>{money(it.price)}</Td>
                          <Td style={{ textAlign: "right" }}>{it.quantity}</Td>
                          <Td style={{ textAlign: "right" }}>{money(it.total)}</Td>
                          <Td>{it.unit || "—"}</Td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <Td colSpan={6}>Carrito vacío.</Td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Confirmación */}
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <h4 style={{ margin: 0 }}>Confirmar y generar ticket</h4>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <label>Cliente (opcional)</label>
                    <input placeholder="Maria Gonzalez" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <label>Método de pago</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as ConfirmBody["paymentMethod"])}>
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="mixed">Mixto</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <label>Notas (opcional)</label>
                  <textarea rows={2} placeholder="sin hielo" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>

                {confirmMsg && !confirmErr && (
                  <div style={{ border: "1px solid #bbf7d0", background: "#ecfdf5", color: "#065f46", padding: 10, borderRadius: 10 }}>
                    {confirmMsg}
                    {lastTicketId && (
                      <div style={{ marginTop: 6 }}>
                        Ticket ID:{" "}
                        <Link href={`/tickets/${lastTicketId}`} style={{ textDecoration: "underline" }}>
                          {lastTicketId}
                        </Link>
                      </div>
                    )}
                  </div>
                )}
                {confirmErr && (
                  <div style={{ border: "1px solid #fecaca", background: "#fee2e2", color: "#7f1d1d", padding: 10, borderRadius: 10 }}>
                    {confirmErr}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className={btn.primary} onClick={confirmCart} disabled={confirming || !summary.items?.length} title="Confirmar carrito y generar ticket">
                    {confirming ? "Generando…" : "Confirmar carrito"}
                  </button>

                  <button
                    className={btn.secondary}
                    onClick={() => {
                      setCustomerName("");
                      setNotes("");
                      setPaymentMethod("cash");
                    }}
                    disabled={confirming}
                    title="Limpiar campos de confirmación"
                  >
                    Limpiar
                  </button>

                  <button
                    className={btn.secondary}
                    onClick={clearCart}
                    disabled={clearing || !summary.items?.length}
                    title="Vaciar todo el carrito"
                    style={{ borderColor: "#ef4444", color: "#ef4444" }}
                  >
                    {clearing ? "Vaciando…" : "Vaciar carrito"}
                  </button>

                  {/* Reimprimir último ticket usando printFormat */}
                  <button
                    className={btn.secondary}
                    onClick={() => {
                      if (lastPrintFormat) printFromFormat(lastPrintFormat);
                    }}
                    disabled={!lastPrintFormat}
                    title="Reimprimir último ticket"
                  >
                    Reimprimir último ticket
                  </button>
                </div>

                {clearMsg && !clearErr && (
                  <div style={{ border: "1px solid #bbf7d0", background: "#ecfdf5", color: "#065f46", padding: 10, borderRadius: 10, marginTop: 8 }}>
                    {clearMsg}
                  </div>
                )}
                {clearErr && (
                  <div style={{ border: "1px solid #fecaca", background: "#fee2e2", color: "#7f1d1d", padding: 10, borderRadius: 10, marginTop: 8 }}>
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
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, display: "grid", gap: 6 }}>
      <span style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 22, fontWeight: 800 }}>{value ?? "—"}</span>
    </div>
  );
}

const Th: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = (props) => (
  <th {...props} style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, ...(props.style || {}) }} />
);
const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = (props) => (
  <td {...props} style={{ padding: "8px 10px", borderBottom: "1px solid #f3f4f6", ...(props.style || {}) }} />
);

/* 💰 Formateo de moneda con soporte de currency */
function money(n?: number, currency?: string) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  const cur = currency || "ARS";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${cur} ${n}`;
  }
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return String(iso);
  }
}

/* ======================= PRINT DESDE printFormat (58mm, sin popups) ======================= */
/* ======================= PRINT DESDE printFormat (58mm, estilo similar al screenshot) ======================= */
/* ======================= PRINT DESDE printFormat (58mm, estilo similar al screenshot) ======================= */
/* ======================= PRINT DESDE printFormat (layout monoespaciado tipo térmica) ======================= */
function printFromFormat(fmt: PrintFormat) {
  const paper = fmt.printerSettings?.paperWidth || 58; // 58 u 80
  const fontSize = fmt.printerSettings?.fontSize || 12;
  const fontFamily =
    fmt.printerSettings?.fontFamily ||
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  const currency = fmt.totals?.currency || fmt.ticket?.currency || "ARS";

  // columnas típicas (58mm ≈ 32, 80mm ≈ 48). Si usan letra muy chica en 58mm, podés subir a 42.
  const COLS =
    paper >= 80 ? 48 : fontSize <= 10 ? 42 : 32;

  // 2 decimales siempre en el papel
  const money2 = (n?: number) => {
    if (typeof n !== "number" || Number.isNaN(n)) return "—";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `${currency} ${n.toFixed(2)}`;
    }
  };

  // IVA: si no hay rate por item, lo infiero con subtotal/tax
  const ivaRate =
    Number.isFinite((fmt.items?.[0] as any)?.taxRate)
      ? Math.max(0, Number((fmt.items![0] as any).taxRate))
      : (fmt.totals?.subtotal || 0) > 0
      ? Math.round(((fmt.totals?.tax || 0) * 100) / (fmt.totals!.subtotal))
      : 0;

  const title = (fmt.header?.businessName || "GROOVE BAR SYSTEM").toUpperCase();
  const addr  = fmt.header?.businessAddress || "";
  const phone = fmt.header?.businessPhone || "";
  const taxId = fmt.header?.businessTaxId || "";
  const email = fmt.header?.businessEmail || "";

  const customerName =
    (fmt as any)?.ticket?.customerName || (fmt as any)?.customerName || "";

  // helpers de alineación en columnas
  const line = (ch = "-") => ch.repeat(COLS);
  const clamp = (s: string) => (s.length > COLS ? s.slice(0, COLS) : s);
  const center = (s: string) => {
    s = s.slice(0, COLS);
    const pad = Math.max(0, Math.floor((COLS - s.length) / 2));
    return " ".repeat(pad) + s + " ".repeat(Math.max(0, COLS - pad - s.length));
    };
  const kv = (left: string, right: string) => {
    left = left || "";
    right = right || "";
    const maxLeft = Math.max(0, COLS - right.length);
    const L = left.length > maxLeft ? left.slice(0, maxLeft) : left;
    return L + " ".repeat(Math.max(0, COLS - (L.length + right.length))) + right;
  };
  const twoCols = (a: string, b: string) => kv(a, b);

  // Renglón de item: nombre en una línea, debajo "Q x $Unit .... $SubTotal"
  const itemLines = (fmt.items || []).flatMap((it) => {
    const name = clamp(String(it.name || ""));
    const left = `${it.quantity} x ${money2(it.unitPrice)}`;
    const right = money2(it.subtotal);
    return [
      name,
      kv(left, right),
      // línea en blanco finito entre items (opcional)
    ];
  });

  // Construcción del contenido en texto plano
  const rows: string[] = [];

  rows.push(line());
  rows.push(center(title));
  rows.push(line());
  if (addr)  rows.push(clamp(addr));
  if (phone) rows.push(clamp(`Tel: ${phone}`));
  if (taxId) rows.push(clamp(`RUC: ${taxId}`));
  if (email) rows.push(clamp(`Email: ${email}`));
  rows.push(""); // espacio

  rows.push(kv("Ticket:", fmt.ticket.ticketNumber));
  rows.push(kv("Fecha:", `${fmt.ticket.date}   Hora: ${fmt.ticket.time}`));
  if (fmt.ticket.eventName) rows.push(kv("Evento:", fmt.ticket.eventName));
  if (fmt.ticket.barName)   rows.push(kv("Barra:", fmt.ticket.barName));
  rows.push(kv("Atendido por:", fmt.ticket.userName));
  rows.push("PRODUCTOS");
  rows.push(line());

  rows.push(...itemLines);

  rows.push(line());
  rows.push(twoCols("Subtotal:", money2(fmt.totals.subtotal)));
  rows.push(twoCols(`IVA (${ivaRate}%)`, money2(fmt.totals.tax)));
  rows.push(line());
  rows.push(twoCols("TOTAL:", money2(fmt.totals.total)));
  rows.push(""); // espacio

  rows.push(kv("Método de pago:", (fmt.payment.method || "").toUpperCase()));
  if (customerName) rows.push(kv("Cliente:", customerName));
  if ((fmt as any)?.notes) {
    rows.push(""); 
    rows.push(clamp(`Notas: ${(fmt as any).notes}`));
  }
  rows.push("");
  rows.push(fmt.footer?.thankYouMessage ? clamp(fmt.footer.thankYouMessage) : "¡Gracias por su compra!");
  if (fmt.footer?.businessWebsite) rows.push(clamp(fmt.footer.businessWebsite));
  if (fmt.footer?.receiptFooter)   rows.push(clamp(fmt.footer.receiptFooter));
  rows.push(line());

  const text = rows.join("\n");

  // HTML minimalista: <pre> monoespaciado (sin flex), 100% determinístico
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(fmt.ticket.ticketNumber)}</title>
<style>
  @page { size: ${paper}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0; width: ${paper}mm;
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    background:#fff;
  }
  pre {
    margin: 0; padding: 4mm 3mm;
    font-family: ${fontFamily};
    font-size: ${fontSize}px;
    line-height: 1.35;
    white-space: pre;      /* ¡clave! no wraps raros */
    color:#111;
  }
</style>
</head>
<body>
  <pre>${escapeHtml(text)}</pre>
</body>
</html>`;

  // IFRAME oculto para imprimir
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const onLoad = () => {
    try { iframe.contentWindow?.focus(); } catch {}
    try { iframe.contentWindow?.print(); } catch {}
    setTimeout(() => { try { iframe.remove(); } catch {} }, 1000);
  };

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;
  doc.open(); doc.write(html); doc.close();
  if (iframe.contentDocument?.readyState === "complete") onLoad();
  else iframe.onload = onLoad;
}
/* ============================================================================================================ */

/* ============================================================================================================ */

/* ============================================================================================================ */

/* ========================================================================================= */

function escapeHtml(s?: string | number) {
  if (s === undefined || s === null) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
