# BarberBook móvil · Hito 4

La pantalla pública muestra el perfil del profesional y sus servicios activos. Desde el catálogo se puede seleccionar un servicio, consultar horarios y enviar una solicitud de reserva. El acceso profesional sigue pendiente.

## Probar en Expo Go

1. Inicia el backend académico del Taller 3 con su base de datos habitual, siguiendo el README de `backend/`. Express sirve la API en el puerto `3003`.
2. En Windows, ejecuta `ipconfig` y busca la dirección IPv4 del adaptador Wi-Fi o Ethernet conectado a la misma red que el celular. Crea `mobile/.env.local` y reemplaza `IP_DEL_PC` por esa dirección.

   ```dotenv
   EXPO_PUBLIC_API_URL=http://IP_DEL_PC:3003/api
   ```

   Para una API disponible por HTTPS, usa su URL terminada en `/api`. Expo incluye las variables `EXPO_PUBLIC_` en el bundle, así que esta variable debe contener únicamente la URL.

3. Desde `mobile/`, ejecuta `npm ci` si partes de un clon limpio. Si Metro estaba abierto desde la Etapa 1, detén ese proceso con Ctrl+C. Ejecuta `npm start -- --clear` y abre el QR con Expo Go.
4. Si falla la conexión, abre `http://IP_DEL_PC:3003/api/health` en el navegador del celular. Debe mostrar `status: ok` y `database: connected`. Revisa la red local y el acceso al puerto 3003 en el firewall si el navegador tampoco llega a la API. Si el navegador llega pero Expo Go bloquea HTTP, prueba una URL HTTPS de la misma API.

## Verificar los datos

Abre `/api/professionals` y `/api/services` en el mismo host y puerto. En PowerShell, también puedes consultar y filtrar ambos catálogos.

```powershell
$barberBookApi = 'http://IP_DEL_PC:3003/api'
$profesionales = (Invoke-RestMethod "$barberBookApi/professionals").data
$servicios = (Invoke-RestMethod "$barberBookApi/services").data
$profesionales | Select-Object id, name
$servicios | Where-Object { $_.professional_id -eq $profesionales[0].id } |
  Select-Object name, price, duration_minutes
```

Compara los resultados con el primer perfil que aparece en la app. Si hay varios profesionales, selecciona otro y compara usando su ID. El servicio de catálogo de Express consulta PostgreSQL y devuelve los servicios activos. Esta comprobación solo usa solicitudes GET.

## Probar una reserva en Expo Go

1. Toca **Reservar una hora** en el catálogo. Elige un servicio y comprueba su precio y duración.
2. Elige una fecha y una hora. La app muestra las horas habilitadas por `GET /api/availability` en horario de Chile.
3. Completa el nombre y el celular chileno con datos ficticios. Puedes probar primero un campo vacío y comprobar el mensaje de validación.
4. Revisa el resumen y toca **Enviar solicitud** una sola vez. Esta acción escribe en PostgreSQL mediante `POST /api/bookings`.
5. Comprueba el número y el estado que muestra la app. Busca la misma reserva en la sección correspondiente del panel web con una sesión profesional. Para volver a empezar, toca **Volver al catálogo**.

Si la API indica que la hora ya no está disponible, el flujo conserva los datos de contacto y recarga las horas. Si se pierde la respuesta del envío, verifica con el profesional si la reserva quedó registrada antes de intentarlo de nuevo.

## Consultar Mis reservas

1. Usa un backend con la API de seguimiento habilitada. Inicia el proyecto móvil con `npm start` desde `mobile/`, abre Expo Go y comprueba que `EXPO_PUBLIC_API_URL` apunta al entorno de pruebas.
2. En ese entorno, registra varias solicitudes con datos ficticios y horas distintas. Pulsa **Ver mis reservas** al finalizar o entra en **Mis reservas** desde el catálogo.
3. Desliza las tarjetas o usa las flechas. Comprueba los números, el contador, el orden de las próximas atenciones y las fechas y horas de Chile.
4. Tras resolver una solicitud de prueba en el panel profesional, toca **Actualizar reserva** en su tarjeta. Luego comprueba **Actualizar todas**. Al cortar y recuperar la conexión, verifica que las tarjetas se conservan y que **Reintentar** recupera su estado.
5. Cierra y vuelve a abrir Expo Go. Comprueba que reaparecen todas las tarjetas. Si ya tenías una credencial en la versión anterior, usa la misma instalación y URL para verificar que también aparece.

