package com.jair.battleship.battleshipbackend.controllers;

import com.jair.battleship.battleshipbackend.services.RankingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ranking")
public class RankingController {

    @Autowired
    private RankingService rankingService;

    @GetMapping("/{periodo}")
    public List<Map<String, Object>> obtenerRanking(@PathVariable String periodo) {
        return rankingService.obtenerRanking(periodo);
    }

    @GetMapping("/partida/{partidaId}/jugador/{jugadorId}")
    public Map<String, Object> obtenerPuntuacion(@PathVariable Long partidaId, @PathVariable Long jugadorId) {
        return rankingService.obtenerPuntuacion(partidaId, jugadorId);
    }
}
