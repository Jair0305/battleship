package com.jair.battleship.battleshipbackend.services.impl;

import com.jair.battleship.battleshipbackend.models.entities.*;
import com.jair.battleship.battleshipbackend.models.enums.EstadoPartida;
import com.jair.battleship.battleshipbackend.models.enums.ResultadoParticipacion;
import com.jair.battleship.battleshipbackend.repositories.*;
import com.jair.battleship.battleshipbackend.services.PartidaService;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
@Transactional
public class PartidaServiceImpl implements PartidaService {

    @Autowired
    private PartidaRepository partidaRepository;
    @Autowired
    private ParticipacionRepository participacionRepository;
    @Autowired
    private DisparoRepository disparoRepository;
    @Autowired
    private JugadorRepository jugadorRepository;
    @Autowired
    private TableroRepository tableroRepository;
    @Autowired
    private EstadisticaJugadorRepository estadisticaJugadorRepository;
    @Autowired
    private SalaRepository salaRepository;

    @Override
    public Partida crearPartida(Long salaId, Long hostJugadorId) {
        Jugador host = jugadorRepository.findById(hostJugadorId).orElseThrow();
        Partida partida = new Partida();
        partida.setEstado(EstadoPartida.CREADA);
        if (salaId != null) {
            Sala sala = salaRepository.findById(salaId).orElseThrow();
            partida.setSala(sala);
        }
        partida = partidaRepository.save(partida);

        Participacion p = new Participacion();
        p.setPartida(partida);
        p.setJugador(host);
        p.setOrden(1);
        p.setResultado(null);
        p.setPuntosObtenidos(0);
        participacionRepository.save(p);

        partida.setTurnoActualJugadorId(host.getId());
        return partidaRepository.save(partida);
    }

    @Override
    public Partida unirsePartida(Long partidaId, Long jugadorId) {
        Partida partida = partidaRepository.findById(partidaId).orElseThrow();
        long count = participacionRepository.countByPartidaId(partidaId);
        if (count >= 2)
            throw new IllegalStateException("La partida ya tiene 2 jugadores");
        Jugador jugador = jugadorRepository.findById(jugadorId).orElseThrow();

        // Si ya está unido, devolver
        Optional<Participacion> ya = participacionRepository.findByPartidaIdAndJugadorId(partidaId, jugadorId);
        if (ya.isPresent())
            return partida;

        Participacion p = new Participacion();
        p.setPartida(partida);
        p.setJugador(jugador);
        p.setOrden((int) count + 1);
        participacionRepository.save(p);

        if (count + 1 == 2) {
            partida.setEstado(EstadoPartida.EN_CURSO);
            partida.setInicio(Instant.now());
            // turno ya está en el host (orden 1)
        }
        return partidaRepository.save(partida);
    }

    @Override
    public void registrarTablero(Long partidaId, Long jugadorId, Map<String, Boolean> posicionesBarcos) {
        Partida partida = partidaRepository.findById(partidaId).orElseThrow();
        Jugador jugador = jugadorRepository.findById(jugadorId).orElseThrow();

        // Buscar tablero específico de la partida, o uno disponible (sin partida)
        Optional<Tablero> existente = tableroRepository.findByJugadorIdAndPartidaId(jugadorId, partidaId);
        if (existente.isEmpty()) {
            existente = tableroRepository.findByJugadorIdAndPartidaIsNull(jugadorId);
        }

        Tablero t = existente.orElseGet(Tablero::new);
        t.setPartida(partida);
        t.setJugador(jugador);
        Map<String, Boolean> limpia = new HashMap<>();
        if (posicionesBarcos != null) {
            posicionesBarcos.forEach((k, v) -> {
                if (Boolean.TRUE.equals(v))
                    limpia.put(k, true);
            });
        }
        t.setPosicionesBarcos(limpia);
        if (t.getPosicionesAtacadas() == null)
            t.setPosicionesAtacadas(new HashMap<>());
        tableroRepository.save(t);
    }