Cada reserva conserva su propia credencial en SecureStore. El historial se separa por URL de API y la credencial anterior se migra automáticamente en su entorno original. Si falla el guardado, la app mantiene los accesos nuevos durante la sesión y vuelve a intentar guardarlos al actualizar todas las reservas. Las reservas sin una credencial conservada, incluidas las antiguas o las de otro dispositivo, se consultan con el profesional.

### Cancelar una reserva en Expo Go

1. Conecta Expo Go a un backend actualizado en un entorno de pruebas. Usa únicamente reservas ficticias.
2. En **Mis reservas**, abre una reserva pendiente o confirmada y pulsa **Cancelar reserva**. Prueba **Volver** y verifica que su estado sigue igual. Abre otra vez el diálogo y confirma con **Sí, cancelar reserva**.
3. Comprueba que la tarjeta desaparece al confirmarse la cancelación, el contador se actualiza y las demás tarjetas siguen visibles. Cierra y vuelve a abrir Expo Go para comprobar que la reserva cancelada no reaparece. Si era la última, debe verse **Todavía no tienes reservas**.
4. En el panel profesional, actualiza las solicitudes y la agenda. Comprueba que la cancelada aparece entre las resueltas del panel móvil y que las competidoras siguen pendientes. Si la cancelada estaba confirmada, verifica que la hora vuelva a estar disponible cuando no exista otra ocupación.
5. Para probar una pérdida de conexión, desconecta el teléfono antes de confirmar. Después de restablecer la conexión, usa **Comprobar estado**. La app retira la tarjeta y su credencial solo cuando la API devuelve `cancelled`.

HTTP en la red local sirve para la demostración con datos ficticios. Usa HTTPS si trabajas con datos reales, ya que la credencial viaja en la cabecera de cada consulta.

Ejecuta `npm run test:booking-tracking` desde `mobile/` para probar el almacenamiento, la migración, la consulta y la cancelación con mocks. Estas pruebas no contactan el backend ni escriben reservas.

## Probar el panel profesional en Expo Go

1. Abre **Panel profesional** desde el catálogo. Usa una cuenta de prueba en un entorno controlado. Para una cuenta real, configura una URL base HTTPS.
2. Inicia sesión. La app pide `GET /api/auth/session` después del login y abre el panel solo si el servidor reconoce la cookie HttpOnly reenviada por el cliente.
3. En **Inicio**, comprueba el nombre, las solicitudes pendientes, las confirmadas de hoy y la próxima atención. Abre **Solicitudes** y resuelve solicitudes ficticias mediante el diálogo. Si se solapan, el servidor aplica FIFO y puede pedir resolver una anterior primero.
4. Abre **Agenda**, elige una fecha y toca **Actualizar agenda**. Comprueba que el servicio, la hora de Chile y el estado coincidan con las reservas confirmadas del día. Agenda muestra los 14 días ofrecidos por la API.
5. Recorre **Inicio → Solicitudes → Agenda → Ajustes → Inicio** en la barra inferior y comprueba también los accesos de Inicio. Ajustes indica qué se gestiona desde BarberBook Web. Desde otra pestaña, el botón Atrás de Android debe volver a Inicio. Desde Inicio debe volver al catálogo.
6. Toca **Cerrar sesión** en la cabecera. Vuelve a entrar desde el catálogo y confirma que solicita autenticación. Las escrituras requieren la cookie y `X-CSRF-Token` de la sesión.

Si el login responde correctamente pero la app informa que el dispositivo no reenvía la cookie, comprueba que toda la prueba use un solo host y una URL HTTPS directa, sin redirecciones. Si Expo Go sigue sin devolver la cookie, una alternativa sería validar un development build con manejo nativo de cookies que mantenga HttpOnly. Si se requiere otro medio de autenticación móvil, necesita un diseño de servidor revocable sobre HTTPS que conserve los controles de propiedad de las reservas. La app no copia cookies a JavaScript ni guarda las contraseñas o el CSRF en disco.
