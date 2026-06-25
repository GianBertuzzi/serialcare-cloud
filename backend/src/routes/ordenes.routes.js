const express = require("express");
const db = require("../db");
const verificarToken = require("../middlewares/verificarToken");
const verificarRol = require("../middlewares/verificarRol");

const router = express.Router();

const TIPOS_ORDEN = [
  "REPARACION",
  "GARANTIA",
  "MANTENIMIENTO",
  "PUESTA_EN_MARCHA"
];

const TIPOS_EVIDENCIA = ["IMAGEN", "PDF", "DOCUMENTO"];

const ORDEN_SELECT = `SELECT
  o.id_orden,
  o.id_producto,
  p.numero_serie,
  p.marca,
  p.modelo,
  p.estado_garantia,
  p.alerta_propiedad,
  p.fecha_registro AS fecha_registro_producto,
  p.id_cliente,
  c.nombre AS cliente_nombre,
  c.email AS cliente_email,
  o.id_modelo,
  pm.codigo_comercial,
  pm.descripcion AS descripcion_modelo,
  pm.familia AS familia_modelo,
  pm.marca AS marca_modelo,
  pm.certificado AS modelo_certificado,
  o.id_tecnico,
  u.nombre AS tecnico_nombre,
  u.email AS tecnico_email,
  o.id_sucursal,
  s.nombre AS nombre_sucursal,
  s.ciudad AS ciudad_sucursal,
  s.region AS region_sucursal,
  s.direccion AS direccion_sucursal,
  o.costo_ingreso_taller,
  o.valor_revision,
  o.tipo_orden,
  o.diagnostico,
  o.estado,
  o.fecha_creacion
FROM ordenes_servicio o
INNER JOIN productos p ON p.id_producto = o.id_producto
LEFT JOIN productos_modelo pm ON pm.id_modelo = o.id_modelo
LEFT JOIN usuarios u ON u.id_usuario = o.id_tecnico
LEFT JOIN usuarios c ON c.id_usuario = p.id_cliente
LEFT JOIN sucursales s ON s.id_sucursal = o.id_sucursal`;

const GARANTIA_DETALLE_SELECT = `SELECT
  g.id_garantia,
  g.id_orden,
  g.id_producto,
  g.id_sucursal,
  s.nombre AS nombre_sucursal,
  g.id_tecnico,
  u.nombre AS tecnico,
  u.email AS tecnico_email,
  p.numero_serie,
  p.marca,
  p.modelo,
  o.diagnostico,
  g.estado,
  g.observacion,
  g.observacion_marca,
  g.fecha_solicitud,
  g.fecha_revision
FROM garantias g
INNER JOIN ordenes_servicio o ON o.id_orden = g.id_orden
INNER JOIN productos p ON p.id_producto = g.id_producto
LEFT JOIN usuarios u ON u.id_usuario = g.id_tecnico
LEFT JOIN sucursales s ON s.id_sucursal = g.id_sucursal`;

router.use(verificarToken);

async function getUsuarioSucursal(idUsuario) {
  const result = await db.query(
    `SELECT
      u.id_usuario,
      u.id_sucursal,
      s.nombre AS nombre_sucursal,
      s.estado AS estado_sucursal,
      s.costo_ingreso_taller
    FROM usuarios u
    LEFT JOIN sucursales s ON s.id_sucursal = u.id_sucursal
    WHERE u.id_usuario = $1
    LIMIT 1`,
    [idUsuario]
  );

  return result.rows[0] || null;
}

function requireSucursal(usuarioSucursal, res) {
  if (!usuarioSucursal || !usuarioSucursal.id_sucursal) {
    res.status(400).json({
      error: "Usuario ADMIN/TECNICO no tiene sucursal asignada"
    });
    return false;
  }

  return true;
}

async function getOrdenDetalle(idOrden) {
  const result = await db.query(
    `${ORDEN_SELECT}
    WHERE o.id_orden = $1
    LIMIT 1`,
    [idOrden]
  );

  return result.rows[0] || null;
}