    @Override
    public boolean disparar(Long partidaId, Long atacanteId, String posicion) {
        Partida partida = partidaRepository.findById(partidaId).orElseThrow();
        if (partida.getEstado() != EstadoPartida.EN_CURSO)
            throw new IllegalStateException("La partida no está en curso");
        if (!Objects.equals(partida.getTurnoActualJugadorId(), atacanteId))
            throw new IllegalStateException("No es tu turno");

        Participacion atacantePar = participacionRepository.findByPartidaIdAndJugadorId(partidaId, atacanteId)
                .orElseThrow();
        Participacion defensorPar = obtenerOponente(partidaId, atacanteId);
        Tablero tableroDefensor = tableroRepository
                .findByJugadorIdAndPartidaId(defensorPar.getJugador().getId(), partidaId).orElseThrow();

        Map<String, Boolean> atacadas = tableroDefensor.getPosicionesAtacadas();
        if (tableroDefensor.getPosicionesBarcos() == null || tableroDefensor.getPosicionesBarcos().isEmpty()) {
            throw new IllegalStateException("El oponente aún no ha colocado sus barcos");
        }
        if (Boolean.TRUE.equals(atacadas.get(posicion))) {
            throw new IllegalStateException("Esa posición ya fue atacada");
        }
        boolean acierto = Boolean.TRUE.equals(tableroDefensor.getPosicionesBarcos().get(posicion));
        atacadas.put(posicion, acierto);
        tableroRepository.save(tableroDefensor);

        Disparo d = new Disparo();
        d.setPartida(partida);
        d.setAtacante(atacantePar.getJugador());
        d.setDefensor(defensorPar.getJugador());
        d.setPosicion(posicion);
        d.setAcierto(acierto);
        d.setTimestamp(Instant.now());
        disparoRepository.save(d);

        // puntos por impacto
        if (acierto)
            sumarPuntos(atacantePar.getJugador().getId(), 1);
        actualizarStatsDisparo(atacantePar.getJugador().getId(), acierto);

        // ¿victoria?
        boolean victoria = todasPosicionesBarcoImpactadas(tableroDefensor);
        if (victoria) {
            partida.setEstado(EstadoPartida.FINALIZADA);
            partida.setFin(Instant.now());
            partida.setGanador(atacantePar.getJugador());
            partidaRepository.save(partida);

            atacantePar.setResultado(ResultadoParticipacion.GANO);
            defensorPar.setResultado(ResultadoParticipacion.PERDIO);
            participacionRepository.save(atacantePar);
            participacionRepository.save(defensorPar);

            // bonus por victoria
            sumarPuntos(atacantePar.getJugador().getId(), 50);
            actualizarStatsVictoria(atacantePar.getJugador().getId(), defensorPar.getJugador().getId());
            return true;
        } else {
            // cambiar turno siempre (regla estándar)
            partida.setTurnoActualJugadorId(defensorPar.getJugador().getId());
            partidaRepository.save(partida);
        }
        return acierto;
    }

    @Override
    public void deshacerUltimoDisparo(Long partidaId) {
        Partida partida = partidaRepository.findById(partidaId).orElseThrow();
        Optional<Disparo> opt = disparoRepository.findTopByPartidaIdOrderByTimestampDesc(partidaId);
        if (opt.isEmpty())
            return;
        Disparo d = opt.get();

        Tablero tableroDef = tableroRepository.findByJugadorIdAndPartidaId(d.getDefensor().getId(), partidaId)
                .orElseThrow();
        Map<String, Boolean> atacadas = tableroDef.getPosicionesAtacadas();
        atacadas.remove(d.getPosicion());
        tableroRepository.save(tableroDef);

        // revertir puntos y stats
        if (d.isAcierto())
            restarPuntos(d.getAtacante().getId(), 1);
        revertirStatsDisparo(d.getAtacante().getId(), d.isAcierto());

        // si estaba finalizada por ese disparo, reabrir
        if (partida.getEstado() == EstadoPartida.FINALIZADA && Objects.equals(partida.getGanador(), d.getAtacante())) {
            partida.setEstado(EstadoPartida.EN_CURSO);
            partida.setFin(null);
            partida.setGanador(null);
            // revertir resultados
            Participacion at = participacionRepository.findByPartidaIdAndJugadorId(partidaId, d.getAtacante().getId())
                    .orElseThrow();
            Participacion df = participacionRepository.findByPartidaIdAndJugadorId(partidaId, d.getDefensor().getId())
                    .orElseThrow();
            at.setResultado(null);
            df.setResultado(null);
            participacionRepository.save(at);
            participacionRepository.save(df);
            // revertir stats victoria/derrota
            revertirStatsVictoria(d.getAtacante().getId(), d.getDefensor().getId());
            // revertir bonus victoria
            restarPuntos(d.getAtacante().getId(), 50);
        }

        // turno vuelve al atacante que deshizo
        partida.setTurnoActualJugadorId(d.getAtacante().getId());
        partidaRepository.save(partida);

        disparoRepository.delete(d);
    }

