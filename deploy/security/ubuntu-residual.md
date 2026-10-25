# Cierre del residual Ubuntu rechazado por el usuario

El usuario respondió **«No, resolverlo antes de migrar»** a la propuesta de
continuar con 22 avisos MEDIUM y 16 LOW. El candidato publicado `7b8733c` queda
retirado para promoción. Sus imágenes, volúmenes y respaldos siguen conservados;
`/opt/battleship/cutover/7b8733c/WITHDRAWN-DO-NOT-PROMOTE` marca su paquete.
La autorización de ventana sigue condicionada. No hubo corte ni cambios en
producción, DNS o proxy compartido.

## Cambio acotado

La imagen backend pasa de Ubuntu 22.04 a **Alpine 3.24.3**, fijada por digest
multiarch `sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a`.
JDK y JRE conservan **Temurin 21.0.13+9**, usando ahora los binarios oficiales
MUSL para ARM64/AMD64. Sus cuatro SHA256 están fijados en el instalador; el
bloqueo de 16 certificados se aplica a ambas instalaciones antes de usarlas.
Se conserva el usuario no privilegiado UID 10001, el arranque con `exec java`,
`JAVA_OPTS`, zona horaria y UTF-8. No cambian código Java, dependencias Maven,
contratos ni esquema.

Alpine 3.24 tiene soporte de `main` hasta junio de 2028. Adoptium ofrece ambas
arquitecturas Alpine y su receta usa locales MUSL para UTF-8. Se omiten
fontconfig y las fuentes nativas: el backend no contiene rutas de renderizado
AWT/Swing, imágenes o PDF, y esa dependencia incorporaba Expat todavía vulnerable.
No se sustituye por otra versión de Expat declarando un fix inexistente. Java
conserva sus módulos estándar; el contenedor está preparado para este servicio
sin renderizado nativo de fuentes.

