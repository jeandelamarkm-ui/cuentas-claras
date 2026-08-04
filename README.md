# 💰 Cuentas Claras

**Finanzas personales sin cuentas ni nubes: escribe cuánto, toca en qué, y la app hace el resto.**

App completa de control de gastos en español, en **un solo archivo HTML** — sin frameworks, sin dependencias, sin backend. Tus datos viven únicamente en tu navegador.

## Usar la app

- **En línea:** abre la página de GitHub Pages de este repositorio.
- **Local / sin internet:** descarga `index.html` y ábrelo con doble clic. Funciona igual.

> Los datos se guardan en el `localStorage` del navegador donde la uses. Cada navegador/dispositivo tiene sus propios datos; para moverlos usa **Ajustes → Exportar respaldo (JSON)** e impórtalo en el otro dispositivo.

## Qué incluye

- **Registro en 2 toques**: teclado calculadora propio (con matemática inline `12+8×2` y coma decimal según tu moneda); tocar la categoría guarda al instante.
- **Dashboard**: saldo total, ingresos/gastos del mes con comparativa, gasto promedio diario, proyección de fin de mes, disponible por día, alertas de presupuesto.
- **Gráficas**: torta por categoría con drill-down, barras ingresos vs gastos, ritmo del mes vs mes anterior, top de categorías, calendario de calor, regla 50/30/20 — cada una con vista de tabla accesible.
- **Presupuestos** por categoría con umbrales (80 % / excedido) y copia automática al mes siguiente.
- **Metas de ahorro** con abonos, retiros, aporte mensual sugerido y confetti al lograrlas.
- **Gastos fijos** recurrentes que se registran solos el día que elijas.
- **Cuentas múltiples** (efectivo, banco…) con transferencias que no cuentan como gasto.
- **Movimientos**: búsqueda, filtros por tipo/categoría/mes, edición, duplicado y borrado con deshacer.
- **Respaldo**: exportar JSON (restaurable) y CSV (para Excel/Sheets), importar con reemplazo o fusión.
- Tema claro/oscuro, 20 monedas, datos de ejemplo para explorar, racha de días registrando 🔥.

## Desarrollo

El código fuente está en [`src/`](src/) dividido en partes (estilos, motor de datos, gráficas, sheets, vistas). Para regenerar `index.html` tras editar:

```bash
python3 src/build.py
```

La paleta de colores de categorías (12 colores, tema claro y oscuro) está validada para accesibilidad (separación para daltonismo y contraste).

## Privacidad

No hay servidores, cuentas, rastreo ni sincronización bancaria. Nada sale de tu navegador. El respaldo JSON exportado es tuyo y es la única forma de mover datos entre dispositivos.

---

Hecha con [Claude Code](https://claude.com/claude-code).
