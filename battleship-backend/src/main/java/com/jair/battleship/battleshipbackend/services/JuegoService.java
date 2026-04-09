package com.jair.battleship.battleshipbackend.services;

import com.jair.battleship.battleshipbackend.models.entities.Jugador;
import com.jair.battleship.battleshipbackend.models.entities.Sala;
import com.jair.battleship.battleshipbackend.models.entities.Tablero;
import com.jair.battleship.battleshipbackend.repositories.JugadorRepository;
import com.jair.battleship.battleshipbackend.repositories.TableroRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service("juegoService")
public interface JuegoService {

    public Jugador registrarJugadorEnSala(String nombreJugador, Long salaId);

    public void inicializarTablero(Long jugadorId, Map<String, Boolean> posiciones);

    public boolean realizarDisparo(Long jugadorId, String posicion);

    // Nuevo: marcar listo y devolver estado de preparación de la sala
    public Map<String, Object> marcarListo(Long jugadorId);

    // Nuevo: obtener estado actual (readyCount/started/deadline) de una sala
    public Map<String, Object> obtenerEstadoSala(Long salaId);

}
