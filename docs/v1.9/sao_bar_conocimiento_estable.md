# Base de conocimiento SAO Bar
# Cada seccion (##) es un chunk independiente para vectorizar.
# Escrito en lenguaje claro para la administradora del bar.

## Como abrir una jornada o iniciar el dia en caja

Para abrir una jornada nueva, ingresa a la seccion Caja desde el menu de navegacion del panel de administracion. El sistema solicitara tu PIN de administrador (código de seguridad). Una vez validado el PIN, la jornada se abre oficialmente.

Solo se puede abrir una jornada si la anterior esta completamente cerrada. No puede haber dos jornadas abiertas al mismo tiempo; el sistema lo impide automaticamente. Una vez abierta la jornada, todas las terminales de comandas se desbloquean y se pueden empezar a registrar pedidos.

## Como tomar, enviar, otorgar o mandar una comanda

Cuando la jornada esta abierta, los mozos o la administradora acceden a la pantalla de Comandas (/comandas). Ahi se visualizan las tarjetas de productos organizadas por categorias (Tragos, Cerveza, Comida, Cafeteria, Postres, Sin Alcohol).

Pasos para enviar una comanda:
1. Hacer clic o pulsar sobre cada producto que solicita el cliente para agregarlo al carrito.
2. Seleccionar el medio de pago: Efectivo, Mercado Pago o Regalo de la casa.
3. Opcionalmente, asignar un numero de beeper (del 1 al 20) para llamar o identificar al cliente.
4. Presionar el boton de enviar comanda.

