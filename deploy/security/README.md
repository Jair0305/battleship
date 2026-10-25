# Battleship: remediación de seguridad previa al corte

Evidencia del 25 de octubre de 2026 UTC. Producción sigue en nightly-int.
El usuario autorizó las correcciones mínimas necesarias de runtime, dependencias
y código; la paridad inicial se conserva como baseline, no como requisito para
mantener paquetes vulnerables. **No se ejecutó corte, cambio DNS, recarga pública,
revocación de sesiones ni hotfix de producción.**

## Estado y límites

**Decisión posterior del usuario: «No, resolverlo antes de migrar».** El residual
Ubuntu no fue aceptado y `7b8733c` no puede promoverse. Se conserva como baseline.
La [remediación acotada de la base](ubuntu-residual.md) prueba Alpine/Temurin MUSL
con la misma versión Java, elimina dependencias afectadas y endurece CI a todas
las severidades. `f4a06e6` pasó nuevo CI y publicación nativos ARM64/AMD64
[`40210687407`](https://github.com/Jair0305/battleship/actions/runs/40210687407).
Los ocho digests publicados coinciden con sus configuraciones escaneadas; cero
hallazgos en los ocho reportes de todas las severidades, con Trivy 0.76.1 y DB
del 25-Oct 12:57 UTC, sin ignores ni exenciones.

Las imágenes finales restauraron 16 tablas: ARM64 de 3.737 a 4.122 filas y AMD64
nativo de 4.122 a 4.507. Pasaron WS/SockJS, ranking/chat, bloqueo de falsificación,
reinicio y persistencia de cuentas/hashes/sesiones, manteniendo revocaciones y
esquema. Los clones quedaron detenidos y sus escrituras nuevas respaldadas.
El [recibo actual](../migration/evidence/musl-final-candidate-20261025.json)
conserva ocho digests, hashes de reportes/SBOM y recuperación inversa. Las
secciones sobre candidatos anteriores describen evidencia histórica.

El candidato de runtimes `f9eaa42` pasó CI y los ensayos ARM64/AMD64 descritos
abajo, con cero HIGH/CRITICAL en sus imágenes. El usuario autorizó después retirar
la API antigua: el candidato actual añade ese retiro y el bloqueo de publicaciones
STOMP de clientes. El candidato histórico retirado `7b8733c` pasó CI/publicación y
flujos de las imágenes exactas ARM64/AMD64; las imágenes anteriores no contienen
este cierre. Los tokens emitidos antes del
parche se revocarán durante el corte. El usuario confirmó que todas las cuentas
son de prueba y no requieren recuperación individual; se conservan datos y
respaldos. No se acepta riesgo en nombre del usuario.

El usuario autorizó la ventana condicionada de 5–10 minutos y posible reconexión
RTC/POM; el coordinador gestiona Cloudflare y el GO con Cleanly. No falta pedir
esa misma ventana: faltan Cloudflare/TLS, GO coordinado y la ejecución/validación
del corte con datos frescos. El residual se trató en el nuevo candidato, sin
aceptarlo ni promover `7b8733c`.

Se preservan `/opt/battleship`, únicamente los binds de aplicación
`127.0.0.1:3006/3007`, backups y artefactos originales. El TLS de prueba corre
dentro de la red exclusiva, sin publicar otro puerto. Los builds usan
`/run/lock/nightly-phosrvr-build.lock` con el builder exclusivo limitado a
1.5 CPU/4 GiB. No se cambiaron límites globales de Docker, Alloy, observabilidad,
Hermes, POM ni hojas de otros proyectos.

## Versiones antes y después

| Componente | Origen realmente observado | Candidato |
| --- | --- | --- |
| Código frontend | `af4f47783e6f44d6b086648348bc37392d661ecf` | Base conservada, dependencias parcheadas; tipo público del lobby sin token |
| Next | 16.3.8 | 16.4.1, corrección anterior en `1e91f3e` conservada |
| React cliente | 19.2.8 | 19.2.8; se verifica aparte el RSC embebido en Next |
| Node | 22.23.1 | 22.23.4 |
| OpenSSL / c-ares / Undici de Node | 3.5.7 / 1.34.6 / 6.27.0 | 3.5.9 / 1.34.9 / 6.29.1 |
| SQLite / Brotli de Node | 3.51.3 / 1.1.0 | 3.53.4 / 1.1.0 con backport oficial |
| npm global | 10.9.8 | 11.21.1 solo en build; npm/corepack/yarn ausentes en runner |
| Java | Temurin 21.0.12+8 | Temurin 21.0.13+9, con bloqueo explícito de 16 certificados comprometidos |
| Spring Boot / Framework | 3.2.5 / 6.1.6 | 4.0.9 / 7.0.10 |
| Spring Security Crypto | 6.2.4 | 7.0.8, más límites UTF-8 en alta y login |
| Tomcat | 10.1.20 | 11.0.27 |
| Jackson | 2.15.4 | 3.1.8; anotaciones compatibles 2.21, sin databind 2.x |
| Hibernate / pgJDBC | 6.4.4.Final / 42.6.2 | 7.2.25.Final / 42.7.14 |
| SQL Server JDBC | 12.4.2.jre11 en JAR | 13.2.1.jre11 de BOM para desarrollo; excluido solo de `repackage` de producción |
| PostgreSQL | 16.15 | 16.15, base Alpine refrescada; sin upgrade de major |
| gosu | 1.19 compilado con Go 1.24.6 | Mismo source 1.19, Go 1.27.3, moby/sys/user 0.4.1 y x/sys 0.44.0 |
| Nginx | 1.27.5 / Alpine 3.21.3 | 1.30.6 estable, brotli-libs 1.2.1-r0 |

Las referencias OCI base y SHA256 de los cuatro binarios Java, para ARM64 y AMD64,
están fijadas en Dockerfiles e instalador. El instalador usa descargas oficiales
de Adoptium y comprueba SHA256 antes de extraer. Las imágenes oficiales Temurin
disponibles no ofrecían todavía este parche; no se sustituyó por `latest`.
Los IDs locales, JAR, SBOM y reportes se registran en el recibo de evidencia.
Los digests de publicación GHCR y los config digests escaneados están en el
[recibo de publicación](../migration/evidence/published-security-20261025.json).

Recibo público: [expanded-security-20261025.json](../migration/evidence/expanded-security-20261025.json).
Las cuatro imágenes ARM64 están conservadas en
`/opt/battleship/backups/expanded-security-arm64-20261025.tar.gz`, SHA256
`44106585dd0a5e9d2fa12ab187849d3253ae645381bf84416bf23cd9c9995563`.
Se verificó la integridad gzip; la restauración lógica de PostgreSQL y la
identidad de las imágenes se verificaron por separado. No se afirma un ensayo
de restauración de este archivo OCI nuevo. Los contextos de build excluyen
`.env`, `.env.*` y `.git` para evitar incorporar configuración privada.

## Avisos y aplicabilidad

- **Node:** 22.23.4 corrige CVE-2026-105482 (DNS), -106069/-106072 (TLS),
  -111497 (Brotli), -105481, -106074 y -106073. No se asignan a Node 22 los
  avisos exclusivos de 24/26. La versión de Brotli permanece 1.1.0 porque el
  proveedor aplica un backport. Se comprobó `process.versions` del runner real,
  además del escáner. [Release oficial](https://nodejs.org/en/blog/release/v22.23.4).
- **Next/RSC:** se conserva Next 16.4.1, parche del
  [GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr).
  La aplicación no configura `cacheComponents`/`use cache`; no se confunde eso
  con la existencia de RSC. Los 116 archivos de cuatro variantes RSC de la imagen
  coinciden byte por byte con el tarball oficial fijado por SHA512 en el lockfile.
  La etiqueta canary embebida no demuestra ausencia del parche; React cliente
  tampoco demuestra el estado del RSC. El
  [aviso React](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3)
  se analiza para esos bundles, no se atribuye por usar React cliente.
- **Java:** la alerta posterior al CPU,
  [CVE-2026-91403](https://www.oracle.com/security-alerts/alert-cve-2026-91403.html),
  incluye 21.0.13. La imagen AMD64 que ejecuta producción aceptó 7/14 cadenas
  públicas comprometidas en una JVM efímera offline, sin arrancar la aplicación.
  El candidato rechaza 14/14 con su confianza real. JDK de build, JRE y JDK de CI
  incluyen las 16 huellas de la
  [mitigación publicada](https://www.scala-lang.org/blog/jdk-certificate-vulnerability.html).
  Las huellas se contrastaron con los
  [datos del incidente](https://emudhra.we-have-a-problem.com/impacted-intermediates.json).
  La versión por sí sola no certifica el almacén de confianza.
- **BCrypt:** [CVE-2025-22228](https://spring.io/security/cve-2025-22228/)
  tiene una ruta real: registro/login sin límite anterior. El servicio rechaza
  entradas de más de 72 bytes UTF-8, también al iniciar sesión; el encoder nuevo
  por sí solo no evita todos los matches contra prefijos heredados. Se conservan
  hashes existentes válidos hasta ese límite. Un hash no identifica si el usuario
  había usado una contraseña más larga; no se hace rehash masivo ni truncamiento
  silencioso. El usuario confirmó que la cuenta existente es de prueba y no
  requiere recuperar acceso individual; no hay usuarios reales todavía.
- **Spring/Tomcat:** Boot 4.0.9 es la rama soportada mínima elegida; 3.5.16 fue
  la [última versión OSS de 3.5](https://spring.io/blog/2026/06/25/spring-boot-3-5-16-available-now/).
  El BOM cubre Framework 7.0.10, Security 7.0.8 y Tomcat 11.0.27. Los requisitos
  de DefaultServlet escribible/JSP de CVE-2025-24813 y CVE-2024-50379/-56337 no se
  encontraron. Tampoco DIGEST/FORM/constraints particulares de los avisos 2026,
  ni HTTP/2 probado hacia Tomcat; el proxy usa HTTP/1.1 upstream. Se parchean los
  componentes igualmente. [Apache](https://tomcat.apache.org/security-11.html),
  [Spring](https://spring.io/security).
- **Jackson:** se sube el BOM a 3.1.8 por
  [CVE-2026-110879 / GHSA-m8xf-2cr7-77ph](https://github.com/FasterXML/jackson-databind/security/advisories/GHSA-m8xf-2cr7-77ph).
  El BOM Boot traía 3.1.7. No se encontró default typing/polimorfismo requerido,
  ni las rutas DataInput/async/XML específicas de otros avisos. No se declara
  exploitabilidad por versión solamente. El JAR se inspecciona, no solo el POM.
- **pgJDBC:** 42.7.14 cubre
  [CVE-2026-42198](https://github.com/pgjdbc/pgjdbc/security/advisories/GHSA-98qh-xjc8-98pq)
  (fix 42.7.11). No se hallan URLs JDBC aportadas por usuarios; un endpoint
  PostgreSQL malicioso es prerrequisito distinto de una petición HTTP normal.
- **SQL Server:** Microsoft confirma el fix de CVE-2025-59250 en
  [13.2.1](https://github.com/microsoft/mssql-jdbc/releases/tag/v13.2.1).
  Su JAR `13.2.1.jre11` declara `13.2.1` en pom.properties y Trivy lo marca por
  esa discrepancia. No se suprime el CVE ni se sube arbitrariamente de rama:
  el driver no usado por producción PostgreSQL se excluye del empaquetado;
  `spring-boot:run` conserva la dependencia de desarrollo.
- **gosu:** no se atribuyen todas las CVEs de Go a código alcanzable por versión
  del compilador. Se recompila el mismo commit
  `6456aaa0f3c854d199d0f037f068eb97515b7513` con Go 1.27.3 y símbolos retenidos.
  Se parchea además
  [CVE-2026-61801](https://github.com/moby/sys/security/advisories/GHSA-mjcv-p78q-w5fw)
  en moby/sys/user y x/sys; no se usa una excepción para conservarlos. Pasan sus
  tests, cambio de UID/grupos y arranque/restauración PostgreSQL.
- **Nginx:** se elige 1.30.6 de la rama estable para los
  [avisos oficiales](https://nginx.org/en/security_advisories.html), conservando
  configuración/rutas. El nuevo Alpine traía Brotli 1.2.0-r1 afectado por
  CVE-2026-111497; se instala 1.2.1-r0. No se modifica el Caddy compartido.

## Hallazgos de código y decisiones pendientes

1. **Fuga de tokens por lobby público, corregida en el candidato.** Se reemplaza
   `SessionUser` por `PublicPlayer` solo en la lista pública. Login/alta/session-me
   conservan su respuesta privada. El frontend solo consume nombre, tipo y rating
   de la lista; su tipo ahora omite `token`. Tests de serialización y HTTP anónimo
   comprueban la ausencia de tokens incluso con cuentas registradas.
2. **Sesiones antiguas potencialmente comprometidas.** Origen: una cuenta y siete
   sesiones, todas dentro de la lista pública. No se reproducen tokens ni se prueba
   suplantación en producción. Antes de abrir el candidato se necesita revocación
   de los tokens expuestos, con nuevo login para la cuenta y nueva sesión para
   invitados. Mantenerlos sería dejar utilizable la fuga anterior. No se realizó
   aún: se ejecutará en la ventana de corte autorizada. El usuario confirmó que
   todas son sesiones de prueba y pidió continuar sin recuperación individual.
   [revoke-exposed-sessions.sql](../migration/revoke-exposed-sessions.sql) rota
   atómicamente las credenciales y sus copias en `jugador`, conserva filas y
   rechaza partidas/deadlines activos. No cambia hashes ni historial. Requiere
   ingreso/backend/scheduler detenidos y backup lógico verificado previo.
   En el clon privado, las 83 sesiones anteriores dieron 401 después de rotar;
   se preservaron las 2.964 filas y todos sus campos ajenos a credenciales,
   incluidos hashes y relaciones. Un deadline activo rechazó la operación sin
   cambiar tokens; login existente, sesión privada e invitado nuevo pasaron.
   Las dos filas nuevas de esos controles quedaron en un backup posterior.
   Estos números son del clon ampliado por ensayos, no del origen con siete
   sesiones observado antes. Producción no fue revocada.
3. **API legacy HIGH retirada del candidato con autorización del usuario.** `/api/partidas`, `/api/sala`, `/api/juego`,
   `/api/chat` y el handler STOMP antiguo aceptan operaciones por ID sin identidad
   suficiente y pueden exponer entidades. La UI actual usa `/api/mesas` y
   `/api/salas`. El usuario eligió retirar las rutas antiguas. Se eliminan sus
   cuatro controladores HTTP y `JuegoWebSocketController`; no hay bandera para
   reactivarlos. Las 28 operaciones HTTP antiguas deben devolver 404 y
   `/app/juego/disparo` queda sin handler. Entidades, servicios internos y creación
   inicial de salas se conservan, sin cambios de esquema ni borrado de datos.
4. **Suplantación STOMP MEDIUM corregida en el candidato.** El broker también
   aceptaba `SEND /topic/...` directamente, sin pasar por handlers o por el chat
   HTTP autenticado. Permitía falsificar mensajes y el ranking mostrado, sin
   cambiar puntos persistidos. Un interceptor en `clientInboundChannel` descarta
   mensajes de publicación de clientes; conexiones, suscripciones y publicaciones
   del servidor se conservan. La UI actual no publica por STOMP. La regresión con
   Spring real primero confirmó que el canal aceptaba el `SEND`; después exige
   rechazo y ausencia de entrega, con una publicación válida del servidor como
   control positivo. El smoke añade un intento sintético de publicación, solo
   contra el clon privado, y exige que el chat HTTP autenticado siga llegando.

La fuga no justifica borrar cuentas/historial ni considerar un token antes
expuesto como prueba suficiente de propiedad para recuperar una contraseña.
La revocación debe preservar filas, relaciones y datos; guardar sus valores solo
en el backup privado de rollback. No restaurar después tokens comprometidos.

## Verificación y alcance del escaneo

- 26 pruebas backend ARM64: hashes fijos generados con Crypto 6.2.4, límites
  ASCII/multibyte y rechazo de sufijos; reglas clásicas, privacidad, scoring y
  vencimientos. El timer se desactiva solo en tests que invocan acciones
  explícitamente; una prueba real separada comprueba el scheduler en ejecución.
- El retiro añade inventario de los 28 handlers HTTP, ausencia del handler STOMP,
  controles de API moderna y el rechazo de publicaciones en el broker real.
  Cinco pruebas Node validan coincidencia exacta del payload y conservación del
  historial de frames: esperar el chat válido no puede borrar una falsificación.
- Cinco regresiones Linux para carrera de partidas, configuración antigua de
  dos imágenes, validación antes de pausar ingreso y política Java idempotente.
  Se repitieron con las cuatro variables de imágenes presentes en el entorno.
- El scanner elimina opciones `TRIVY_*` heredadas, desactiva config automática,
  recoge todas las severidades y ahora falla ante cualquier hallazgo. Un entorno/cwd
  hostil que pide solo LOW no ocultó un HIGH conocido: el gate devolvió 1.
- Trivy 0.76.1, DB de vulnerabilidades `2026-10-25T01:20:33Z`, Java DB
  `2026-10-25T00:59:20Z`. Cuatro JSON completos y cuatro SBOM CycloneDX, sin
  secret scanner ni ignore/suppressions. Runtimes Node/JRE y RSC se verifican
  aparte; `npm audit 0` no los certifica.
- Frontend, PostgreSQL y Nginx: sin hallazgos en ese escaneo. Backend: cero
  HIGH/CRITICAL; **22 MEDIUM y 16 LOW** de Ubuntu, 27 CVEs distintos, sin versión
  corregida informada por el scanner. Permanecen abiertos, con detalle en el
  recibo. Por ejemplo, Ubuntu confirma que
  [CVE-2026-18374](https://ubuntu.com/security/CVE-2026-18374) sigue sin parche
  en Jammy. El usuario rechazó ese residual: ahora se cambia la base y se eliminan
  los componentes afectados, según la [remediación](ubuntu-residual.md), sin
  supresiones ni backports locales no soportados.
- La verificación Java usa 14 cadenas públicas y raíces de fixture fijadas por
  SHA256. Una JVM efímera sin red, app o datos prueba el control sin los 16 bloqueos;
  otra, con las mismas raíces **solo en memoria**, exige rechazo por el bloqueo.
  Después se prueba la confianza real sin esas raíces y HTTPS válido. No se añade
  ninguna CA a la imagen, al host ni a producción para ejecutar esta verificación.
- Se retira el Dockerfile de migración que podía reempaquetar el JAR congelado
  con un JRE vulnerable. Los artefactos originales siguen respaldados; el único
  Dockerfile backend activo produce el candidato parcheado.

## Datos, contratos y recuperación

El dump inicial reciente proviene de snapshot PostgreSQL exportado, con huellas
en la misma transacción: 16 tablas, 112 filas. Se restauró en
`battleship_postgres_expanded_security_20261025`, nunca sobre producción.
`ddl-auto=validate` impidió cambios de esquema. Hibernate nuevo cambió nombres
implícitos de dos columnas de revancha; se fijan explícitamente a los existentes
`rematch_requestj1/j2`. Se comparó el esquema entero normalizado y el contenido
de todas las tablas antes/después de arrancar el candidato.

Pasaron cuentas/hashes/sesiones creados por el backend anterior, reinicio completo,
dos jugadores y espectador, HTTP, TLS con hostname/cadena validada, WebSocket,
SockJS XHR polling, chat una sola vez, flotas, disparos/victoria, revancha,
abandono y salida. Una partida con dos cuentas registradas verificó Elo, victorias
y derrotas exactamente una vez. Las partidas contra invitados no puntúan Elo.
Un deadline pendiente sobrevivió al reinicio y lo resolvió el scheduler sin
peticiones HTTP; no se duplicaron escritores contra la misma base.

El ensayo inverso restauró 16 tablas/1.243 filas con escrituras ARM nuevas en un
volumen AMD64 nuevo `battleship_security_reverse_20261025`, comparó todas las
huellas y probó sesión, lobby y contrato de ranking. Usó el backend original
**solo en red privada**, sin puertos host; quedó detenido. Demuestra compatibilidad
de datos, no autoriza reexponer esa imagen vulnerable. El candidato final agregó
la corrección del lobby sin alterar el esquema; sus pruebas terminaron con
16 tablas/1.622 filas en otro respaldo consistente privado.

Los originales, imágenes, volúmenes y respaldos anteriores siguen conservados.
La recuperación de producción debe usar AMD64 **parcheado** y el dump de la base
que contenga las escrituras más nuevas, manteniendo revocaciones de seguridad.
No volver DNS a la base vieja después de aceptar escrituras en phosrvr.

## Imágenes publicadas anteriores al retiro de la API antigua

El [CI del PR](https://github.com/Jair0305/battleship/actions/runs/40171163140)
pasó en ARM64 y AMD64. Su referencia de merge `84d1879` tiene el mismo árbol Git
que el commit candidato `f9eaa42`: no incorpora código adicional de otra rama.
La [ejecución de publicación](https://github.com/Jair0305/battleship/actions/runs/40171629106)
reconstruyó, probó y escaneó ambas arquitecturas desde `f9eaa42`, y publicó cuatro
imágenes por arquitectura. Ambos despliegues quedaron omitidos.

Los ocho manifests del registro apuntan a los config digests que Trivy escaneó.
Se descargaron por digest, comprobando arquitectura y etiqueta de revisión;
no se confunde un tag nuevo con la imagen local del ensayo anterior. Los ocho
reportes conservan cero HIGH/CRITICAL; los hallazgos Ubuntu siguen abiertos.
Pasaron también las verificaciones CI de RSC y confianza Java.

Se restauró el snapshot ARM64 de 16 tablas/1.622 filas en volúmenes nuevos,
uno por arquitectura, con huellas idénticas antes de iniciar el backend.
Con las imágenes publicadas pasaron dos partidas clasificadas por arquitectura:
WebSocket y SockJS XHR polling, chat una sola vez para dos jugadores/espectador,
privacidad, flotas, victoria/Elo, revancha y abandono. Después del reinicio de los
cuatro servicios seguían funcionando la cuenta, su hash y la sesión anterior.
Cada clon terminó con 16 tablas/2.007 filas; no se afirma que sus datos aleatorios
sean iguales entre sí. Sus esquemas completos sí coinciden, antes/después y entre
arquitecturas, SHA256 `8110579202dbb1f6337e3c96ae2517bb18e04f5e8fbf4c51dc2d76f1a8271ecc`.
La comparación usa `pg_dump --schema-only --no-owner --no-privileges`, excluyendo
solo los guards aleatorios `restrict/unrestrict`; no normaliza sentencias DDL.

Los contenedores de estos ensayos no publican puertos host, suman como máximo
800 MiB/1 CPU por stack y quedaron detenidos, sin OOM. Estos límites son solo
del ensayo, no del despliegue ni del Docker global. Se conservan los volúmenes
`battleship_security_patched_{amd64,arm64}_20261025`, snapshots privados y logs en
`/opt/battleship/migration/security-patched-{amd64,arm64}-20261025` en cada host.
El [recibo](../migration/evidence/published-security-20261025.json) contiene
digests completos, hashes de reportes/SBOM y evidencia por arquitectura.

El JAR con retiro de API y bloqueo STOMP pasó además un ensayo ARM64 privado,
montado sobre el runtime publicado anterior; **no es todavía la imagen final**.
SHA256 del JAR: `c77304b33d529d4b7cc7ab446142e00a1252fca2c60ba66fad86799aac1327fd`.
Pasaron partidas completas por WebSocket y SockJS polling, rechazo de chat
falsificado con entrega del chat HTTP válido, ranking y estadísticas privadas,
revancha, rendición y salida, y cuenta/hash/sesión tras reiniciar los cuatro
servicios. Las 16 tablas pasaron de 2.579 a 2.964 filas de ensayo, con backups
consistentes antes/después y el mismo hash de esquema. Se conservan los intentos
fallidos: una expectativa incorrecta de top diez y permisos del archivo de
prueba se corrigieron antes de este ensayo completo. El
[recibo del cierre](../migration/evidence/legacy-retirement-20261025.json)
distingue estas pruebas del ensayo posterior de las imágenes finales.

La publicación histórica `40197918658` aprobó `7b8733c` en ARM64 y AMD64, sin deploy;
ese candidato quedó retirado por el residual rechazado después por el usuario.
Se cotejaron los ocho manifests por digest con el config digest de cada reporte
escaneado. Después, las imágenes exactas restauraron y probaron 16 tablas:
ARM64 de 2.966 a 3.352 filas; su dump con escrituras nuevas se restauró con huellas
idénticas en Docker Desktop AMD64 nativo, de 3.352 a 3.737 filas de ensayo.
Ambos pasaron WS/SockJS/ranking/chat/privacidad y rechazo de publicaciones
falsificadas, reinicio y hash/sesión. Se conserva la revocación anterior y el hash
de esquema `8110579202dbb1f6337e3c96ae2517bb18e04f5e8fbf4c51dc2d76f1a8271ecc`.
Los clones están detenidos. No se consumió la RAM escasa de nightly-int ni se
alteraron servicios vecinos para el ensayo AMD64. Los reportes finales mantienen
cero HIGH/CRITICAL y el residual Ubuntu conocido; no se afirma cero vulnerabilidades.

La comprobación posterior al fallo de transporte SSH encontró íntegro y estable
el archivo ARM64 de recuperación anterior: mismo SHA256 y CRC gzip válido,
sin procesos tar/gzip pendientes. No se repitió ese build ni se borraron originales.

## CI, hotfix y siguiente aprobación

El workflow prueba ARM64 y AMD64 nativos; compila/carga cuatro imágenes, verifica
runtimes, confianza Java y bundles RSC, audita npm y escanea todas las imágenes
antes de publicar. Los reportes/SBOM conservan fecha y versión de DB. No se
publica en PR. El dispatch `publish_security_candidate` puede publicar candidatos
probados; **ningún dispatch despliega**. El despliegue solo ocurre por push a
main, variable `BATTLESHIP_DEPLOY_TARGET=phosrvr`, host/arquitectura fijados y
marcador `.production-active`. Esos mecanismos no están activados.

El deploy actualiza cuatro referencias, valida la configuración candidata incluso
si `.env` anterior solo tenía dos, cierra ingreso y comprueba partidas de nuevo
después de parar escritores. Si aparece actividad en vuelo, reabre el backend
anterior sin cambiar configuración/base. Fallos posteriores conservan el backup
y dejan ingreso cerrado: no restauran automáticamente datos antiguos.

Si Cloudflare/ingress siguen demorados, preparar **hotfix separado en nightly-int**
con las nuevas imágenes que incluyan el retiro de API y el bloqueo STOMP. El
ensayo AMD64 de `f9eaa42` es evidencia histórica de compatibilidad, no el artefacto
final para ese hotfix. Antes de solicitar su ventana, cerrar nuevo CI/publicación/
flujos y recuperación/revocación de sesiones. Proponer entonces una
sola ventana concreta, con rollback que conserve escrituras nuevas; no ejecutar
interrupción por este documento. El procedimiento de migración y coordinación
Cleanly/Caddy permanece en el [runbook](../migration/README.md).
