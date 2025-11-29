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

    // Estado de preparación por sala en memoria (no persistente)
    private static class PrepState {
        Set<Long> readyPlayers = Collections.newSetFromMap(new ConcurrentHashMap<>());
        boolean started = false;
        Long deadline = null; // epoch millis
    }

    private final Map<Long, PrepState> prepStates = new ConcurrentHashMap<>();

    public Jugador registrarJugadorEnSala(String nombreJugador, Long salaId) {
        Jugador jugador = new Jugador();
        jugador.setNombre(nombreJugador);
        Sala sala = salaRepository.findById(salaId).orElseThrow();

        // Assign seat
        if (sala.getJugador1() == null) {
            sala.setJugador1(jugador);
        } else if (sala.getJugador2() == null) {
            sala.setJugador2(jugador);
        } else {
            throw new IllegalStateException("La sala está llena");
        }

        sala.setOcupacion((sala.getJugador1() != null ? 1 : 0) + (sala.getJugador2() != null ? 1 : 0));
        sala.setDisponible(sala.getOcupacion() < 2);
        sala = salaRepository.save(sala);

        jugador.setSala(sala);
        Tablero tablero = new Tablero();
        tablero.setJugador(jugador);
        jugador.getTableros().add(tablero);
        Jugador saved = jugadorRepository.save(jugador);

        // Broadcast update
        try {
            messagingTemplate.convertAndSend("/topic/salas", salaRepository.findAll());
        } catch (Exception ignored) {
        }

        return saved;
    }

    public void inicializarTablero(Long jugadorId, Map<String, Boolean> posiciones) {
        // Buscar el tablero actual del jugador sin partida asociada
        Tablero tablero = tableroRepository.findByJugadorIdAndPartidaIsNull(jugadorId).orElseThrow();
        // Establecer las posiciones donde hay barcos
        tablero.setPosicionesBarcos(posiciones);
        tableroRepository.save(tablero);
    }

    @Transactional
    public boolean realizarDisparo(Long jugadorId, String posicion) {
        // Obtener atacante y su sala
        Jugador atacante = jugadorRepository.findById(jugadorId).orElseThrow();
        Sala sala = atacante.getSala();
        if (sala == null || sala.getId() == null) {
            throw new IllegalStateException("El jugador no está en una sala válida");
        }

        // Si existe una partida activa para la sala, delegar en PartidaService
        // (persistente y con turnos)
        try {
            var activa = partidaService.obtenerActivaPorSala(sala.getId());
            if (activa != null) {
                return partidaService.disparar(activa.getId(), jugadorId, posicion);
            }
        } catch (Exception ignored) {
        }

        // Legacy: disparo contra tablero actual sin partida asociada
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

        // Contar jugadores en la sala (hasta 2)
        int readyCount = state.readyPlayers.size();

        if (!state.started && readyCount >= 2) {
            state.started = true;
            state.deadline = System.currentTimeMillis() + 60_000L; // 60s

            // Crear la partida oficialmente en el backend
            try {
                partidaService.iniciarPartidaDesdeSala(salaId);
            } catch (Exception e) {
                // Log error or handle
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
}
