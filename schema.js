window.LEA_SCHEMA = {
  practicantes: {
    label: "Practicantes",
    singular: "practicante",
    sheetName: "Practicantes",
    editable: true,
    prefix: "PRA",
    createLabel: "Nuevo practicante",
    columns: [
      { key: "ID", type: "text", system: true },
      { key: "Nombre completo", type: "text", required: true, main: true },
      { key: "Documento", type: "text" },
      { key: "Correo", type: "email" },
      { key: "Telefono", label: "Teléfono", type: "text" },
      { key: "Programa", type: "text", required: true, defaultValue: "LEA" },
      { key: "Enfasis", label: "Énfasis", type: "select", options: ["Música", "Danza", "Artes plásticas", "Teatro", "Todos", "Otro"] },
      { key: "Institucion", label: "Institución", type: "text" },
      { key: "Coordinador de practica", label: "Coordinador de práctica", type: "text" },
      { key: "Fecha de inicio", type: "date" },
      { key: "Fecha de finalizacion", label: "Fecha de finalización", type: "date" },
      { key: "Horario semanal", type: "textarea", placeholder: "Viernes 15:00-19:00\nSabado 13:00-17:00", help: "Formato: un dia por linea. Ej: Viernes 15:00-19:00 / Sabado 13:00-17:00. Tambien acepta 3:00 pm-7:00 pm." },
      { key: "Estado", type: "select", required: true, options: ["Activo", "Pausado", "Finalizado", "Retirado"], defaultValue: "Activo" },
      { key: "Observaciones", type: "textarea" },
      { key: "CreatedAt", type: "datetime", system: true },
      { key: "UpdatedAt", type: "datetime", system: true }
    ]
  },
  calendario: {
    label: "Calendario",
    singular: "periodo",
    sheetName: "Calendario",
    editable: true,
    prefix: "CAL",
    createLabel: "Nuevo periodo",
    columns: [
      { key: "ID", type: "text", system: true },
      { key: "Nombre periodo", type: "text", required: true, defaultValue: "Semestre 2026" },
      { key: "Fecha de inicio", type: "date", required: true },
      { key: "Fecha de finalizacion", label: "Fecha de finalización", type: "date", required: true },
      { key: "Dias habilitados", label: "Días habilitados", type: "text", defaultValue: "Lunes, Martes, Miercoles, Jueves, Viernes" },
      { key: "Estado", type: "select", options: ["Activo", "Inactivo"], defaultValue: "Activo" },
      { key: "Observaciones", type: "textarea" },
      { key: "CreatedAt", type: "datetime", system: true },
      { key: "UpdatedAt", type: "datetime", system: true }
    ]
  },
  ajustes_horario: {
    label: "Ajustes de Horario",
    singular: "ajuste",
    sheetName: "Ajustes de Horario",
    editable: true,
    prefix: "AJU",
    createLabel: "Nuevo ajuste",
    columns: [
      { key: "ID", type: "text", system: true },
      { key: "Practicante", type: "person", required: true, main: true },
      { key: "Fecha", type: "date", required: true },
      { key: "Tipo", type: "select", options: ["Cambio de horario", "Reposicion", "No aplica", "Cancelacion"], defaultValue: "Cambio de horario" },
      { key: "Hora inicio", type: "time" },
      { key: "Hora fin", type: "time" },
      { key: "Observaciones", type: "textarea" },
      { key: "CreatedAt", type: "datetime", system: true },
      { key: "UpdatedAt", type: "datetime", system: true }
    ]
  },
  actividades: {
    label: "Actividades",
    singular: "actividad",
    sheetName: "Actividades",
    editable: true,
    prefix: "ACT",
    createLabel: "Nueva actividad",
    columns: [
      { key: "ID", type: "text", system: true },
      { key: "Fecha", type: "date", required: true },
      { key: "Practicante", type: "person", required: true, main: true },
      { key: "Tipo de actividad", type: "select", options: ["Clase", "Apoyo", "Planeacion", "Material", "Reunion", "Evento", "Administrativo", "Otro"], required: true },
      { key: "Descripcion", label: "Descripción", type: "textarea", required: true },
      { key: "Area", label: "Área", type: "select", options: ["Musica", "Danza", "Teatro", "Artes plasticas", "Porrismo", "Administrativo", "Interdisciplinar"] },
      { key: "Responsable", type: "text" },
      { key: "Evidencia / enlace", type: "url" },
      { key: "Observaciones", type: "textarea" },
      { key: "CreatedAt", type: "datetime", system: true },
      { key: "UpdatedAt", type: "datetime", system: true }
    ]
  },
  evaluaciones: {
    label: "Evaluaciones Mensuales",
    singular: "evaluacion",
    sheetName: "Evaluaciones Mensuales",
    editable: true,
    prefix: "EVA",
    createLabel: "Nueva evaluación",
    columns: [
      { key: "ID", type: "text", system: true },
      { key: "Mes", type: "month", required: true },
      { key: "Ano", label: "Año", type: "number", system: true },
      { key: "Practicante", type: "person", required: true, main: true },
      { key: "Evaluador", type: "select", required: true, options: ["Alek", "Cata"] },
      { key: "Actitud", type: "score" },
      { key: "Apoyo", type: "score" },
      { key: "Calidad", type: "score" },
      { key: "Comunicacion", label: "Comunicación", type: "score" },
      { key: "Disponibilidad de horario", type: "score" },
      { key: "Habilidades artisticas", label: "Habilidades artísticas", type: "score" },
      { key: "Habilidades generales", type: "score" },
      { key: "Presentacion personal", label: "Presentación personal", type: "score" },
      { key: "Puntualidad", type: "score" },
      { key: "Responsabilidad", type: "score" },
      { key: "Seguimiento de instrucciones", type: "score" },
      { key: "Sentido de pertenencia", type: "score" },
      { key: "Promedio", type: "number", system: true },
      { key: "Fortalezas", type: "textarea" },
      { key: "Aspectos por mejorar", type: "textarea" },
      { key: "Recomendaciones", type: "textarea" },
      { key: "Concepto general", type: "textarea" },
      { key: "CreatedAt", type: "datetime", system: true },
      { key: "UpdatedAt", type: "datetime", system: true }
    ]
  },
  retroalimentaciones: {
    label: "Retroalimentaciones",
    singular: "retroalimentacion",
    sheetName: "Retroalimentaciones",
    editable: true,
    prefix: "RET",
    createLabel: "Nueva retroalimentación",
    columns: [
      { key: "ID", type: "text", system: true },
      { key: "Fecha", type: "date", required: true },
      { key: "Practicante", type: "person", required: true, main: true },
      { key: "Tipo", type: "select", options: ["Seguimiento", "Alerta", "Reconocimiento", "Compromiso", "Cierre", "Otro"] },
      { key: "Tema", type: "text", required: true },
      { key: "Descripcion", label: "Descripción", type: "textarea" },
      { key: "Acuerdos", type: "textarea" },
      { key: "Compromisos", type: "textarea" },
      { key: "Responsable seguimiento", type: "text" },
      { key: "Fecha de seguimiento", type: "date" },
      { key: "Estado", type: "select", options: ["Abierta", "En seguimiento", "Cerrada", "Pendiente"], defaultValue: "Abierta" },
      { key: "CreatedAt", type: "datetime", system: true },
      { key: "UpdatedAt", type: "datetime", system: true }
    ]
  },
  proyectos: {
    label: "Proyectos",
    singular: "proyecto",
    sheetName: "Proyectos",
    editable: true,
    prefix: "PRO",
    createLabel: "Nuevo proyecto",
    columns: [
      { key: "ID", type: "text", system: true },
      { key: "Practicante", type: "person", required: true, main: true },
      { key: "Nombre del proyecto", type: "text", required: true },
      { key: "Descripcion", label: "Descripción", type: "textarea" },
      { key: "Objetivo", type: "textarea" },
      { key: "Estado", type: "select", options: ["Planeado", "En proceso", "En revision", "Finalizado", "Pausado", "Cancelado"], defaultValue: "Planeado" },
      { key: "Fecha de inicio", type: "date" },
      { key: "Fecha estimada de cierre", type: "date" },
      { key: "Avance %", type: "number", min: 0, max: 100 },
      { key: "Evidencias", type: "url" },
      { key: "Observaciones", type: "textarea" },
      { key: "CreatedAt", type: "datetime", system: true },
      { key: "UpdatedAt", type: "datetime", system: true }
    ]
  },
  catalogos: {
    label: "Catalogos",
    singular: "catalogo",
    sheetName: "Catalogos",
    editable: true,
    prefix: "CAT",
    createLabel: "Nuevo catálogo",
    columns: [
      { key: "ID", type: "text", system: true },
      { key: "Tipo", type: "text", required: true },
      { key: "Valor", type: "text", required: true },
      { key: "Activo", type: "select", options: ["Si", "No"], defaultValue: "Si" },
      { key: "CreatedAt", type: "datetime", system: true },
      { key: "UpdatedAt", type: "datetime", system: true }
    ]
  }
};

window.LEA_JORNADAS = {
  aliases: ["Registros de Jornadas", "Registro de Jornadas", "Registro jornadas", "Registro de jornada", "Registro Jornada", "Jornadas"],
  columns: {
    nombre: ["Nombre", "Practicante", "Nombre completo", "Estudiante", "Docente"],
    fecha: ["Fecha", "Dia", "Día", "Timestamp", "Marca temporal"],
    entrada: ["Hora entrada", "Entrada", "Hora de ingreso", "Ingreso"],
    salida: ["Hora salida", "Salida", "Hora de salida"],
    estado: ["Estado", "Tipo", "Jornada", "Modalidad"]
  }
};
