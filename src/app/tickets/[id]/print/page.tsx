// (4) TicketPrintPage - marca automáticamente como impreso tras cargar y ofrece botón manual

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import btn from "@/styles/Buttons.module.css";

type PrintItem = {
  name: string;
  quantity: number;
  price: number;
  total: number;
};

type PrintData = {
  header: string;
  date: string;            // "2024-01-01 12:00:00"
  customer?: string;       // "Cliente Test"
  items: PrintItem[];
  subtotal: number;
  tax: number;
  total: number;
};

type PrintResponse = {
  ticketId: string;        // "ticket-123"
  printData: PrintData;
  printedAt: string;       // ISO
};

export default function TicketPrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<PrintResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ➕ estado PATCH marcar como impreso
  const [marking, setMarking] = useState(false);
  const [markMsg, setMarkMsg] = useState<string | null>(null);
  const [alreadyMarked, setAlreadyMarked] = useState(false);

  useEffect(() => {
    async function fetchPrint() {
      if (!id) return;
      setLoading(true);
      setErr(null);
      try {
        const token = getToken();
        const { data } = await api.get<PrintResponse>(`/tickets/${id}/print`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        setData(data);

        // Autodispara la impresión apenas carga
        setTimeout(() => {
          try { window.print(); } catch {}
        }, 150);

        // ➕ Marca como impreso automáticamente si el rol lo permite
        if (hasRole(["admin","bartender"])) {
          await markAsPrintedSilent();
        }
      } catch (e: any) {
        const sc = e?.response?.status;
        if (sc === 403) setErr("No autorizado: requiere rol admin o bartender.");
        else if (sc === 404) setErr("Ticket no encontrado o no imprimible.");
        else setErr(e?.response?.data?.message || "Error al preparar la impresión");
      } finally {
        setLoading(false);
      }
    }
    fetchPrint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const pd = data?.printData;

  const totals = useMemo(() => {
    if (!pd) return null;
    return {
      subtotal: pd.subtotal,
      tax: pd.tax,
      total: pd.total,
    };
  }, [pd]);

  // ➕ función para marcar como impreso (manual y silenciosa)
  async function markAsPrintedSilent() {
    if (alreadyMarked || !id) return;
    try {
      setAlreadyMarked(true); // evita dobles llamados
      setMarking(true);
      const token = getToken();
      const res = await api.patch<{ id: string; printed: boolean; printedAt: string }>(
        `/tickets/${id}/print`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      setMarkMsg("Ticket marcado como impreso.");
      // No necesitamos almacenar nada extra aquí; la vista detalle lo mostrará.
      return res.data;
    } catch (e: any) {
      // No rompemos el flujo de impresión por error de marcado
      setMarkMsg(e?.response?.data?.message || "No se pudo marcar como impreso.");
    } finally {
      setMarking(false);
    }
  }

  async function markAsPrintedManual() {
    setMarkMsg(null);
    setAlreadyMarked(false);
    await markAsPrintedSilent();
  }

  return (
    <Guard roles={["admin","bartender"]}>
      <Navbar />
      <main style={{ padding: 20, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className={btn.secondary} onClick={() => router.back()} type="button">← Volver</button>
          <h1 style={{ margin: 0 }}>Imprimir ticket</h1>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className={btn.secondary} type="button" onClick={() => window.print()} disabled={loading || !!err}>
              Abrir diálogo de impresión
            </button>
            {/* ➕ botón manual para marcar como impreso */}
            <button
              className={btn.secondary}
              type="button"
              onClick={markAsPrintedManual}
              disabled={loading || !!err || marking}
              title="Marcar ticket como impreso"
              style={{ borderColor: "#10b981", color: "#10b981" }}
            >
              {marking ? "Marcando…" : "Marcar impreso"}
            </button>
          </div>
        </div>

        {loading && <p style={{ color:"#6b7280" }}>Preparando impresión…</p>}
        {err && <p style={{ color:"#b91c1c" }}>{err}</p>}
        {markMsg && !err && <p style={{ marginTop: -6, color:"#065f46" }}>{markMsg}</p>}

        {!loading && !err && pd && (
          <>
            {/* Vista previa tipo ticket (ancho reducido) */}
            <div
              id="ticket"
              style={{
                width: 320,
                background: "#fff",
                border: "1px dashed #d1d5db",
                borderRadius: 8,
                padding: 12,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>{pd.header || "GROOVE BAR"}</div>
                <div style={{ fontSize: 12 }}>{pd.date}</div>
                {pd.customer && <div style={{ fontSize: 12, marginTop: 2 }}>Cliente: {pd.customer}</div>}
                {data?.ticketId && <div style={{ fontSize: 11, marginTop: 2, opacity:.8 }}>Ticket: {data.ticketId}</div>}
              </div>

              <hr style={{ border: "none", borderTop: "1px dashed #d1d5db", margin: "8px 0" }} />

              <div>
                {pd.items?.length ? pd.items.map((it, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", fontSize: 12, marginBottom: 4 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{it.name}</div>
                      <div style={{ opacity: .8 }}>
                        {it.quantity} x {money(it.price)} = {money(it.total)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontWeight: 700 }}>{money(it.total)}</div>
                  </div>
                )) : (
                  <div style={{ fontSize: 12 }}>Sin ítems.</div>
                )}
              </div>

              <hr style={{ border: "none", borderTop: "1px dashed #d1d5db", margin: "8px 0" }} />

              <div style={{ fontSize: 12, display: "grid", gap: 2 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto" }}>
                  <span>Subtotal</span><strong>{money(totals?.subtotal)}</strong>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto" }}>
                  <span>Impuesto</span><strong>{money(totals?.tax)}</strong>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", fontSize: 14 }}>
                  <span style={{ fontWeight: 800 }}>TOTAL</span><strong style={{ fontWeight: 900 }}>{money(totals?.total)}</strong>
                </div>
              </div>

              <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, opacity: .8 }}>
                {data?.printedAt ? `Emitido: ${formatDate(data.printedAt)}` : ""}
              </div>
            </div>

            <p style={{ fontSize: 12, color:"#6b7280" }}>
              * Esta vista está optimizada para impresoras térmicas de ~80mm. Usa “Imprimir” y selecciona tu impresora.
            </p>
          </>
        )}
      </main>

      {/* Estilos de impresión: sólo el ticket */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #ticket, #ticket * { visibility: visible; }
          #ticket {
            position: absolute; left: 0; top: 0; right: 0; margin: 0 auto;
          }
        }
      `}</style>
    </Guard>
  );
}

function money(n?: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  } catch { return `$${n}`; }
}
function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`;
  } catch { return String(iso); }
}
