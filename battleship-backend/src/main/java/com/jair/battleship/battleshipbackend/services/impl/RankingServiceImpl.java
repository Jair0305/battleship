package com.jair.battleship.battleshipbackend.services.impl;

import com.jair.battleship.battleshipbackend.models.entities.*;
import com.jair.battleship.battleshipbackend.models.enums.ResultadoParticipacion;
import com.jair.battleship.battleshipbackend.repositories.*;
import com.jair.battleship.battleshipbackend.services.RankingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class RankingServiceImpl implements RankingService {

    @Autowired
    private PuntuacionRepository puntuacionRepository;

    @Autowired
    private EstadisticaJugadorRepository estadisticaJugadorRepository;

    @Autowired
    private TableroRepository tableroRepository;

    @Autowired
    private ParticipacionRepository participacionRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Override
    @Transactional
    public void procesarPartida(Partida partida) {
        List<Participacion> participaciones = participacionRepository.findByPartidaId(partida.getId());

        for (Participacion p : participaciones) {
            calcularYGuardarPuntuacion(p, partida);
        }

        broadcastRankingUpdate();
    }

    private void calcularYGuardarPuntuacion(Participacion p, Partida partida) {
        Jugador jugador = p.getJugador();
        boolean esGanador = p.getResultado() == ResultadoParticipacion.GANO;

        // 1. Puntos Base
        int puntosBase = esGanador ? 100 : -20;

        // 2. Precisión
        long disparosTotales = partida.getDisparos().stream()
                .filter(d -> d.getAtacante().getId().equals(jugador.getId()))
                .count();
        long aciertos = partida.getDisparos().stream()
                .filter(d -> d.getAtacante().getId().equals(jugador.getId()) && d.isAcierto())
                .count();

        int puntosPrecision = 0;
        if (disparosTotales > 0) {
            double precision = (double) aciertos / disparosTotales;
            puntosPrecision = (int) (precision * 50);
        }

        // 3. Barcos Hundidos (Daño Infligido)
        long oponenteId = participacionRepository.findByPartidaId(partida.getId()).stream()
                .filter(op -> !op.getJugador().getId().equals(jugador.getId()))
                .map(op -> op.getJugador().getId())
                .findFirst()
                .orElse(-1L);

        int barcosHundidos = 0;
        if (oponenteId != -1L) {
            Tablero tableroOponente = tableroRepository.findByJugadorIdAndPartidaId(oponenteId, partida.getId())
                    .orElse(null);
            if (tableroOponente != null) {
                barcosHundidos = contarBarcosHundidos(tableroOponente);
            }
        }
        int puntosBarcos = barcosHundidos * 5; // 5 puntos por barco (10 barcos max)

        // 4. Supervivencia
        int barcosIntactos = 0;
        Tablero miTablero = tableroRepository.findByJugadorIdAndPartidaId(jugador.getId(), partida.getId())
                .orElse(null);
        if (miTablero != null) {
            barcosIntactos = contarBarcosIntactos(miTablero);
        }
        int puntosSupervivencia = barcosIntactos * 2; // 2 puntos por barco intacto

        // 5. Racha (Bonus)
        EstadisticaJugador stats = estadisticaJugadorRepository.findByJugadorId(jugador.getId())
                .orElse(new EstadisticaJugador());
        int rachaActual = stats.getRachaActual();

        int puntosRacha = 0;
        if (esGanador) {
            int rachaParaPuntos = Math.min(rachaActual, 5);
            puntosRacha = rachaParaPuntos * 5;
        }

        // Total
        int total = puntosBase + puntosPrecision + puntosBarcos + puntosSupervivencia + puntosRacha;

        // No negativos
        Integer puntajeActual = puntuacionRepository.findGlobalLeaderboard(PageRequest.of(0, 1000)).stream()
                .filter(obj -> ((Long) obj[0]).equals(jugador.getId()))
                .map(obj -> ((Number) obj[2]).intValue())
                .findFirst()
                .orElse(0);

        if (puntajeActual + total < 0) {
            total = -puntajeActual; // Para que quede en 0
        }

        Puntuacion puntuacion = new Puntuacion();
        puntuacion.setJugador(jugador);
        puntuacion.setPartida(partida);
        puntuacion.setPuntosBase(puntosBase);
        puntuacion.setPuntosPrecision(puntosPrecision);
        puntuacion.setPuntosBarcos(puntosBarcos);
        puntuacion.setPuntosSupervivencia(puntosSupervivencia);
        puntuacion.setPuntosRacha(puntosRacha);
        puntuacion.setTotal(total);
        puntuacion.setFecha(Instant.now());

        puntuacionRepository.save(puntuacion);

        if (stats.getJugador() == null)
            stats.setJugador(jugador);
        stats.setPuntosTotales(Math.max(0, stats.getPuntosTotales() + total));
        estadisticaJugadorRepository.save(stats);
    }

    private int contarBarcosHundidos(Tablero tablero) {
        long celdasBarcoDestruidas = tablero.getPosicionesBarcos().entrySet().stream()
                .filter(e -> Boolean.TRUE.equals(e.getValue())) // Es barco
                .filter(e -> Boolean.TRUE.equals(tablero.getPosicionesAtacadas().get(e.getKey()))) // Fue atacado
                .count();

        return (int) (celdasBarcoDestruidas / 2);
    }

    private int contarBarcosIntactos(Tablero tablero) {
        long celdasBarcoTotal = tablero.getPosicionesBarcos().entrySet().stream()
                .filter(e -> Boolean.TRUE.equals(e.getValue()))
                .count();

        long celdasBarcoDestruidas = tablero.getPosicionesBarcos().entrySet().stream()
                .filter(e -> Boolean.TRUE.equals(e.getValue()))
                .filter(e -> Boolean.TRUE.equals(tablero.getPosicionesAtacadas().get(e.getKey())))
                .count();

        long celdasVivas = celdasBarcoTotal - celdasBarcoDestruidas;
        return (int) (celdasVivas / 2);
    }

    @Override
    public Map<String, Object> obtenerPuntuacion(Long partidaId, Long jugadorId) {
        Puntuacion p = puntuacionRepository.findByPartidaIdAndJugadorId(partidaId, jugadorId)
                .orElse(null);

        Map<String, Object> result = new HashMap<>();
        if (p != null) {
            result.put("puntosBase", p.getPuntosBase());
            result.put("puntosPrecision", p.getPuntosPrecision());
            result.put("puntosBarcos", p.getPuntosBarcos());
            result.put("puntosSupervivencia", p.getPuntosSupervivencia());
            result.put("puntosRacha", p.getPuntosRacha());
            result.put("total", p.getTotal());
        }
        return result;
    }

    @Override
    public List<Map<String, Object>> obtenerRanking(String periodo) {
        Instant startDate = Instant.EPOCH;
        if ("dia".equalsIgnoreCase(periodo)) {
            startDate = Instant.now().truncatedTo(ChronoUnit.DAYS);
        } else if ("semana".equalsIgnoreCase(periodo)) {
            startDate = Instant.now().minus(7, ChronoUnit.DAYS).truncatedTo(ChronoUnit.DAYS);
        } else if ("mes".equalsIgnoreCase(periodo)) {
            startDate = Instant.now().minus(30, ChronoUnit.DAYS).truncatedTo(ChronoUnit.DAYS);
        }

        List<Object[]> results;
        if ("historico".equalsIgnoreCase(periodo)) {
            results = puntuacionRepository.findGlobalLeaderboard(PageRequest.of(0, 10));
        } else {
            results = puntuacionRepository.findLeaderboardSince(startDate, PageRequest.of(0, 10));
        }

        List<Map<String, Object>> ranking = new ArrayList<>();
        int rank = 1;
        for (Object[] row : results) {
            Map<String, Object> item = new HashMap<>();
            item.put("rank", rank++);
            item.put("jugadorId", row[0]);
            item.put("nombre", row[1]);
            item.put("puntos", row[2] != null ? ((Number) row[2]).intValue() : 0);
            ranking.add(item);
        }
        return ranking;
    }

    private void broadcastRankingUpdate() {
        try {
            messagingTemplate.convertAndSend("/topic/ranking/dia", obtenerRanking("dia"));
            messagingTemplate.convertAndSend("/topic/ranking/semana", obtenerRanking("semana"));
            messagingTemplate.convertAndSend("/topic/ranking/mes", obtenerRanking("mes"));
            messagingTemplate.convertAndSend("/topic/ranking/historico", obtenerRanking("historico"));
        } catch (Exception ignored) {
        }
    }
}
