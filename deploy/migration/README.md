# Battleship: preparación de migración a phosrvr

Fecha de evidencia: 2026-10-25 UTC (2026-10-24 en México).
**Estado: preparado y probado en privado; producción todavía está en nightly-int.
No se ha autorizado ni ejecutado el corte.**

## Versión conservada

| Componente | Producción AMD64 | Preparación ARM64 |
| --- | --- | --- |
| Frontend | `af4f47783e6f44d6b086648348bc37392d661ecf` | Archivo limpio de ese commit; mismo package-lock; sin cambios de aplicación |
| Backend | `c80b74a6194e1b014c314c53f041ff41370d6bcd` | Reempaquetado del JAR que ejecuta producción, sin recompilar dependencias |
| JAR SHA256 | `d65ba230f653a29f15d40999ea65f4745218dc5e3d5945439f77e1af3f185108` | Idéntico dentro del contenedor ARM64 |
| Node / Alpine | `22.23.1` / `3.24.1` | Mismas versiones, verificadas ejecutándolas |
| Java | Temurin `21.0.12+8`, Ubuntu 22.04 | Misma versión; binario ARM64 |
| PostgreSQL | `16.15` | `16.15`, mismo índice OCI por digest |
| Nginx | `1.27.5` | Mismo índice OCI por digest |

Imágenes ARM64 locales verificadas en phosrvr:

- `battleship-frontend:af4f477-arm64`: `sha256:d86de1f0f0979a05f689add4f37ebc74f2c83aaaa2122490dd6f98eb2573660c`.
- `battleship-backend:c80b74a-arm64`: `sha256:ccb068db9e313d297a9077939b80bfe5ae00ae74440b6b5e557d11a060c0bbdb`.

La imagen frontend de producción tiene un nombre GHCR, pero ese tag no existe en
el registro: la liberación visual fue cargada manualmente. La imagen backend
publicada solamente ofrece AMD64. Por eso no se usó `latest` ni se desplegó HEAD.
Los Dockerfiles de aplicación solo reciben argumentos para fijar los runtimes de
los siguientes builds; los archivos de código y los lockfiles no cambian.

Archivo de recuperación de ambas imágenes ARM64 en phosrvr:
`/opt/battleship/backups/migration-arm64-images.tar.gz`, SHA256
`92ef1d3b5ed2fccbc3c25955d2d63395ad8630f484030c70a604d48b9370cfce`.

## Inventario y propiedad

| Recurso | Hallazgo / tratamiento |
| --- | --- |
| Contenedores exclusivos | `battleship-frontend`, `battleship-backend`, `battleship-db`, `battleship-nginx` |
| Archivos exclusivos | `/opt/battleship/{.env,docker-compose.yml,nginx.conf,host-nginx-battleship.nightly.mx.conf}` y backups visuales anteriores |
| Base | PostgreSQL `battleship`, rol `battleship`; 16 tablas públicas; extensión `plpgsql`; locales `en_US.utf8` |
| Volumen / red | `battleship_postgres_data` / `battleship`, exclusivos; la base no publica puerto |
| Archivos/uploads | Sin mounts de uploads ni datos persistentes en frontend/backend. Sus capas modificadas solo contienen cachés/logs temporales y archivos de trabajo de Tomcat |
| Autenticación | Contraseña PostgreSQL en `.env`; usuarios, hashes de contraseña y tokens de sesión dentro de PostgreSQL. No valores en Git ni en este reporte |
| Trabajos | `MultiplayerService.processDueAutoActions`, cada segundo, dentro del backend; deadlines/partidas persistidos en PostgreSQL |
| Colas | Broker STOMP simple en memoria, sin RabbitMQ/Redis/Kafka ni consumidor externo encontrado. Eventos en vuelo y conexiones WS no son durables |
| Estado en memoria | El servicio legacy también contiene estado de preparación en memoria. El corte exige cero partidas activas y cero ready-deadlines; no se promete trasladar conexiones o memoria de JVM |
| Cron/backups | No se encontró cron/timer exclusivo de Battleship. Los backups visuales previos eran de configuración, no respaldos lógicos de PostgreSQL |
| Dominio | Ruta host exclusiva `battleship.nightly.mx`; `/api/` y `/ws` pasan al backend. No se encontraron callbacks OAuth, correo ni integraciones externas de negocio |
| Certificado | Let's Encrypt exclusivo del dominio, válido 2026-09-07 a 2026-12-06; llave/lineage respaldados de forma privada |
| Recursos compartidos origen | Docker daemon, Nginx host, certbot/timer y red del host. Se conservan; no hay runner propio de Battleship que mover |
| Recursos compartidos destino | `pom-caddy` posee `10.0.0.175:80/443`, admin `127.0.0.1:2029`; configuración POM generada por `render.sh`. No se modificó |
| Integraciones técnicas | Cloudflare, GHCR y GitHub Actions del repo `Jair0305/battleship` |
| Secretos CI anteriores | `DEPLOY_SSH_HOST/USER/KEY`, `POSTGRES_PASSWORD` y un `MSSQL_SA_PASSWORD` legacy. Se conservan; no se deduce que una clave compartida sea eliminable |

