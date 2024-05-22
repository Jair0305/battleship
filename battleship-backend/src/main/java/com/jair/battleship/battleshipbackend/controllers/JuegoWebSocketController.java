package com.jair.battleship.battleshipbackend.controllers;

import com.jair.battleship.battleshipbackend.models.MensajeDisparo;
import com.jair.battleship.battleshipbackend.models.ResultadoDisparo;
import com.jair.battleship.battleshipbackend.services.JuegoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class JuegoWebSocketController {

    @Autowired
    private JuegoService juegoService;

    @MessageMapping("/juego/disparo")
    @SendTo("/topic/resultados")
    public ResultadoDisparo realizarDisparo(MensajeDisparo mensaje) throws Exception {
        // Lógica para manejar el disparo
        boolean acierto = juegoService.realizarDisparo(mensaje.getJugadorId(), mensaje.getPosicion());
        return new ResultadoDisparo(mensaje.getJugadorId(), mensaje.getPosicion(), acierto);
    }
}