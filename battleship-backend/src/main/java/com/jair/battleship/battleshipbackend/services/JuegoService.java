package com.jair.battleship.battleshipbackend.services;

import com.jair.battleship.battleshipbackend.models.entities.Jugador;

import java.util.Map;

public interface JuegoService {

    public Jugador registrarJugadorEnSala(String nombreJugador, Long salaId);

    public void inicializarTablero(Long jugadorId, Map<String, Boolean> posiciones);

    public boolean realizarDisparo(Long jugadorId, String posicion);

    // Nuevo: marcar listo y devolver estado de preparación de la sala
    public Map<String, Object> marcarListo(Long jugadorId);

    // Nuevo: obtener estado actual (readyCount/started/deadline) de una sala
    public Map<String, Object> obtenerEstadoSala(Long salaId);

}