    @Override
    public void cancelarPartida(Long partidaId) {
        Partida partida = partidaRepository.findById(partidaId).orElseThrow();
        partida.setEstado(EstadoPartida.CANCELADA);
        partida.setFin(Instant.now());
        partidaRepository.save(partida);
    }

    @Override
    public void finalizarEmpate(Long partidaId) {
        Partida partida = partidaRepository.findById(partidaId).orElseThrow();
        partida.setEstado(EstadoPartida.FINALIZADA);
        partida.setFin(Instant.now());
        partida.setGanador(null);
        partidaRepository.save(partida);
        // marcar participaciones
        for (Participacion p : participacionRepository.findByPartidaId(partidaId)) {
            p.setResultado(ResultadoParticipacion.EMPATE);
            participacionRepository.save(p);
            sumarPuntos(p.getJugador().getId(), 20);
            actualizarStatsEmpate(p.getJugador().getId());
        }
    }

    @Override
    public Partida obtenerPartida(Long partidaId) {
        return partidaRepository.findById(partidaId).orElseThrow();
    }

    @Autowired
    private EspectadorRepository espectadorRepository;

    @Override
    public void agregarEspectador(Long partidaId, Long jugadorId) {
        Partida partida = partidaRepository.findById(partidaId).orElseThrow();
        Jugador jugador = jugadorRepository.findById(jugadorId).orElseThrow();
        Espectador e = new Espectador();
        e.setPartida(partida);
        e.setJugador(jugador);
        espectadorRepository.save(e);
    }

    @Override
    public Partida obtenerActivaPorSala(Long salaId) {
        List<Partida> enCurso = partidaRepository.findBySalaIdAndEstado(salaId, EstadoPartida.EN_CURSO);
        if (!enCurso.isEmpty())
            return enCurso.get(0);
        List<Partida> creadas = partidaRepository.findBySalaIdAndEstado(salaId, EstadoPartida.CREADA);
        if (!creadas.isEmpty())
            return creadas.get(0);
        throw new NoSuchElementException("No hay partida activa en la sala");
    }

