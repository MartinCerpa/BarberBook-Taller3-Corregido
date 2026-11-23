# BarberBook móvil · Hito 4

La pantalla pública muestra el perfil del profesional y sus servicios activos. Los avisos de reserva y acceso profesional indican etapas pendientes.

## Probar en Expo Go

1. Inicia el backend académico del Taller 3 con su base de datos habitual, siguiendo el README de `backend/`. Express sirve la API en el puerto `3003`.
2. En Windows, ejecuta `ipconfig` y busca la dirección IPv4 del adaptador Wi-Fi o Ethernet conectado a la misma red que el celular. Crea `mobile/.env.local` y reemplaza `IP_DEL_PC` por esa dirección.

   ```dotenv
   EXPO_PUBLIC_API_URL=http://IP_DEL_PC:3003/api
   ```

   Para una API disponible por HTTPS, usa su URL terminada en `/api`. Expo incluye las variables `EXPO_PUBLIC_` en el bundle, así que esta variable debe contener únicamente la URL.

3. Desde `mobile/`, ejecuta `npm start` y abre el QR con Expo Go. Si Expo ya estaba abierto, recarga la app tras guardar `.env.local`.
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
