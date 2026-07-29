# Base de conocimiento SAO Bar
# Cada seccion (##) es un chunk independiente para vectorizar.
# Escrito en lenguaje claro para la administradora del bar.

## Como abrir una jornada

Para abrir una jornada nueva, ingresa a la seccion Caja desde el menu de administracion. El sistema te va a pedir tu PIN de administrador. Una vez validado el PIN, se abre la jornada.

Solo se puede abrir una jornada si la anterior esta cerrada. No puede haber dos jornadas abiertas al mismo tiempo, el sistema lo impide automaticamente. Una vez que la jornada esta abierta, todas las terminales se desbloquean y se pueden empezar a tomar pedidos.

## Como tomar un pedido

Cuando la jornada esta abierta, se accede a la pantalla de Comandas. Ahi se ven los productos organizados por categoria (Tragos, Cerveza, Comida, Cafeteria, Postres, Sin Alcohol). Se seleccionan los productos que el cliente pide, se elige el medio de pago (Efectivo, Mercado Pago o Regalo) y opcionalmente se asigna un numero de beeper del 1 al 20 para identificar al cliente.

Al enviar la comanda, el sistema le asigna automaticamente un numero de ticket correlativo y descuenta el stock de los productos que tienen seguimiento de inventario. Si un producto se queda sin stock, la tarjeta del producto se deshabilita y no se puede agregar mas.

Despues de confirmar la comanda, aparece la opcion de imprimir un ticket de cocina. Este ticket sale en formato para impresora termica, en blanco y negro, con el numero de comanda grande, la lista de productos con cantidades, el beeper si fue asignado, y la fecha y hora. No incluye precios ni totales porque es solo para la cocina.

## Que es una comanda de regalo

El medio de pago "Regalo" se usa cuando se le invita algo a un cliente sin cobrarle. Al marcar una comanda como regalo, el sistema registra el total en cero pesos (no suma a la caja), pero si descuenta el stock fisico de los productos. De esta forma, la salida de mercaderia queda registrada para la auditoria de inventario aunque no haya ingreso de dinero.

Esto es importante para entender los desvios: si se regalaron 3 cervezas durante la noche, esas 3 unidades se restan del stock teorico junto con las vendidas, y no deberian aparecer como faltante en la auditoria.

## Que tipos de productos hay en el sistema

En SAO Bar hay dos tipos de productos: productos de venta y insumos.

Los productos de venta son los que aparecen en el menu de comandas y se pueden vender a los clientes: tragos, cervezas, comidas, cafeteria, etc.

Los insumos son productos internos que no aparecen en el menu de comandas. Son materias primas o ingredientes que se usan para elaborar otros productos. Por ejemplo, los bollos de pizza son un insumo: no se venden directamente, pero se consumen cuando se vende una pizza.

Todos los insumos tienen seguimiento de stock obligatorio. Los productos de venta pueden tener seguimiento de stock activado o desactivado, dependiendo de si se quiere controlar su inventario.

## Como funciona el stock compartido

El stock compartido permite que varios productos de venta compartan el inventario de un mismo insumo. El ejemplo clasico es la pizza: Pizza Muzza, Pizza Jamon y Pizza Napolitana son tres productos de venta distintos, pero los tres se elaboran a partir del mismo insumo (Bollos Prepizza Masa Madre).

Cuando se vende cualquiera de esas pizzas, el stock se descuenta del insumo compartido (los bollos), no del producto vendido. Si hay 10 bollos y se venden 2 Pizza Muzza y 1 Pizza Napolitana, quedan 7 bollos, y las tres variedades de pizza muestran 7 unidades disponibles.

Esto funciona en tiempo real: cuando se agrega una pizza al carrito en cualquier terminal, el stock disponible baja instantaneamente en todas las terminales, incluso antes de enviar la comanda. Si los bollos se agotan, todas las variedades de pizza se deshabilitan simultaneamente.

## Cuando usar stock compartido vs productos de elaboracion instantanea

