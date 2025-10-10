# 🎨 Sistema de Diseño - Groove Bars Frontend

## Paleta de Colores Minimalista

### Colores Principales
- **Primary**: `#2C3E50` - Color principal para botones y elementos importantes
- **Primary Light**: `#34495E` - Variante clara para hover
- **Accent**: `#5B7C99` - Color de acento suave para links y elementos secundarios

### Grises Neutros
- `--color-gray-50`: `#FAFBFC` - Fondos muy claros
- `--color-gray-100`: `#F5F6F8` - Fondos de cards
- `--color-gray-200`: `#E8EAED` - Bordes suaves
- `--color-gray-300`: `#D1D5DB` - Bordes más visibles
- `--color-gray-500`: `#6B7280` - Texto secundario
- `--color-gray-700`: `#374151` - Texto principal alternativo

### Colores de Estado (Suaves)
- **Success**: `#7BA98B` - Acciones exitosas
- **Warning**: `#D4A574` - Advertencias
- **Error**: `#C77B7B` - Errores
- **Info**: `#7A9FBF` - Información

## Tipografía

### Fuentes
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', ...
```

### Tamaños
- `h1`: 1.875rem (30px)
- `h2`: 1.5rem (24px)
- `h3`: 1.25rem (20px)
- Body: 0.9375rem (15px)
- Small: 0.875rem (14px)
- Tiny: 0.75rem (12px)

## Espaciado

- `--spacing-xs`: 4px
- `--spacing-sm`: 8px
- `--spacing-md`: 12px
- `--spacing-lg`: 16px
- `--spacing-xl`: 24px
- `--spacing-2xl`: 32px

## Bordes Redondeados

- `--radius-sm`: 6px - Elementos pequeños
- `--radius-md`: 10px - Botones, inputs
- `--radius-lg`: 14px - Cards, modales
- `--radius-full`: 9999px - Pills, badges

## Sombras

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
--shadow-md: 0 2px 4px 0 rgba(0, 0, 0, 0.04);
--shadow-lg: 0 4px 6px -1px rgba(0, 0, 0, 0.06);
--shadow-xl: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
```

## Componentes

### Botones

#### Primario
```jsx
import btn from "@/styles/Buttons.module.css";

<button className={btn.primary}>Guardar</button>
```

#### Secundario
```jsx
<button className={btn.secondary}>Cancelar</button>
```

#### Link
```jsx
<a className={btn.link}>Ver más</a>
```

### Formularios

```jsx
import form from "@/styles/Forms.module.css";

<div className={form.container}>
  <form className={form.form}>
    <label>Nombre</label>
    <input type="text" placeholder="Juan Pérez" />
    
    <label>Rol</label>
    <select>
      <option>Admin</option>
      <option>Usuario</option>
    </select>
    
    <button className={btn.primary}>Enviar</button>
  </form>
</div>
```

### Tablas

```jsx
import table from "@/styles/Table.module.css";

<table className={table.table}>
  <thead>
    <tr>
      <th>Nombre</th>
      <th>Email</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Juan</td>
      <td>juan@example.com</td>
    </tr>
  </tbody>
</table>
```

### Alertas y Mensajes

```jsx
import shared from "@/styles/Shared.module.css";

<div className={shared.alertSuccess}>
  ✓ Operación exitosa
</div>

<div className={shared.alertError}>
  ✗ Error al procesar
</div>

<div className={shared.alertInfo}>
  ℹ Información importante
</div>
```

### Badges

```jsx
<span className={shared.badgeSuccess}>Activo</span>
<span className={shared.badgeWarning}>Pendiente</span>
<span className={shared.badgeError}>Cancelado</span>
<span className={shared.badgeInfo}>Info</span>
```

### Cards

```jsx
<div className={shared.card}>
  <h3>Título de la Card</h3>
  <p>Contenido...</p>
</div>
```

### Layouts

```jsx
// Container centrado
<div className={shared.pageContainer}>
  <div className={shared.pageHeader}>
    <h1>Título de Página</h1>
  </div>
  ...
</div>

// Grid de 2 columnas
<div className={shared.grid2}>
  <div>Item 1</div>
  <div>Item 2</div>
</div>

// Flex entre espacios
<div className={shared.flexBetween}>
  <span>Izquierda</span>
  <span>Derecha</span>
</div>
```

## Archivos Principales

- `src/app/globals.css` - Variables CSS y estilos globales
- `src/styles/Buttons.module.css` - Estilos de botones
- `src/styles/Forms.module.css` - Estilos de formularios
- `src/styles/Table.module.css` - Estilos de tablas
- `src/styles/Shared.module.css` - Componentes compartidos y utilidades
- `src/components/Navbar.module.css` - Estilos del navbar

## Principios de Diseño

### 1. Minimalismo
- Usa espacios en blanco generosamente
- Evita contrastes fuertes de colores
- Prefiere grises neutros sobre colores vivos

### 2. Consistencia
- Usa variables CSS en lugar de valores hardcodeados
- Mantén los espaciados consistentes
- Usa los mismos estilos de botones en toda la app

### 3. Accesibilidad
- Todos los inputs tienen focus visible
- Los botones tienen estados hover/active claros
- Los colores cumplen con contraste mínimo

### 4. Responsive
- Todos los componentes son responsive
- Los grids se adaptan automáticamente
- El navbar colapsa en móvil

## Transiciones

Todas las transiciones usan:
```css
transition: all var(--transition-base); /* 200ms ease */
```

Para efectos sutiles al hover:
- `transform: translateY(-1px)` - Elevación ligera
- `box-shadow: var(--shadow-md)` - Sombra más pronunciada

## Ejemplo Completo

```jsx
import shared from "@/styles/Shared.module.css";
import btn from "@/styles/Buttons.module.css";
import table from "@/styles/Table.module.css";

export default function ProductsPage() {
  return (
    <div className={shared.pageContainer}>
      <div className={shared.pageHeader}>
        <h1>Productos</h1>
        <button className={btn.primary}>Crear Producto</button>
      </div>

      <div className={shared.card}>
        <table className={table.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cerveza</td>
              <td>$500</td>
              <td><span className={shared.badgeSuccess}>50</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

**Última actualización**: Octubre 2025

