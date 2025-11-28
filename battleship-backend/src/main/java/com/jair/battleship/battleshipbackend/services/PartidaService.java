package com.jair.battleship.battleshipbackend.services;

import com.jair.battleship.battleshipbackend.models.entities.Partida;

import java.util.Map;

public interface PartidaService {
    Partida crearPartida(Long salaId, Long hostJugadorId);

    Partida unirsePartida(Long partidaId, Long jugadorId);

    void registrarTablero(Long partidaId, Long jugadorId, Map<String, Boolean> posicionesBarcos);

    boolean disparar(Long partidaId, Long atacanteId, String posicion);

    void deshacerUltimoDisparo(Long partidaId);

    void cancelarPartida(Long partidaId);

    void finalizarEmpate(Long partidaId);

    Partida obtenerPartida(Long partidaId);

    void agregarEspectador(Long partidaId, Long jugadorId);

    Partida obtenerActivaPorSala(Long salaId);

    Map<String, Object> obtenerEstadoPartida(Long partidaId, Long jugadorId);

    Partida iniciarPartidaDesdeSala(Long salaId);

    void solicitarRevancha(Long partidaId, Long jugadorId);

    void rechazarRevancha(Long partidaId, Long jugadorId);
}