El stock compartido permite que varios productos de venta compartan el inventario de un mismo insumo, pero solo funciona cuando el consumo del insumo es exacto y fijo por cada unidad vendida (relacion 1 a 1). Si el consumo varia entre una preparacion y otra, no se debe usar stock compartido.

Cuando SI usar stock compartido: Se usa cuando cada venta consume exactamente una unidad del insumo comun, sin importar la variedad. Por ejemplo, los bollos de pizza como insumo comun para Pizza Muzza, Pizza Jamon y Pizza Napolitana. Cada pizza vendida consume exactamente 1 bollo. Si hay 10 bollos disponibles, se pueden vender hasta 10 pizzas en cualquier combinacion. El descuento es automatico y exacto.

Cuando NO usar stock compartido: No se debe usar cuando la cantidad de insumo consumida varia segun la preparacion, el mozo, la receta o el tamaño. Por ejemplo, la leche usada para elaborar distintos tipos de cafe (cortado, lagrima, capuchino) o el hielo y frutas en cocteleria. No existe una relacion fija de "1 leche = 1 cafe". Si se fuerza el stock compartido en estos casos, el stock teorico del sistema se desfasara del stock real.

Solucion para insumos variables (Elaboracion instantanea): Los productos finales con ingredientes variables (como el cafe o tragos complejos) se configuran como productos de venta directa sin seguimiento de stock (elaboracion instantanea). El insumo de consumo variable (como la leche o la botella de licor) se controla aparte como un insumo interno con seguimiento de stock activado. Durante el cierre de jornada, en la auditoria de inventario, la administradora carga manualmente el consumo real o el conteo fisico final de ese insumo. Esto evita desvios falsos por variables humanas o externas.

## Como dar de alta un producto nuevo

Desde la seccion Productos del panel de administracion, usa el boton para crear un producto nuevo. Tenes que completar: nombre, precio, categoria y definir si es un producto de venta o un insumo.

Si es un producto de venta, podes elegir si tiene seguimiento de stock. Si tiene seguimiento, podes opcionalmente asociarlo a un insumo de stock compartido (por ejemplo, asociar una pizza a los bollos).

Si es un insumo, el seguimiento de stock se activa automaticamente y no se puede desactivar. Tenes que definir el stock ideal (referencia semanal), el stock inicial y la unidad de medida (unidades, litros o mililitros).

Para dar de baja un producto, se desactiva (no se borra). El producto desactivado deja de aparecer en el menu de comandas pero se conserva en el historial para no perder la trazabilidad de las ventas anteriores.

## Como gestionar las categorias de productos

Las categorias organizan los productos en el menu de comandas. Cada categoria tiene un nombre, un color de fondo y un color de texto que se muestran en las tarjetas de productos.

Se pueden crear categorias nuevas o desactivar las existentes. Las categorias desactivadas dejan de mostrarse en el menu de comandas. No se puede activar un producto si su categoria esta desactivada; primero hay que reactivar la categoria.

Las categorias por defecto son: Tragos, Cerveza, Comida, Cafeteria, Postres y Sin Alcohol, pero se pueden modificar libremente.

## Como funciona la caja del dia

La seccion Caja muestra en tiempo real el estado financiero de la jornada activa. Se ve cuanto se lleva vendido en efectivo, cuanto en Mercado Pago, y el total general. Tambien se ve el historial de todas las comandas de la jornada con su numero de ticket, total y medio de pago.

Esta informacion se actualiza automaticamente cada vez que se registra una comanda desde cualquier terminal, sin necesidad de refrescar la pantalla.

## Como hacer el cierre de jornada

El cierre de jornada es el proceso mas importante del dia y tiene varios pasos que se hacen en orden.

Primer paso: ingresa tu PIN de administrador. Esto cambia el estado de la jornada a "en auditoria", lo que bloquea inmediatamente todas las terminales. A partir de este momento, nadie puede registrar mas comandas.

Segundo paso: carga los gastos de la noche (proveedores, insumos, limpieza, etc.) eligiendo la categoria de gasto correspondiente. Tambien tenes que ingresar el monto real que aparece en el posnet de Mercado Pago, que puede diferir del total que el sistema registro en las comandas por las comisiones que cobra Mercado Pago.

