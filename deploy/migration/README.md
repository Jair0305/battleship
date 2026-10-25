# Battleship: preparación de migración a phosrvr

Fecha de evidencia: 2026-10-25 UTC.
**Estado: candidato final preparado y probado; producción todavía está en nightly-int.
El usuario autorizó el corte condicionado a cerrar los gates restantes; todavía
no se ha ejecutado.**

**El usuario rechazó el residual Ubuntu de `7b8733c`: no promover ese candidato.**
Se conserva su evidencia como histórica; la [remediación actual](../security/ubuntu-residual.md)
cambia la base del backend a Alpine/MUSL. El candidato corregido `f4a06e6` ya
cerró CI, publicación, digests y ensayos finales. La autorización de ventana
sigue condicionada a Cloudflare/TLS y GO coordinado, sin aceptación de riesgo.

**Candidato actual `f4a06e6`:** publicación nativa ARM64/AMD64
[`40210687407`](https://github.com/Jair0305/battleship/actions/runs/40210687407)
aprobada; ocho digests verificados contra los config digests escaneados. Los
ocho reportes Trivy 0.76.1, DB del 25-Oct 12:57 UTC, no contienen hallazgos de
ninguna severidad. ARM64 restauró 16 tablas/3.737 filas y terminó con 4.122;
AMD64 nativo restauró ese respaldo con huellas idénticas y terminó con 4.507.
Ambos pasaron juego completo WS/SockJS, ranking/chat y bloqueo de falsificación,
reinicio, cuentas/hashes/sesiones y revocaciones, sin cambiar el esquema.
Clones detenidos y nuevas escrituras respaldadas. El
[recibo actual](evidence/musl-final-candidate-20261025.json) registra digests,
reportes, ensayos y paquete `/opt/battleship/cutover/f4a06e6` validado sin activar
configuración, servicios ni marker de producción. Origen revalidado a las
16:25 UTC: mismas revisiones y cero partidas/deadlines; sigue activo.

**Actualización de seguridad:** la instrucción posterior del usuario autoriza
parches mínimos de runtimes, dependencias y código. La tabla siguiente describe
el ensayo de paridad histórico, no el candidato actual. El candidato de corte
debe ser el parcheado, documentado en [seguridad](../security/README.md), con CI
aprobado y los bloqueos de aplicación resueltos. El JAR congelado y las imágenes
originales se conservan exclusivamente como baseline/recuperación privada.

**Actualización de publicación:** el candidato `f9eaa42` pasó CI y publicó imágenes
ARM64/AMD64 verificadas por digest. Ambas arquitecturas pasaron restauración de
16 tablas/1.622 filas, partidas con ranking por WebSocket/SockJS y persistencia
tras reiniciar los cuatro servicios. Los clones terminaron con 2.007 filas y
quedaron detenidos. Véanse [seguridad](../security/README.md) y el
[recibo actualizado](evidence/published-security-20261025.json). La revocación de
sesiones, acceso Cloudflare e ingress coordinado siguen pendientes; esta
validación no autoriza abrir producción. El usuario confirmó que las cuentas son
de prueba y no requieren recuperación individual. El usuario autorizó
después retirar la API antigua: se eliminan sus controladores HTTP/STOMP y se
bloquean los `SEND` de clientes al broker. `f9eaa42` queda como baseline privado;
el corte y el hotfix requieren imágenes nuevas con ese cierre, nuevo CI y flujos.
El [ensayo posterior del JAR](evidence/legacy-retirement-20261025.json) pasó
multijugador WebSocket/SockJS, bloqueo STOMP y persistencia con esquema intacto.
La revocación se probó solo en el clon: 83 tokens anteriores rechazados, datos
conservados y nuevos accesos válidos.

**Candidato histórico retirado `7b8733c`:** CI nativo y publicación aprobados, con los ocho
digests ligados a sus config digests escaneados. ARM64 restauró 16 tablas/2.966
filas y terminó con 3.352 filas nuevas de ensayo. Docker Desktop AMD64 nativo
restauró ese dump ARM con huellas idénticas y terminó con 3.737 filas. Ambas
arquitecturas pasaron WebSocket/SockJS, rechazo de falsificación STOMP, ranking,
privacidad, reinicio y persistencia; conservaron la revocación y el mismo esquema.
Todos los clones quedaron detenidos. El
[recibo final](evidence/final-candidate-20261025.json) registra los artefactos,
respaldos y preparación de proxy fresca de las 14:49:39 UTC. Paquete de corte
validado en `/opt/battleship/cutover/7b8733c`, sin activar configuración/marker.

## Ensayo histórico de paridad

| Componente | Producción AMD64 | Preparación ARM64 |
| --- | --- | --- |
| Frontend | `af4f47783e6f44d6b086648348bc37392d661ecf` | Código de ese commit; candidato con corrección de dependencias autorizada, descrita abajo |
| Backend | `c80b74a6194e1b014c314c53f041ff41370d6bcd` | Reempaquetado del JAR que ejecuta producción, sin recompilar dependencias |
| JAR SHA256 | `d65ba230f653a29f15d40999ea65f4745218dc5e3d5945439f77e1af3f185108` | Idéntico dentro del contenedor ARM64 |
| Node / Alpine | `22.23.1` / `3.24.1` | Mismas versiones, verificadas ejecutándolas |
| Java | Temurin `21.0.12+8`, Ubuntu 22.04 | Misma versión; binario ARM64 |
| PostgreSQL | `16.15` | `16.15`, mismo índice OCI por digest |
| Nginx | `1.27.5` | Mismo índice OCI por digest |

Revalidación de producción a las 04:40:26 UTC: los cuatro contenedores originales
siguen ejecutándose con esas referencias; cero partidas activas y cero deadlines
pendientes. A las 04:40:32 UTC, ningún contenedor Battleship está ejecutándose en
phosrvr; no existen su hoja pública ni el marcador `.production-active`.
Estas comprobaciones se repetirán inmediatamente antes de cualquier corte.

Imágenes ARM64 locales verificadas en phosrvr:

- `battleship-frontend:af4f477-arm64`: `sha256:d86de1f0f0979a05f689add4f37ebc74f2c83aaaa2122490dd6f98eb2573660c`.
- `battleship-backend:c80b74a-arm64`: `sha256:ccb068db9e313d297a9077939b80bfe5ae00ae74440b6b5e557d11a060c0bbdb`.

La imagen frontend de producción tiene un nombre GHCR, pero ese tag no existe en
el registro: la liberación visual fue cargada manualmente. La imagen backend
publicada solamente ofrece AMD64. Por eso no se usó `latest` ni se desplegó HEAD.
Los Dockerfiles de aplicación reciben argumentos para fijar los runtimes de los
siguientes builds. El código de negocio permanece igual. El ensayo inicial
conservó también el lockfile original; posteriormente el
usuario autorizó explícitamente **«repara las vulnerabilidades obviamente»**.
El candidato de corte debe incorporar esa corrección; la imagen original de
frontend se conserva como evidencia/rollback y no es el candidato corregido.

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

No se detuvieron ni reconfiguraron Alloy, observabilidad, Hermes/correos, las rutas
POM ni los runners Cleanly o Pixel Office. Otros chats hacen cambios simultáneos; las diferencias de
su inventario global no deben atribuirse a esta migración.

## Destino y coordinación

phosrvr se verificó como `aarch64`, con aproximadamente 160 GiB libres y 20 GiB de
RAM disponibles al empezar. La reserva está en
`/opt/battleship/MIGRATION-RESERVATION.txt`.

- `/opt/battleship`, red Docker `battleship`, sin subred fija compartida.
- Nginx de aplicación: **solo `127.0.0.1:3006`**; backend: **solo `127.0.0.1:3007`**.
- PostgreSQL: sin puerto publicado. No se abrió firewall ni servicio interno.
- El ensayo TLS inicial usó `127.0.0.1:9444` y quedó detenido. El candidato de
  seguridad prueba TLS dentro de su red exclusiva, sin otro puerto host.
- Moonlight reserva 3334/3335/9443, sin conflicto.
- Límites de memoria/CPU por servicio en `docker-compose.phosrvr.yml`; builder
  exclusivo `battleship-migration`, con 4 GiB y 1.5 CPU como máximo.
- Cualquier build pesado posterior debe tomar `/run/lock/nightly-phosrvr-build.lock`.
  Se reutilizan las imágenes verificadas; el builder y los ensayos están detenidos.
- La copia de prueba usa **`battleship_postgres_preflight_20261025`**. El volumen
  de producción del destino se creará con el respaldo FINAL después de aprobar.

`battleship.caddy` contiene la ruta con TLS administrado. La hoja bootstrap
`battleship.bootstrap.caddy` usa el certificado actual exclusivo del dominio hasta
confirmar DNS y emitir su certificado administrado. Ambas apuntan únicamente a
`127.0.0.1:3006`. Cleanly confirmó su rol como instalador coordinado del ingress.
Ya instaló la foundation VACÍA, sin reload, con import persistente
`/config/nightly-sites/*.caddy` y lock `/run/lock/nightly-public-proxy.lock`.
No se reaplicaron foundation, renderer patches ni `render.sh`.

Paquete preparado y validado bajo el lock a las 04:46:36 UTC:

- `/opt/battleship/proxy-packets/20261025T044636Z/battleship.caddy`.
- Hoja SHA256 `e83f60fdec9d53898b2a09a03295a7824eaa7f794d1070811bf440d8905951f3`.
- Candidato JSON SHA256 `5553b6dd2e20600b3ba67c4ef225aab51248f1341e7e06e0740bb73f16053ae6`.
- Baseline activo `11276f9769071e122ac5683e98b99ff5f7e8bda325e845042ed693976d118c71`,
  coincidente con el recibo foundation de Cleanly. Glob público vacío.
- `caddy adapt` y `caddy validate` pasaron. Las rutas existentes, sus políticas
  TLS, listeners y loggers mantienen su comportamiento. Pruebas RTC/TURN
  200/200/404/404 antes y después; 35 contenedores protegidos sin cambios.
- Certificado bootstrap en `/config/battleship-tls`, claves root-only fuera del
  glob público; staging en `/config/battleship-candidates/20261025T044636Z`.
- Recibo versionado: `evidence/proxy-preparation-20261025.json`.
- **Sin hoja pública instalada, sin load/reload y sin cambio DNS.** Cleanly recibió
  paquete/hash/baseline para instalar después de aprobación propia y nueva
  comprobación de drift bajo lock, preservando hojas de otros proyectos.

El preparador compara el JSON completo, conservando el orden de las listas y
permitiendo únicamente la ruta, certificado, política SNI y exclusión de logging
exactos de Battleship. Rechaza cambios en catch-all, rutas sin host, logging
global y automatización TLS. Exige el import persistente activo al nivel superior
en template/rendered (rechaza snippets sin uso o imports dentro de un sitio) y
que el archivo montado coincida; el candidato conserva las hojas actuales y
añade su import de ensayo en el mismo lugar y alcance del import persistente.
Por seguridad, rechaza heredocs antes del import: una plantilla con esa sintaxis
necesita revisión específica, ya que su contenido puede simular llaves/imports.
Antes de reutilizar TLS comprueba propietario root:root, directorio 0700,
archivos regulares 0600 y ausencia de enlaces simbólicos o hardlinks.

Las 18 pruebas de `test_prepare_public_proxy.py` pasaron como root en phosrvr,
incluidas las reproducciones negativas de los hallazgos de las revisiones.
En Windows pasan las 16 pruebas de configuración/import; las dos de permisos
Linux se omiten explícitamente. Ejecutar con
`python3 -m unittest discover -s /opt/battleship -p test_prepare_public_proxy.py`
después de copiar ambos scripts al directorio privado. El ensayo real adicional
usó `python3 /opt/battleship/prepare-public-proxy.py`, sin instalar ni cargar.

La igualdad de configuración y los probes anteriores no demuestran continuidad
de conexiones durante una futura recarga. Los proxies RTC actuales no configuran
`stream_close_delay`; Caddy documenta que un reload cierra por defecto los
[WebSockets existentes](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#streaming).
Antes de cada recarga, Cleanly debe coordinar una ventana sin sesiones RTC que
puedan verse afectadas, o un mecanismo autorizado por su dueño. No añadir
opciones a rutas POM ni interpretar la aprobación de Battleship como permiso
para interrumpir POM. Si no se cumple esa condición, no recargar ni congelar
el origen. Esto también aplica al paso posterior de TLS administrado.

El usuario informa que Chrome está autenticado. La herramienta no puede observar
sus pestañas porque su runtime intenta cargar `browser/26.1016.62342/scripts/
browser-service.mjs`, versión que ya no existe después de actualizar el plugin.
Chrome está ejecutándose y su manifest de native-host pasó la comprobación
soportada. **No se interpreta este fallo como sesión cerrada ni se pide otro login.**
No se reparó el native-host, no se copiaron módulos y no se extrajeron cookies.
La credencial CLI existente de Wrangler está vencida y no autorizó lectura de
zona; tampoco incluye permiso de edición DNS. No se reutilizó ni amplió su acceso.

Cuenta esperada `c6c06b3b8b2262a874ad710ccaf4ec8e`, zona `nightly.mx`: **todavía
no confirmadas en la sesión actual**. Verificar cuenta, zona, registro, proxy,
TTL y restricciones antes de modificar. Las respuestas AAAA públicas del proxy
Cloudflare no demuestran que exista un registro AAAA de origen.

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
  frontend, lint, auditoría y typecheck. Instala el lockfile versionado.
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

### Bloqueo de CI identificado el 2026-10-25

El [run de effabca](https://github.com/Jair0305/battleship/actions/runs/40155730640)
pasó la instalación de Temurin/Node y las pruebas del backend en ARM64. Falló en
`npm audit --audit-level=moderate`: 7 vulnerabilidades reportadas (3 moderadas,
3 altas y 1 crítica). El despliegue fue omitido; no publicó imágenes ni ejecutó
cambios en producción.

Antes de la corrección autorizada se comprobó con `git diff --exit-code af4f477 979455f --
battleship-frontend/package.json battleship-frontend/package-lock.json` que los
manifests y el lockfile coincidían con la versión frontend de producción. Eran
hallazgos sobre las dependencias conservadas, no una actualización introducida
por esta migración.

La auditoría señala `next`, `follow-redirects`, `source-map-js`, `zod` y la cadena
`postcss-selector-parser` / `postcss-nested` / `tailwindcss`. Next 16.3.8 está en
el rango publicado por los avisos
[GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) y
[GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr), publicados
después de la liberación visual y corregidos en Next 16.4.1. Estos avisos tienen
condiciones específicas de explotación; el resultado de audit no demuestra que
Battleship haya sido explotado.

El usuario autorizó después reparar las vulnerabilidades. Se actualizaron solo
Next y su configuración ESLint, las transitivas afectadas y el parser de CSS.
No se ejecutó `npm audit fix --force`, no se añadió allowlist y no se debilitó
el umbral del workflow. La auditoría del lockfile corregido reporta cero
vulnerabilidades. Cloudflare, ingress y aprobación de corte siguen pendientes;
corregir dependencias no constituye aprobación de corte.

| Dependencia | Anterior | Corregida |
| --- | --- | --- |
| next / eslint-config-next | 16.3.8 | 16.4.1, versiones exactas alineadas |
| follow-redirects | 1.16.0 | 1.16.1 |
| source-map-js | 1.2.1 | 1.2.2 |
| zod | 4.4.3 | 4.6.7 |
| postcss-selector-parser | 6.1.4 | 7.1.6, override explícito |

Tailwind permanece en 3.4.19. El override del parser cierra
[GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) sin migrar
la aplicación a Tailwind 4. Se comprobó compatibilidad generando el CSS completo
con ambos árboles de dependencias: SHA256 idéntico
`8b11dcc3ee1456fca10511373c7c51ceb4a0b96e4d7bc4d7d4be44b0ca314f73`.
No se cambiaron componentes, reglas de estilo, lógica de juego, backend ni datos.
Pasaron `npm ci`, `npm audit --audit-level=moderate`, lint y TypeScript localmente.

El Dockerfile de producción compiló el candidato nativamente en ARM64 con el
mismo Node 22.23.1/Alpine, bajo `/run/lock/nightly-phosrvr-build.lock`. El builder
conservó 4 GiB/1.5 CPU, terminó sin OOM y quedó detenido. También pasó la auditoría
durante instalación y después de `npm prune --omit=dev`.

- Imagen corregida: `battleship-frontend:security-20261025`, ID
  `sha256:2637e728187faeb0bf911c24f242bbf8b5200d70a4ff8df1660c9c497e6c44fa`.
- Archivo privado: `/opt/battleship/backups/frontend-security-20261025.tar.gz`, SHA256
  `2e7381b7f954385a3215482799c577fb7ff9196760361535155f57bc58b9c939`.
  Se verificaron CRC gzip, tag, arquitectura y hashes del config/blob OCI.
- Build log: `/opt/battleship/build/security-20261025-build.log`.
- Auditoría completa del lockfile: `evidence/npm-audit-security-20261025.json`;
  recibo de pruebas: `evidence/security-remediation-20261025.json`.

Se repitió `smoke.mjs` con esa imagen sobre el volumen preflight: registro/login,
sesiones, jugadores/espectador, chat STOMP/WebSocket sin duplicados, flotas,
privacidad, disparos hasta victoria, revancha, rendición y salida. Los cuatro
grupos de pruebas pasaron. `.env.security-preflight` es privado y apunta solo al
volumen de ensayo; `.env` original no cambió. Después se detuvieron todos los
contenedores de ensayo. La producción del origen, DNS y proxy público siguen
sin cambios. La aprobación del corte continúa pendiente.

Para comprobar los pasos que no llegó a ejecutar CI después del fallo de audit,
se ejecutaron `npm ci`, `npm run lint`, `npm run build` y
`npx tsc --noEmit --incremental false` sobre el archivo limpio de `af4f477`, en
un contenedor ARM64 con Node 22.23.1, red exclusiva de Battleship y límites de
1.5 CPU / 4 GiB. Todos pasaron; el contenedor terminó con código 0 y sin OOM.
Evidencia en phosrvr: `/opt/battleship/build/ci-validation-effabca.log`, contenedor
detenido `battleship-ci-validation-effabca`. Esto no sustituye ni anula el fallo
de seguridad del workflow.

## Corte autorizado, condicionado a los gates restantes

El hilo coordinador transmitió la autorización real del usuario alrededor de las
14:40 UTC: **«Sí, ejecutar cuando estén verificadas las condiciones restantes»**,
para Battleship y la ventana de 5–10 minutos, incluyendo la posible desconexión
de WebSockets/llamadas RTC de POM durante la recarga compartida. No se vuelve a
pedir esa misma ventana. El coordinador resuelve Chrome/Cloudflare y el GO con
Cleanly; no se congela el origen ni se recarga/cambia DNS antes de ese GO.

Estado posterior del coordinador: los cuatro diagnósticos oficiales de Chrome
pasaron, pero el bootstrap sigue fallando antes de observar pestañas por el
`browser-service.mjs` faltante. Soporte indicó reinstalar Browser desde la UI;
el usuario ya fue informado. No se interpreta como logout, no se usa T3 como
alternativa ni se repara el host manualmente. No hay baseline Cloudflare ni GO.
El usuario rechazó expresamente los 22 MEDIUM/16 LOW: `7b8733c` está retirado.
La remediación Alpine/MUSL y sus nuevos artefactos deben cumplir los gates
descritos en seguridad; la aprobación operativa no acepta el residual anterior.
El origen sigue activo y no se reservan locks mientras falta el GO.

Interrupción estimada: **5–10 minutos** para escrituras y reconexión de sesiones;
puede alargarse si Cloudflare o certificados tardan. Buscar una ventana sin
partidas activas; no forzar a terminar juegos. Usar el frontend corregido y
verificado tras la autorización de dependencias y el backend recompilado con los
parches de seguridad. Conservar el JAR original como artefacto histórico, sin
promoverlo. Revalidar la versión que sigue sirviendo el origen antes del corte.

Condiciones previas pendientes:

1. Recuperación de la herramienta de Chrome o acceso API válido, confirmación de
   cuenta/zona Cloudflare e inventario exacto de TODOS los
   registros del subdominio y sus valores anteriores, proxy/TTL/restricciones.
2. Responsable del proxy confirma mecanismo persistente y lock compartido;
   valida nueva configuración completa preservando todas las rutas existentes.
   Resolver TLS para este dominio y comprobar vecinos antes/después de la
   recarga, cuya posible reconexión RTC ya fue autorizada.
3. Revalidar los ocho digests del candidato corregido `f4a06e6`, ligados a sus
   reportes y ensayos del [recibo actual](evidence/musl-final-candidate-20261025.json).
   `7b8733c` está retirado; `f9eaa42` es histórico.
4. Conservar la evidencia de remediación del residual Ubuntu y el gate estricto
   de todas las severidades; no usar ignores ni aceptar riesgo por omisión.
   La autorización de ventana ya llegó.
5. Revocación real durante el corte, conservando datos y usando el SQL ensayado;
   retiro legacy y bloqueo STOMP están cerrados en el candidato final.

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
   Con ingreso/backend/scheduler aún detenidos, aplicar
   [revoke-exposed-sessions.sql](revoke-exposed-sessions.sql) mediante `psql -X -q`
   con `ON_ERROR_STOP`, en la base restaurada. Aplica la revocación acordada en la base
   que será autoridad, conservando filas/relaciones e historial. Verificar que los
   tokens anteriores fallen y un nuevo login/sesión funcione; no registrar sus
   valores. Las cuentas existentes son de prueba según el usuario; no se necesita
   recuperación individual ni cambiar sus hashes. Guardar un backup posterior
   a la revocación: todo rollback debe conservarla.
6. Iniciar imágenes ARM64 verificadas; probar nuevo login y datos históricos
   sin publicar tokens. Probar ingreso, API/WS y TLS del dominio por la ruta
   acordada. No ejecutar smoke de escritura contra datos reales sin marcar las
   cuentas/mesa de prueba y dejar constancia.
7. Cleanly instala exclusivamente la hoja bootstrap revisada, tras comprobar drift
   y vecinos bajo el lock compartido, con recarga acordada. Cambiar
   SOLO el registro de Battleship al origen `129.146.117.87`, manteniendo proxy,
   TTL y restricciones. No tocar apex, www, correo ni otros subdominios.
8. Emitir y comprobar TLS administrado de este dominio después de propagar DNS;
   sustituir solo su hoja bootstrap por `battleship.caddy` bajo el mismo protocolo,
   conservando el certificado anterior hasta validar renovación automática.
   Validar con dos sesiones y espectador por HTTPS público, incluyendo WS y una
   partida de prueba identificada. Confirmar acceso a datos anteriores, reinicios
   y persistencia. Origen permanece en 503 para clientes/edges rezagados: nunca
   permite escrituras concurrentes en su base antigua.
9. Crear `.production-active` y configurar el destino CI como phosrvr sin saltar
   audit. Impedir que el workflow antiguo vuelva a desplegar en nightly-int;
   verificar el siguiente despliegue exclusivamente hacia phosrvr.
   Habilitar backup exclusivo diario; verificar su primer resultado. Reanudar CI
   solo hacia phosrvr. Mantener contenedores/volumen/config/certificados/backups
   originales y acordar duración de la ventana de rollback antes de retirarlos.

## Recuperación sin perder escrituras nuevas

**No basta volver el DNS a la base vieja.** Después de abrir phosrvr, esa base
ya no contiene las escrituras más recientes.

- Antes de abrir escrituras en phosrvr: dejar su ingreso cerrado y reabrir en
  nightly-int el candidato AMD64 parcheado y probado, usando la base que sea
  autoridad y conservando la revocación acordada. No reexponer por defecto las
  imágenes originales vulnerables. La base original no se borró ni restauró.
- Después de abrir escrituras en phosrvr: bloquear su ingreso HTTP/WS, desactivar
  su despliegue CI/timer y detener backend. Exportar un nuevo dump consistente
  de **phosrvr**. Conservar su volumen y todos sus respaldos.
- Transferir ese dump al origen, crear una base/volumen de recuperación NUEVOS y
  restaurar verificando huellas, secuencias y propietarios. Usar las imágenes
  AMD64 parcheadas y verificadas; crear un stack de recuperación de Battleship
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

- Restablecer acceso técnico a Cloudflare, confirmar cuenta/zona y obtener el GO
  coordinado para ejecutar la ventana ya autorizada; instalar la hoja mediante
  Cleanly y verificar producción públicamente.
- Conservar los digests y ensayos del candidato corregido `f4a06e6` y la evidencia
  del futuro corte real. `7b8733c` permanece retirado para promoción.
- Acordar ventana de rollback, retención y respaldo automático off-host.
- Después de esa ventana, retirar únicamente recursos/secretos/claves/rutas
  demostrados exclusivos de Battleship. No borrar nada durante esta preparación.
