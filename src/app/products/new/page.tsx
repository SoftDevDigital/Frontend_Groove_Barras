"use client";
import Guard from "@/components/Guard";
import Navbar from "@/components/Navbar";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import form from "@/styles/Forms.module.css";
import btn from "@/styles/Buttons.module.css";
import { hasRole, getToken } from "@/lib/auth";

type Unit = "unidad" | "ml" | "l" | "kg" | "g" | string;
type Category = "bebidas" | "comida" | "snacks" | "otros" | string;

// 👇 NUEVO: regex que exige 2–3 letras mayúsculas
const CODE_REGEX = /^[A-Z]{2,3}$/;

export default function NewProductPage() {
  // Campos del formulario (según el contrato del endpoint)
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | string>("");
  const [code, setCode] = useState("");
  const [stock, setStock] = useState<number | string>("");
  const [unit, setUnit] = useState<Unit>("unidad");
  const [category, setCategory] = useState<Category>("bebidas");

  // UI
  const [msg, setMsg] = useState<string | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Validación simple en cliente
  const clientErrors = useMemo(() => {
    const list: string[] = [];
    if (!name.trim()) list.push("El nombre es obligatorio.");
    if (price === "" || isNaN(Number(price)) || Number(price) < 0)
      list.push("El precio es obligatorio y debe ser un número válido.");
    if (!code.trim()) {
      list.push("El código es obligatorio.");
    } else if (!CODE_REGEX.test(code.trim().toUpperCase())) {
      // 👇 NUEVO: validación exacta como en el backend
      list.push("El código debe ser 2–3 letras MAYÚSCULAS (sin números ni espacios), ej: CC o CCC.");
    }
    if (stock === "" || isNaN(Number(stock)) || Number(stock) < 0)
      list.push("El stock es obligatorio y debe ser un número válido.");
    if (!unit.trim()) list.push("La unidad es obligatoria.");
    if (!category.trim()) list.push("La categoría es obligatoria.");
    return list;
  }, [name, price, code, stock, unit, category]);

  // Normaliza payload de error del backend (mismo estilo que usas en otros módulos)
  function normalizeErrorPayload(payload: any): { message: string; list: string[] } {
    if (!payload) return { message: "Error al crear producto", list: [] };
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
    catch { return { message: "Error al crear producto", list: [] }; }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErrs([]);

    try {
      // Rol
      if (!hasRole(["admin"])) {
        setMsg("Solo admin puede crear productos");
        return;
      }
      // Validación cliente
      if (clientErrors.length > 0) {
        setErrs(clientErrors);
        setMsg("Revisa los campos del formulario.");
        return;
      }

      setLoading(true);

      // Construcción del body EXACTO al contrato
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price),         // number
        code: code.trim().toUpperCase(), // ya validado con 2–3 letras
        stock: Number(stock),         // number
        unit: unit.trim(),
        category: category.trim(),
      };

      const token = getToken();
      await api.post("/products", body, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      // Éxito -> ir al listado
      window.location.href = "/products";
    } catch (err: any) {
      const { message, list } = normalizeErrorPayload(err?.response?.data);
      setMsg(message || "Error al crear producto");
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
          <h1>Nuevo producto</h1>

          <label>Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Coca Cola 500ml"
            required
          />

          <label>Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Bebida gaseosa"
            rows={3}
          />

          <label>Precio</label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="1000"
            required
          />

          <label>Código</label>
          <input
            value={code}
            onChange={(e) => {
              // 👇 NUEVO: forzar mayúsculas, quitar no-letras y limitar a 3
              const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
              setCode(v);
            }}
            placeholder="CCC"
            // 👇 ayudas extra (no rompen nada)
            maxLength={3}
            pattern="[A-Z]{2,3}"
            title="2–3 letras MAYÚSCULAS, sin números ni espacios (ej: CC o CCC)"
            required
          />

          <label>Stock</label>
          <input
            type="number"
            step="1"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="100"
            required
          />

          <label>Unidad</label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="unidad"
            list="units"
            required
          />
          <datalist id="units">
            <option value="unidad" />
            <option value="ml" />
            <option value="l" />
            <option value="g" />
            <option value="kg" />
          </datalist>

          <label>Categoría</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="bebidas"
            list="categories"
            required
          />
          <datalist id="categories">
            <option value="bebidas" />
            <option value="comida" />
            <option value="snacks" />
            <option value="otros" />
          </datalist>

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
            {loading ? "Creando..." : "Crear producto"}
          </button>
        </form>
      </main>
    </Guard>
  );
}
