"use client";

import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getToken, hasRole } from "@/lib/auth";
import btn from "@/styles/Buttons.module.css";
import form from "@/styles/Forms.module.css";
import table from "@/styles/Table.module.css";
import Link from "next/link";

type AssignOp = {
  type: "assign";
  productId: string;
  barId: string;
  quantity: number;
  notes?: string;
};

type MoveOp = {
  type: "move";
  productId: string;
  fromBarId: string;
  toBarId: string;
  quantity: number;
  notes?: string;
};

// Si tu backend soporta más tipos, solo extiende aquí:
type BulkOperation = AssignOp | MoveOp;

type BulkResult = {
  operation: string;    // "assign" | "move" | ...
  id?: string;          // ej: "stock-123" o "move-123"
  status: "success" | "error";
  message?: string;     // opcional si el backend la envía en errores
};

type BulkResponse = {
  processed: number;
  successful: number;
  failed: number;
  results: BulkResult[];
};

export default function StockBulkPage() {
  const [jsonText, setJsonText] = useState<string>(() =>
    JSON.stringify(
      {
        operations: [
          {
            type: "assign",
            productId: "product-123",
            barId: "bar-123",
            quantity: 50,
            // notes: "opcional"
          },
          // Ejemplo move (si tu API lo permite en bulk):
          // {
          //   type: "move",
          //   productId: "product-123",
          //   fromBarId: "bar-123",
          //   toBarId: "bar-456",
          //   quantity: 10,
          //   // notes: "opcional"
          // }
        ],
      },
      null,
      2
    )
  );

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [resp, setResp] = useState<BulkResponse | null>(null);

  const clientErrors = useMemo(() => {
    const list: string[] = [];
    if (!jsonText.trim()) list.push("Pegá el JSON de operaciones.");
    return list;
  }, [jsonText]);

  function loadExample() {
    const example = {
      operations: [
        { type: "assign", productId: "product-001", barId: "bar-A", quantity: 20 },
        { type: "assign", productId: "product-002", barId: "bar-A", quantity: 5, notes: "Reposición" },
        // Descomenta si tu backend acepta 'move' en bulk:
        // { type: "move", productId: "product-001", fromBarId: "bar-A", toBarId: "bar-B", quantity: 3 }
      ],
    };
    setJsonText(JSON.stringify(example, null, 2));
  }

  function validateOps(ops: any): ops is BulkOperation[] {
    if (!Array.isArray(ops)) return false;
    for (const op of ops) {
      if (!op || typeof op !== "object") return false;
      if (op.type === "assign") {
        if (!op.productId || !op.barId || !Number.isInteger(op.quantity) || op.quantity <= 0) return false;
      } else if (op.type === "move") {
        // si admitís 'move' en bulk
        if (!op.productId || !op.fromBarId || !op.toBarId || !Number.isInteger(op.quantity) || op.quantity <= 0)
          return false;
      } else {
        // tipo no soportado en FE (evitamos enviar basura)
        return false;
      }
    }
    return true;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErrs([]);
    setResp(null);

    try {
      if (!hasRole(["admin"])) {
        setMsg("Solo admin puede ejecutar operaciones masivas.");
        return;
      }
      if (clientErrors.length > 0) {
        setErrs(clientErrors);
        setMsg("Revisá el JSON antes de enviar.");
        return;
      }

      // Parseo seguro del JSON
      let parsed: any;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        setMsg("El JSON no es válido.");
        setErrs(["Error de sintaxis JSON."]);
        return;
      }

      const operations = parsed?.operations;
      if (!validateOps(operations)) {
        setMsg("Validación de operaciones fallida.");
        setErrs([
          "Asegurate que 'operations' sea un array con objetos válidos.",
          "assign: { type, productId, barId, quantity>0 }",
          "move (opcional): { type, productId, fromBarId, toBarId, quantity>0 }",
        ]);
        return;
      }

      setSubmitting(true);
      const token = getToken();
      const { data } = await api.post<BulkResponse>("/stock/bulk", { operations }, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      setResp(data);
      setMsg(`Procesadas: ${data.processed} • OK: ${data.successful} • Fallidas: ${data.failed}`);
    } catch (err: any) {
      const sc = err?.response?.status;
      if (sc === 403) setMsg("No autorizado: requiere rol admin.");
      else setMsg(err?.response?.data?.message || "Error al ejecutar operaciones masivas.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Guard roles={["admin"]}>
      <Navbar />
      <main className={form.container}>
        <form className={form.form} onSubmit={onSubmit} noValidate>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ marginRight: "auto" }}>Operaciones masivas de stock</h1>
            <Link className={btn.secondary} href="/stock/search">Buscar</Link>
            <Link className={btn.secondary} href="/stock/assign">Asignar</Link>
            <Link className={btn.secondary} href="/stock/move">Mover</Link>
            <Link className={btn.secondary} href="/stock/info">Info</Link>
          </div>

          <p style={{ marginTop: 0, color: "#6b7280" }}>
            Pegá un JSON con <code>operations</code>. Ej.: <code>assign</code> (y opcionalmente <code>move</code> si tu API lo soporta).
          </p>

          <label>JSON de operaciones</label>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            style={{
              width: "100%",
              minHeight: 220,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 13,
            }}
            placeholder={`{\n  "operations": [\n    { "type": "assign", "productId": "product-123", "barId": "bar-123", "quantity": 50 }\n  ]\n}`}
            required
          />

          {(msg || errs.length > 0) && (
            <div className={errs.length ? form.error : ""} style={{ textAlign: "left" }}>
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

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className={btn.primary} disabled={submitting}>
              {submitting ? "Procesando…" : "Ejecutar bulk"}
            </button>
            <button type="button" className={btn.secondary} onClick={loadExample} disabled={submitting}>
              Cargar ejemplo
            </button>
          </div>
        </form>

        {/* Resultado */}
        <section style={{ marginTop: 12 }}>
          <div style={{ overflowX: "auto" }}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Operación</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {!resp ? (
                  <tr>
                    <td colSpan={5} style={{ color: "#6b7280" }}>
                      Aún sin resultados.
                    </td>
                  </tr>
                ) : resp.results.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Sin resultados devueltos.</td>
                  </tr>
                ) : (
                  resp.results.map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>
                        <code>{r.operation}</code>
                      </td>
                      <td>
                        {r.id ? <code>{r.id}</code> : "—"}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 999,
                            textTransform: "uppercase",
                            background: r.status === "success" ? "#d1fae5" : "#fee2e2",
                            color: r.status === "success" ? "#065f46" : "#991b1b",
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td>{r.message ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {resp && (
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ fontWeight: 700 }}>
                      Procesadas: {resp.processed} • Exitosas: {resp.successful} • Fallidas: {resp.failed}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      </main>
    </Guard>
  );
}
