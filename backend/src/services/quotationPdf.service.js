const PDFDocument = require("pdfkit");

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(value = new Date()) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santiago"
  }).format(new Date(value));
}

function generateQuotationPdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 42,
      bufferPages: true,
      compress: false,
      info: {
        Title: `Cotizacion orden ${data.orden.id_orden} version ${data.cotizacion.version}`,
        Author: "SerialCare Cloud",
        Subject: "Cotizacion de servicio tecnico"
      }
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const pageBottom = 760;
    const ensureSpace = (height = 40) => {
      if (doc.y + height > pageBottom) doc.addPage();
    };
    const section = (title) => {
      ensureSpace(38);
      doc.moveDown(0.6).font("Helvetica-Bold").fontSize(11).fillColor("#164e63").text(title);
      doc.moveTo(42, doc.y + 3).lineTo(553, doc.y + 3).strokeColor("#a5f3fc").stroke();
      doc.moveDown(0.5).fillColor("#111827");
    };
    const field = (label, value) => {
      ensureSpace(22);
      doc.font("Helvetica-Bold").fontSize(9).text(`${label}: `, { continued: true });
      doc.font("Helvetica").text(value || "Sin informacion");
    };

    doc.rect(0, 0, 595, 100).fill("#0f172a");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(22).text("SerialCare Cloud", 42, 32);
    doc.font("Helvetica").fontSize(11).text("Cotizacion de servicio tecnico", 42, 62);
    doc.font("Helvetica-Bold").fontSize(12).text(`Orden ${data.orden.id_orden} - Version ${data.cotizacion.version}`, 340, 38, { width: 213, align: "right" });
    doc.font("Helvetica").fontSize(9).text(formatDate(data.fecha_generacion), 340, 61, { width: 213, align: "right" });
    doc.y = 120;

    section("Datos de la cotizacion");
    field("Estado", data.cotizacion.estado);
    field("Responsable", data.responsable || "Sin responsable");

    section("Cliente");
    field("Nombre", data.cliente.nombre);
    field("RUT", data.cliente.rut);
    field("Telefono", data.cliente.telefono);
    field("Correo", data.cliente.email);
    field("Direccion", data.cliente.direccion);

    section("Maquina");
    field("Tipo", data.maquina.tipo);
    field("Marca", data.maquina.marca);
    field("Modelo", data.maquina.modelo);
    field("Numero de serie", data.maquina.numero_serie);

    section("Evaluacion tecnica");
    field("Falla informada", data.orden.descripcion_problema);
    field("Diagnostico", data.orden.diagnostico);

    section("Repuestos");
    const columns = [42, 112, 292, 352, 430, 500];
    const headers = ["Codigo", "Repuesto", "Cant.", "Unitario", "Subtotal"];
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#334155");
    headers.forEach((header, index) => doc.text(header, columns[index], doc.y, { width: columns[index + 1] - columns[index] - 6 }));
    doc.moveDown(1.2).fillColor("#111827");
    if (data.repuestos.length === 0) {
      doc.font("Helvetica").fontSize(9).text("Sin repuestos asociados.");
    } else {
      data.repuestos.forEach((item) => {
        ensureSpace(28);
        const rowY = doc.y;
        doc.font("Helvetica").fontSize(8);
        doc.text(item.codigo || "-", columns[0], rowY, { width: 64 });
        doc.text(item.nombre, columns[1], rowY, { width: 174 });
        doc.text(String(item.cantidad), columns[2], rowY, { width: 54, align: "right" });
        doc.text(formatCurrency(item.valor_unitario), columns[3], rowY, { width: 72, align: "right" });
        doc.text(formatCurrency(item.subtotal), columns[4], rowY, { width: 76, align: "right" });
        doc.y = Math.max(doc.y, rowY + 24);
      });
    }

    section("Resumen monetario");
    if (Number(data.cotizacion.valor_ingreso || 0) > 0) field("Valor de ingreso", formatCurrency(data.cotizacion.valor_ingreso));
    field("Mano de obra", formatCurrency(data.cotizacion.mano_obra));
    field("Subtotal original", formatCurrency(data.cotizacion.subtotal_original));
    const discount = data.cotizacion.tipo_descuento === "PORCENTAJE"
      ? `${data.cotizacion.valor_descuento}%`
      : data.cotizacion.tipo_descuento === "MONTO_FIJO"
        ? formatCurrency(data.cotizacion.valor_descuento)
        : "Sin descuento";
    field("Descuento", discount);
    if (data.cotizacion.tipo_descuento) field("Motivo del descuento", data.cotizacion.motivo_descuento);
    ensureSpace(34);
    doc.moveDown(0.5).font("Helvetica-Bold").fontSize(14).fillColor("#0f172a")
      .text(`Total final: ${formatCurrency(data.cotizacion.total_final)}`, { align: "right" });

    section("Observaciones");
    doc.font("Helvetica").fontSize(9).fillColor("#111827")
      .text(data.cotizacion.observacion || data.orden.observaciones_recepcion || "Sin observaciones.");

    const pages = doc.bufferedPageRange();
    for (let index = 0; index < pages.count; index += 1) {
      doc.switchToPage(index);
      doc.font("Helvetica").fontSize(8).fillColor("#64748b")
        .text(`SerialCare Cloud - Pagina ${index + 1} de ${pages.count}`, 42, 780, { width: 511, align: "center" });
    }
    doc.end();
  });
}

module.exports = { generateQuotationPdf };
