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

## Consultar Mi reserva

1. Desde la raíz del repositorio, reconstruye el backend con `docker compose up -d --build backend`. Al arrancar, el backend crea la tabla de credenciales si todavía no existe. Usa el volumen PostgreSQL existente.
2. Inicia el proyecto móvil con `npm start` desde `mobile/` y abre Expo Go. Confirma que `EXPO_PUBLIC_API_URL` apunta a ese backend.
3. Crea una reserva con datos ficticios desde el móvil. Pulsa **Consultar estado** y conserva su número para compararlo con el panel web.
4. Desde el panel profesional web, resuelve la solicitud de prueba según las reglas vigentes. En **Mi reserva**, toca **Actualizar estado** y comprueba que aparece el cambio del mismo número de reserva.
5. Cierra y vuelve a abrir Expo Go. Entra en **Mi reserva** desde el catálogo para recuperar el acceso.

El dispositivo conserva la credencial de la última reserva creada con seguimiento. Las reservas antiguas no reciben una credencial automáticamente y se consultan con el profesional. Si el almacenamiento seguro falla, la app informa que solo mantendrá el acceso durante la sesión. La aplicación no ofrece cancelación.

HTTP en la red local sirve para la demostración con datos ficticios. Usa HTTPS si trabajas con datos reales, ya que la credencial viaja en la cabecera de cada consulta.