Al enviar el pedido, el sistema le asigna automaticamente un numero de ticket correlativo (ej. Ticket #101), descuenta el stock en tiempo real y habilita la opcion de imprimir el ticket de cocina.

## Que es y como registrar una comanda de regalo

El medio de pago "Regalo" se utiliza cuando se le obsequia o invita consumicion a un cliente sin cobrarle dinero. 

Al marcar una comanda como Regalo:
1. El sistema registra el total en cero pesos ($0.00), por lo que no suma dinero a la caja en efectivo ni Mercado Pago.
2. Descuenta obligatoriamente el stock fisico de los productos consumidos.

De esta forma, las unidades regaladas quedan justificadas para la auditoria de inventario al final de la jornada y no figuran como faltantes o desvios indeseados.

## Que tipos de productos existen en el sistema (Venta vs Insumos)

En SAO Bar existen dos clasificaciones de productos:
1. Productos de Venta: Son los productos finales que se muestran en la pantalla de comandas para ser vendidos a los clientes (ej. Fernet, Cerveza Tirada, Pizza Muzza, Cafe). Pueden tener seguimiento de stock activado o desactivado.
2. Insumos Internos: Son materias primas o ingredientes que no aparecen en el menu de comandas (ej. Bollos de Pizza, Botellas de Licor base, Cafe en grano). Los insumos tienen seguimiento de stock obligatorio y se consumen al elaborar otros productos o durante la auditoria.

## Como funciona el stock compartido entre productos e insumos

El stock compartido permite que multiples productos de venta dependan del inventario de un mismo insumo comun (relacion 1 a 1).

Ejemplo clasico de las pizzas:
- Productos de Venta: Pizza Muzza, Pizza Jamon, Pizza Napolitana.
- Insumo Asociado: "Bollos Prepizza Masa Madre".

Cuando se vende cualquier variedad de pizza, el stock se descuenta del insumo base (los bollos). Si hay 10 bollos y se venden 2 Pizza Muzza y 1 Napolitana, quedan 7 bollos disponibles. Las tres pizzas mostraran 7 unidades en pantalla. Si los bollos llegan a cero, todas las pizzas asociadas se deshabilitan automaticamente en tiempo real.

## Cuando usar stock compartido vs productos de elaboracion instantanea

Se debe usar Stock Compartido cuando el consumo del insumo es exacto y fijo (1 a 1). Por ejemplo, 1 pizza vendida = 1 bollo consumido.

NO se debe usar Stock Compartido cuando el consumo de insumo es variable o aproximado (ej. la leche en distintas variedades de cafe, el hielo o jugo en cocteleria).

Solucion para productos de elaboracion instantanea (insumos variables):
Los productos con insumos variables (como el cafe o tragos complejos) se configuran como productos de venta sin seguimiento de stock. El insumo (ej. el cartón de leche o botella de licor) se controla aparte como un insumo interno con seguimiento de stock activado. Durante el cierre de jornada, la administradora carga manualmente el consumo real en la auditoria fisica.

## Como dar de alta o crear un producto nuevo

Para crear o dar de alta un producto nuevo:
1. Ingresar a la seccion Productos en el panel de administracion.
2. Presionar el boton "Nuevo Producto".
3. Completar los campos requeridos: Nombre, Precio, Categoria y seleccionar si es un Producto de Venta o un Insumo.
4. Si es de venta: indicar si controla stock y si se asocia a un insumo de stock compartido.
5. Si es insumo: definir la unidad de medida (unidades, litros o mililitros), stock ideal semanal y stock inicial.

## Como editar, modificar o actualizar un producto existente (precio, nombre, categoria, stock)

Para modificar, editar o cambiar datos de un producto (como su precio de venta, su nombre, su categoria o su stock):
1. Ingresar a la seccion Productos del panel de administracion.
2. Localizar el producto en la lista o utilizar la barra de busqueda por nombre.
3. Presionar la opcion u icono de "Editar".
4. Modificar el campo deseado (ej. cambiar el precio de $3500 a $4000, cambiar la categoria o actualizar el stock actual).
5. Guardar los cambios. El precio o stock actualizado surtira efecto de inmediato en la pantalla de comandas.

## Como dar de baja, inactivar, desactivar o eliminar un producto

En SAO Bar los productos NO se eliminan ni se borran fisicamente de la base de datos para evitar romper la trazabilidad de las ventas pasadas y los historiales de auditoria.

Para dar de baja o eliminar un producto:
1. Ingresar a la seccion Productos del panel de administracion.
2. Buscar el producto y presionar la opcion de "Desactivar" o dar de baja.
3. El producto pasa a estado inactivo.

Efecto: El producto desactivado deja de aparecer inmediatamente en la pantalla de comandas de los mozos y no se puede vender. Sin embargo, toda su historia de ventas anteriores y estadisticas permanecen intactas.

## Como reactivar, volver a activar o dar de alta nuevamente un producto inactivo

Si un producto fue dado de baja previamente y se desea volver a venderlo:
1. Ingresar a la seccion Productos del panel de administracion.
2. Marcar el casillero o filtro "Mostrar productos inactivos".
3. Localizar el producto desactivado y presionar la opcion "Reactivar" o activar.
4. El producto vuelve a estado activo y reaparece al instante en el menu de comandas de los mozos.

## Como reponer, actualizar o modificar el stock de un producto o insumo

Para actualizar o cargar stock tras recibir un pedido de proveedores:
1. Ingresar a la seccion Productos en el panel de administracion.
2. Buscar el producto o insumo y presionar "Editar".
3. Modificar la casilla "Stock Actual" colocando la cantidad total real existente tras la reposicion.
4. Guardar los cambios.

Si el producto utiliza stock compartido (ej. pizzas), la reposicion de stock se debe hacer directamente sobre el insumo base (ej. los bollos de pizza).

## Como gestionar y personalizar las categorias de productos

Las categorias organizan los botones en el menu de comandas. Cada categoria posee un nombre, un color de fondo y un color de texto personalizable.

Desde la seccion Productos, se puede abrir el modal de "Gestión de Categorias" para:
- Crear una categoria nueva eligiendo sus colores corporativos.
- Desactivar o editar una categoria existente.
- Si una categoria se desactiva, todos sus productos quedan ocultos temporalmente en el menu de comandas.

## Como funciona la pantalla de Caja del dia en tiempo real

La seccion Caja muestra el balance financiero de la jornada activa en tiempo real:
- Total recaudado en Efectivo.
- Total recaudado en Mercado Pago.
- Total General acumulado.
- Historial desplegable de todos los tickets emitiendose en la noche con hora, medio de pago y monto.

Esta pantalla se actualiza en vivo mediante WebSockets sin necesidad de refrescar el navegador.

## Como hacer el cierre de jornada, cierre de caja y auditoria fisica de inventario

El cierre de jornada consta de 4 pasos secuenciales ejecutados por la administradora:

Pasos para cerrar la jornada:
1. Iniciar Auditoria: Ingresar el PIN de administrador en la seccion Cierre. Esto bloquea instantaneamente todas las terminales de comandas de los mozos.
2. Carga de Gastos y Mercado Pago Real: Registrar los egresos del dia (compras, proveedores, limpieza) y cargar el monto total real devuelto por el posnet de Mercado Pago.
3. Auditoria Fisica de Inventario: El sistema despliega el Stock Teorico calculado (Stock Inicial - Vendidas - Regaladas). La administradora cuenta fisicamente lo que queda en barra/cocina y carga el conteo real.
4. Confirmar Cierre: El sistema calcula desvios, comisiones de Mercado Pago y ganancia neta. Los conteos fisicos cargados se convierten automaticamente en el stock inicial para la proxima jornada.

## Como se calcula el desvio de inventario y sobrantes o faltantes

Formula de calculo:
1. Stock Teorico = Stock Inicial - Unidades Vendidas - Unidades Regaladas.
2. Desvio = Conteo Fisico Real - Stock Teorico.

Interpretacion de resultados:
- Desvio Cero (0): Coincidencia perfecta de inventario.
- Desvio Negativo (ej. -3): Faltan 3 unidades (posible rotura, olvido de cobro o perdida). Se resalta en rojo.
- Desvio Positivo (ej. +2): Sobran 2 unidades (error en conteo o venta no registrada).

## Como funciona el calculo de comision de Mercado Pago

El sistema compara el "Total Mercado Pago en Lista" (la suma de comandas cobradas con MP) contra el "Total Mercado Pago Real" (ingresado por la administradora segun el cierre del posnet).

La diferencia constituye la comision bancaria. Si la comision supera el 10% del total cobrado, el sistema muestra una alerta de advertencia visual para evitar errores de tipeo al cargar el cierre del posnet.

Formula de Ganancia Neta:
Ganancia Neta = Total Efectivo + Total Mercado Pago Real - Gastos Totales de la Jornada.

## Como consultar, filtrar y ver el historial de jornadas anteriores

Desde la seccion Historial (/admin/historial) la administradora puede revisar todas las jornadas cerradas del bar:

Filtros y Visualización:
- Filtrar por rango de fechas (desde / hasta).
- Seleccionar cualquier jornada de la lista para inspeccionar sus solapas de detalle:
  1. Resumen Financiero: Totales de efectivo, Mercado Pago real, comisiones, gastos y ganancia neta.
  2. Auditoria de Inventario: Tabla completa con stock inicial, unidades vendidas, regaladas, stock teorico, conteo fisico y desvio de cada producto.
  3. Gastos: Listado detallado de egresos con descripcion y categoria.
  4. Comandas: Historial de cada ticket emitido con su hora, medio de pago y total.
  5. Rendimiento de Productos: Ranking de volumen de ventas e ingresos por producto.

El historial es estrictamente de solo lectura y no admite modificaciones posteriores.

## Como funciona la calculadora de costos y estimaciones de compra

La calculadora de costos (/admin/calculadora) es un simulador interactivo para presupuestar compras de insumos o calcular el costo de recetas:

Funcionamiento:
1. Permite agregar filas especificando insumo, cantidad y precio unitario estimado.
2. Cuenta con autocompletado inteligente sugiriendo productos del catalogo real del bar.
3. Calcula reactivamente subtotales y total general.
4. Incluye boton de impresion en formato A4 profesional con membrete del bar para exportar a PDF.

La calculadora no altera la base de datos ni el inventario real. Es una herramienta de simulación de borrador.

## Cuales son las funciones y permisos segun el Rol (Admin vs Empleado)

El sistema soporta dos roles de usuario:
1. Rol Administrador: Acceso total al panel de control, gestion de productos, categorias, apertura/cierre de jornada, auditoria de inventario, historial, calculadora de costos y comandas.
2. Rol Empleado (Mozo): Acceso exclusivo y restringido a la pantalla de toma de comandas (/comandas). No puede ver datos financieros, stock, caja ni configuraciones. Si la jornada esta cerrada, su pantalla permanece bloqueada.

## Como funciona la impresion de tickets de cocina

Al confirmar una comanda en la pantalla de ventas, se despliega un modal con la opcion de imprimir el ticket de cocina.

Formatos y Estilos:
- Formato optimizado para ticketera termica de 76mm en blanco y negro.
- Imprime con letra gigante el Numero de Ticket (ej. TICKET #104) y el Numero de Beeper si fue asignado.
- Detalla la lista de productos con cantidad antepuesta (ej. x2 Hamburguesa Completa).
- Omite precios y dinero por ser una comanda exclusiva para el personal de cocina.

## Preguntas Frecuentes Operativas (FAQ)

- ¿Se puede eliminar o borrar una comanda ya enviada? No. Las comandas enviadas no se pueden borrar ni editar para resguardar la seguridad y la auditoria. Si hubo un error de mozo, se compensa en el cierre de jornada o auditoria fisica.
- ¿Se pueden conectar varias tablets o celulares al mismo tiempo? Si. Se pueden tener multiples terminales simultaneas. Todas comparten la misma jornada y actualizan el stock en tiempo real.
- ¿Qué pasa si falla internet durante un pedido? La comanda no se envia ni descuenta stock. Al restablecer la conexion, se debe reenviar el pedido.
- ¿Se puede cambiar el PIN de administrador? El PIN se administra con hash de seguridad SHA-256 en la base de datos.
- ¿Se puede saber cuanto vendio cada mozo? Si, en la pestaña Comandas del detalle de jornada en el Historial se puede visualizar qué usuario registro cada ticket.