No se operaron Alloy, observabilidad, Hermes/correos, POM ni los runners Cleanly o
Pixel Office. Otros chats están haciendo cambios simultáneos; las diferencias de
su inventario global no deben atribuirse a esta migración.

## Destino y coordinación

phosrvr se verificó como `aarch64`, con aproximadamente 160 GiB libres y 20 GiB de
RAM disponibles al empezar. La reserva está en
`/opt/battleship/MIGRATION-RESERVATION.txt`.

- `/opt/battleship`, red Docker `battleship`, sin subred fija compartida.
- Nginx de aplicación: **solo `127.0.0.1:3006`**; backend: **solo `127.0.0.1:3007`**.
- PostgreSQL: sin puerto publicado. No se abrió firewall ni servicio interno.
- Prueba TLS aislada: `127.0.0.1:9444`, contenedor `battleship-tls-preflight`.
- Moonlight reserva 3334/3335/9443, sin conflicto.
- Límites de memoria/CPU por servicio en `docker-compose.phosrvr.yml`; builder
  exclusivo `battleship-migration`, con 4 GiB y 1.5 CPU como máximo.
- La copia de prueba usa **`battleship_postgres_preflight_20261025`**. El volumen
  de producción del destino se creará con el respaldo FINAL después de aprobar.

`battleship.caddy` contiene únicamente la ruta propuesta
`battleship.nightly.mx -> 127.0.0.1:3006`. El responsable del proxy compartido debe
acordar su import persistente, el bloqueo común y la recarga validada; no basta
editar el archivo generado de POM. No se crearon imports, locks globales ni se
recargó `pom-caddy`. Hasta acordarlo no se puede dar por lista la ruta pública.

Cloudflare está desconectado en Chrome. Cuenta esperada por el contexto:
`c6c06b3b8b2262a874ad710ccaf4ec8e`, zona `nightly.mx`; **no confirmadas en la sesión
actual**. Deben comprobarse visualmente cuenta, zona, registro, proxy y TTL antes
de cambiar algo. La resolución pública muestra direcciones del proxy Cloudflare;
sus respuestas AAAA no demuestran que exista un registro AAAA de origen.

## Respaldos y pruebas de recuperación

`consistent-backup.py` mantiene abierta una transacción `REPEATABLE READ READ
ONLY`, exporta su snapshot y usa ese mismo snapshot con `pg_dump --format=custom`.
Las huellas por tabla se calculan dentro de la misma transacción. No copia PGDATA
en funcionamiento. Las secuencias son administradas por pg_dump; las huellas de
contenido no equivalen a una comparación de secuencias. En el corte final se
detiene el único backend escritor antes de respaldar.

Respaldo inicial:

- Origen: `/opt/battleship/migration/preflight-20261025` (privado).
- Archivo transportable: `/home/ubuntu/.battleship-migration/preflight-20261025.private.tar.gz`.
- Destino: `/opt/battleship/backups/preflight-20261025`.
- Copia local con ACL restringida: `%LOCALAPPDATA%/BattleshipMigration/20261025`.
- Archivo transportable SHA256: `22d87feb82830195e03e3d1e9c38ba86e13da7ccf1cad13e22217c03e5c259f0`.
- Dump: 46,118 bytes; SHA256 `8d169bc2e5c36ae6d5c323b4fff674bacb4426b9c04d36a3e0f017118164f6d8`.
- Incluye dump, globals privados, huellas, configuración con claves, backups
  anteriores, certificado/llave exclusivos y el JAR real. `SHA256SUMS` comprobado.
- Restauración ARM64: **16 tablas, 112 filas, todos los hashes idénticos** antes
  de iniciar la aplicación de prueba.

Prueba inversa después de escribir datos nuevos con la aplicación ARM64:

- Destino: `/opt/battleship/backups/reverse-drill-20261025`.
- Archivo transportable SHA256: `2d2ac59e604c5651e873819cda6e7431d54f19ac0e6d305495dbe1185f4e2fc4`.
- Restaurado en nightly-int, contenedor **aislado sin red/puertos**
  `battleship-rollback-db-20261025`, volumen
  `battleship_postgres_reverse_drill_20261025`.
- **16 tablas, 303 filas y todos los hashes idénticos**, incluyendo registros,
  sesiones, partidas, tableros y disparos creados en ARM64.
