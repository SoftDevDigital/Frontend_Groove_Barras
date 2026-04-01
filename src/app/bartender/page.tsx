"use client";

import { useEffect, useRef, useState } from "react";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import styles from "./bartender.module.css";
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
  id?: string;
  bartenderId?: string;
  bartenderName?: string;
  eventId?: string;
  createdAt?: string;
  updatedAt?: string;
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
  tax?: number;
  totalTax?: number;
  total: number;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
};

type DeleteItemResponse = {
  success: boolean;
  message: string;
  cartSummary: CartSummary;
};

type EventOption = { id: string; name: string; date?: string };
type BarOption = { id: string; name: string; eventId?: string };

type PrintItem = {
  id?: string;
  productId?: string;
  productName?: string;
  name?: string;
  quantity: number;
  unitPrice?: number;
  price?: number;
  subtotal?: number;
  tax?: number;
  total: number;
};

type TicketPrintFormat = {
  id: string;
  userId?: string;
  userName?: string;
  barId?: string;
  barName?: string;
  eventId?: string;
  eventName?: string;
  status?: string;
  paymentMethod?: string;
  subtotal?: number;
  totalTax?: number;
  total?: number;
  notes?: string;
  printed?: boolean;
  createdAt?: string;
  updatedAt?: string;
  items: PrintItem[];
};

function getErrorText(err: any, fallback = "Ocurrió un error"): string {
  const raw = err?.response?.data;

  if (typeof raw?.message === "string") return raw.message;

  if (raw?.message && typeof raw.message === "object") {
    const innerMsg =
      typeof raw.message.message === "string" ? raw.message.message : fallback;
    const errorId =
      typeof raw.message.errorId === "string" ? raw.message.errorId : null;

    return errorId ? `${innerMsg} (${errorId})` : innerMsg;
  }

  if (typeof raw?.error === "string") return raw.error;
  if (typeof err?.message === "string") return err.message;

  return fallback;
}

