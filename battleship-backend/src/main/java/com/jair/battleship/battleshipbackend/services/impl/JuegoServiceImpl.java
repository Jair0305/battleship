package com.jair.battleship.battleshipbackend.services.impl;

import com.jair.battleship.battleshipbackend.models.entities.Jugador;
import com.jair.battleship.battleshipbackend.models.entities.Sala;
import com.jair.battleship.battleshipbackend.models.entities.Tablero;
import com.jair.battleship.battleshipbackend.repositories.JugadorRepository;
import com.jair.battleship.battleshipbackend.repositories.TableroRepository;
import com.jair.battleship.battleshipbackend.repositories.SalaRepository;
import com.jair.battleship.battleshipbackend.services.JuegoService;
import com.jair.battleship.battleshipbackend.services.PartidaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class JuegoServiceImpl implements JuegoService {

    @Autowired
    private JugadorRepository jugadorRepository;

    @Autowired
    private TableroRepository tableroRepository;

    @Autowired
    private SalaRepository salaRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private PartidaService partidaService;

    // Estado de preparación por sala (en memoria)
    private static class PrepState {
        Set<Long> readyPlayers = Collections.newSetFromMap(new ConcurrentHashMap<>());
        boolean started = false;
        Long deadline = null;
    }

    private static final Map<Long, PrepState> prepStates = new ConcurrentHashMap<>();

    /**
     * Reset prep state for a sala (called when starting a rematch)
     */
    public static void resetPrepState(Long salaId) {
        prepStates.remove(salaId);
    }

    public Jugador registrarJugadorEnSala(String nombreJugador, Long salaId) {
        Sala sala = salaRepository.findById(salaId).orElseThrow();

        Jugador jugador = new Jugador();
        jugador.setNombre(nombreJugador);
        jugador.setUsername(nombreJugador); // Link to user identity for ranking
        jugador.setSala(sala);

        Tablero tablero = new Tablero();
        tablero.setJugador(jugador);
        jugador.getTableros().add(tablero);

        Jugador saved = jugadorRepository.save(jugador);

        broadcastSalas();
        broadcastEvento(salaId);

        return saved;
    }

    public void inicializarTablero(Long jugadorId, Map<String, Boolean> posiciones) {
        Tablero tablero = tableroRepository.findByJugadorIdAndPartidaIsNull(jugadorId).orElseThrow();
        tablero.setPosicionesBarcos(posiciones);
        tableroRepository.save(tablero);
    }

    @Transactional
    public boolean realizarDisparo(Long jugadorId, String posicion) {
        Jugador atacante = jugadorRepository.findById(jugadorId).orElseThrow();
        Sala sala = atacante.getSala();
        if (sala == null || sala.getId() == null) {
            throw new IllegalStateException("El jugador no está en una sala válida");
        }

        try {
            var activa = partidaService.obtenerActivaPorSala(sala.getId());
            if (activa != null) {
                return partidaService.disparar(activa.getId(), jugadorId, posicion);
            }
        } catch (Exception ignored) {
        }

        // Legacy fallback
        Sala salaFull = salaRepository.findById(sala.getId()).orElseThrow();
        Jugador oponente = salaFull.getJugadores().stream()
                .filter(j -> !j.getId().equals(jugadorId))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No hay oponente en la sala"));

        Tablero tableroOponente = tableroRepository.findByJugadorIdAndPartidaIsNull(oponente.getId()).orElseThrow();
        boolean acierto = Boolean.TRUE.equals(tableroOponente.getPosicionesBarcos().get(posicion));
        tableroOponente.getPosicionesAtacadas().put(posicion, true);
        tableroRepository.save(tableroOponente);
        return acierto;
    }

    @Override
    public Map<String, Object> marcarListo(Long jugadorId) {
        Jugador jugador = jugadorRepository.findById(jugadorId).orElseThrow();
        Sala sala = jugador.getSala();
        if (sala == null || sala.getId() == null) {
            throw new IllegalStateException("El jugador no tiene sala asociada");
        }
        Long salaId = sala.getId();
        PrepState state = prepStates.computeIfAbsent(salaId, id -> new PrepState());
        state.readyPlayers.add(jugadorId);

        int readyCount = state.readyPlayers.size();

        if (!state.started && readyCount >= 2) {
            state.started = true;
            state.deadline = System.currentTimeMillis() + 60_000L;

            try {
                partidaService.iniciarPartidaDesdeSala(salaId);
            } catch (Exception e) {
                System.err.println("Error al iniciar partida: " + e.getMessage());
            }
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("salaId", salaId);
        payload.put("readyCount", readyCount);
        payload.put("started", state.started);
        payload.put("deadline", state.deadline);

        try {
            messagingTemplate.convertAndSend("/topic/sala/" + salaId + "/estado", payload);
        } catch (Exception ignored) {
        }

        return payload;
    }

    @Override
    public Map<String, Object> obtenerEstadoSala(Long salaId) {
        PrepState state = prepStates.get(salaId);
        int readyCount = state == null ? 0 : state.readyPlayers.size();
        boolean started = state != null && state.started;
        Long deadline = state == null ? null : state.deadline;
        Map<String, Object> payload = new HashMap<>();
        payload.put("salaId", salaId);
        payload.put("readyCount", readyCount);
        payload.put("started", started);
        payload.put("deadline", deadline);
        return payload;
    }

    private void broadcastSalas() {
        try {
            messagingTemplate.convertAndSend("/topic/salas", salaRepository.findAll());
        } catch (Exception ignored) {
        }
    }

    private void broadcastEvento(Long salaId) {
        try {
            messagingTemplate.convertAndSend("/topic/sala/" + salaId + "/evento", "UPDATE");
        } catch (Exception ignored) {
        }
    }
}