async function getGarantiaDetalle(idGarantia) {
  const result = await db.query(
    `${GARANTIA_DETALLE_SELECT}
    WHERE g.id_garantia = $1
    LIMIT 1`,
    [idGarantia]
  );

  return result.rows[0] || null;
}

async function getOrdenParaUsuario(idOrden, usuario, allowMarca = false, allowCliente = false) {
  const orden = await getOrdenDetalle(idOrden);

  if (!orden) {
    return { status: 404, error: "Orden no encontrada" };
  }

  if (usuario.rol === "MARCA" && allowMarca) {
    return { orden, usuarioSucursal: null };
  }

  if (usuario.rol === "CLIENTE" && allowCliente) {
    if (Number(orden.id_cliente) !== Number(usuario.id_usuario)) {
      return { status: 404, error: "Orden no encontrada para el cliente" };
    }

    return { orden, usuarioSucursal: null };
  }

  const usuarioSucursal = await getUsuarioSucursal(usuario.id_usuario);

  if (!usuarioSucursal || !usuarioSucursal.id_sucursal) {
    return {
      status: 400,
      error: "Usuario ADMIN/TECNICO no tiene sucursal asignada"
    };
  }

  if (Number(orden.id_sucursal) !== Number(usuarioSucursal.id_sucursal)) {
    return {
      status: 404,
      error: "Orden no encontrada para la sucursal del usuario"
    };
  }

  return { orden, usuarioSucursal };
}

function parsePositiveInteger(value, defaultValue) {
  const numberValue = value === undefined || value === null || value === ""
    ? defaultValue
    : Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 1) {
    return null;
  }

  return numberValue;
}

function parseMoney(value, defaultValue = 0) {
  const numberValue = value === undefined || value === null || value === ""
    ? defaultValue
    : Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return Math.round(numberValue);
}

async function getRepuestos(idOrden) {
  const result = await db.query(
    `SELECT
      id_repuesto_usado,
      id_orden,
      nombre_repuesto,
      cantidad,
      precio_unitario,
      cubierto_garantia,
      observacion,
      fecha_registro
    FROM repuestos_usados
    WHERE id_orden = $1
    ORDER BY fecha_registro DESC, id_repuesto_usado DESC`,
    [idOrden]
  );

  return result.rows;
}

async function getCotizacion(idOrden) {
  const result = await db.query(
    `SELECT
      id_cotizacion,
      id_orden,
      mano_obra,
      total_repuestos,
      total,
      estado,
      observacion,
      fecha_creacion,
      fecha_respuesta
    FROM cotizaciones
    WHERE id_orden = $1
    LIMIT 1`,
    [idOrden]
  );

  return result.rows[0] || null;
}

async function getEvidencias(idOrden) {
  const result = await db.query(
    `SELECT
      id_evidencia,
      id_orden,
      tipo,
      nombre_archivo,
      url_archivo,
      descripcion,
      fecha_subida
    FROM evidencias_orden
    WHERE id_orden = $1
    ORDER BY fecha_subida DESC, id_evidencia DESC`,
    [idOrden]
  );

  return result.rows;
}

async function getGarantiaPorOrden(idOrden) {
  const result = await db.query(
    `${GARANTIA_DETALLE_SELECT}
    WHERE g.id_orden = $1
    ORDER BY g.fecha_solicitud DESC, g.id_garantia DESC
    LIMIT 1`,
    [idOrden]
  );

  return result.rows[0] || null;
}

