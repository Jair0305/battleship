package com.jair.battleship.battleshipbackend.services.impl;

import com.jair.battleship.battleshipbackend.models.entities.Jugador;
import com.jair.battleship.battleshipbackend.models.entities.Sala;
import com.jair.battleship.battleshipbackend.models.entities.Tablero;
import com.jair.battleship.battleshipbackend.repositories.JugadorRepository;
import com.jair.battleship.battleshipbackend.repositories.TableroRepository;
import com.jair.battleship.battleshipbackend.services.JuegoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class JuegoServiceImpl implements JuegoService {

    @Autowired
    private JugadorRepository jugadorRepository;

    @Autowired
    private TableroRepository tableroRepository;

    public Jugador registrarJugadorEnSala(String nombreJugador, Long salaId) {
        Jugador jugador = new Jugador();
        jugador.setNombre(nombreJugador);
        jugador.setSala(new Sala(salaId)); // Suponiendo que existe un constructor con id
        Tablero tablero = new Tablero();
        tablero.setJugador(jugador);
        jugador.setTablero(tablero);
        return jugadorRepository.save(jugador);
    }

    public void inicializarTablero(Long jugadorId, Map<String, Boolean> posiciones) {
        Tablero tablero = tableroRepository.findById(jugadorId).orElseThrow();
        tablero.setPosiciones(posiciones);
        tableroRepository.save(tablero);
    }

    public boolean realizarDisparo(Long jugadorId, String posicion) {
        Tablero tablero = tableroRepository.findById(jugadorId).orElseThrow();
        Boolean acierto = tablero.getPosiciones().get(posicion);
        tablero.getPosiciones().put(posicion, true); // Marca la posición como atacada
        tableroRepository.save(tablero);
        return acierto != null && acierto;
    }
}