Tercer paso: la auditoria fisica de inventario. El sistema te muestra todos los productos que tienen seguimiento de stock, con el stock teorico calculado (lo que deberia haber segun las ventas registradas). Vos contas fisicamente lo que queda y cargas el conteo real. Si los numeros coinciden, el desvio es cero. Si hay diferencias, el sistema las resalta en rojo.

Cuarto paso: confirmas el cierre. El sistema calcula los totales finales (efectivo, Mercado Pago real, comisiones, gastos, ganancia neta) y cierra la jornada. Los conteos fisicos que cargaste se convierten en el stock inicial para la proxima jornada.

## Como se calcula el desvio de inventario

El desvio es la diferencia entre lo que deberia haber en stock (segun el sistema) y lo que realmente hay (segun tu conteo fisico).

La formula es: Stock Teorico = Stock Inicial de la jornada menos Unidades Vendidas menos Unidades Regaladas. Desvio = Conteo Fisico menos Stock Teorico.

Si el desvio es cero, todo cuadra. Si el desvio es negativo (faltan unidades), puede indicar robo, perdida, rotura, o un error en el conteo. Si el desvio es positivo (sobran unidades), puede indicar un error en el conteo o que se registro mal una venta.

Para los productos que usan stock compartido (como las pizzas), el sistema calcula automaticamente cuantas unidades del insumo base se consumieron sumando las ventas de todos los productos que comparten ese insumo. No hay que cargar el consumo manualmente.

## Como funciona la comision de Mercado Pago

Durante la jornada, el sistema registra el total de ventas cobradas con Mercado Pago segun las comandas (esto se llama "total en lista"). Al hacer el cierre, vos ingresas el monto real que aparece en el posnet de Mercado Pago. La diferencia entre ambos es la comision que cobra Mercado Pago.

Si la comision supera el 10% del total en lista, el sistema lo marca con un color de advertencia para que lo revises, porque podria indicar un error en la carga del monto real del posnet.

La ganancia neta se calcula como: efectivo + Mercado Pago real - gastos totales.

## Como consultar el historial de jornadas

Desde la seccion Historial se puede ver el listado de todas las jornadas cerradas, ordenadas de la mas reciente a la mas antigua. Se puede filtrar por rango de fechas.

Al seleccionar una jornada, se abre el detalle con varias pestanas: Resumen Financiero (totales de efectivo, Mercado Pago, comisiones, gastos y ganancia neta), Auditoria de Inventario (stock inicial, unidades vendidas, regaladas, stock teorico, conteo fisico y desvio), Gastos (listado de egresos con descripcion, categoria y monto), Comandas (historial de todos los tickets con hora, total y medio de pago) y Rendimiento (productos ordenados por volumen de ventas, mostrando unidades vendidas e ingresos).

El historial es de solo lectura. No se pueden modificar los datos de una jornada cerrada.

## Que es la calculadora de costos

La calculadora de costos es una herramienta de simulacion que permite calcular rapidamente el costo de una compra de insumos. Se agregan filas con el nombre del insumo, la cantidad y el precio unitario, y el sistema calcula los subtotales y el total general.

Es importante saber que la calculadora no guarda nada en la base de datos. Es solo para hacer cuentas rapidas. Si se refresca la pagina, los datos se pierden. Se puede imprimir el resultado como un documento en formato A4 con el membrete del bar.

Al escribir el nombre de un insumo en la calculadora, el sistema sugiere productos del catalogo real para autocompletar rapidamente.

## Que puede hacer cada rol

Hay dos roles en el sistema: Administrador y Empleado.

La Administradora tiene acceso completo: puede gestionar productos, categorias, abrir y cerrar jornadas, ver la caja del dia, hacer auditorias de inventario, consultar el historial, usar la calculadora de costos, y tambien tomar comandas.

El Empleado (mozo) solo puede tomar comandas. No ve los productos, la caja, el cierre, el historial ni la calculadora. Su pantalla muestra unicamente la terminal de comandas.