    @Override
    public Map<String, Object> obtenerEstadoPartida(Long partidaId, Long jugadorId) {
        Partida partida = partidaRepository.findById(partidaId).orElseThrow();
        Map<String, Object> dto = new HashMap<>();
        dto.put("partidaId", partida.getId());
        dto.put("estado", partida.getEstado().name());
        dto.put("turnoActualJugadorId", partida.getTurnoActualJugadorId());
        dto.put("ganadorId", partida.getGanador() == null ? null : partida.getGanador().getId());

        if (jugadorId != null) {
            // Tablero propio y del oponente (vista de jugador)
            Participacion propia = participacionRepository.findByPartidaIdAndJugadorId(partidaId, jugadorId)
                    .orElse(null);
            if (propia != null) {
                Optional<Tablero> miTablero = tableroRepository.findByJugadorIdAndPartidaId(jugadorId, partidaId);
                miTablero.ifPresent(t -> {
                    dto.put("misBarcos", new HashMap<>(t.getPosicionesBarcos()));
                    dto.put("misImpactosRecibidos", new HashMap<>(t.getPosicionesAtacadas()));
                });
                Participacion op = obtenerOponente(partidaId, jugadorId);
                Optional<Tablero> tabOp = tableroRepository.findByJugadorIdAndPartidaId(op.getJugador().getId(),
                        partidaId);
                tabOp.ifPresent(t -> {
                    dto.put("oponenteImpactos", new HashMap<>(t.getPosicionesAtacadas()));
                    dto.put("oponenteListo", t.getPosicionesBarcos() != null && !t.getPosicionesBarcos().isEmpty());
                });
            }
        } else {
            // Vista de espectador: ver impactos en ambos tableros
            // No mostramos barcos no impactados para evitar trampas (o podríamos mostrarlos
            // si es "god mode")
            // Por ahora, solo mostramos lo que se ve públicamente (impactos)
            List<Participacion> partes = participacionRepository.findByPartidaId(partidaId);
            Map<Long, Map<String, Boolean>> tablerosPublicos = new HashMap<>();
            for (Participacion p : partes) {
                Optional<Tablero> t = tableroRepository.findByJugadorIdAndPartidaId(p.getJugador().getId(), partidaId);
                t.ifPresent(tab -> {
                    tablerosPublicos.put(p.getJugador().getId(), new HashMap<>(tab.getPosicionesAtacadas()));
                });
            }
            dto.put("tablerosPublicos", tablerosPublicos);
        }

        // Información de jugadores (ID -> Nombre)
        List<Participacion> todasPartes = participacionRepository.findByPartidaId(partidaId);
        Map<Long, String> jugadoresMap = new HashMap<>();
        for (Participacion p : todasPartes) {
            jugadoresMap.put(p.getJugador().getId(), p.getJugador().getNombre());
        }
        dto.put("jugadores", jugadoresMap);

        // Historial compacto
        List<Disparo> disparos = disparoRepository.findByPartidaIdOrderByTimestampAsc(partidaId);
        List<Map<String, Object>> hist = new ArrayList<>();
        for (Disparo d : disparos) {
            Map<String, Object> item = new HashMap<>();
            item.put("atacanteId", d.getAtacante().getId());
            item.put("defensorId", d.getDefensor().getId());
            item.put("posicion", d.getPosicion());
            item.put("acierto", d.isAcierto());
            item.put("ts", d.getTimestamp());
            hist.add(item);
        }
        dto.put("historial", hist);
        return dto;
    }

    private Participacion obtenerOponente(Long partidaId, Long jugadorId) {
        List<Participacion> ps = participacionRepository.findByPartidaId(partidaId);
        for (Participacion p : ps)
            if (!p.getJugador().getId().equals(jugadorId))
                return p;
        throw new IllegalStateException("No se encontró oponente");
    }

    private boolean todasPosicionesBarcoImpactadas(Tablero tablero) {
        Map<String, Boolean> barcos = tablero.getPosicionesBarcos();
        if (barcos.isEmpty())
            return false; // no hay barcos => no victoria
        Map<String, Boolean> atacadas = tablero.getPosicionesAtacadas();
        for (Map.Entry<String, Boolean> e : barcos.entrySet()) {
            if (Boolean.TRUE.equals(e.getValue())) {
                if (!Boolean.TRUE.equals(atacadas.get(e.getKey())))
                    return false;
            }
        }
        return true;
    }

    private EstadisticaJugador getStats(Long jugadorId) {
        return estadisticaJugadorRepository.findByJugadorId(jugadorId)
                .orElseGet(() -> {
                    EstadisticaJugador s = new EstadisticaJugador();
                    Jugador j = jugadorRepository.findById(jugadorId).orElseThrow();
                    s.setJugador(j);
                    s.setPartidasJugadas(0);
                    s.setGanadas(0);
                    s.setPerdidas(0);
                    s.setEmpates(0);
                    s.setPuntosTotales(0);
                    s.setImpactos(0);
                    s.setFallos(0);
                    s.setBarcosHundidos(0);

                    return estadisticaJugadorRepository.save(s);
                });
    }

    private void sumarPuntos(Long jugadorId, int puntos) {
        EstadisticaJugador s = getStats(jugadorId);
        s.setPuntosTotales(s.getPuntosTotales() + puntos);
        estadisticaJugadorRepository.save(s);
    }

