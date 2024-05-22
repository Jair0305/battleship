package com.jair.battleship.battleshipbackend.controllers;

import com.jair.battleship.battleshipbackend.models.entities.Jugador;
import com.jair.battleship.battleshipbackend.services.JuegoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/juego")
public class JuegoController {
    @Autowired
    private JuegoService juegoService;

    @PostMapping("/registrar")
    public Jugador registrarJugador(@RequestParam String nombre, @RequestParam Long salaId) {
        return juegoService.registrarJugadorEnSala(nombre, salaId);
    }

    @PostMapping("/tablero/{jugadorId}")
    public void inicializarTablero(@PathVariable Long jugadorId, @RequestBody Map<String, Boolean> posiciones) {
        juegoService.inicializarTablero(jugadorId, posiciones);
    }

    @PostMapping("/disparo/{jugadorId}")
    public boolean realizarDisparo(@PathVariable Long jugadorId, @RequestParam String posicion) {
        return juegoService.realizarDisparo(jugadorId, posicion);
    }
}