async function buildOrdenDetalle(orden) {
  const [repuestos, cotizacion, garantia, evidencias] = await Promise.all([
    getRepuestos(orden.id_orden),
    getCotizacion(orden.id_orden),
    getGarantiaPorOrden(orden.id_orden),
    getEvidencias(orden.id_orden)
  ]);

  return {
    orden,
    producto: {
      id_producto: orden.id_producto,
      numero_serie: orden.numero_serie,
      marca: orden.marca,
      modelo: orden.modelo,
      estado_garantia: orden.estado_garantia,
      alerta_propiedad: orden.alerta_propiedad,
      fecha_registro: orden.fecha_registro_producto
    },
    modelo: {
      id_modelo: orden.id_modelo,
      codigo_comercial: orden.codigo_comercial,
      descripcion: orden.descripcion_modelo,
      familia: orden.familia_modelo,
      marca: orden.marca_modelo,
      certificado: orden.modelo_certificado
    },
    sucursal: {
      id_sucursal: orden.id_sucursal,
      nombre: orden.nombre_sucursal,
      ciudad: orden.ciudad_sucursal,
      region: orden.region_sucursal,
      direccion: orden.direccion_sucursal
    },
    cliente: orden.id_cliente
      ? {
          id_cliente: orden.id_cliente,
          nombre: orden.cliente_nombre,
          email: orden.cliente_email
        }
      : null,
    tecnico: orden.id_tecnico
      ? {
          id_tecnico: orden.id_tecnico,
          nombre: orden.tecnico_nombre,
          email: orden.tecnico_email
        }
      : null,
    repuestos,
    cotizacion,
    garantia,
    evidencias
  };
}