- Contenedor del ensayo inverso detenido; base original intacta.

Los archivos privados y globals contienen secretos: conservar permisos 0600,
directorios 0700 y no adjuntarlos a PRs/logs/reportes. No se programó retención ni
eliminación. El timer diario propuesto permanece sin instalar/activar; no había
uno exclusivo en origen. Su instalación se hace después del corte y requiere
`.production-active`. Acordar destino off-host y retención antes de cerrar rollback.

## Validación funcional realizada

`node deploy/migration/smoke.mjs http://localhost:3006 --allow-test-writes`, por un
túnel SSH privado al clon del destino, pasó:

1. Registro, contraseña, login, recuperación de sesión y rechazo de token inválido.
2. Dos jugadores, un espectador, crear mesa, sentarse y ready.
3. WebSocket real, STOMP y entrega de un mensaje de chat exactamente una vez a
   cada una de las tres conexiones.
4. Flotas completas, barcos ocultos al espectador, disparos, barcos hundidos y victoria.
5. Revancha, rendición y salida de las tres sesiones.

TLS de origen se comprobó sin `-k`, con hostname y cadena válidos, pasando portada
y API por el proxy TLS aislado. Arquitectura, versiones, hash del JAR, límites,
puertos y `nginx -t` verificados. YAML, actionlint 1.7.12, `bash -n`, compilación
Python y unidades systemd validados. Las advertencias de permisos de unidades
globales de observabilidad no se corrigieron por estar fuera de alcance.
También se reinició PostgreSQL en el destino y se verificó que sus 16 tablas y
303 filas conservaran todos los hashes; el volumen persiste tras reiniciar.

La automatización visual de navegador presentó timeouts; no se da por validado
un recorrido visual completo en esta sesión. Las pruebas anteriores sí ejercen
HTTP/WS reales y escrituras en la copia restaurada; no son solo comprobaciones 200.

La copia contiene datos de ensayo y **NO debe promoverse a producción**. Antes de
esperar aprobación se detienen backend/proxy/frontend de prueba para que no haya
temporizadores duplicados sobre el clon. Los datos reales vendrán del dump final.

## CI/CD preparado

- Workflow nativo `ubuntu-24.04-arm`, `linux/arm64`; conserva pruebas backend,
  frontend, lint, auditoría y typecheck. No actualiza dependencias.
- PRs validan y construyen sin publicar imágenes ni desplegar.
- Tags futuros `${commit}-arm64`, sin reemplazar `latest` AMD64.
- Secretos nuevos: `PHOSRVR_SSH_HOST`, `PHOSRVR_SSH_USER`, `PHOSRVR_SSH_KEY`,
  `PHOSRVR_SSH_KNOWN_HOSTS`. Se verificó autenticación exclusiva con la nueva
  clave y host key fijada. Se añadió una clave con `restrict` sin sustituir las
  otras claves autorizadas. No se copiaron identidades personales entre hosts.
- Usa la contraseña restaurada en el `.env` del host; no la reemplaza desde CI.
- Despliegue bloqueado hasta configurar `BATTLESHIP_DEPLOY_TARGET=phosrvr`
  **y** crear `/opt/battleship/.production-active` después del corte validado.
- Candidatos por SHA, bloqueo exclusivo, respaldo de configuración activa,
  ingreso cerrado y backend detenido antes del snapshot; segunda comprobación
  de partidas para cerrar la carrera. Ingreso reabre tras startup verificado.
- CI no modifica el proxy público ni POM. No hay runner propio del proyecto que
  desinstalar del origen. Los secrets antiguos se conservan para rollback.

Documentación de runners: https://docs.github.com/en/actions/reference/runners/github-hosted-runners

## Corte propuesto: REQUIERE CONFIRMACIÓN DEL USUARIO

Interrupción estimada: **5–10 minutos** para escrituras y reconexión de sesiones;
puede alargarse si Cloudflare o certificados tardan. Buscar una ventana sin
partidas activas; no forzar a terminar juegos. El frontend/backend mantienen sus
versiones anteriores verificadas, no imágenes de un commit nuevo de infraestructura.

Condiciones previas pendientes:

1. Login y confirmación de cuenta/zona Cloudflare, inventario exacto de TODOS los
   registros del subdominio y sus valores anteriores, proxy/TTL/restricciones.
2. Responsable del proxy confirma mecanismo persistente y lock compartido;
   valida nueva configuración completa preservando todas las rutas existentes.
   Resolver TLS para este dominio antes de habilitar tráfico al destino.
3. Commit revisado, CI pertinente aprobado; respaldo e imágenes ARM64 disponibles.
4. Confirmación explícita del usuario para este corte.

