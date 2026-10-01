# Nightly Games / Direccion de arte y movimiento

Version compartida 1.0. Existe una copia identica en cada frontend:

- `minesweeper-frontend/docs/nightly-art-direction.md`
- `battleship-frontend/docs/nightly-art-direction.md`

Si cambias un token compartido, cambialo en ambas copias y en ambos `app/globals.css`
y `tailwind.config.ts`. Lo que se marca como "por juego" puede divergir.

## Direccion: "Instrumentos nocturnos"

Nightly es una consola de instrumentos de arcade usados de noche. Cada juego es un
instrumento distinto montado en el mismo chasis:

- **Chasis**: superficies carbon casi negras, bordes de 1px, radios bajos (4/8px).
- **Registro**: marcas de esquina tipo visor (`nightly-ticks`) solo en herramientas
  enmarcadas importantes: dialogos, resultados, acceso y tableros.
- **Placas de datos**: etiquetas en Geist Mono, mayusculas, tracking amplio, con un
  pixel de tono (`nightly-eyebrow`) que identifica el canal del panel.
- **Pantalla**: Pixelify Sans solo para titulos y momentos grandes (resultado,
  cuenta atras). Nunca para parrafos ni datos.
- **Juego primero**: las secciones de pagina van sin marco y a todo el ancho; las
  tarjetas se reservan para elementos repetidos o herramientas reales.

Prohibido: orbes de gradiente, bokeh, blobs con blur, CRT de pagina completa,
parpadeos, mascotas, datos o ratings falsos, texto que hable del diseno, cursores
propios, scroll secuestrado, sonido, tamanos de fuente en `vw`, tracking negativo.

## Tokens compartidos (mismo nombre y valor en ambos juegos)

| Token | Valor | Uso |
| --- | --- | --- |
| `--night-bg` | `#090909` | Fondo de pagina |
| `--night-void` | `#0d0d0b` | Pozos, listas, inputs |
| `--night-ink` | `#151513` | Controles elevados |
| `--night-panel` | `rgba(17,17,14,0.94)` | Panel estandar |
| `--night-panel-strong` | `rgba(20,21,17,0.98)` | Dialogo / resultado |
| `--night-line` | `rgba(241,251,134,0.16)` | Linea con tinte de marca |
| `--night-line-soft` | `rgba(255,255,255,0.08)` | Linea neutra |
| `--night-line-strong` | `rgba(255,255,255,0.14)` | Hover / separacion fuerte |
| `--night-text` | `#f7f7ef` | Texto principal |
| `--night-muted` | `#a3a398` | Texto secundario |
| `--night-faint` | `#7a7a6f` | Etiquetas (>= 4.5:1 sobre `#090909`) |
| `--night-accent` | `#b9f95a` | Identidad, sistema, "tu" |
| `--night-accent-strong` | `#d7ff73` | Hover del acento |
| `--night-accent-ink` | `#101309` | Texto sobre lima |
| `--night-danger` | `#ff5f69` | Mina, impacto, error, derrota |
| `--night-warning` | `#f5c85c` | Bandera, espera, reloj critico |
| `--night-success` | `#8df0b0` | Listo, verificado |
| `--night-info` | `#67d7ff` | Asiento A, datos frios |
| `--night-rival` | `#ff6ba8` | Asiento B, rival |
| `--night-radius` / `-sm` | `8px` / `4px` | Paneles / controles |

Asientos: A siempre frio (`info`), B siempre rosa (`rival`). El color nunca es la unica
senal: se acompana de letra de asiento, icono, texto o patron.

### Por juego

| Token | Minesweeper | Battleship |
| --- | --- | --- |
| `--game-signal` | `#f5c85c` (bandera) | `#8ac7ff` (sonar) |
| Motivo de fondo | Matriz de puntos y casillas abiertas estaticas | Anillos de sonar estaticos |
| Marco de tablero | Marcas de registro en la carcasa | Reticula de sonar bajo las celdas |

## Tipografia

- Display: Pixelify Sans (`font-display`), mayusculas. H1 de pagina `text-3xl`/`sm:text-4xl`;
  titulo de panel `text-lg`; resultado `text-3xl`. Maximo `text-6xl` en acceso.
- UI: Geist (`font-ui`), `text-sm` / `leading-6` para cuerpo.
- Datos: Geist Mono (`font-mono`) con cifras tabulares para tiempo, puntos, rating,
  coordenadas. Etiquetas `0.6-0.65rem`, mayusculas, tracking `0.14-0.2em`.

## Ritmo y superficies

- Base 4px. Escala usada: 4 / 8 / 12 / 16 / 20 / 24 / 32.
- Panel: `p-4` (`md:p-5` permitido), cabecera con regla inferior y `mb-4`.
- `nightly-frame`: panel estandar. `nightly-frame-strong`: panel con registro (ticks).
- Sin `backdrop-filter` en superficies persistentes ni encima de tableros.

## Movimiento

| Token | Valor | Uso |
| --- | --- | --- |
| `--night-ease` | `cubic-bezier(0.16,1,0.3,1)` | Salidas suaves, entradas |
| `--night-ease-snap` | `cubic-bezier(0.2,0,0,1)` | Presion, cambios de estado |
| `--night-dur-press` | `80ms` | Presion tactil fuera del tablero |
| `--night-dur-fast` | `120ms` | Hover, foco, color de control |
| `--night-dur-base` | `160ms` | Navegacion, tabs, segmentos |
| `--night-dur-enter` | `220ms` | Entrada de dialogo / pagina |
| `--night-dur-stage` | `260ms` | Entrada de resultado |
| `--night-dur-once` | `560ms` | Decoracion unica de resultado |

Vocabulario CSS (identico en ambos):

- `nightly-button`: transiciones explicitas de color/borde/sombra + `translateY(1px)` al presionar.
- `nightly-enter` / `animate-night-enter`: opacidad + 6px, una vez al montar.
- `nightly-pop`: dialogo, opacidad + escala 0.98 -> 1.
- `nightly-scrim`: fondo de dialogo, opacidad.
- `nightly-result[data-outcome=win|loss|draw|neutral]`: entrada de resultado, barra de
  senal que barre una vez y titulo `nightly-result-title` con sello (win) o sacudida
  de 2px (loss). Solo se monta cuando la partida termina.

Reglas:

1. Nunca `transition: all`. Solo `transform`/`opacity` en entradas.
2. Acciones frecuentes: instantaneas o <= 160ms y nunca bloquean input.
3. Entradas raras: 180-260ms. Decoracion unica <= 560ms, solo en resultados.
4. Nada se re-anima por revision/snapshot: animaciones solo en montaje de elementos que
   aparecen una vez (dialogo, resultado). Sin `key` cambiantes para forzar replays.
5. Sin pulsos perpetuos salvo estados realmente vivos: reloj critico, reconexion,
   pista activa en una celda, indicador de carga.
6. `prefers-reduced-motion`: todas las animaciones y transiciones colapsan a su estado final.

## Guardas de rendimiento (no negociables)

- Minesweeper: `MinefieldBoard` y su logica no se tocan. El CSS de celdas es
  instantaneo: sin transiciones, animaciones ni transforms en revelar, bandera,
  pendiente o presion. Solo la detonacion (una celda) y la pista tienen animacion.
- Fondo 100% estatico en ambos: CSS sin canvas, sin RAF, sin listeners.
- Sin blur sobre tableros ni en barras fijas. Overlays de pausa/cuenta atras opacos.
- Battleship: celdas sin transform en hover/press; el impacto anima un pseudo-elemento
  (`transform`/`opacity`) solo cuando la celda cambia a impacto/hundido.
