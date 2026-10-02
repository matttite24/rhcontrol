# Plan: módulo de Liquidaciones de personal (Ecuador)

> Borrador para revisar con contador y abogado laboral. Las normas citadas están
> escritas de memoria y **deben validarse** antes de usarlas en pagos reales.
> Fecha del borrador: 2026-10-02.

## 1. Estado actual en el proyecto

Existe un prototipo en `/employees/settlements`:
tabla `employee_settlements`, `NewSettlementModal.tsx` y la lista de bajas. Su
cálculo es de relleno y no es confiable:

- 15 días de sueldo pendiente fijos y 6 meses fijos para el décimo tercero.
- Décimo cuarto con 460 fijo, no el SBU vigente, y sin distinguir región.
- Vacaciones calculadas con `sueldo/24` (incorrecto).
- Marca al empleado como inactivo al crear el borrador, no al aprobar.
- No consulta saldo real de vacaciones, descuentos pendientes ni quincena pagada.

Piezas reutilizables: `src/lib/payroll/ecuador.ts` (SBU, décimos), el saldo de
vacaciones (`getEmployeeVacationBalanceAction`), descuentos, carta de renuncia
(`print-resignation-letter.ts`) y acta de entrega de bienes.

Interacción con el rol: el rol **ya excluye a los empleados inactivos**; el mes
de salida se paga solo por liquidación.

## 2. Cómo funciona la liquidación en Ecuador

### Rubros a favor del trabajador

| Rubro | Cálculo |
|---|---|
| Sueldo pendiente | sueldo/30 × días trabajados del mes de salida (más horas extras no pagadas) |
| Décimo tercero proporcional | suma de remuneraciones del 1-dic hasta la salida ÷ 12 |
| Décimo cuarto proporcional | SBU/360 × días trabajados en el período |
| Vacaciones no gozadas | (15 días por año, con días extra desde el año 6) − gozados, × sueldo/30 |
| Bonificación por desahucio | 25% de la última remuneración × años de servicio |
| Indemnización por despido intempestivo | < 3 años: 3 remuneraciones; 3–25 años: 1 por año; tope 25. Se suma el 25% de desahucio |
| Utilidades proporcionales | del año en curso; normalmente manual |

Notas:
- Décimo cuarto: período 1-ago a 31-jul en Sierra/Oriente; 1-mar a fin de febrero en Costa/Galápagos.
- Si los décimos se cobran mensualizados, no se pagan de nuevo.
- Fondos de reserva acumulados en el IESS los reclama el trabajador allá.
- Contrato a plazo fijo: se paga el 50% de lo que faltaba del contrato.
- Casos protegidos (embarazo, discapacidad, dirigentes sindicales) tienen indemnizaciones especiales.

### Descuentos
- Aporte IESS 9.45% sobre el sueldo pendiente (validar si las vacaciones aportan).
- Anticipo quincenal ya pagado del mes de salida.
- Cuotas pendientes de anticipos y crédito quirografario; multas o faltantes, con autorización escrita.
- Retención de impuesto a la renta si corresponde (las indemnizaciones suelen estar exentas; validar).

### Trámite legal
1. Carta de renuncia/desahucio o de terminación.
2. Acta de finiquito, firmada en el Ministerio del Trabajo.
3. Aviso de salida en el IESS (pocos días después de la terminación).
4. Pago de la liquidación en el plazo legal.
5. Certificado de trabajo y devolución de bienes entregados.

## 3. Plan por fases

| Fase | Contenido |
|---|---|
| 0. Reglas | Definir con abogado/contador las reglas por causal (renuncia, despido, desahucio, fin de contrato, mutuo acuerdo, visto bueno) y los puntos "validar". |
| 1. Modelo de datos | Ampliar `employee_settlements`: desglose por rubro, datos de entrada, región, último día trabajado, estado "anulado", fechas del trámite (aviso IESS, finiquito, pago). |
| 2. Motor de cálculo | Función pura con una regla por causal y soporte de décimos mensualizados/acumulados. Con pruebas contra casos reales de liquidación. |
| 3. Asistente | Empleado → causal y fecha → revisión de rubros editables con motivo → descuentos pendientes → resumen. |
| 4. Integraciones | Saldo de vacaciones, quincena pagada, cuotas de anticipos/quirografario pendientes, horas extras sin pagar; descuentos cerrados como liquidados. |
| 5. Documentos | Acta de finiquito, certificado de trabajo, liquidación detallada, comprobante de pago, checklist de salida. |
| 6. Flujo y cierre | Borrador → aprobado → pagado. Al aprobar: empleado inactivo con fecha de salida y registros del período bloqueados (como los roles generados). |

Cuidados con el rol:
- Evitar doble pago: el asistente debe incluir los días trabajados del mes de salida.
- Inactivar al **aprobar**, no al crear el borrador.

## 4. Puntos a validar con contador / abogado

1. Reglas exactas por causal (en especial desahucio vs. renuncia vs. mutuo acuerdo).
2. Días de vacaciones: tasa base y días extra desde el año 6.
3. ¿Las vacaciones no gozadas aportan al IESS?
4. Indemnización en contratos a plazo fijo y casos protegidos.
5. Retención de impuesto a la renta en la liquidación.
6. Plazo legal de pago y plazo del aviso de salida en el IESS.
7. Tratamiento de utilidades proporcionales.
8. Vigencia del SBU y cualquier reforma laboral reciente.

## 5. Datos que necesitamos del negocio

1. Provincia/región de trabajo (define el período del décimo cuarto); ¿hay más de una?
2. Causales a cubrir primero (propuesta: renuncia, despido intempestivo, mutuo acuerdo, fin de contrato).
3. ¿Décimos mensualizados o acumulados? (hoy se guarda por empleado)
4. Una liquidación real de ejemplo para contrastar el motor de cálculo.
