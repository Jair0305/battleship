# Battleship: remediación de seguridad previa al corte

Evidencia del 25 de octubre de 2026 UTC. Producción sigue en nightly-int.
El usuario autorizó las correcciones mínimas necesarias de runtime, dependencias
y código; la paridad inicial se conserva como baseline, no como requisito para
mantener paquetes vulnerables. **No se ejecutó corte, cambio DNS, recarga pública,
revocación de sesiones ni hotfix de producción.**

## Estado y límites

El candidato ARM64 pasa las pruebas descritas abajo y el gate de imágenes
HIGH/CRITICAL. Eso no certifica toda la aplicación: la API legacy sin autorización,
los tokens emitidos antes del parche y la recuperación de acceso siguen siendo
bloqueos de promoción. CI del nuevo commit y el ensayo del candidato AMD64
parcheado también deben completarse. No se acepta riesgo en nombre del usuario.

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
Los digests de publicación GHCR se registrarán después de CI/publicación.

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
  silencioso. Recuperación pendiente para la única cuenta real si la necesita.
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
   aún: requiere acordar impacto/recuperación en la ventana autorizada.
3. **API legacy HIGH abierta.** `/api/partidas`, `/api/sala`, `/api/juego`,
   `/api/chat` y el handler STOMP antiguo aceptan operaciones por ID sin identidad
   suficiente y pueden exponer entidades. La UI actual usa `/api/mesas` y
   `/api/salas`. El usuario tiene pendiente elegir retiro de rutas antiguas o
   conservación con autorización. No se publicará el candidato con este acceso.

La fuga no justifica borrar cuentas/historial ni considerar un token antes
expuesto como prueba suficiente de propiedad para recuperar una contraseña.
La revocación debe preservar filas, relaciones y datos; guardar sus valores solo
en el backup privado de rollback. No restaurar después tokens comprometidos.

## Verificación y alcance del escaneo

- 22 pruebas backend ARM64: hashes fijos generados con Crypto 6.2.4, límites
  ASCII/multibyte y rechazo de sufijos; reglas clásicas, privacidad, scoring y
  vencimientos. El timer se desactiva solo en tests que invocan acciones
  explícitamente; una prueba real separada comprueba el scheduler en ejecución.
- Cinco regresiones Linux para carrera de partidas, configuración antigua de
  dos imágenes, validación antes de pausar ingreso y política Java idempotente.
  Se repitieron con las cuatro variables de imágenes presentes en el entorno.
- El scanner elimina opciones `TRIVY_*` heredadas, desactiva config automática,
  recoge todas las severidades y aplica después HIGH/CRITICAL. Un entorno/cwd
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
  en Jammy. No se cambia de distribución ni se aplica un backport local no
  soportado para ocultarlos; su evaluación residual debe acordarse antes del corte.
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

Si Cloudflare/ingress siguen demorados, preparar el candidato AMD64 de este mismo
commit para **hotfix separado en nightly-int**. Antes de solicitar su ventana:
resolver la API antigua y recuperación/revocación, esperar CI completo, publicar
digests, probar restauración y flujos con AMD64 parcheado. Proponer entonces una
sola ventana concreta, con rollback que conserve escrituras nuevas; no ejecutar
interrupción por este documento. El procedimiento de migración y coordinación
Cleanly/Caddy permanece en el [runbook](../migration/README.md).
