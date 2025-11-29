package com.jair.battleship.battleshipbackend.services.impl;

import com.jair.battleship.battleshipbackend.models.entities.*;
import com.jair.battleship.battleshipbackend.models.enums.EstadoPartida;
import com.jair.battleship.battleshipbackend.models.enums.ResultadoParticipacion;
import com.jair.battleship.battleshipbackend.repositories.*;
import com.jair.battleship.battleshipbackend.services.PartidaService;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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
    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    @Autowired
    private EspectadorRepository espectadorRepository;
    @Autowired
    private com.jair.battleship.battleshipbackend.services.RankingService rankingService;

    @Autowired
    private com.jair.battleship.battleshipbackend.services.SalaService salaService;

    private void broadcastEvento(Long salaId) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        messagingTemplate.convertAndSend("/topic/sala/" + salaId + "/evento", "UPDATE");
                    } catch (Exception ignored) {
                    }
                }
            });
        } else {
            try {
                messagingTemplate.convertAndSend("/topic/sala/" + salaId + "/evento", "UPDATE");
            } catch (Exception ignored) {
            }
        }
    }

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
        }
        return partidaRepository.save(partida);
    }

    @Override
    public void registrarTablero(Long partidaId, Long jugadorId, Map<String, Boolean> posicionesBarcos) {
        Partida partida = partidaRepository.findById(partidaId).orElseThrow();
        Jugador jugador = jugadorRepository.findById(jugadorId).orElseThrow();

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
        if (atacadas.containsKey(posicion)) {
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

        if (acierto)
            sumarPuntos(atacantePar.getJugador().getId(), 1);
        actualizarStatsDisparo(atacantePar.getJugador().getId(), acierto);

        boolean victoria = todasPosicionesBarcoImpactadas(tableroDefensor);
        if (victoria) {
            partida.setEstado(EstadoPartida.FINALIZADA);
            partida.setFin(Instant.now());
            partida.setGanador(atacantePar.getJugador());
            partida.setRematchDeadline(Instant.now().plusSeconds(30)); // 30 seconds for rematch
            partidaRepository.save(partida);

            atacantePar.setResultado(ResultadoParticipacion.GANO);
            defensorPar.setResultado(ResultadoParticipacion.PERDIO);
            participacionRepository.save(atacantePar);
            participacionRepository.save(defensorPar);

            sumarPuntos(atacantePar.getJugador().getId(), 50);
            actualizarStatsVictoria(atacantePar.getJugador().getId(), defensorPar.getJugador().getId());

            // Calculate and save ranking points
            rankingService.procesarPartida(partida);

            broadcastEvento(partida.getSala().getId());
            return true;
        } else {
            // Only switch turn if it was a MISS
            if (!acierto) {
                partida.setTurnoActualJugadorId(defensorPar.getJugador().getId());
                partidaRepository.save(partida);
            } else {
                // If hit, keep turn (do not change turnoActualJugadorId)
                // Broadcast event to notify hit and that turn stays
                partidaRepository.save(partida); // Save just in case
            }
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

        if (d.isAcierto())
            restarPuntos(d.getAtacante().getId(), 1);
        revertirStatsDisparo(d.getAtacante().getId(), d.isAcierto());

        if (partida.getEstado() == EstadoPartida.FINALIZADA && Objects.equals(partida.getGanador(), d.getAtacante())) {
            partida.setEstado(EstadoPartida.EN_CURSO);
            partida.setFin(null);
            partida.setGanador(null);
            Participacion at = participacionRepository.findByPartidaIdAndJugadorId(partidaId, d.getAtacante().getId())
                    .orElseThrow();
            Participacion df = participacionRepository.findByPartidaIdAndJugadorId(partidaId, d.getDefensor().getId())
                    .orElseThrow();
            at.setResultado(null);
            df.setResultado(null);
            participacionRepository.save(at);
            participacionRepository.save(df);
            revertirStatsVictoria(d.getAtacante().getId(), d.getDefensor().getId());
            restarPuntos(d.getAtacante().getId(), 50);
            // Revert ranking points? Complex. For now, we assume undo is only possible if
            // game not ended or we handle it later.
            // If game WAS ended and we undo, we should probably delete the Puntuacion
            // record.
            // TODO: Handle ranking reversion.
        }

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
        if (partida.getSala() != null)
            broadcastEvento(partida.getSala().getId());
    }

    @Override
    public void finalizarEmpate(Long partidaId) {
        Partida partida = partidaRepository.findById(partidaId).orElseThrow();
        partida.setEstado(EstadoPartida.FINALIZADA);
        partida.setFin(Instant.now());
        partida.setGanador(null);
        partidaRepository.save(partida);
        for (Participacion p : participacionRepository.findByPartidaId(partidaId)) {
            p.setResultado(ResultadoParticipacion.EMPATE);
            participacionRepository.save(p);
            sumarPuntos(p.getJugador().getId(), 20);
            actualizarStatsEmpate(p.getJugador().getId());
        }
        if (partida.getSala() != null)
            broadcastEvento(partida.getSala().getId());
    }

    @Override
    public Partida obtenerPartida(Long partidaId) {
        return partidaRepository.findById(partidaId).orElseThrow();
    }

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
        checkRematchTimeout(partida);
        Map<String, Object> dto = new HashMap<>();
        dto.put("partidaId", partida.getId());
        dto.put("estado", partida.getEstado().name());
        dto.put("turnoActualJugadorId", partida.getTurnoActualJugadorId());
        dto.put("ganadorId", partida.getGanador() == null ? null : partida.getGanador().getId());

        if (jugadorId != null) {
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

        List<Participacion> todasPartes = participacionRepository.findByPartidaId(partidaId);
        Map<Long, String> jugadoresMap = new HashMap<>();
        for (Participacion p : todasPartes) {
            jugadoresMap.put(p.getJugador().getId(), p.getJugador().getNombre());
        }
        dto.put("jugadores", jugadoresMap);

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
        dto.put("rematchRequestJ1", partida.isRematchRequestJ1());
        dto.put("rematchRequestJ2", partida.isRematchRequestJ2());
        if (partida.getRematchDeadline() != null) {
            dto.put("rematchDeadline", partida.getRematchDeadline().toEpochMilli());
        }
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
            return false;
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
        List<Partida> activas = partidaRepository.findBySalaIdAndEstado(salaId, EstadoPartida.EN_CURSO);
        if (!activas.isEmpty())
            return activas.get(0);

        Sala sala = salaRepository.findById(salaId).orElseThrow();
        Jugador host = sala.getJugador1();
        Jugador challenger = sala.getJugador2();

        if (host == null || challenger == null)
            throw new IllegalStateException("Se necesitan 2 jugadores en los puestos para iniciar");

        Partida partida = new Partida();
        partida.setSala(sala);
        partida.setEstado(EstadoPartida.EN_CURSO);
        partida.setInicio(Instant.now());
        // Randomize starting player
        boolean startHost = Math.random() < 0.5;
        partida.setTurnoActualJugadorId(startHost ? host.getId() : challenger.getId());
        partida = partidaRepository.save(partida);

        // Associate draft boards with the new game
        Tablero t1 = tableroRepository.findByJugadorIdAndPartidaIsNull(host.getId()).orElse(null);
        if (t1 != null) {
            t1.setPartida(partida);
            tableroRepository.save(t1);
        }
        Tablero t2 = tableroRepository.findByJugadorIdAndPartidaIsNull(challenger.getId()).orElse(null);
        if (t2 != null) {
            t2.setPartida(partida);
            tableroRepository.save(t2);
        }

        Participacion p1 = new Participacion();
        p1.setPartida(partida);
        p1.setJugador(host);
        p1.setOrden(1);
        p1.setPuntosObtenidos(0);
        participacionRepository.save(p1);

        Participacion p2 = new Participacion();
        p2.setPartida(partida);
        p2.setJugador(challenger);
        p2.setOrden(2);
        p2.setPuntosObtenidos(0);
        participacionRepository.save(p2);

        broadcastEvento(salaId);
        return partida;
    }

    @Override
    public void solicitarRevancha(Long partidaId, Long jugadorId) {
        Partida partida = partidaRepository.findById(partidaId).orElseThrow();
        if (partida.getEstado() != EstadoPartida.FINALIZADA)
            return;

        checkRematchTimeout(partida);
        if (partida.getRematchDeadline() != null && Instant.now().isAfter(partida.getRematchDeadline())) {
            return; // Timeout
        }

        Participacion p = participacionRepository.findByPartidaIdAndJugadorId(partidaId, jugadorId).orElseThrow();
        if (p.getOrden() == 1) {
            partida.setRematchRequestJ1(true);
        } else {
            partida.setRematchRequestJ2(true);
        }
        partidaRepository.save(partida);
        broadcastEvento(partida.getSala().getId());

        if (partida.isRematchRequestJ1() && partida.isRematchRequestJ2()) {
            iniciarPartidaDesdeSala(partida.getSala().getId());
        }
    }

    @Override
    public void rechazarRevancha(Long partidaId, Long jugadorId) {
        Partida partida = partidaRepository.findById(partidaId).orElseThrow();
        if (partida.getEstado() != EstadoPartida.FINALIZADA)
            return;

        // Kick the player from seat
        Sala sala = partida.getSala();
        if (sala != null) {
            Participacion p = participacionRepository.findByPartidaIdAndJugadorId(partidaId, jugadorId).orElse(null);
            if (p != null) {
                salaService.liberarPuesto(sala.getId(), p.getOrden());
            }
        }
        broadcastEvento(partida.getSala().getId());
    }

    private void checkRematchTimeout(Partida partida) {
        if (partida.getEstado() == EstadoPartida.FINALIZADA && partida.getRematchDeadline() != null) {
            if (Instant.now().isAfter(partida.getRematchDeadline())) {
                // Timeout reached. Kick anyone who hasn't accepted? Or just kick both to be
                // safe/fair.
                // Requirement: "Implement the logic for a player to be 'kicked from their seat'
                // (become a spectator) if a rematch is declined or times out."
                // Let's kick both to free the room for new players or re-selection.
                Sala sala = partida.getSala();
                if (sala != null) {
                    salaService.liberarPuesto(sala.getId(), 1);
                    salaService.liberarPuesto(sala.getId(), 2);
                }
                partida.setRematchDeadline(null); // Clear deadline so we don't keep kicking
                partidaRepository.save(partida);
                broadcastEvento(sala.getId());
            }
        }
    }
}