router.get(
  "/",
  verificarRol("ADMIN", "TECNICO", "MARCA"),
  async (req, res) => {
    const isMarca = req.usuario.rol === "MARCA";

    try {
      const usuarioSucursal = isMarca
        ? null
        : await getUsuarioSucursal(req.usuario.id_usuario);

      if (!isMarca && !requireSucursal(usuarioSucursal, res)) {
        return;
      }

      const params = isMarca ? [] : [usuarioSucursal.id_sucursal];

      const result = await db.query(
        `${ORDEN_SELECT}
        ${isMarca ? "" : "WHERE o.id_sucursal = $1"}
        ORDER BY o.fecha_creacion DESC`,
        params
      );

      return res.json({ ordenes: result.rows });
    } catch (error) {
      console.error("Error listando ordenes de servicio:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

router.post("/", verificarRol("ADMIN", "TECNICO"), async (req, res) => {
  const {
    id_producto,
    numero_serie,
    tipo_orden = "REPARACION",
    diagnostico = ""
  } = req.body || {};

  const hasProductoId =
    id_producto !== undefined &&
    id_producto !== null &&
    String(id_producto).trim() !== "";
  const numeroSerie =
    typeof numero_serie === "string" ? numero_serie.trim() : "";
  const tipoOrden = String(tipo_orden || "REPARACION").trim().toUpperCase();
  const diagnosticoOrden =
    typeof diagnostico === "string" ? diagnostico.trim() : "";

  if (!hasProductoId && !numeroSerie) {
    return res.status(400).json({
      error: "id_producto o numero_serie es obligatorio"
    });
  }

  if (!TIPOS_ORDEN.includes(tipoOrden)) {
    return res.status(400).json({
      error: "tipo_orden no es valido"
    });
  }

  try {
    const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

    if (!requireSucursal(usuarioSucursal, res)) {
      return;
    }

    if (usuarioSucursal.estado_sucursal !== "ACTIVA") {
      return res.status(403).json({
        error: "La sucursal del usuario esta INACTIVA y no puede crear ordenes"
      });
    }

    const productoResult = hasProductoId
      ? await db.query(
          `SELECT id_producto, numero_serie, marca, modelo, id_modelo
          FROM productos
          WHERE id_producto = $1
          LIMIT 1`,
          [id_producto]
        )
      : await db.query(
          `SELECT id_producto, numero_serie, marca, modelo, id_modelo
          FROM productos
          WHERE UPPER(numero_serie) = UPPER($1)
          LIMIT 1`,
          [numeroSerie]
        );

    if (productoResult.rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const producto = productoResult.rows[0];

    if (!producto.id_modelo) {
      return res.status(400).json({
        error: "El producto no tiene un modelo de maquina asociado"
      });
    }

    const precioResult = await db.query(
      `SELECT valor_revision
      FROM precios_modelo_sucursal
      WHERE id_sucursal = $1
        AND id_modelo = $2
        AND estado = 'ACTIVO'
      LIMIT 1`,
      [usuarioSucursal.id_sucursal, producto.id_modelo]
    );

    if (precioResult.rows.length === 0) {
      return res.status(400).json({
        error:
          "No existe valor de revision configurado para este modelo en la sucursal"
      });
    }

    const idTecnico =
      req.usuario.rol === "TECNICO" ? req.usuario.id_usuario : null;

    const result = await db.query(
      `INSERT INTO ordenes_servicio (
        id_producto,
        id_tecnico,
        id_sucursal,
        id_modelo,
        costo_ingreso_taller,
        valor_revision,
        tipo_orden,
        diagnostico,
        estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDIENTE')
      RETURNING id_orden`,
      [
        producto.id_producto,
        idTecnico,
        usuarioSucursal.id_sucursal,
        producto.id_modelo,
        usuarioSucursal.costo_ingreso_taller || 0,
        precioResult.rows[0].valor_revision,
        tipoOrden,
        diagnosticoOrden
      ]
    );

    const orden = await getOrdenDetalle(result.rows[0].id_orden);

    return res.status(201).json({ orden });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(404).json({
        error: "Producto, tecnico, sucursal o modelo no encontrado"
      });
    }

    console.error("Error creando orden de servicio:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get(
  "/:id/detalle",
  verificarRol("ADMIN", "TECNICO", "MARCA", "CLIENTE"),
  async (req, res) => {
    try {
      const access = await getOrdenParaUsuario(
        req.params.id,
        req.usuario,
        true,
        true
      );

      if (access.error) {
        return res.status(access.status).json({ error: access.error });
      }

      const detalle = await buildOrdenDetalle(access.orden);
      return res.json({ detalle });
    } catch (error) {
      console.error("Error obteniendo detalle de orden:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

router.get(
  "/:id/repuestos",
  verificarRol("ADMIN", "TECNICO", "MARCA"),
  async (req, res) => {
    try {
      const access = await getOrdenParaUsuario(
        req.params.id,
        req.usuario,
        true
      );

      if (access.error) {
        return res.status(access.status).json({ error: access.error });
      }

      const repuestos = await getRepuestos(access.orden.id_orden);
      return res.json({ repuestos });
    } catch (error) {
      console.error("Error listando repuestos de orden:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

router.post(
  "/:id/repuestos",
  verificarRol("ADMIN", "TECNICO"),
  async (req, res) => {
    const {
      nombre_repuesto,
      cantidad = 1,
      precio_unitario = 0,
      cubierto_garantia = false,
      observacion = ""
    } = req.body || {};

    const nombreRepuesto =
      typeof nombre_repuesto === "string" ? nombre_repuesto.trim() : "";
    const cantidadValue = parsePositiveInteger(cantidad, 1);
    const precioUnitarioValue = parseMoney(precio_unitario, 0);
    const cubiertoGarantiaValue =
      cubierto_garantia === true || cubierto_garantia === "true";
    const observacionValue =
      typeof observacion === "string" ? observacion.trim() : "";

    if (!nombreRepuesto) {
      return res.status(400).json({ error: "nombre_repuesto es obligatorio" });
    }

    if (cantidadValue === null) {
      return res.status(400).json({
        error: "cantidad debe ser un numero entero mayor o igual a 1"
      });
    }

    if (precioUnitarioValue === null) {
      return res.status(400).json({
        error: "precio_unitario debe ser un numero mayor o igual a 0"
      });
    }

    try {
      const access = await getOrdenParaUsuario(req.params.id, req.usuario);

      if (access.error) {
        return res.status(access.status).json({ error: access.error });
      }

      const result = await db.query(
        `INSERT INTO repuestos_usados (
          id_orden,
          nombre_repuesto,
          cantidad,
          precio_unitario,
          cubierto_garantia,
          observacion
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id_repuesto_usado,
          id_orden,
          nombre_repuesto,
          cantidad,
          precio_unitario,
          cubierto_garantia,
          observacion,
          fecha_registro`,
        [
          access.orden.id_orden,
          nombreRepuesto,
          cantidadValue,
          precioUnitarioValue,
          cubiertoGarantiaValue,
          observacionValue
        ]
      );

      return res.status(201).json({ repuesto: result.rows[0] });
    } catch (error) {
      console.error("Error agregando repuesto a orden:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

router.get(
  "/:id/cotizacion",
  verificarRol("ADMIN", "TECNICO", "MARCA", "CLIENTE"),
  async (req, res) => {
    try {
      const access = await getOrdenParaUsuario(
        req.params.id,
        req.usuario,
        true,
        true
      );

      if (access.error) {
        return res.status(access.status).json({ error: access.error });
      }

      const cotizacion = await getCotizacion(access.orden.id_orden);
      return res.json({ cotizacion });
    } catch (error) {
      console.error("Error obteniendo cotizacion:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

router.post(
  "/:id/cotizacion",
  verificarRol("ADMIN", "TECNICO"),
  async (req, res) => {
    const manoObra = parseMoney(req.body?.mano_obra, 0);
    const observacion =
      typeof req.body?.observacion === "string" ? req.body.observacion.trim() : "";
    const estado =
      typeof req.body?.estado === "string" && req.body.estado.trim()
        ? req.body.estado.trim().toUpperCase()
        : "BORRADOR";

    if (manoObra === null) {
      return res.status(400).json({
        error: "mano_obra debe ser un numero mayor o igual a 0"
      });
    }

    if (!["BORRADOR", "ENVIADA", "APROBADA", "RECHAZADA"].includes(estado)) {
      return res.status(400).json({ error: "estado de cotizacion no es valido" });
    }

    try {
      const access = await getOrdenParaUsuario(req.params.id, req.usuario);

      if (access.error) {
        return res.status(access.status).json({ error: access.error });
      }

      const totalResult = await db.query(
        `SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS total_repuestos
        FROM repuestos_usados
        WHERE id_orden = $1`,
        [access.orden.id_orden]
      );

      const totalRepuestos = Number(totalResult.rows[0]?.total_repuestos || 0);
      const total = manoObra + totalRepuestos;

      const result = await db.query(
        `INSERT INTO cotizaciones (
          id_orden,
          mano_obra,
          total_repuestos,
          total,
          estado,
          observacion
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id_orden) DO UPDATE
        SET mano_obra = EXCLUDED.mano_obra,
            total_repuestos = EXCLUDED.total_repuestos,
            total = EXCLUDED.total,
            estado = EXCLUDED.estado,
            observacion = EXCLUDED.observacion
        RETURNING
          id_cotizacion,
          id_orden,
          mano_obra,
          total_repuestos,
          total,
          estado,
          observacion,
          fecha_creacion,
          fecha_respuesta`,
        [access.orden.id_orden, manoObra, totalRepuestos, total, estado, observacion]
      );

      return res.json({ cotizacion: result.rows[0] });
    } catch (error) {
      console.error("Error guardando cotizacion:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

router.get(
  "/:id/evidencias",
  verificarRol("ADMIN", "TECNICO", "MARCA", "CLIENTE"),
  async (req, res) => {
    try {
      const access = await getOrdenParaUsuario(
        req.params.id,
        req.usuario,
        true,
        true
      );

      if (access.error) {
        return res.status(access.status).json({ error: access.error });
      }

      const evidencias = await getEvidencias(access.orden.id_orden);
      return res.json({ evidencias });
    } catch (error) {
      console.error("Error obteniendo evidencias:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

router.post(
  "/:id/evidencias",
  verificarRol("ADMIN", "TECNICO"),
  async (req, res) => {
    const tipo = typeof req.body?.tipo === "string" ? req.body.tipo.trim().toUpperCase() : "";
    const nombreArchivo =
      typeof req.body?.nombre_archivo === "string" ? req.body.nombre_archivo.trim() : "";
    const urlArchivo =
      typeof req.body?.url_archivo === "string" ? req.body.url_archivo.trim() : "";
    const descripcion =
      typeof req.body?.descripcion === "string" ? req.body.descripcion.trim() : "";

    if (!TIPOS_EVIDENCIA.includes(tipo)) {
      return res.status(400).json({ error: "tipo de evidencia no es valido" });
    }

    if (!nombreArchivo) {
      return res.status(400).json({ error: "nombre_archivo es obligatorio" });
    }

    try {
      const access = await getOrdenParaUsuario(req.params.id, req.usuario);

      if (access.error) {
        return res.status(access.status).json({ error: access.error });
      }

      const result = await db.query(
        `INSERT INTO evidencias_orden (
          id_orden,
          tipo,
          nombre_archivo,
          url_archivo,
          descripcion
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id_evidencia,
          id_orden,
          tipo,
          nombre_archivo,
          url_archivo,
          descripcion,
          fecha_subida`,
        [access.orden.id_orden, tipo, nombreArchivo, urlArchivo, descripcion]
      );

      return res.status(201).json({ evidencia: result.rows[0] });
    } catch (error) {
      console.error("Error registrando evidencia:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

router.post(
  "/:id/solicitar-garantia",
  verificarRol("ADMIN", "TECNICO"),
  async (req, res) => {
    const motivoRaw = req.body?.motivo_solicitud ?? req.body?.observacion ?? "";
    const observacion =
      typeof motivoRaw === "string" ? motivoRaw.trim() : String(motivoRaw || "");

    try {
      const access = await getOrdenParaUsuario(req.params.id, req.usuario);

      if (access.error) {
        return res.status(access.status).json({ error: access.error });
      }

      const duplicateResult = await db.query(
        `SELECT id_garantia
        FROM garantias
        WHERE id_orden = $1
          AND estado IN ('PENDIENTE', 'EN_REVISION')
        LIMIT 1`,
        [access.orden.id_orden]
      );

      if (duplicateResult.rows.length > 0) {
        return res.status(409).json({
          error: "Ya existe una solicitud de garantia activa para esta orden"
        });
      }

      const idTecnico =
        access.orden.id_tecnico ||
        (req.usuario.rol === "TECNICO" ? req.usuario.id_usuario : null);

      const result = await db.query(
        `INSERT INTO garantias (
          id_orden,
          id_producto,
          id_sucursal,
          id_tecnico,
          estado,
          observacion
        )
        VALUES ($1, $2, $3, $4, 'PENDIENTE', $5)
        RETURNING id_garantia`,
        [
          access.orden.id_orden,
          access.orden.id_producto,
          access.orden.id_sucursal,
          idTecnico,
          observacion || "Solicitud de garantia levantada desde orden de servicio"
        ]
      );

      const garantia = await getGarantiaDetalle(result.rows[0].id_garantia);

      return res.status(201).json({ garantia });
    } catch (error) {
      console.error("Error solicitando garantia desde orden:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

router.put(
  "/:id/estado",
  verificarRol("ADMIN", "TECNICO"),
  async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body || {};

    if (!estado) {
      return res.status(400).json({ error: "estado es obligatorio" });
    }

    try {
      const usuarioSucursal = await getUsuarioSucursal(req.usuario.id_usuario);

      if (!requireSucursal(usuarioSucursal, res)) {
        return;
      }

      const result = await db.query(
        `UPDATE ordenes_servicio
        SET estado = $1
        WHERE id_orden = $2
          AND id_sucursal = $3
        RETURNING id_orden`,
        [estado, id, usuarioSucursal.id_sucursal]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Orden no encontrada para la sucursal del usuario"
        });
      }

      const orden = await getOrdenDetalle(result.rows[0].id_orden);

      return res.json({ orden });
    } catch (error) {
      console.error("Error actualizando estado de orden:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

module.exports = router;