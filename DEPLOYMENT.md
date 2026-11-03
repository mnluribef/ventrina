# Guía de Puesta en Producción — Ventrina SaaS

Este manual contiene los pasos exactos y comandos terminales para desplegar y operar **Ventrina** en la infraestructura de Cloudflare (Pages + D1 + KV + R2 + Workers).

---

## 📋 Prerrequisitos

1. Cuenta activa en [Cloudflare](https://dash.cloudflare.com/) con el dominio principal (ej: `ventrina.app`) agregado y activo.
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) autenticado localmente:
   ```bash
   pnpm dlx wrangler login
   ```
3. Node.js v18+ y pnpm instalados.

---

## 🛠 Paso 1: Creación de Recursos en Cloudflare

Ejecuta los siguientes comandos desde la raíz del proyecto para crear los recursos físicos en tu cuenta:

### 1.1 Base de Datos D1
```bash
pnpm dlx wrangler d1 create ventrina-db
```
Copia el `database_id` devuelto y pégalo en el archivo [`wrangler.jsonc`](./wrangler.jsonc):
```json
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "ventrina-db",
    "database_id": "TU-ID-REAL-AQUI",
    "migrations_dir": "migrations"
  }
]
```

### 1.2 Namespace de KV (Caché de Tenants)
```bash
# Namespace de producción
pnpm dlx wrangler kv:namespace create KV

# Namespace de vista previa
pnpm dlx wrangler kv:namespace create KV --preview
```
Copia los IDs generados en `wrangler.jsonc`:
```json
"kv_namespaces": [
  {
    "binding": "KV",
    "id": "TU-KV-ID-PRODUCCION",
    "preview_id": "TU-KV-ID-PREVIEW"
  }
]
```

### 1.3 Bucket de Almacenamiento R2 (Imágenes y Comprobantes)
```bash
pnpm dlx wrangler r2 bucket create ventrina-storage
```

---

## 🗄 Paso 2: Ejecución de Migraciones de Base de Datos

Aplica las 18 migraciones de esquemas e índices a la base de datos D1 en la nube:
```bash
pnpm run db:migrate:remote
```

*(Opcional: Si deseas cargar las plantillas y atributos demo por defecto)*:
```bash
pnpm dlx wrangler d1 execute ventrina-db --remote --file=seed_templates.sql
```

---

## 🔐 Paso 3: Configuración de Secretos y Variables de Entorno

En el dashboard de Cloudflare:
**Workers & Pages > ventrina > Settings > Environment variables** (o vía terminal):

```bash
# Clave maestra de superadministrador (genera con: openssl rand -hex 32)
pnpm dlx wrangler pages secret put SUPERADMIN_KEY

# Clave API de Resend para envío de correos (https://resend.com)
pnpm dlx wrangler pages secret put RESEND_API_KEY

# Clave secreta de Cloudflare Turnstile (opcional para bot protection)
pnpm dlx wrangler pages secret put TURNSTILE_SECRET_KEY
```

Variables de entorno de texto plano (Settings > Environment variables > Variables de entorno):
* `EMAIL_FROM`: `Ventrina <notificaciones@ventrina.app>`
* `PAYMENT_METHOD`: `Pago Móvil / Transferencia`
* `PAYMENT_BANK`: `Banesco`
* `PAYMENT_PHONE`: `0412-XXXXXXX`
* `PAYMENT_ID`: `V-XXXXXXXX`
* `PAYMENT_ZELLE`: `pagos@ventrina.app`

---

## 🌐 Paso 4: Subdominios Wildcard y Worker Proxy

Para que las tiendas atiendan en `mitienda.ventrina.app`:

1. **Crear registro DNS en Cloudflare**:
   - Tipo: `CNAME`
   - Nombre: `*`
   - Contenido: `@` (o `ventrina.app`)
   - Proxy: **Habilitado (Nube Naranja)**

2. **Desplegar el Worker Proxy**:
   Ajusta `workers/wrangler.toml` con tu subdominio Pages y despliega:
   ```bash
   pnpm run worker:deploy
   ```

---

## ⏰ Paso 5: Mantenimiento y Purgado Automático (Cron Worker)

Para purgar diariamente sesiones revocadas y registros expirados de limitación de tasa:
1. Configura el secreto en el Worker programado:
   ```bash
   pnpm dlx wrangler secret put SUPERADMIN_KEY --config workers/cron-wrangler.toml
   ```
2. Despliega el worker programado:
   ```bash
   pnpm run cron:deploy
   ```
   *Se ejecutará todos los días a las 04:00 UTC.*

---

## 📬 Paso 6: Entregabilidad de Correo (SPF, DKIM, DMARC)

En la zona DNS de `ventrina.app` en Cloudflare:
1. **SPF**:
   - Tipo: `TXT` | Nombre: `@` | Valor: `v=spf1 include:resend.com ~all`
2. **DKIM**:
   - Añade los 3 registros `CNAME` provistos por el panel de Resend al registrar tu dominio.
3. **DMARC**:
   - Tipo: `TXT` | Nombre: `_dmarc` | Valor: `v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@ventrina.app`

---

## 🚀 Paso 7: Verificación Pre-Vuelo y Despliegue de la Aplicación

1. Ejecuta la verificación previa:
   ```bash
   pnpm run preflight
   ```
2. Ejecuta la suite de pruebas automatizadas:
   ```bash
   pnpm test
   ```
3. Compila y despliega a Cloudflare Pages:
   ```bash
   pnpm run deploy
   ```

---

## 🩺 Paso 8: Monitor de Salud (Uptime)

Añade tu endpoint de salud a un servicio externo (BetterStack, UptimeRobot o Checkly):
* **URL**: `https://ventrina.app/api/health`
* **Frecuencia**: Cada 60 segundos
* **Respuesta esperada**: HTTP `200 OK`
* **Contenido**: `{"status": "healthy"}`

