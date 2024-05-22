package com.jair.battleship.battleshipbackend.services;

import com.jair.battleship.battleshipbackend.models.entities.Jugador;
import org.springframework.stereotype.Service;

@Service
public interface JugadorService {

    public Jugador crearJugador(String nombre, Long salaId);


}
