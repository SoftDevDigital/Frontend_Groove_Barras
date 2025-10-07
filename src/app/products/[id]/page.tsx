"use client";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useParams } from "next/navigation";
import form from "@/styles/Forms.module.css";
import btn from "@/styles/Buttons.module.css";
// ⬇️ antes: import { hasRole } from "@/lib/auth";
import { hasRole, getToken } from "@/lib/auth";

// ⬇️ expandí el tipo para reflejar el contrato del backend (sin quitar tus campos)
type P = {
  id: string;
  name: string;
  price: number;
  stock?: number;
  quickKey?: string;

  // del contrato GET /products/:id
  description?: string;
  code?: string;
  unit?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<P | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // ⬇️ agregados
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false); // PATCH /products/:id (name/price)
  const [err, setErr] = useState<string | null>(null);

  // ⬇️ NUEVO: estados para actualizar stock
  const [stockAmount, setStockAmount] = useState<number | string>("");
  const [stockSaving, setStockSaving] = useState(false);
  const [stockErr, setStockErr] = useState<string | null>(null);
  const [stockMsg, setStockMsg] = useState<string | null>(null);

  // 🔒 Helper para normalizar respuestas { data: {...} } o directas {...}
  function unwrap<T = any>(responseData: any): T {
    if (responseData && typeof responseData === "object" && "data" in responseData) {
      return responseData.data as T;
    }
    return responseData as T;
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const token = getToken();
      const { data } = await api.get(`/products/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setP(unwrap<P>(data));
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) setErr("Producto no encontrado.");
      else if (status === 403) setErr("No autorizado: requiere rol admin o bartender.");
      else setErr(e?.response?.data?.message || "Error al cargar el producto");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 👇 helper para armar el body permitido por el contrato PATCH /products/:id
  function buildPatchBody(current: P | null) {
    const body: Partial<Pick<P, "name" | "price">> = {};
    if (!current) return body;
    if (typeof current.name === "string" && current.name.trim()) body.name = current.name.trim();
    if (typeof current.price === "number" && !Number.isNaN(current.price)) body.price = current.price;
    return body;
  }

  async function save() {
    setMsg(null);
    setErr(null);

    try {
      if (!hasRole(["admin"])) {
        setMsg("Solo admin puede editar");
        return;
      }
      if (!p) return;

      const payload = buildPatchBody(p);
      if (!("name" in payload) && !("price" in payload)) {
        setMsg("No hay cambios para guardar.");
        return;
      }

      setSaving(true);
      const token = getToken();
      const { data } = await api.patch<P>(`/products/${id}`, payload, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      setP(unwrap<P>(data));
      setMsg("Guardado!");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setMsg("No autorizado: requiere rol admin.");
      else if (status === 404) setMsg("Producto no encontrado.");
      else setMsg(e?.response?.data?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  // ⬇️ NUEVO: PATCH /products/:id/stock (tolerante a contratos alternativos)
  async function updateStock() {
    setStockErr(null);
    setStockMsg(null);

    try {
      if (!hasRole(["admin"])) {
        setStockErr("Solo admin puede actualizar stock.");
        return;
      }

      // normalización del número (permite negativos para restar stock)
      const valueRaw = typeof stockAmount === "string" ? stockAmount.trim() : stockAmount;
      const amountNum = Number(valueRaw);
      if (valueRaw === "" || Number.isNaN(amountNum)) {
        setStockErr("Ingresá una cantidad válida.");
        return;
      }
      if (!Number.isFinite(amountNum) || amountNum === 0) {
        setStockErr("La cantidad no puede ser 0.");
        return;
      }
      if (!Number.isInteger(amountNum)) {
        setStockErr("Usá números enteros para el stock.");
        return;
      }

      setStockSaving(true);
      const token = getToken();
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // Intento principal (tu contrato declarado)
      // { "stock": number, "operation": "add" }
      const attempts: Array<{ body: any; note: string }> = [
        { body: { stock: amountNum, operation: "add" as const }, note: "primary(stock+operation)" },
        // variantes comunes en APIs
        { body: { amount: amountNum, operation: "add" }, note: "amount+operation" },
        { body: { delta: amountNum }, note: "delta" },
        { body: { stockDelta: amountNum }, note: "stockDelta" },
        { body: { incrementBy: amountNum }, note: "incrementBy" },
        { body: { quantity: amountNum, op: "inc" }, note: "quantity+op" },
      ];

      let success = false;
      let lastErr: any = null;

      for (const attempt of attempts) {
        try {
          const { data } = await api.patch<any>(`/products/${id}/stock`, attempt.body, { headers });
          const dto = unwrap<any>(data);

          // múltiples formas en que el backend puede devolver el nuevo stock
          const newStock =
            (typeof dto?.stock === "number" ? dto.stock : undefined) ??
            (typeof dto?.newStock === "number" ? dto.newStock : undefined) ??
            (typeof dto?.data?.stock === "number" ? dto.data.stock : undefined);

          if (typeof newStock === "number") {
            setP((prev) =>
              prev
                ? {
                    ...prev,
                    stock: newStock,
                    updatedAt: dto?.updatedAt ?? dto?.data?.updatedAt ?? prev.updatedAt,
                  }
                : prev
            );
          } else {
            // si no puedo inferir, recargo el producto para quedar consistentes
            await load();
          }

          setStockMsg("Stock actualizado correctamente.");
          setStockAmount("");
          success = true;
          break;
        } catch (e: any) {
          lastErr = e;
          const status = e?.response?.status;
          // solo sigo probando variantes si parece error de contrato (400/422)
          if (status === 400 || status === 422) {
            continue; // probar la siguiente variante
          } else {
            // errores duros (401/403/404/500) -> corto
            throw e;
          }
        }
      }

      if (!success) {
        // si ninguna variante funcionó, muestro el último error legible
        const readable =
          lastErr?.response?.data?.message ||
          lastErr?.message ||
          "No se pudo actualizar el stock.";
        throw new Error(readable);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setStockErr("No autorizado: requiere rol admin.");
      else if (status === 404) setStockErr("Producto no encontrado.");
      else setStockErr(e?.message || e?.response?.data?.message || "Error al actualizar stock.");
    } finally {
      setStockSaving(false);
    }
  }

  if (!p)
    return (
      <Guard roles={["admin", "bar_user", "bartender"]}>
        <Navbar />
        <main className={form.container}>
          <div className={form.form}>
            {err ? <p className={form.error}>{err}</p> : <p>Cargando…</p>}
          </div>
        </main>
      </Guard>
    );

  return (
    <Guard roles={["admin", "bar_user", "bartender"]}>
      <Navbar />
      <main className={form.container}>
        <div className={form.form}>
          <h1>Producto</h1>

          {/* ——— edición existente (se mantiene tal cual) ——— */}
          <label>Nombre</label>
          <input
            value={typeof p.name === "string" ? p.name : ""}
            onChange={(e) => setP({ ...p, name: e.target.value })}
          />
          <label>Precio</label>
          <input
            type="number"
            step="0.01"
            value={typeof p.price === "number" ? p.price : Number(p.price) || 0}
            onChange={(e) => setP({ ...p, price: Number(e.target.value) })}
          />
          <label>Tecla rápida</label>
          <input
            value={typeof p.quickKey === "string" ? (p.quickKey ?? "") : ""}
            onChange={(e) =>
              setP({ ...p, quickKey: e.target.value.toUpperCase() })
            }
          />

          {/* ——— NUEVO: bloque para actualizar stock (admin) ——— */}
          {hasRole(["admin"]) && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                background: "#fff",
                display: "grid",
                gap: 8,
              }}
            >
              <strong>Actualizar stock</strong>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="number"
                  step="1"
                  placeholder="Cantidad (ej: 10 / -3)"
                  value={stockAmount}
                  onChange={(e) => setStockAmount(e.target.value)}
                  style={{ width: 200 }}
                />
                <button
                  className={btn.primary}
                  onClick={updateStock}
                  disabled={stockSaving}
                  type="button"
                >
                  {stockSaving ? "Actualizando…" : "Actualizar stock"}
                </button>
                <span style={{ color: "#6b7280", fontSize: 12 }}>
                  Enviamos una operación <code>add</code> con el valor ingresado (positivo o negativo).
                </span>
              </div>
              {stockErr && <p className={form.error} style={{ margin: 0 }}>{stockErr}</p>}
              {stockMsg && <p style={{ color: "#065f46", margin: 0 }}>{stockMsg}</p>}
            </div>
          )}

          {/* ——— info adicional del contrato (solo visual) ——— */}
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              background: "#fafafa",
              display: "grid",
              gap: 8,
            }}
          >
            <strong style={{ marginBottom: 6 }}>Detalles</strong>
            <Row label="Descripción">{safeText(p.description)}</Row>
            <Row label="Código">
              <code>{safeText(p.code)}</code>
            </Row>
            <Row label="Unidad">{safeText(p.unit)}</Row>
            <Row label="Categoría">{safeText(p.category)}</Row>
            <Row label="Stock">
              {typeof p.stock === "number" ? p.stock : safeText(p.stock)}
            </Row>
            <Row label="Creado">{formatDate(p.createdAt)}</Row>
            <Row label="Actualizado">{formatDate(p.updatedAt)}</Row>
          </div>

          {msg && <p className={form.error}>{msg}</p>}
          {err && <p className={form.error}>{err}</p>}
          <div style={{ display: "flex", gap: 12 }}>
            <button className={btn.primary} onClick={save} disabled={loading || saving}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button className={btn.secondary} onClick={load} disabled={loading || saving || stockSaving}>
              {loading ? "Cargando…" : "Refrescar"}
            </button>
          </div>
        </div>
      </main>
    </Guard>
  );
}

// helper visual para filas de detalle (no quita nada de lo tuyo)
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
      <span style={{ color: "#6b7280", fontWeight: 600 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

function safeText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
}

function formatDate(iso?: string) {
  if (!iso || typeof iso !== "string") return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return "—";
  }
}
