package com.jair.battleship.battleshipbackend.controllers;

import com.jair.battleship.battleshipbackend.models.entities.Partida;
import com.jair.battleship.battleshipbackend.services.PartidaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/partidas")
public class PartidaController {

    @Autowired
    private PartidaService partidaService;

    @PostMapping
    public Partida crear(@RequestParam(required = false) Long salaId, @RequestParam Long hostJugadorId) {
        return partidaService.crearPartida(salaId, hostJugadorId);
    }

    @PostMapping("/{partidaId}/unirse")
    public Partida unirse(@PathVariable Long partidaId, @RequestParam Long jugadorId) {
        return partidaService.unirsePartida(partidaId, jugadorId);
    }

    @PostMapping("/{partidaId}/tablero/{jugadorId}")
    public void registrarTablero(@PathVariable Long partidaId, @PathVariable Long jugadorId,
            @RequestBody Map<String, Boolean> posicionesBarcos) {
        partidaService.registrarTablero(partidaId, jugadorId, posicionesBarcos);
    }

    @PostMapping("/{partidaId}/disparar")
    public boolean disparar(@PathVariable Long partidaId, @RequestParam Long atacanteId,
            @RequestParam String posicion) {
        return partidaService.disparar(partidaId, atacanteId, posicion);
    }

    @PostMapping("/{partidaId}/deshacer")
    public void deshacer(@PathVariable Long partidaId) {
        partidaService.deshacerUltimoDisparo(partidaId);
    }

    @PostMapping("/{partidaId}/cancelar")
    public void cancelar(@PathVariable Long partidaId) {
        partidaService.cancelarPartida(partidaId);
    }

    @PostMapping("/{partidaId}/empate")
    public void empate(@PathVariable Long partidaId) {
        partidaService.finalizarEmpate(partidaId);
    }

    @GetMapping("/{partidaId}")
    public Partida obtener(@PathVariable Long partidaId) {
        return partidaService.obtenerPartida(partidaId);
    }

    @PostMapping("/{partidaId}/espectadores")
    public void agregarEspectador(@PathVariable Long partidaId, @RequestParam Long jugadorId) {
        partidaService.agregarEspectador(partidaId, jugadorId);
    }

    // Nuevo: obtener la partida activa por sala
    @GetMapping("/sala/{salaId}/activa")
    public Partida obtenerActivaPorSala(@PathVariable Long salaId) {
        return partidaService.obtenerActivaPorSala(salaId);
    }

    // Nuevo: obtener estado resumido de la partida, personalizado por jugador
    @GetMapping("/{partidaId}/estado")
    public Map<String, Object> obtenerEstadoPartida(@PathVariable Long partidaId,
            @RequestParam(required = false) Long jugadorId) {
        return partidaService.obtenerEstadoPartida(partidaId, jugadorId);
    }

    @PostMapping("/{partidaId}/revancha")
    public void revancha(@PathVariable Long partidaId, @RequestParam Long jugadorId) {
        partidaService.solicitarRevancha(partidaId, jugadorId);
    }
}