Si no hay una jornada abierta, la terminal del empleado queda bloqueada con un mensaje indicando que debe esperar a que se abra una jornada.

## Que pasa cuando se inicia una auditoria

Cuando la administradora ingresa su PIN para iniciar el cierre, la jornada pasa a estado "en auditoria". En ese momento, todas las terminales se bloquean automaticamente en tiempo real, sin importar cuantas haya conectadas. Las pantallas muestran un cartel indicando que la terminal esta bloqueada.

Este bloqueo es inmediato gracias a la conexion en tiempo real del sistema. No hace falta avisarle a nadie ni pedir que dejen de usar el sistema; se bloquea solo.

Una vez que la jornada se cierra, las terminales permanecen bloqueadas hasta que se abra una nueva jornada.

## Que pasa si un producto se queda sin stock

Si un producto con seguimiento de stock llega a cero unidades, su tarjeta se deshabilita automaticamente en la pantalla de comandas de todas las terminales. No se puede agregar al carrito ni venderlo.

Si el producto usa stock compartido (por ejemplo, las pizzas), cuando el insumo base se agota, todas las variedades que dependen de ese insumo se deshabilitan simultaneamente.

El stock se actualiza en tiempo real: si se vende la ultima unidad desde una terminal, las demas terminales reflejan el cambio instantaneamente.

## Como reponer stock de un producto

Para actualizar el stock de un producto despues de recibir mercaderia, entra a la seccion Productos, busca el producto y editalo. Ahi podes modificar el stock actual directamente con la cantidad nueva despues de la reposicion.

Si el producto tiene stock compartido, la reposicion se hace sobre el insumo base (por ejemplo, sobre los bollos de pizza, no sobre cada variedad de pizza individualmente).

## Que son las categorias de gastos

Las categorias de gastos clasifican los egresos que se registran durante el cierre de jornada. Las categorias por defecto son: Insumos, Limpieza, Servicios, Otros, Personal y Mantenimiento.

Al cargar un gasto durante el cierre, se elige la categoria correspondiente, se escribe una descripcion y el monto. Todos los gastos se suman al total de egresos y se restan de la ganancia neta.

## Como se imprime un ticket de cocina

Despues de enviar una comanda exitosamente, aparece un modal de confirmacion con el numero de ticket y un boton para imprimir la comanda de cocina.

El ticket de cocina esta disenado para impresoras termicas de 76mm. Muestra la fecha y hora, el numero de comanda en grande, el numero de beeper si fue asignado, y la lista de productos con la cantidad antepuesta por una "x" (por ejemplo, "x2 Fernet con Coca"). No incluye precios ni totales porque es solo informacion para la cocina.

## Preguntas frecuentes

Puedo borrar una comanda que ya se envio: No. Una vez enviada, la comanda queda registrada y no se puede borrar ni modificar. Esto es por seguridad y para mantener la integridad del historial y la auditoria.

Que hago si alguien se equivoco en una comanda: La comanda no se puede corregir en el sistema. Si hubo un error, se puede hacer un ajuste manual en el cierre de jornada registrando la diferencia como un gasto o considerandola en el conteo fisico de la auditoria.

Se pueden tener varias terminales al mismo tiempo: Si. Pueden conectarse varias terminales (computadoras, tablets, celulares) con cuentas diferentes. Todas comparten la misma jornada y ven el stock actualizado en tiempo real.

Que pasa si se corta internet durante una comanda: Si se pierde la conexion, la comanda no se envia ni se registra. No hay riesgo de cobro duplicado ni de descuento de stock sin registro. Cuando vuelva la conexion, hay que volver a enviar la comanda.

Puedo cambiar el PIN de administrador: El PIN se configura en la base de datos. Para cambiarlo hay que contactar al desarrollador o administrador tecnico del sistema.

Puedo ver cuanto vendio cada mozo: En el historial de la jornada, las comandas muestran que usuario las registro. Desde ahi se puede ver la actividad de cada mozo durante la noche.