Secuencia después de confirmar:

1. Suspender despliegues automáticos de Battleship durante el corte, sin afectar
   otros workflows/runners. Registrar estado de origen/destino y hora UTC.
2. Verificar cero partidas activas (`PLACING_SHIPS`, `READY_TO_START`,
   `IN_PROGRESS`, legacy `EN_CURSO`) y cero `mesa.ready_deadline_at` pendientes.
3. Cerrar SOLO el ingreso de Battleship en el origen con respuesta 503; cerrar
   WS existentes y detener `battleship-backend` con `docker stop --time 60`.
   Volver a comprobar los estados.
   Si comenzó una partida en la carrera, reabrir el origen y reprogramar el corte.
   No detener Nginx global, Alloy, Docker daemon u otros contenedores.
4. Hacer respaldo FINAL con el mismo script y guardar `.env`, configuración y
   manifests. Transferir por SSH y verificar SHA256. Mantener origen congelado.
5. En phosrvr, crear `battleship_postgres_data` NUEVO, restaurar el dump FINAL,
   comparar huellas antes de iniciar backend y revisar secuencias/propietarios.
   Conservar el volumen preflight. No restaurar sobre el volumen original del origen.
6. Iniciar imágenes ARM64 verificadas; probar sesión existente y datos históricos
   sin publicar tokens. Probar ingreso, API/WS y TLS del dominio por la ruta
   acordada. No ejecutar smoke de escritura contra datos reales sin marcar las
   cuentas/mesa de prueba y dejar constancia.
7. El responsable integra exclusivamente la ruta acordada del dominio. Cambiar
   SOLO el registro de Battleship al origen `129.146.117.87`, manteniendo proxy,
   TTL y restricciones. No tocar apex, www, correo ni otros subdominios.
8. Validar con dos sesiones y espectador por HTTPS público, incluyendo WS y una
   partida de prueba identificada. Confirmar acceso a datos anteriores, reinicios
   y persistencia. Origen permanece en 503 para clientes/edges rezagados: nunca
   permite escrituras concurrentes en su base antigua.
9. Crear `.production-active` y activar `BATTLESHIP_DEPLOY_TARGET=phosrvr`.
   Habilitar backup exclusivo diario; verificar su primer resultado. Reanudar CI
   solo hacia phosrvr. Mantener contenedores/volumen/config/certificados/backups
   originales y acordar duración de la ventana de rollback antes de retirarlos.

## Recuperación sin perder escrituras nuevas

**No basta volver el DNS a la base vieja.** Después de abrir phosrvr, esa base
ya no contiene las escrituras más recientes.

- Antes de abrir escrituras en phosrvr: dejar su ingreso cerrado, arrancar los
  contenedores originales de Battleship en nightly-int y restaurar su ruta/DNS
  anterior. La base original sigue siendo la autoridad; no se borró ni restauró.
- Después de abrir escrituras en phosrvr: bloquear su ingreso HTTP/WS, desactivar
  su despliegue CI/timer y detener backend. Exportar un nuevo dump consistente
  de **phosrvr**. Conservar su volumen y todos sus respaldos.
- Transferir ese dump al origen, crear una base/volumen de recuperación NUEVOS y
  restaurar verificando huellas, secuencias y propietarios. Usar las imágenes
  AMD64 originales conservadas; crear un stack de recuperación de Battleship
  con nombres/red propios y puerto loopback libre, preservando el stack original.
- Con ambos ingresos cerrados, validar la recuperación. Cambiar exclusivamente
  la ruta/DNS de Battleship y abrir solo el stack de recuperación. phosrvr sigue
  sin escritores y responde mantenimiento a tráfico rezagado.
- Tras estabilizar, registrar exactamente qué base es la autoridad. No mezclar
  bases ni reactivar simultáneamente schedulers/escritores. El ensayo ARM64 →
  AMD64 ya demostró recuperación de escrituras posteriores, pero no representa
  una autorización para cortar ni una prueba del futuro DNS/proxy público.

Si falla un despliegue CI con ingreso cerrado, el script no restaura una base
antigua automáticamente: inspeccionar el backup privado y decidir si hubo nuevas
escrituras antes de recuperar. Si no llegó a cambiar contenedores, `docker start`
de los contenedores originales de Battleship permite reabrir sin tocar datos.

## Pendientes de cierre

- Confirmación de Cloudflare, proxy compartido, corte y pruebas públicas finales.
- Ejecutar y conservar evidencia de CI del commit de infraestructura.
- Acordar ventana de rollback, retención y respaldo automático off-host.
- Después de esa ventana, retirar únicamente recursos/secretos/claves/rutas
  demostrados exclusivos de Battleship. No borrar nada durante esta preparación.