function moneyPrint(n?: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "$ 0";
  return `$ ${Number(n).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDatePrint(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function escapeHtml(value?: string | number) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type BackendPrintPayload = {
  header?: {
    businessName?: string;
    businessAddress?: string;
    businessPhone?: string;
    businessTaxId?: string;
  };
  ticketInfo?: {
    id?: string;
    date?: string;
    userName?: string;
    barName?: string;
    eventName?: string;
    paymentMethod?: string;
  };
  items?: Array<{
    id?: string;
    productId?: string;
    productName?: string;
    name?: string;
    quantity?: number;
    unitPrice?: number;
    price?: number;
    subtotal?: number;
    tax?: number;
    total?: number;
  }>;
  totals?: {
    subtotal?: number;
    tax?: number;
    total?: number;
  };
  footer?: {
    message?: string;
    footer?: string;
  };
};

function normalizeTicketForPrint(raw: any): TicketPrintFormat {
  // Si ya viene en formato plano, lo dejamos como está
  if (raw && Array.isArray(raw.items) && ("barName" in raw || "createdAt" in raw || "total" in raw)) {
    return {
      id: raw.id ?? "",
      userId: raw.userId,
      userName: raw.userName,
      barId: raw.barId,
      barName: raw.barName || "Festgo-Bar",
      eventId: raw.eventId,
      eventName: raw.eventName,
      status: raw.status,
      paymentMethod: raw.paymentMethod,
      subtotal: Number(raw.subtotal ?? 0),
      totalTax: Number(raw.totalTax ?? raw.tax ?? 0),
      total: Number(raw.total ?? 0),
      notes: raw.notes,
      printed: raw.printed,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      items: (raw.items || []).map((it: any) => ({
        id: it.id,
        productId: it.productId,
        productName: it.productName || it.name,
        name: it.name,
        quantity: Number(it.quantity ?? 0),
        unitPrice:
          typeof it.unitPrice === "number"
            ? Number(it.unitPrice)
            : typeof it.price === "number"
            ? Number(it.price)
            : undefined,
        price:
          typeof it.price === "number"
            ? Number(it.price)
            : typeof it.unitPrice === "number"
            ? Number(it.unitPrice)
            : undefined,
        subtotal: typeof it.subtotal === "number" ? Number(it.subtotal) : undefined,
        tax: typeof it.tax === "number" ? Number(it.tax) : undefined,
        total: Number(it.total ?? 0),
      })),
    };
  }

  // Si viene en formato anidado del backend
  const data = raw as BackendPrintPayload;

  return {
    id: data.ticketInfo?.id || "",
    userName: data.ticketInfo?.userName || "",
    barName: data.ticketInfo?.barName || "Festgo-Bar",
    eventName: data.ticketInfo?.eventName || data.header?.businessName || "",
    paymentMethod: data.ticketInfo?.paymentMethod || "",
    subtotal: Number(data.totals?.subtotal ?? 0),
    totalTax: Number(data.totals?.tax ?? 0),
    total: Number(data.totals?.total ?? 0),
    createdAt: data.ticketInfo?.date,
    notes: data.footer?.message,
    items: (data.items || []).map((it) => {
      const unit =
        typeof it.unitPrice === "number"
          ? it.unitPrice
          : typeof it.price === "number"
          ? it.price
          : 0;

      return {
        id: it.id,
        productId: it.productId,
        productName: it.productName || it.name || "Producto",
        name: it.name,
        quantity: Number(it.quantity ?? 0),
        unitPrice: Number(unit),
        price: Number(unit),
        subtotal: typeof it.subtotal === "number" ? Number(it.subtotal) : undefined,
        tax: typeof it.tax === "number" ? Number(it.tax) : undefined,
        total: Number(it.total ?? 0),
      };
    }),
  };
}

function buildTicketPrintHtml(rawData: any) {
  const data = normalizeTicketForPrint(rawData);

  const businessName = "Festgo-Barra";
  const subtotal = Number(data.subtotal ?? 0);
  const total = Number(data.total ?? 0);

  const paymentLabels: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
    administrator: "Administrador",
    dj: "DJ",
  };

  const paymentText = data.paymentMethod
    ? paymentLabels[String(data.paymentMethod).toLowerCase()] || String(data.paymentMethod)
    : "";

  const itemsText = (data.items || [])
    .map((it) => {
      const itemName = it.productName || it.name || "Producto";
      return [
        itemName,
        `Cantidad: ${it.quantity}`,
      ].join("\n");
    })
    .join("\n\n");

  const ticketText = [
    "¡Gracias por su compra!",
    businessName,
    "",
    formatDatePrint(data.createdAt),
    data.eventName ? `Evento: ${data.eventName}` : "",
    data.userName ? `Usuario: ${data.userName}` : "",
    paymentText ? `Pago: ${paymentText}` : "",
    "------------------------",
    itemsText || "Sin ítems",
    "------------------------",
    `TOTAL: ${moneyPrint(subtotal)}`,
    `TOTAL: ${moneyPrint(total)}`,
    "",
    "",
    "",
    "",
    "",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Ticket</title>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            font-family: "Courier New", Courier, monospace;
          }

          body {
            font-size: 13px;
          }

          .ticket {
            width: 72mm;
            padding: 4mm 3mm 12mm 3mm;
            box-sizing: border-box;
          }

          pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-word;
            line-height: 1.35;
            font-family: "Courier New", Courier, monospace;
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <pre>${escapeHtml(ticketText)}</pre>
        </div>
      </body>
    </html>
  `;
}

function printTicketInline(rawData: any) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(buildTicketPrintHtml(rawData));
  doc.close();

  const triggerPrint = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          iframe.remove();
        }, 2000);
      }
    }, 700);
  };

  if (doc.readyState === "complete") {
    triggerPrint();
  } else {
    iframe.onload = triggerPrint;
  }
}

