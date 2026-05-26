(() => {
  const CONFIG = window.LEA_CONFIG || {};
  const SCHEMA = window.LEA_SCHEMA || {};
  const EDITABLE_KEYS = Object.keys(SCHEMA).filter((key) => SCHEMA[key].editable);
  const SECTION_TO_KEY = { practicantes: "practicantes", calendario: "calendario", ajustes_horario: "ajustes_horario", actividades: "actividades", evaluaciones: "evaluaciones", retroalimentaciones: "retroalimentaciones", proyectos: "proyectos" };
  const $ = (selector, ctx = document) => ctx.querySelector(selector);
  const $$ = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));

  const state = {
    section: "dashboard",
    isAdmin: isAdminUrl(),
    data: {},
    jornadas: [],
    jornadasMeta: {},
    filters: {},
    modalKey: "",
    modalId: ""
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    hydrateBrand();
    bindShellEvents();
    seedFilters();
    loadAllData();
  }

  function hydrateBrand() {
    const brand = CONFIG.BRAND || {};
    if (brand.logo) $("#brand-logo").src = brand.logo;
    if (brand.title) $("#brand-title").textContent = brand.title;
    if (brand.subtitle) $("#brand-subtitle").textContent = brand.subtitle;
    $("#modeLabel").textContent = state.isAdmin ? "Panel administrativo" : "Panel de consulta";
  }

  function bindShellEvents() {
    document.body.classList.toggle("admin-mode", state.isAdmin);
    document.body.classList.toggle("readonly-mode", !state.isAdmin);
    $("#setupBtn").hidden = !state.isAdmin;
    $$('.nav-item[data-section="configuracion"]').forEach((button) => { button.hidden = !state.isAdmin; });
    $$(".nav-item").forEach((button) => button.addEventListener("click", () => setSection(button.dataset.section)));
    $("#refreshBtn").addEventListener("click", loadAllData);
    $("#setupBtn").addEventListener("click", setupSchema);
    $("#recordForm").addEventListener("submit", handleFormSubmit);
    $("#closeModalBtn").addEventListener("click", closeModal);
    $("#cancelFormBtn").addEventListener("click", closeModal);
    $("#recordModal").addEventListener("click", (event) => {
      if (event.target.id === "recordModal") closeModal();
    });
  }

  function seedFilters() {
    Object.keys(SCHEMA).forEach((key) => {
      state.filters[key] = { search: "", practicante: "", mes: "", estado: "", programa: "", tipo: "" };
    });
    state.filters.informes = { practicante: "", mes: "", ano: String(new Date().getFullYear()), estado: "", programa: "" };
  }

  function setSection(section) {
    if (section === "configuracion" && !state.isAdmin) section = "dashboard";
    state.section = section;
    $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.section === section));
    $$(".view").forEach((view) => view.classList.remove("active"));
    $(`#view-${section}`)?.classList.add("active");
    renderCurrentSection();
  }

  async function loadAllData() {
    setStatus("Cargando datos...", "warning");
    try {
      let payload;
      if (apiUrl()) {
        payload = await apiGet({ action: "getData", ts: Date.now() });
      } else if (CONFIG.USE_SAMPLE_WHEN_EMPTY !== false) {
        payload = await fetch("data.sample.json", { cache: "no-store" }).then((res) => res.json());
      } else {
        throw new Error("Falta configurar API_URL en config.js.");
      }
      if (!payload || payload.ok === false) throw new Error(payload?.error || "Respuesta invalida del backend.");
      hydrateData(payload);
      setStatus(apiUrl() ? "Datos cargados desde Apps Script." : "Modo muestra: configura API_URL para escribir en Sheets.", "success");
      renderAllSections();
    } catch (error) {
      console.error(error);
      setStatus(`No se pudieron cargar los datos: ${error.message}`, "error");
      if (apiUrl() && CONFIG.USE_SAMPLE_WHEN_EMPTY !== false) {
        try {
          const sample = await fetch("data.sample.json", { cache: "no-store" }).then((res) => res.json());
          hydrateData(sample);
          setStatus("No hubo conexion con Apps Script. Se cargaron datos de muestra para revisar el panel.", "warning");
          renderAllSections();
        } catch (sampleError) {
          console.error(sampleError);
        }
      }
    }
  }

  function hydrateData(payload) {
    const data = payload.data || payload;
    EDITABLE_KEYS.forEach((key) => {
      state.data[key] = Array.isArray(data[key]) ? data[key].filter(hasValues) : [];
    });
    state.jornadas = Array.isArray(data.jornadas) ? data.jornadas.filter(hasValues) : [];
    state.jornadasMeta = data.jornadasMeta || payload.jornadasMeta || {};
  }

  function renderAllSections() {
    renderDashboard();
    EDITABLE_KEYS.forEach((key) => renderCrudSection(key));
    renderInformes();
    renderConfiguracion();
  }

  function renderCurrentSection() {
    if (state.section === "dashboard") renderDashboard();
    if (state.section === "informes") renderInformes();
    if (state.section === "configuracion") renderConfiguracion();
    const key = SECTION_TO_KEY[state.section];
    if (key) renderCrudSection(key);
  }

  function renderDashboard() {
    const people = getPracticantesFiltered({});
    const stats = people.map((person) => calculateJornadaStats(person, state.jornadas));
    const evaluations = state.data.evaluaciones || [];
    const projects = state.data.proyectos || [];
    const activeProjects = projects.filter((p) => !["Finalizado", "Cancelado"].includes(p.Estado)).length;
    const avgEval = average(evaluations, "Promedio");
    $("#view-dashboard").innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Resumen general</p><h2>Dashboard</h2></div>
        <span class="pill">Jornadas: solo lectura</span>
      </div>
      <div class="kpis">
        ${kpi("Practicantes", people.length, "registrados")}
        ${kpi("Jornadas", state.jornadas.length, "registros leidos")}
        ${kpi("Puntualidad", `${round(average(stats, "porcentajePuntualidad"))}%`, "promedio")}
        ${kpi("Proyectos activos", activeProjects, "en seguimiento")}
        ${kpi("Promedio evaluacion", avgEval ? round(avgEval) : "--", "mensual")}
      </div>
      <div class="grid two">
        <article class="card"><h3>Asistencia y puntualidad</h3>${tableHtml(stats.map((s) => ({ Practicante: s.practicante, Esperadas: s.jornadasEsperadas || "--", Asistidos: s.diasAsistidos, Asistencia: s.jornadasEsperadas ? `${round(s.porcentajeAsistencia)}%` : "--", Tarde: s.llegadasTarde, Puntualidad: `${round(s.porcentajePuntualidad)}%`, Horas: round(s.totalHoras), Ultima: s.ultimaJornada || "--" })), ["Practicante", "Esperadas", "Asistidos", "Asistencia", "Tarde", "Puntualidad", "Horas", "Ultima"])}</article>
        <article class="card"><h3>Alertas</h3>${alertsHtml(stats)}</article>
      </div>
      <article class="card"><h3>Actividad reciente</h3>${recentHtml()}</article>
    `;
  }

  function renderCrudSection(key) {
    const def = SCHEMA[key];
    const container = $(`#view-${sectionForKey(key)}`);
    if (!container) return;
    const filter = state.filters[key];
    const rows = filteredRows(key);
    const cols = displayColumns(key);
    const actionsColumn = state.isAdmin ? ["_actions"] : [];
    container.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">${state.isAdmin ? "Gestion editable" : "Vista solo lectura"}</p><h2>${escapeHtml(def.label)}</h2></div>
        ${state.isAdmin ? `<button class="btn primary" data-create="${key}" type="button">${escapeHtml(def.createLabel || `Nuevo ${def.singular}`)}</button>` : ""}
      </div>
      <article class="card filters-card">
        <input data-filter="search" data-key="${key}" type="search" placeholder="Buscar..." value="${escapeAttr(filter.search)}" />
        ${selectHtml("practicante", key, "Practicante", ["", ...peopleNames()], filter.practicante)}
        ${selectHtml("mes", key, "Mes", ["", ...monthOptions(key)], filter.mes)}
        ${selectHtml("estado", key, "Estado", ["", ...unique((state.data[key] || []).map((r) => r.Estado))], filter.estado)}
        ${selectHtml("programa", key, "Programa", ["", ...unique((state.data.practicantes || []).map((r) => r.Programa))], filter.programa)}
        ${selectHtml("tipo", key, "Tipo", ["", ...typeOptions(key)], filter.tipo)}
      </article>
      <article class="card">
        <div class="section-row"><strong>${rows.length} registro(s)</strong><span>${escapeHtml(def.sheetName)}</span></div>
        ${tableHtml(rows, [...actionsColumn, ...cols], { key })}
      </article>
    `;
    bindCrudEvents(container, key);
  }

  function bindCrudEvents(container, key) {
    if (!state.isAdmin) {
      container.querySelectorAll("[data-filter]").forEach((input) => {
        input.addEventListener("input", () => {
          state.filters[key][input.dataset.filter] = input.value;
          renderCrudSection(key);
        });
      });
      return;
    }
    container.querySelector(`[data-create="${key}"]`)?.addEventListener("click", () => openCreateModal(key));
    container.querySelectorAll("[data-filter]").forEach((input) => {
      input.addEventListener("input", () => {
        state.filters[key][input.dataset.filter] = input.value;
        renderCrudSection(key);
      });
    });
    container.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openEditModal(key, button.dataset.edit)));
    container.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => deleteRecord(key, button.dataset.delete)));
  }

  function renderInformes() {
    const filter = state.filters.informes;
    $("#view-informes").innerHTML = `
      <div class="page-head no-print">
        <div><p class="eyebrow">Informes</p><h2>General e individual</h2></div>
        <button id="printReportBtn" class="btn primary" type="button">Imprimir / Guardar PDF</button>
      </div>
      <article class="card filters-card no-print">
        ${selectReport("practicante", "Practicante", ["", ...peopleNames()], filter.practicante)}
        ${selectReport("mes", "Mes", ["", ...allMonths()], filter.mes)}
        <input data-report-filter="ano" type="number" placeholder="Ano" value="${escapeAttr(filter.ano)}" />
        ${selectReport("estado", "Estado", ["", ...unique((state.data.practicantes || []).map((r) => r.Estado))], filter.estado)}
        ${selectReport("programa", "Programa", ["", ...unique((state.data.practicantes || []).map((r) => r.Programa))], filter.programa)}
        <button id="generalReportBtn" class="btn secondary" type="button">Generar informe</button>
      </article>
      <div class="grid two reports-grid">
        <article id="generalReport" class="report-paper"></article>
        <article id="individualReport" class="report-paper"></article>
      </div>
    `;
    $("#view-informes").querySelectorAll("[data-report-filter]").forEach((input) => input.addEventListener("input", () => {
      state.filters.informes[input.dataset.reportFilter] = input.value;
      renderInformes();
    }));
    $("#printReportBtn")?.addEventListener("click", () => window.print());
    $("#generalReportBtn")?.addEventListener("click", () => {
      generateGeneralReport();
      generateIndividualReport(filter.practicante || firstVisiblePerson()?.ID || "");
    });
    generateGeneralReport();
    generateIndividualReport(filter.practicante || firstVisiblePerson()?.ID || "");
  }

  function renderConfiguracion() {
    if (!state.isAdmin) {
      setSection("dashboard");
      return;
    }
    const meta = state.jornadasMeta || {};
    const editable = EDITABLE_KEYS.map((key) => SCHEMA[key].sheetName).join(", ");
    const catalogRows = filteredRows("catalogos");
    $("#view-configuracion").innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Configuracion</p><h2>Estructura del Google Sheets</h2></div></div>
      <article class="card config-card">
        <p>El boton crea hojas editables faltantes y agrega columnas al final. No borra datos, no reordena columnas y no escribe en la hoja de jornadas.</p>
        <button id="setupConfigBtn" class="btn primary" type="button">Crear / actualizar estructura del Sheet</button>
        <pre id="setupResult">${escapeHtml(meta.warning || "Sin ejecucion reciente de setupSchema.")}</pre>
      </article>
      <div class="grid two">
        <article class="card"><h3>Hojas editables</h3><p>${escapeHtml(editable)}</p></article>
        <article class="card"><h3>Hoja solo lectura</h3><p>${escapeHtml(meta.sheetName || CONFIG.JORNADAS_SHEET_NAME || "Jornadas / Registro de Jornadas")}</p><p>${escapeHtml(meta.warning || "Se cruza por nombre normalizado del practicante.")}</p></article>
      </div>
      <article class="card">
        <div class="page-head">
          <div><h3>Catalogos</h3><p>Listas editables de apoyo para programas, estados y tipos.</p></div>
          <button class="btn primary" data-create="catalogos" type="button">Nuevo catalogo</button>
        </div>
        ${tableHtml(catalogRows, ["_actions", "Tipo", "Valor", "Activo"])}
      </article>
    `;
    $("#setupConfigBtn")?.addEventListener("click", setupSchema);
    $("#view-configuracion").querySelector('[data-create="catalogos"]')?.addEventListener("click", () => openCreateModal("catalogos"));
    $("#view-configuracion").querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openEditModal("catalogos", button.dataset.edit)));
    $("#view-configuracion").querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => deleteRecord("catalogos", button.dataset.delete)));
  }

  async function setupSchema() {
    if (!state.isAdmin) return setStatus("La estructura solo se puede actualizar en modo administrador.", "error");
    const btns = [$("#setupBtn"), $("#setupConfigBtn")].filter(Boolean);
    btns.forEach((button) => { button.disabled = true; button.textContent = "Creando estructura..."; });
    setStatus("Creando / actualizando estructura...", "warning");
    try {
      const payload = await apiPost({ action: "setupSchema" });
      if (!payload.ok) throw new Error(payload.error || "No se pudo preparar el Sheet.");
      const lines = [payload.message || "Estructura revisada."];
      (payload.report || []).forEach((item) => {
        lines.push(`${item.sheetName}: ${item.created ? "hoja creada" : "lista"}${item.addedColumns?.length ? `; columnas agregadas: ${item.addedColumns.join(", ")}` : ""}`);
      });
      if (payload.jornadasWarning) lines.push(`Advertencia: ${payload.jornadasWarning}`);
      setStatus(lines.join("\n"), "success");
      await loadAllData();
    } catch (error) {
      console.error(error);
      setStatus(`Error en setupSchema: ${error.message}`, "error");
    } finally {
      btns.forEach((button) => { button.disabled = false; button.textContent = "Crear / actualizar estructura del Sheet"; });
    }
  }

  function openCreateModal(sheetName) {
    if (!state.isAdmin) return setStatus("La edicion solo esta disponible en modo administrador.", "error");
    state.modalKey = sheetName;
    state.modalId = "";
    openRecordModal(sheetName, {});
  }

  function openEditModal(sheetName, recordId) {
    if (!state.isAdmin) return setStatus("La edicion solo esta disponible en modo administrador.", "error");
    const row = (state.data[sheetName] || []).find((item) => String(item.ID) === String(recordId));
    if (!row) return setStatus("No se encontro el registro para editar.", "error");
    state.modalKey = sheetName;
    state.modalId = recordId;
    openRecordModal(sheetName, row);
  }

  function openRecordModal(key, row) {
    const def = SCHEMA[key];
    $("#modalKicker").textContent = def.label;
    $("#modalTitle").textContent = state.modalId ? `Editar ${def.singular}` : def.createLabel;
    $("#formFields").innerHTML = def.columns.filter((col) => !col.system && col.key !== "ID").map((col) => fieldHtml(col, row[col.key])).join("");
    bindScoreFields($("#formFields"));
    $("#recordModal").showModal();
  }

  function closeModal() {
    $("#recordModal").close();
    state.modalKey = "";
    state.modalId = "";
    $("#formFields").innerHTML = "";
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    const key = state.modalKey;
    const def = SCHEMA[key];
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    data.ID = state.modalId;
    for (const col of def.columns) {
      if (col.required && !String(data[col.key] || "").trim()) return setStatus(`Falta completar: ${col.label || col.key}`, "error");
    }
    await saveRecord(key, data);
  }

  async function saveRecord(sheetName, data) {
    if (!state.isAdmin) return setStatus("La edicion solo esta disponible en modo administrador.", "error");
    const button = $("#saveFormBtn");
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Guardando...";
    try {
      const action = data.ID ? "updateRecord" : "createRecord";
      const payload = await apiPost({ action, sheetName, id: data.ID, payload: data });
      if (!payload.ok) throw new Error(payload.error || "No se pudo guardar.");
      closeModal();
      setStatus("Seguimiento guardado.", "success");
      await loadAllData();
      setSection(sectionForKey(sheetName));
    } catch (error) {
      console.error(error);
      setStatus(`Error guardando: ${error.message}`, "error");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function deleteRecord(sheetName, recordId) {
    if (!state.isAdmin) return setStatus("La eliminacion solo esta disponible en modo administrador.", "error");
    if (!confirm("Eliminar este registro? Esta accion no toca la hoja de jornadas.")) return;
    setStatus("Eliminando...", "warning");
    try {
      const payload = await apiPost({ action: "deleteRecord", sheetName, id: recordId });
      if (!payload.ok) throw new Error(payload.error || "No se pudo eliminar.");
      setStatus("Registro eliminado.", "success");
      await loadAllData();
      setSection(sectionForKey(sheetName));
    } catch (error) {
      console.error(error);
      setStatus(`Error eliminando: ${error.message}`, "error");
    }
  }

  function generateGeneralReport() {
    const people = reportPeople();
    const stats = people.map((person) => calculateJornadaStats(person, state.jornadas));
    const evaluations = filteredForReport("evaluaciones");
    const projects = filteredForReport("proyectos");
    const avg = average(evaluations, "Promedio");
    $("#generalReport").innerHTML = `
      <p class="eyebrow">Informe general</p><h2>Practicantes LEA - Musicala</h2>
      <p class="muted">Generado: ${new Date().toLocaleDateString("es-CO")} - Periodo: ${escapeHtml(reportPeriodLabel())}</p>
      <div class="report-kpis">${kpi("Practicantes", people.length, "visibles")}${kpi("Puntualidad", `${round(average(stats, "porcentajePuntualidad"))}%`, "promedio")}${kpi("Evaluacion", avg ? round(avg) : "--", "promedio")}${kpi("Proyectos", projects.length, "registrados")}</div>
      <h3>Resumen</h3><p>El periodo incluye ${people.length} practicante(s), ${state.jornadas.length} jornada(s) leidas en modo solo lectura, ${filteredForReport("actividades").length} actividad(es), ${evaluations.length} evaluacion(es) y ${projects.filter((p) => !["Finalizado", "Cancelado"].includes(p.Estado)).length} proyecto(s) activo(s).</p>
      <h3>Ranking de asistencia y puntualidad</h3>${tableHtml(stats.map((s) => ({ Practicante: s.practicante, Esperadas: s.jornadasEsperadas || "--", Asistidos: s.diasAsistidos, Asistencia: s.jornadasEsperadas ? `${round(s.porcentajeAsistencia)}%` : "--", Horas: round(s.totalHoras), Puntualidad: `${round(s.porcentajePuntualidad)}%`, Alerta: s.alerta || "Sin alerta" })), ["Practicante", "Esperadas", "Asistidos", "Asistencia", "Horas", "Puntualidad", "Alerta"])}
      <h3>Observaciones generales</h3><ul>${generalRecommendations(stats, evaluations, projects).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    `;
  }

  function generateIndividualReport(practicanteId) {
    const people = reportPeople();
    const person = people.find((p) => String(p.ID) === String(practicanteId)) || people.find((p) => p["Nombre completo"] === practicanteId) || people[0];
    if (!person) {
      $("#individualReport").innerHTML = "<p>No hay practicante seleccionado.</p>";
      return;
    }
    const name = person["Nombre completo"];
    const stats = calculateJornadaStats(person, state.jornadas);
    const acts = filteredForReport("actividades").filter((r) => samePerson(r.Practicante, name));
    const evals = filteredForReport("evaluaciones").filter((r) => samePerson(r.Practicante, name));
    const feedback = filteredForReport("retroalimentaciones").filter((r) => samePerson(r.Practicante, name));
    const projects = filteredForReport("proyectos").filter((r) => samePerson(r.Practicante, name));
    const latestEval = evals[evals.length - 1] || {};
    $("#individualReport").innerHTML = `
      <p class="eyebrow">Informe individual</p><h2>${escapeHtml(name)}</h2>
      <p class="muted">${escapeHtml(person.Programa || "LEA")} - ${escapeHtml(person.Estado || "Sin estado")}</p>
      <div class="report-kpis">${kpi("Jornadas", stats.totalRegistros, "registros")}${kpi("Horas", round(stats.totalHoras), "registradas")}${kpi("Puntualidad", `${round(stats.porcentajePuntualidad)}%`, "")}${kpi("Promedio", latestEval.Promedio || "--", "evaluacion")}</div>
      <h3>Datos basicos</h3><p>Documento: ${escapeHtml(person.Documento || "--")}. Correo: ${escapeHtml(person.Correo || "--")}. Institucion: ${escapeHtml(person.Institucion || "--")}.</p>
      <h3>Estadisticas de jornada</h3><p>${escapeHtml(stats.narrative)}</p>
      <h3>Actividades realizadas</h3>${listHtml(acts, (r) => `${r.Fecha || ""} - ${r["Tipo de actividad"] || "Actividad"}: ${r.Descripcion || ""}`)}
      <h3>Evaluaciones mensuales</h3>${listHtml(evals, (r) => `${r.Mes || ""} - Promedio ${r.Promedio || "--"}. Fortalezas: ${r.Fortalezas || "--"}. Aspectos por mejorar: ${r["Aspectos por mejorar"] || "--"}`)}
      <h3>Retroalimentaciones</h3>${listHtml(feedback, (r) => `${r.Fecha || ""} - ${r.Tema || r.Tipo || "Seguimiento"}: ${r.Compromisos || r.Descripcion || ""}`)}
      <h3>Proyectos asignados</h3>${listHtml(projects, (r) => `${r["Nombre del proyecto"] || "Proyecto"} - ${r.Estado || "Sin estado"} - Avance ${r["Avance %"] || 0}%`)}
      <h3>Conclusion general</h3><p>${escapeHtml(individualConclusion(stats, latestEval, projects))}</p>
    `;
  }

  function calculateJornadaStats(practicante, jornadas) {
    const name = typeof practicante === "string" ? practicante : practicante?.["Nombre completo"] || practicante?.Practicante || "";
    const rows = (jornadas || []).filter((row) => samePerson(row.__nombre || row.Practicante || row.Nombre || row["Nombre completo"], name));
    const uniqueDays = unique(rows.map((row) => normalizeDate(row.__fecha || row.Fecha || row.Timestamp || row["Marca temporal"]))).filter(Boolean);
    const expected = expectedPracticeDays(practicante);
    const weeklySchedule = parseWeeklySchedule(practicante?.["Horario semanal"], practicante);
    let late = 0;
    let onTime = 0;
    let minutesTotal = 0;
    let entryCount = 0;
    let hours = 0;
    rows.forEach((row) => {
      const entry = row.__entrada || row.Entrada || row.Ingreso || row["Hora entrada"] || row["Hora de ingreso"];
      const exit = row.__salida || row.Salida || row["Hora salida"] || row["Hora de salida"];
      const entryMinutes = timeToMinutes(entry);
      const rowDate = normalizeDate(row.__fecha || row.Fecha || row.Timestamp || row["Marca temporal"]);
      const scheduled = scheduledForDate(practicante, rowDate, weeklySchedule);
      if (entryMinutes !== null) {
        minutesTotal += entryMinutes;
        entryCount += 1;
        if (scheduled?.start && entryMinutes > timeToMinutes(scheduled.start)) late += 1;
        else onTime += 1;
      }
      const diff = diffHours(entry, exit);
      if (diff > 0) hours += diff;
      else hours += Number(String(row["Horas registradas"] || row.Horas || 0).replace(",", ".")) || 0;
    });
    const pct = entryCount ? (onTime / entryCount) * 100 : 0;
    const attendance = expected ? (uniqueDays.length / expected) * 100 : 0;
    const latest = uniqueDays.sort().at(-1) || "";
    const stale = latest && daysBetween(latest, new Date()) > 10;
    const alerta = !rows.length ? "Sin jornadas" : stale ? "Sin registros recientes" : late > 0 ? "Revisar llegadas tarde" : "";
    return {
      practicante: name,
      totalRegistros: rows.length,
      diasAsistidos: uniqueDays.length,
      horaPromedioEntrada: entryCount ? minutesToTime(minutesTotal / entryCount) : "",
      llegadasTarde: late,
      llegadasATiempo: onTime,
      jornadasEsperadas: expected,
      horarioSemanal: practicante?.["Horario semanal"] || "",
      totalHoras: hours,
      porcentajePuntualidad: pct,
      porcentajeAsistencia: attendance,
      ultimaJornada: latest,
      alerta,
      narrative: rows.length ? `Tiene ${rows.length} registro(s), ${uniqueDays.length} dia(s) asistidos${expected ? ` de ${expected} esperados` : ""}, ${round(hours)} hora(s), entrada promedio ${entryCount ? minutesToTime(minutesTotal / entryCount) : "sin dato"} y puntualidad de ${round(pct)}% frente al horario semanal registrado. ${alerta || "No se observan alertas fuertes."}` : "No se encontraron jornadas asociadas por nombre normalizado."
    };
  }

  function expectedPracticeDays(person) {
    const periods = (state.data.calendario || []).filter((row) => !row.Estado || row.Estado === "Activo");
    if (!periods.length) return Number(person?.["Dias esperados"] || 0);
    const personStart = normalizeDate(person?.["Fecha de inicio"]);
    const personEnd = normalizeDate(person?.["Fecha de finalizacion"]);
    const base = periods.reduce((total, period) => {
      const start = maxDate(normalizeDate(period["Fecha de inicio"]), personStart);
      const end = minDate(normalizeDate(period["Fecha de finalizacion"]), personEnd);
      const schedule = parseWeeklySchedule(person?.["Horario semanal"], person);
      const days = schedule.length ? schedule.map((item) => item.day) : parseWeekdays(period["Dias habilitados"]);
      return total + countWeekdaysBetween(start, end, days);
    }, 0);
    const adjustments = (state.data.ajustes_horario || []).filter((row) => samePerson(row.Practicante, person?.["Nombre completo"]));
    return adjustments.reduce((total, row) => {
      if (row.Tipo === "Reposicion") return total + 1;
      if (row.Tipo === "Cancelacion") return Math.max(0, total - 1);
      return total;
    }, base);
  }

  function scheduledForDate(person, date, schedule = parseWeeklySchedule(person?.["Horario semanal"], person)) {
    const adjustment = (state.data.ajustes_horario || []).find((row) => samePerson(row.Practicante, person?.["Nombre completo"]) && normalizeDate(row.Fecha) === date);
    if (adjustment) {
      if (adjustment.Tipo === "Cancelacion" || adjustment.Tipo === "No aplica") return null;
      return { start: adjustment["Hora inicio"], end: adjustment["Hora fin"], source: "ajuste" };
    }
    const day = new Date(`${date}T00:00:00`).getDay();
    return schedule.find((item) => item.day === day) || null;
  }

  function normalizeName(name) {
    return normalizeText(name).replace(/\s+/g, " ").trim();
  }

  function normalizeText(text) {
    return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  function samePerson(a, b) {
    const na = normalizeName(a);
    const nb = normalizeName(b);
    if (!na || !nb) return false;
    return na === nb || na.includes(nb) || nb.includes(na) || tokenOverlap(na, nb) >= 0.75;
  }

  function tokenOverlap(a, b) {
    const aa = a.split(" ").filter(Boolean);
    const bb = b.split(" ").filter(Boolean);
    const matches = aa.filter((x) => bb.includes(x)).length;
    return matches / Math.max(aa.length, bb.length, 1);
  }

  function filteredRows(key) {
    const filter = state.filters[key];
    return (state.data[key] || []).filter((row) => matchesFilter(row, filter));
  }

  function matchesFilter(row, filter) {
    const text = normalizeText(Object.values(row).join(" "));
    if (filter.search && !text.includes(normalizeText(filter.search))) return false;
    if (filter.practicante && !samePerson(row.Practicante || row["Nombre completo"], filter.practicante)) return false;
    if (filter.mes && normalizeMonth(row.Mes || row.Fecha || row["Fecha de inicio"]) !== filter.mes) return false;
    if (filter.estado && row.Estado !== filter.estado) return false;
    if (filter.programa) {
      const p = row.Programa || findPerson(row.Practicante)?.Programa || "";
      if (p !== filter.programa) return false;
    }
    if (filter.tipo && (row.Tipo || row["Tipo de actividad"] || row.Estado) !== filter.tipo) return false;
    return true;
  }

  function filteredForReport(key) {
    const f = state.filters.informes;
    return (state.data[key] || []).filter((row) => {
      if (f.practicante && !samePerson(row.Practicante || row["Nombre completo"], f.practicante)) return false;
      if (f.mes && normalizeMonth(row.Mes || row.Fecha || row["Fecha de inicio"]) !== f.mes) return false;
      if (f.ano && row.Ano && String(row.Ano) !== String(f.ano)) return false;
      if (f.estado && row.Estado !== f.estado) return false;
      if (f.programa) {
        const p = row.Programa || findPerson(row.Practicante)?.Programa || "";
        if (p !== f.programa) return false;
      }
      return true;
    });
  }

  function reportPeople() {
    return (state.data.practicantes || []).filter((row) => matchesFilter(row, state.filters.informes));
  }

  function getPracticantesFiltered(filter) {
    return (state.data.practicantes || []).filter((row) => matchesFilter(row, filter));
  }

  function fieldHtml(col, value) {
    const label = escapeHtml(col.label || col.key) + (col.required ? " *" : "");
    const val = value ?? col.defaultValue ?? defaultValue(col.type);
    const required = col.required ? "required" : "";
    const wide = ["textarea", "url", "score"].includes(col.type) ? "wide" : "";
    const help = col.help ? `<small class="field-help">${escapeHtml(col.help)}</small>` : "";
    if (col.type === "textarea") return `<label class="${wide}"><span>${label}</span><textarea name="${escapeAttr(col.key)}" ${col.placeholder ? `placeholder="${escapeAttr(col.placeholder)}"` : ""} ${required}>${escapeHtml(val)}</textarea>${help}</label>`;
    if (col.type === "select") return `<label class="${wide}"><span>${label}</span><select name="${escapeAttr(col.key)}" ${required}>${optionsHtml(["", ...fieldOptions(col)], val)}</select>${help}</label>`;
    if (col.type === "person") return `<label class="${wide}"><span>${label}</span><select name="${escapeAttr(col.key)}" ${required}>${optionsHtml(["", ...peopleNames()], val)}</select></label>`;
    if (col.type === "score") return scoreFieldHtml(col, val, label, required);
    const type = col.type === "score" ? "number" : ["date", "month", "email", "url", "number", "time"].includes(col.type) ? col.type : "text";
    const min = col.min ?? (col.type === "score" ? 1 : "");
    const max = col.max ?? (col.type === "score" ? 5 : "");
    return `<label class="${wide}"><span>${label}</span><input name="${escapeAttr(col.key)}" type="${type}" value="${escapeAttr(val)}" ${col.placeholder ? `placeholder="${escapeAttr(col.placeholder)}"` : ""} ${required} ${min !== "" ? `min="${min}"` : ""} ${max !== "" ? `max="${max}"` : ""} ${col.type === "score" ? "step=\"0.1\"" : ""}>${help}</label>`;
  }

  function scoreFieldHtml(col, value, label, required) {
    const score = Math.max(0, Math.min(5, Number(value || 0)));
    const stars = [1, 2, 3, 4, 5].map((num) => `<button class="star-btn ${num <= score ? "active" : ""}" type="button" data-score-value="${num}" aria-label="${num} de 5">★</button>`).join("");
    return `<label class="wide score-field"><span>${label}</span><input name="${escapeAttr(col.key)}" type="hidden" value="${escapeAttr(score || "")}" ${required}><div class="star-rating" data-score-field="${escapeAttr(col.key)}">${stars}<strong>${score || "--"}</strong></div></label>`;
  }

  function bindScoreFields(container) {
    container.querySelectorAll(".star-rating").forEach((rating) => {
      const input = rating.closest("label")?.querySelector("input[type='hidden']");
      const valueLabel = rating.querySelector("strong");
      rating.querySelectorAll("[data-score-value]").forEach((button) => {
        button.addEventListener("click", () => {
          const value = button.dataset.scoreValue;
          input.value = value;
          valueLabel.textContent = value;
          rating.querySelectorAll("[data-score-value]").forEach((star) => {
            star.classList.toggle("active", Number(star.dataset.scoreValue) <= Number(value));
          });
        });
      });
    });
  }

  function tableHtml(rows, columns, context = {}) {
    if (!rows.length) return `<div class="empty">No hay datos para mostrar con este filtro.</div>`;
    return `<div class="table-wrap"><table><thead><tr>${columns.map((c) => `<th>${escapeHtml(c === "_actions" ? "Acciones" : c)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((col) => `<td>${cellHtml(row, col, context)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function cellHtml(row, col) {
    if (col === "_actions") return `<div class="row-actions"><button class="mini-btn" data-edit="${escapeAttr(row.ID)}" type="button">Editar</button><button class="mini-btn danger" data-delete="${escapeAttr(row.ID)}" type="button">Eliminar</button></div>`;
    const value = row[col];
    if (col === "Estado") return `<span class="badge ${badgeClass(value)}">${escapeHtml(value || "Sin estado")}</span>`;
    if (String(value || "").startsWith("http")) return `<a href="${escapeAttr(value)}" target="_blank" rel="noopener">Abrir enlace</a>`;
    return escapeHtml(value || "--");
  }

  async function apiGet(params) {
    const url = new URL(apiUrl());
    Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function apiPost(body) {
    if (!apiUrl()) throw new Error("Falta configurar API_URL en config.js.");
    const response = await fetch(apiUrl(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function isAdminUrl() {
    const marker = `${window.location.pathname} ${window.location.search} ${window.location.hash}`.toLowerCase();
    return /\badmin\b/.test(marker);
  }

  function apiUrl() { return String(CONFIG.API_URL || "").trim(); }
  function setStatus(message, type = "info") { const el = $("#status"); el.className = `status ${type}`; el.textContent = message; }
  function kpi(label, value, hint) { return `<div class="kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint || "")}</small></div>`; }
  function sectionForKey(key) { return key === "catalogos" ? "configuracion" : key; }
  function displayColumns(key) { return SCHEMA[key].columns.filter((c) => !c.system).slice(0, 9).map((c) => c.key); }
  function peopleNames() { return unique((state.data.practicantes || []).map((p) => p["Nombre completo"])).sort(localeSort); }
  function fieldOptions(col) { return unique([...(col.options || []), ...catalogValues(col.catalogType)]).sort(localeSort); }
  function catalogValues(type) {
    if (!type) return [];
    return (state.data.catalogos || [])
      .filter((row) => sameText(row.Tipo, type) && !sameText(row.Activo, "No"))
      .map((row) => row.Valor)
      .filter(Boolean);
  }
  function allMonths() { return unique(EDITABLE_KEYS.flatMap((key) => monthOptions(key))).sort().reverse(); }
  function monthOptions(key) { return unique((state.data[key] || []).map((r) => normalizeMonth(r.Mes || r.Fecha || r["Fecha de inicio"]))).filter(Boolean); }
  function typeOptions(key) { return unique((state.data[key] || []).map((r) => r.Tipo || r["Tipo de actividad"] || "")).filter(Boolean); }
  function selectHtml(name, key, label, values, current) { return `<select data-filter="${name}" data-key="${key}" aria-label="${label}">${optionsHtml(values, current, label)}</select>`; }
  function selectReport(name, label, values, current) { return `<select data-report-filter="${name}" aria-label="${label}">${optionsHtml(values, current, label)}</select>`; }
  function optionsHtml(values, current, emptyLabel = "Seleccionar") { return values.map((value) => `<option value="${escapeAttr(value)}" ${String(value) === String(current) ? "selected" : ""}>${escapeHtml(value || emptyLabel)}</option>`).join(""); }
  function sameText(a, b) { return normalizeText(a) === normalizeText(b); }
  function findPerson(name) { return (state.data.practicantes || []).find((p) => samePerson(p["Nombre completo"], name)); }
  function firstVisiblePerson() { return reportPeople()[0] || (state.data.practicantes || [])[0]; }
  function recentHtml() { const items = [...(state.data.actividades || []).map((r) => [r.Fecha, "Actividad", r.Practicante, r.Descripcion]), ...(state.data.retroalimentaciones || []).map((r) => [r.Fecha, "Retroalimentacion", r.Practicante, r.Tema]), ...(state.data.proyectos || []).map((r) => [r["Fecha de inicio"], "Proyecto", r.Practicante, r["Nombre del proyecto"]])].sort((a, b) => String(b[0]).localeCompare(String(a[0]))).slice(0, 8); return items.length ? `<div class="timeline">${items.map((i) => `<div><strong>${escapeHtml(i[1])} - ${escapeHtml(i[2] || "Sin practicante")}</strong><span>${escapeHtml(i[0] || "Sin fecha")} - ${escapeHtml(i[3] || "")}</span></div>`).join("")}</div>` : `<div class="empty">Sin actividad reciente.</div>`; }
  function alertsHtml(stats) { const alerts = stats.filter((s) => s.alerta).map((s) => `${s.practicante}: ${s.alerta}`); if (state.jornadasMeta.warning) alerts.unshift(state.jornadasMeta.warning); return alerts.length ? `<ul>${alerts.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>` : "<p>No hay alertas fuertes con los datos actuales.</p>"; }
  function generalRecommendations(stats, evaluations, projects) { const items = []; if (stats.some((s) => !s.totalRegistros)) items.push("Revisar practicantes sin jornadas asociadas por nombre."); if (!evaluations.length) items.push("Registrar evaluaciones mensuales del periodo."); if (projects.some((p) => ["Planeado", "En proceso"].includes(p.Estado) && Number(p["Avance %"] || 0) < 30)) items.push("Actualizar avances de proyectos activos con baja trazabilidad."); if (!items.length) items.push("Mantener el registro mensual, las evidencias y el cierre oportuno de compromisos."); return items; }
  function individualConclusion(stats, latestEval, projects) { const score = Number(latestEval.Promedio || 0); const active = projects.filter((p) => !["Finalizado", "Cancelado"].includes(p.Estado)).length; if (!stats.totalRegistros && !score) return "Se requiere ampliar la informacion disponible antes de emitir una conclusion robusta."; return `El proceso muestra ${stats.totalRegistros} registro(s) de jornada, ${active} proyecto(s) activo(s) y un promedio de evaluacion ${score || "sin dato"}. Se recomienda sostener seguimiento sobre asistencia, evidencias y compromisos abiertos.`; }
  function listHtml(rows, mapper) { return rows.length ? `<ul>${rows.map((r) => `<li>${escapeHtml(mapper(r))}</li>`).join("")}</ul>` : "<p>No hay registros visibles.</p>"; }
  function reportPeriodLabel() { const f = state.filters.informes; return [f.mes, f.ano].filter(Boolean).join(" / ") || "Todos los periodos"; }
  function hasValues(row) { return Object.values(row || {}).some((v) => String(v || "").trim()); }
  function unique(items) { return [...new Set((items || []).map((v) => String(v || "").trim()).filter(Boolean))]; }
  function localeSort(a, b) { return String(a).localeCompare(String(b), "es", { sensitivity: "base" }); }
  function average(rows, key) { const nums = (rows || []).map((r) => Number(r[key] || 0)).filter((n) => Number.isFinite(n) && n > 0); return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; }
  function round(value, decimals = 1) { const n = Number(value || 0); return Number.isFinite(n) ? Math.round(n * 10 ** decimals) / 10 ** decimals : 0; }
  function defaultValue(type) { if (type === "date") return new Date().toISOString().slice(0, 10); if (type === "month") return new Date().toISOString().slice(0, 7); return ""; }
  function normalizeMonth(value) { const s = String(value || "").trim(); if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7); const d = new Date(s); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 7); }
  function normalizeDate(value) { const s = String(value || "").trim(); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); const d = new Date(s); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10); }
  function minDate(a, b) { return [a, b].filter(Boolean).sort().at(0) || ""; }
  function maxDate(a, b) { return [a, b].filter(Boolean).sort().at(-1) || ""; }
  function parseWeekdays(value) {
    const map = { domingo: 0, dom: 0, lunes: 1, lun: 1, martes: 2, mar: 2, miercoles: 3, mie: 3, miércoles: 3, jueves: 4, jue: 4, viernes: 5, vie: 5, sabado: 6, sábados: 6, sab: 6, sábado: 6 };
    const days = normalizeText(value).split(/\s+|,/).map((part) => map[part]).filter((day) => day !== undefined);
    return days.length ? unique(days).map(Number) : [1, 2, 3, 4, 5];
  }
  function parseWeeklySchedule(value, person = {}) {
    const text = String(value || "").trim();
    if (!text && person["Dias de practica"]) {
      return parseWeekdays(person["Dias de practica"]).map((day) => ({ day, start: person["Hora inicio programada"] || CONFIG.LATE_AFTER || "08:10", end: person["Hora fin programada"] || "" }));
    }
    const weekdayMap = { domingo: 0, dom: 0, lunes: 1, lun: 1, martes: 2, mar: 2, miercoles: 3, miércoles: 3, mie: 3, jueves: 4, jue: 4, viernes: 5, vie: 5, sabado: 6, sábado: 6, sab: 6 };
    return text.split(/\n|;/).map((line) => {
      const cleanLine = line.trim();
      const dayKey = Object.keys(weekdayMap).find((key) => normalizeText(cleanLine).includes(key));
      const times = cleanLine.match(/(\d{1,2})(?::(\d{2}))?\s*(?:a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?/gi) || [];
      const normalizedTimes = times.map(normalizeTimeText).filter(Boolean);
      if (!dayKey || !normalizedTimes.length) return null;
      return { day: weekdayMap[dayKey], start: normalizedTimes[0], end: normalizedTimes[1] || "" };
    }).filter(Boolean);
  }
  function normalizeTimeText(value) {
    const s = String(value || "").toLowerCase();
    const match = s.match(/(\d{1,2})(?::(\d{2}))?/);
    if (!match) return "";
    let hour = Number(match[1]);
    const minutes = match[2] || "00";
    if ((s.includes("pm") || s.includes("p. m")) && hour < 12) hour += 12;
    if ((s.includes("am") || s.includes("a. m")) && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${minutes}`;
  }
  function countWeekdaysBetween(start, end, weekdays) {
    if (!start || !end || start > end) return 0;
    const allowed = new Set(weekdays);
    let count = 0;
    for (let date = new Date(`${start}T00:00:00`), limit = new Date(`${end}T00:00:00`); date <= limit; date.setDate(date.getDate() + 1)) {
      if (allowed.has(date.getDay())) count += 1;
    }
    return count;
  }
  function timeToMinutes(value) { const s = String(value || "").trim(); const match = s.match(/(\d{1,2}):(\d{2})/); if (!match) return null; return Number(match[1]) * 60 + Number(match[2]); }
  function minutesToTime(value) { const total = Math.round(Number(value || 0)); return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }
  function diffHours(start, end) { const a = timeToMinutes(start); const b = timeToMinutes(end); if (a === null || b === null || b <= a) return 0; return (b - a) / 60; }
  function daysBetween(date, now) { const d = new Date(`${date}T00:00:00`); return Math.floor((new Date(now).setHours(0,0,0,0) - d.getTime()) / 86400000); }
  function badgeClass(value) { const s = normalizeText(value); if (s.includes("activo") || s.includes("finalizado") || s.includes("cerrada")) return "good"; if (s.includes("proceso") || s.includes("pendiente") || s.includes("pausado")) return "warn"; if (s.includes("retirado") || s.includes("cancelado")) return "bad"; return "neutral"; }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch])); }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g, "&#096;"); }

  Object.assign(window, { loadAllData, renderDashboard, renderPracticantes: () => renderCrudSection("practicantes"), renderCalendario: () => renderCrudSection("calendario"), renderActividades: () => renderCrudSection("actividades"), renderEvaluaciones: () => renderCrudSection("evaluaciones"), renderRetroalimentaciones: () => renderCrudSection("retroalimentaciones"), renderProyectos: () => renderCrudSection("proyectos"), openCreateModal, openEditModal, saveRecord, deleteRecord, generateGeneralReport, generateIndividualReport, calculateJornadaStats, normalizeName });
})();