    private void restarPuntos(Long jugadorId, int puntos) {
        EstadisticaJugador s = getStats(jugadorId);
        s.setPuntosTotales(Math.max(0, s.getPuntosTotales() - puntos));
        estadisticaJugadorRepository.save(s);
    }

    private void actualizarStatsDisparo(Long jugadorId, boolean acierto) {
        EstadisticaJugador s = getStats(jugadorId);
        if (acierto)
            s.setImpactos(s.getImpactos() + 1);
        else
            s.setFallos(s.getFallos() + 1);
        estadisticaJugadorRepository.save(s);
    }

    private void revertirStatsDisparo(Long jugadorId, boolean acierto) {
        EstadisticaJugador s = getStats(jugadorId);
        if (acierto)
            s.setImpactos(Math.max(0, s.getImpactos() - 1));
        else
            s.setFallos(Math.max(0, s.getFallos() - 1));
        estadisticaJugadorRepository.save(s);
    }

    private void actualizarStatsVictoria(Long ganadorId, Long perdedorId) {
        EstadisticaJugador g = getStats(ganadorId);
        EstadisticaJugador p = getStats(perdedorId);
        g.setGanadas(g.getGanadas() + 1);
        p.setPerdidas(p.getPerdidas() + 1);
        g.setPartidasJugadas(g.getPartidasJugadas() + 1);
        p.setPartidasJugadas(p.getPartidasJugadas() + 1);
        estadisticaJugadorRepository.save(g);
        estadisticaJugadorRepository.save(p);
    }

    private void revertirStatsVictoria(Long ganadorId, Long perdedorId) {
        EstadisticaJugador g = getStats(ganadorId);
        EstadisticaJugador p = getStats(perdedorId);
        g.setGanadas(Math.max(0, g.getGanadas() - 1));
        p.setPerdidas(Math.max(0, p.getPerdidas() - 1));
        estadisticaJugadorRepository.save(g);
        estadisticaJugadorRepository.save(p);
    }

    private void actualizarStatsEmpate(Long jugadorId) {
        EstadisticaJugador s = getStats(jugadorId);
        s.setEmpates(s.getEmpates() + 1);
        s.setPartidasJugadas(s.getPartidasJugadas() + 1);
        estadisticaJugadorRepository.save(s);
    }

    @Override
    public Partida iniciarPartidaDesdeSala(Long salaId) {
        // Verificar si ya existe partida activa
        List<Partida> activas = partidaRepository.findBySalaIdAndEstado(salaId, EstadoPartida.EN_CURSO);
        if (!activas.isEmpty())
            return activas.get(0);
        List<Partida> creadas = partidaRepository.findBySalaIdAndEstado(salaId, EstadoPartida.CREADA);
        if (!creadas.isEmpty())
            return creadas.get(0);

        Sala sala = salaRepository.findById(salaId).orElseThrow();
        List<Jugador> jugadores = sala.getJugadores();
        if (jugadores.size() < 2)
            throw new IllegalStateException("Se necesitan 2 jugadores para iniciar");

        Jugador host = jugadores.get(0);
        Jugador challenger = jugadores.get(1);

        // Crear partida
        Partida partida = new Partida();
        partida.setSala(sala);
        partida.setEstado(EstadoPartida.EN_CURSO); // Se inicia directamente en fase de preparación/juego
        partida.setInicio(Instant.now());
        partida.setTurnoActualJugadorId(host.getId());
        partida = partidaRepository.save(partida);

        // Participación Host
        Participacion p1 = new Participacion();
        p1.setPartida(partida);
        p1.setJugador(host);
        p1.setOrden(1);
        p1.setPuntosObtenidos(0);
        participacionRepository.save(p1);

        // Participación Challenger
        Participacion p2 = new Participacion();
        p2.setPartida(partida);
        p2.setJugador(challenger);
        p2.setOrden(2);
        p2.setPuntosObtenidos(0);
        participacionRepository.save(p2);

        return partida;
    }
}