export default function BartenderCartPage() {
  const [eventId, setEventId] = useState<string>("");
  const [barId, setBarId] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [sending, setSending] = useState(false);

  const [lastMsg, setLastMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [productInfo, setProductInfo] = useState<InputResponse["product"] | null>(null);
  const [summary, setSummary] = useState<CartSummary | null>(null);

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

  const [customerName, setCustomerName] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer" | "administrator" | "dj">("cash");
  const [notes, setNotes] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);
  const [lastTicketId, setLastTicketId] = useState<string | null>(null);

  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const [clearErr, setClearErr] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [delMsg, setDelMsg] = useState<string | null>(null);
  const [delErr, setDelErr] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const eventRef = useRef<HTMLSelectElement>(null);
  const barRef = useRef<HTMLSelectElement>(null);

  const [events, setEvents] = useState<EventOption[]>([]);
  const [bars, setBars] = useState<BarOption[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingBars, setLoadingBars] = useState(false);
  const [eventsErr, setEventsErr] = useState<string | null>(null);
  const [barsErr, setBarsErr] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  function normalizeEvents(data: any): EventOption[] {
    const arr = Array.isArray(data) ? data : data?.items || data?.data || [];
    return (arr || [])
      .map((e: any) => ({
        id: e?._id ?? e?.id ?? e?.eventId ?? e?.uuid ?? "",
        name: e?.name ?? e?.title ?? e?.eventName ?? "(sin nombre)",
        date: e?.date ?? e?.startDate ?? e?.fecha,
      }))
      .filter((e: EventOption) => e.id);
  }

  function normalizeBars(data: any): BarOption[] {
    const arr = Array.isArray(data) ? data : data?.items || data?.data || [];
    return (arr || [])
      .map((b: any) => ({
        id: b?._id ?? b?.id ?? b?.barId ?? b?.uuid ?? "",
        name: b?.name ?? b?.barName ?? "(sin nombre)",
        eventId: b?.eventId ?? b?.event?._id ?? b?.event?.id,
      }))
      .filter((b: BarOption) => b.id);
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

      if (eventId && !list.some((e) => e.id === eventId)) {
        setEventId("");
      }
    } catch (err: any) {
      setEventsErr(getErrorText(err, "No se pudieron cargar los eventos."));
    } finally {
      setLoadingEvents(false);
    }
  }

  async function fetchBarsByEvent(evId: string) {
    setBarsErr(null);
    setLoadingBars(true);
    try {
      const token = getToken();
      let res = await api.get(`/bars?eventId=${encodeURIComponent(evId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        validateStatus: () => true,
      });

      if (res.status >= 400) {
        res = await api.get(`/events/${encodeURIComponent(evId)}/bars`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      }

      const list = normalizeBars(res.data);
      setBars(list);

      if (barId && !list.some((b) => b.id === barId)) {
        setBarId("");
      }
    } catch (err: any) {
      setBarsErr(getErrorText(err, "No se pudieron cargar las barras del evento."));
      setBars([]);
      setBarId("");
    } finally {
      setLoadingBars(false);
    }
  }

  useEffect(() => {
    void fetchEvents();
  }, []);

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
      else setCartErr(getErrorText(e, "Error al obtener el carrito actual"));
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
        }
      );

      setProductInfo(data.product);
      setSummary(data.cartSummary);
      setLastMsg(data.message || "Agregado al carrito.");
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 400) setError(getErrorText(e, "Formato inválido o stock insuficiente"));
      else if (sc === 404) setError(getErrorText(e, "Producto no encontrado"));
      else setError(getErrorText(e, "Error al procesar la entrada"));
    } finally {
      setSending(false);
    }
  }

  async function confirmCart() {
    setConfirmMsg(null);
    setConfirmErr(null);
    setLastTicketId(null);

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

    try {
      setConfirming(true);
      const token = getToken();

      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const createBody = {
        barId: bar,
        customerName: customerName.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const { data: createdTicket } = await api.post<TicketDTO>("/tickets", createBody, {
        headers,
      });

      const ticketId = createdTicket?.id;
      if (!ticketId) {
        throw new Error("No se pudo obtener el id del ticket creado.");
      }

      for (const it of summary.items) {
        await api.patch(
          `/tickets/${ticketId}`,
          {
            productId: it.productId,
            quantity: Number(it.quantity),
          },
          { headers }
        );
      }

      await api.patch(
        `/tickets/${ticketId}`,
        {
          paymentMethod,
          paidAmount: Number(summary.total || 0),
        },
        { headers }
      );

      const { data: printData } = await api.get(`/tickets/${ticketId}/print`, {
  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
});

setConfirmMsg("Ticket generado exitosamente.");
setLastTicketId(ticketId);

printTicketInline(printData);

      setSummary(null);
      setProductInfo(null);
      setCustomerName("");
      setNotes("");
      setPaymentMethod("cash");

      try {
        await api.delete("/bartender/cart", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      } catch {}
    } catch (e: any) {
      console.error("Error creando ticket:", e?.response?.data || e);
      setConfirmErr(getErrorText(e, "Error al crear ticket"));
    } finally {
      setConfirming(false);
    }
  }

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
      });

      setSummary(null);
      setProductInfo(null);
      setClearMsg(data?.message || "Carrito vaciado.");
      setCartMeta((m) => (m ? { ...m, updatedAt: new Date().toISOString() } : m));
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 401 || sc === 403) setClearErr("No autorizado para limpiar el carrito.");
      else setClearErr(getErrorText(e, "Error al limpiar el carrito"));
    } finally {
      setClearing(false);
    }
  }

  async function deleteCartItem(productId: string) {
    setDelMsg(null);
    setDelErr(null);

    if (!hasRole(["bartender", "admin"])) {
      setDelErr("No autorizado: requiere rol bartender o admin.");
      return;
    }

    if (!productId) {
      setDelErr("Falta productId.");
      return;
    }

    try {
      setDeleting((prev) => ({ ...prev, [productId]: true }));
      const token = getToken();
      const { data } = await api.delete<DeleteItemResponse>("/bartender/cart/item", {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        data: { productId },
      });

      setSummary(data.cartSummary);
      setDelMsg(data.message || "Ítem eliminado.");
      if (!data.cartSummary.items?.length) setProductInfo(null);
    } catch (e: any) {
      const sc = e?.response?.status;
      if (sc === 404) setDelErr(getErrorText(e, "Ítem no encontrado en el carrito."));
      else if (sc === 400) setDelErr(getErrorText(e, "Solicitud inválida."));
      else setDelErr(getErrorText(e, "Error al eliminar el ítem del carrito."));
    } finally {
      setDeleting((prev) => {
        const cp = { ...prev };
        delete cp[productId];
        return cp;
      });
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendInput();
  }

  return (
    <Guard roles={["bartender", "admin"]}>
      <Navbar />
      <main className={styles.pageContainer}>
        <header className={styles.header}>
          <h1>🛒 Carrito</h1>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={loadCart}
            disabled={loadingCart}
          >
            {loadingCart ? "Cargando..." : summary ? "Refrescar" : "Cargar Carrito"}
          </button>
        </header>

        {cartMeta && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Información del Carrito</h3>
            {cartErr && <div className={styles.alertError}>{cartErr}</div>}
            <div className={styles.statsGrid}>
              <Card title="Cart ID" value={cartMeta.id || "—"} />
              <Card title="Bartender" value={cartMeta.bartenderName || cartMeta.bartenderId || "—"} />
              <Card title="Evento" value={cartMeta.eventId || "—"} />
              <Card title="Creado" value={formatDate(cartMeta.createdAt)} />
              <Card title="Actualizado" value={formatDate(cartMeta.updatedAt)} />
            </div>
          </section>
        )}

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Configuración</h3>

          <div>
            <label className={styles.label}>Evento</label>
            <select
              ref={eventRef}
              className={styles.select}
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              disabled={loadingEvents}
            >
              <option value="">{loadingEvents ? "Cargando eventos..." : "⚡ Selecciona un evento"}</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                  {ev.date ? ` — ${ev.date}` : ""}
                </option>
              ))}
            </select>
            {eventsErr ? (
              <small className={styles.helperText} style={{ color: "var(--color-error)" }}>
                {eventsErr}
              </small>
            ) : (
              <small className={styles.helperText}>Asocia el carrito al evento en curso</small>
            )}
          </div>

          <div>
            <label className={styles.label}>
              Barra <span className={styles.required}>*</span>
            </label>
            <select
              ref={barRef}
              className={styles.select}
              value={barId}
              onChange={(e) => setBarId(e.target.value)}
              disabled={!eventId || loadingBars}
              required
            >
              {!eventId && <option value="">🔒 Elige un evento primero</option>}
              {eventId && <option value="">{loadingBars ? "Cargando barras..." : "🍺 Selecciona una barra"}</option>}
              {bars.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {barsErr ? (
              <small className={styles.helperText} style={{ color: "var(--color-error)" }}>
                {barsErr}
              </small>
            ) : (
              <small className={styles.helperText}>Obligatorio para confirmar el carrito</small>
            )}
          </div>

          <form onSubmit={onSubmit}>
            <label className={styles.label}>Entrada del Bartender</label>
            <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
              <input
                ref={inputRef}
                className={styles.input}
                placeholder="Ej: CCC2 (2x Coca Cola 500ml)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void sendInput();
                  }
                }}
                style={{ flex: 1 }}
              />
              <button className={styles.primaryButton} type="submit" disabled={sending}>
                {sending ? "⏳ Procesando" : "➕ Agregar"}
              </button>
            </div>

            {lastMsg && !error && (
              <div className={styles.alertSuccess} style={{ marginTop: "1rem" }}>
                ✓ {lastMsg}
              </div>
            )}
            {error && (
              <div className={styles.alertError} style={{ marginTop: "1rem" }}>
                ✗ {error}
              </div>
            )}
          </form>
        </section>

        {productInfo && (
          <section className={styles.productItem}>
            <h3 className={styles.sectionTitle}>✨ Último Ítem Agregado</h3>
            <div className={styles.productGrid}>
              <Card title="Producto" value={productInfo.name} />
              <Card title="Código" value={productInfo.code} />
              <Card title="Precio" value={money(productInfo.price)} />
              <Card title="Cantidad" value={productInfo.quantity} />
              <Card title="Total" value={money(productInfo.total)} />
            </div>
          </section>
        )}

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>🛍️ Productos en el Carrito</h3>

          {delMsg && !delErr && (
            <div style={{ border: "1px solid #bbf7d0", background: "#ecfdf5", color: "#065f46", padding: 10, borderRadius: 10 }}>
              {delMsg}
            </div>
          )}
          {delErr && (
            <div style={{ border: "1px solid #fecaca", background: "#fee2e2", color: "#7f1d1d", padding: 10, borderRadius: 10 }}>
              {delErr}
            </div>
          )}

          {!summary ? (
            <p className={styles.helperText} style={{ textAlign: "center", padding: "2rem" }}>
              El carrito está vacío. ¡Empieza a agregar productos!
            </p>
          ) : (
            <>
              <div className={styles.statsGrid}>
                <Card title="Items" value={summary.totalItems} />
                <Card title="Cantidad total" value={summary.totalQuantity} />
                <Card title="Subtotal" value={money(summary.subtotal)} />
                <Card title="Impuesto" value={money(summary.tax)} />
                <Card title="Total" value={money(summary.total)} />
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className={styles.cartTable}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Código</th>
                      <th style={{ textAlign: "right" }}>Precio</th>
                      <th style={{ textAlign: "right" }}>Cant.</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th>Unidad</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.items?.length ? (
                      summary.items.map((it, i) => (
                        <tr key={`${it.productId}-${i}`}>
                          <td className={styles.productName}>{it.productName}</td>
                          <td>
                            <span className={styles.productCode}>{it.productCode}</span>
                          </td>
                          <td className={styles.priceCell} style={{ textAlign: "right" }}>
                            {money(it.price)}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>{it.quantity}</td>
                          <td className={styles.priceCell} style={{ textAlign: "right" }}>
                            {money(it.total)}
                          </td>
                          <td>{it.unit || "—"}</td>
                          <td>
                            <button
                              type="button"
                              className={`${styles.secondaryButton} ${styles.dangerButton}`}
                              onClick={() => deleteCartItem(it.productId)}
                              disabled={!!deleting[it.productId]}
                              title="Eliminar este producto del carrito"
                              style={{ padding: "6px 10px", fontSize: 12 }}
                            >
                              {deleting[it.productId] ? "Eliminando…" : "Eliminar"}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                          Carrito vacío
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: "2rem" }}>
                <h4 className={styles.sectionTitle}>💳 Confirmar y Generar Ticket</h4>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  <div>
                    <label className={styles.label}>Cliente (opcional)</label>
                    <input
                      className={styles.input}
                      placeholder="María González"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={styles.label}>Método de Pago</label>
                    <select
  className={styles.select}
  value={paymentMethod}
  onChange={(e) =>
    setPaymentMethod(
      e.target.value as "cash" | "card" | "transfer" | "administrator" | "dj"
    )
  }
>
  <option value="cash">💵 Efectivo</option>
  <option value="transfer">🏦 Transferencia</option>
  <option value="dj">🎧 DJ</option>
  <option value="administrator">📌 Administrador</option>
</select>
                  </div>
                </div>

                <div style={{ marginTop: "1rem" }}>
                  <label className={styles.label}>Notas (opcional)</label>
                  <input
                    className={styles.input}
                    placeholder="sin hielo"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {confirmMsg && !confirmErr && (
                  <div className={styles.alertSuccess} style={{ marginTop: "1rem" }}>
                    ✓ {confirmMsg}
                    {lastTicketId && (
                      <div style={{ marginTop: 8 }}>
                        Ticket ID:{" "}
                        <Link href={`/tickets/${lastTicketId}`} style={{ textDecoration: "underline", fontWeight: 700 }}>
                          {lastTicketId}
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {confirmErr && (
                  <div className={styles.alertError} style={{ marginTop: "1rem" }}>
                    ✗ {confirmErr}
                  </div>
                )}

                <div className={styles.buttonGroup}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={confirmCart}
                    disabled={confirming || !summary.items?.length}
                    title="Confirmar carrito y generar ticket"
                  >
                    {confirming ? "⏳ Generando..." : "✅ Confirmar Carrito"}
                  </button>

                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setCustomerName("");
                      setNotes("");
                      setPaymentMethod("cash");
                    }}
                    disabled={confirming}
                    title="Limpiar campos de confirmación"
                  >
                    🔄 Limpiar
                  </button>

                  <button
                    type="button"
                    className={`${styles.secondaryButton} ${styles.dangerButton}`}
                    onClick={clearCart}
                    disabled={clearing || !summary.items?.length}
                    title="Vaciar todo el carrito"
                  >
                    {clearing ? "⏳ Vaciando..." : "🗑️ Vaciar Carrito"}
                  </button>

                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={async () => {
                      if (!lastTicketId) return;
                      try {
                        const token = getToken();
                        const { data } = await api.get<TicketPrintFormat>(`/tickets/${lastTicketId}/print`, {
                          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                        });
                        printTicketInline(data);
                      } catch (e: any) {
                        setConfirmErr(getErrorText(e, "No se pudo reimprimir el ticket"));
                      }
                    }}
                    disabled={!lastTicketId}
                    title="Reimprimir último ticket"
                  >
                    🖨️ Reimprimir
                  </button>
                </div>

                {clearMsg && !clearErr && (
                  <div className={styles.alertSuccess} style={{ marginTop: "1rem" }}>
                    ✓ {clearMsg}
                  </div>
                )}
                {clearErr && (
                  <div className={styles.alertError} style={{ marginTop: "1rem" }}>
                    ✗ {clearErr}
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

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statLabel}>{title}</span>
      <span className={styles.statValue}>{value ?? "—"}</span>
    </div>
  );
}

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