Fuentes: [soporte Alpine](https://www.alpinelinux.org/releases/),
[plataformas Temurin](https://adoptium.net/supported-platforms),
[release exacto](https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.13%2B9),
[receta del proveedor](https://github.com/adoptium/containers/blob/main/21/jre/alpine/3.24/Dockerfile),
[Expat sin fix](https://github.com/libexpat/libexpat/issues/1076).

## Paquetes y avisos reales

El reporte de publicación anterior contiene **38 filas, 27 CVEs distintos**.
El [recibo completo](../migration/evidence/ubuntu-residual-20261025.json) conserva
cada paquete, versión, CVE y severidad anterior, sin alterar el reporte original.

| Familia anterior | Avisos | Tratamiento en el candidato |
| --- | --- | --- |
| glibc 2.35-0ubuntu3.15 (`libc6`, `libc-bin`) | CVE-2026-18374, -89092 | Glibc ausente; JRE MUSL oficial y musl 1.2.6-r3, sin shim glibc |
| dash 0.5.11 | CVE-2026-102473, -102474 | Dash ausente; el arranque POSIX usa BusyBox 1.37.0-r31 |
| GNU tar 1.34 | CVE-2026-18477, -18508 | GNU tar ausente; sus rutas vulnerables no se incorporan al runtime |
| Expat 2.4.7-1ubuntu0.9 | CVE-2025-66382 | Expat y fontconfig ausentes de paquetes y archivos nativos |
| GnuTLS 3.7.3-4ubuntu1.9 | CVE-2026-67693, -88647, -88648, -95184, -95209, -95210 | GnuTLS ausente; la confianza Java se verifica aparte |
| PCRE2 10.39 | CVE-2022-41409; CVE-2026-103111, -86145, -89156, -89157, -89158, -89160, -89161 | PCRE2 ausente; no se cambia el motor regex Java |
| ncurses/tinfo 6.3 | CVE-2023-50495 | Bibliotecas y utilidades ncurses ausentes |
| systemd/udev 249.11 | CVE-2026-40228 | Paquetes y daemon systemd ausentes |
| shadow/login/passwd 4.8.1 | CVE-2023-29383, CVE-2024-56433 | shadow-utils ausente; usuario de servicio creado durante build |
| Zstandard 1.4.8 | CVE-2022-4899 | Biblioteca y herramienta Zstandard ausentes |
| GCC 12.3 (`gcc-12-base`, `libgcc-s1`, `libstdc++6`) | CVE-2022-27943 | Bibliotecas GCC 15.2.0-r5; el componente afectado `libiberty/rust-demangle.c` y sus herramientas no se distribuyen en el runtime |

No bastaba subir de Ubuntu LTS: Canonical seguía declarando vulnerables glibc
y PCRE2 incluso en Noble/Resolute. Debian estable también conservaba los avisos
glibc y dash. No se adoptó una distribución sin mantenimiento ni se copiaron
parches locales no soportados a glibc.

Fuentes primarias adicionales:
[glibc Ubuntu](https://ubuntu.com/security/CVE-2026-18374),
[PCRE2 Ubuntu](https://ubuntu.com/security/CVE-2026-86145),
[glibc Debian](https://security-tracker.debian.org/tracker/CVE-2026-18374),
[dash Debian](https://security-tracker.debian.org/tracker/CVE-2026-102474),
[componente libiberty](https://security-tracker.debian.org/tracker/CVE-2022-27943),
[fix upstream Zstandard](https://github.com/facebook/zstd/commit/e1873ad576cb478fff0e6e44ad99599cd5fd2846).

## Evidencia del ensayo ARM64

- Builder Battleship existente, bajo lock compartido, 1,5 CPU/4 GiB; detenido
  al terminar. Sin builder nuevo, límites globales o cambios a otros proyectos.
- **26 tests pasan dentro del JDK MUSL**, incluido broker, API retirada,
  BCrypt ASCII/multibyte, reglas, privacidad y scoring.
- **Trivy 0.76.1: cero hallazgos en todas las severidades**; 23 paquetes OS y
  74 entradas Java inventariadas. DB de vulnerabilidades 25-Oct 01:20:33 UTC,
  Java DB 25-Oct 00:59:20 UTC. JSON completo y SBOM retenidos.
- Config escaneado local:
  `sha256:e3c2b8e19a994a8d8fdeb7d8e9a68fda010bfb90b5ac66cc69b1d360e8413928`.
  Es un ensayo local, todavía no el digest GHCR final.
- UID 10001, Java 21.0.13+9 y ausencia física de Expat/fontconfig comprobados.
  Las 79 clases compiladas y 73 JAR de dependencias son idénticos al candidato
  anterior. Solo `application.properties` del contexto Windows de ensayo tenía
  CRLF; su contenido normalizado coincide. CI usa el contenido canónico Git.
- Confianza: control sin bloqueo acepta 14 cadenas; candidato rechaza las 14
  por bloqueo, confianza real rechaza las 14 y HTTPS válido sigue funcionando.
- Restaura 16 tablas/3.352 filas con huellas idénticas. Pasan partidas completas
  por WS y SockJS, chat auténtico/forjado, ranking, privacidad, revancha/rendición,
  revocaciones y cuentas/hashes/sesiones tras reiniciar todo el stack. Esquema
  intacto, backup consistente posterior, escritores de ensayo detenidos.

Los intentos fallidos de preparación quedan privados: permisos del contexto,
opciones GNU de `sha256sum` y CRLF del wrapper Windows. Se corrigieron sin
desactivar checksums ni tests; el wrapper normalizado coincide con Git por SHA256.
El intento de reescanear la referencia anterior por digest falló en el exportador
Docker/Trivy antes de producir reporte. No se presentó ese fallo como prueba de
remediación: el control negativo usa el JSON original de CI verificado por SHA.

## Gates de promoción

El scanner ahora falla ante **cualquier** vulnerabilidad detectada, incluida
MEDIUM/LOW/UNKNOWN, con recolección completa y sin ignores. El reporte anterior
demostró el cambio: HIGH/CRITICAL devuelve 0, MEDIUM devuelve 1, LOW devuelve 1
y todas las severidades devuelven 1. CI ejecuta además los tests en el build JDK
MUSL de cada arquitectura y comprueba ausencia de Expat/fontconfig/libiberty.

Faltan CI nativo ARM64/AMD64, publicación y verificación de los nuevos digests,
ensayos finales por imagen y recuperación inversa del candidato publicado.
Después siguen los gates Cloudflare y GO conjunto existentes. No se declara
resuelta una imagen futura ni se interpreta el permiso operativo como aceptación
del residual anterior. No se afirma ausencia universal de vulnerabilidades fuera
del alcance/fecha de las comprobaciones.
