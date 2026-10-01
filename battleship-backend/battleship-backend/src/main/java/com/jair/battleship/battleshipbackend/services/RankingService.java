package com.jair.battleship.battleshipbackend.services;

import com.jair.battleship.battleshipbackend.models.entities.Partida;
import java.util.List;
import java.util.Map;

public interface RankingService {
    void procesarPartida(Partida partida);

    List<Map<String, Object>> obtenerRanking(String periodo);

    Map<String, Object> obtenerPuntuacion(Long partidaId, Long jugadorId);
}
