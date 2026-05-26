# Practicantes LEA - Musicala

Panel administrativo web conectado a Google Sheets mediante Google Apps Script.

## Que incluye

- CRUD completo desde el frontend para `Practicantes`, `Actividades`, `Evaluaciones Mensuales`, `Retroalimentaciones`, `Proyectos` y `Catalogos`.
- Lectura de `Registros de Jornadas` en modo solo lectura.
- Dashboard con estadisticas generales.
- Estadisticas individuales cruzando jornadas por nombre normalizado.
- Informes general e individual con opcion de imprimir o guardar como PDF.
- Boton de configuracion para crear hojas faltantes y agregar columnas faltantes sin borrar datos.
- Respaldo visual con `data.sample.json` cuando no hay conexion disponible.

## 1. Pegar `code.gs` en Apps Script

1. Abre el Google Sheets principal.
2. Ve a **Extensiones > Apps Script**.
3. Borra el codigo de ejemplo.
4. Pega todo el contenido de `code.gs`.
5. Guarda el proyecto.

Si el Apps Script esta ligado directamente al Google Sheets, deja:

```js
const SHEET_ID = "";
```

Si usas un Apps Script independiente, pega el ID del Google Sheets:

```js
const SHEET_ID = "ID_DEL_GOOGLE_SHEETS";
```

## 2. Desplegar como Web App

1. En Apps Script abre **Implementar > Nueva implementacion**.
2. Tipo: **Aplicacion web**.
3. Ejecutar como: **Yo**.
4. Acceso: el que defina el equipo. Para pruebas puede ser **Cualquier usuario con el enlace**.
5. Implementa y autoriza los permisos.

## 3. Copiar la URL `/exec`

Despues de implementar, copia la URL que termina en `/exec`. Esa es la URL que usara el frontend.

## 4. Poner la URL en `config.js`

Abre `config.js` y reemplaza `API_URL` si necesitas apuntar a otra implementacion:

```js
window.LEA_CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXXX/exec",
  USE_SAMPLE_WHEN_EMPTY: true,
  JORNADAS_SHEET_NAME: "Registros de Jornadas",
  LATE_AFTER: "08:10"
};
```

`JORNADAS_SHEET_NAME` debe coincidir con la pestaña externa que ya alimenta la otra app. Por defecto queda en `Registros de Jornadas`; el backend usa `CONFIG_JORNADAS_SHEET_NAME` dentro de `code.gs`.

## 5. Usar el boton de crear estructura

En el panel entra a **Configuracion / Estructura** y presiona:

**Crear / actualizar estructura del Sheet**

Ese boton llama `setupSchema` y hace lo siguiente:

- Crea hojas editables faltantes.
- Agrega columnas faltantes al final.
- No borra datos existentes.
- No renombra columnas existentes.
- No escribe ni limpia la hoja de jornadas.
- Muestra hojas creadas, columnas agregadas y advertencias.

## 6. Hojas que edita el panel

El panel puede crear, editar y eliminar registros por ID estable en:

- `Practicantes`
- `Actividades`
- `Evaluaciones Mensuales`
- `Retroalimentaciones`
- `Proyectos`
- `Catalogos`

Cada registro recibe `ID`, `CreatedAt` y `UpdatedAt`. Al editar se actualiza `UpdatedAt`.

### Agregar evaluadores

El campo `Evaluador` de `Evaluaciones Mensuales` incluye por defecto a Alek, Cata, Camila Rodriguez y Liceth Rincon. Para agregar mas personas sin tocar codigo:

1. Entra al panel en modo administrador.
2. Abre **Configuracion / Estructura**.
3. En `Catalogos`, crea un registro con `Tipo` = `Evaluador`, `Valor` = nombre de la persona y `Activo` = `Si`.
4. Recarga el panel si el nuevo nombre no aparece inmediatamente.

## 7. Hoja que solo lee el panel

La hoja de jornadas es externa y de solo lectura. El panel intenta encontrarla con estos nombres:

- `Registros de Jornadas`
- `Registro de Jornadas`
- `Jornadas`
- `Registro jornadas`
- `Registro de jornada`
- `Registro Jornada`

Tambien detecta columnas flexibles para nombre, fecha, entrada, salida y estado. Si falta alguna columna, el panel sigue funcionando con advertencias suaves.

La relacion con practicantes se hace por nombre normalizado: ignora mayusculas, tildes, puntuacion y dobles espacios, y permite coincidencias razonables.

## 8. Generar PDF desde informes

1. Abre la seccion **Informes**.
2. Filtra por mes, ano, practicante, estado o programa.
3. Presiona **Generar informe**.
4. Presiona **Imprimir / Guardar PDF**.
5. En el navegador elige **Guardar como PDF**.

## Archivos principales

- `index.html`: estructura del panel.
- `styles.css`: estilos claros Musicala.
- `config.js`: URL de Apps Script y ajustes de jornadas.
- `schema.js`: definicion de hojas, columnas y formularios.
- `app.js`: interfaz, CRUD, filtros, estadisticas e informes.
- `code.gs`: backend Apps Script para Google Sheets.
- `data.sample.json`: datos de muestra.
- `logo.png`: logo del panel.

## Recomendacion antes de produccion

Haz una copia del Google Sheets actual, conecta el Apps Script a esa copia y prueba primero el boton de estructura, un registro nuevo, una edicion y una eliminacion. La hoja de jornadas debe mantenerse intacta.
