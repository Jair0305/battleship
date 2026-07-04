package com.jair.battleship.battleshipbackend.controllers;

import com.jair.battleship.battleshipbackend.models.dto.multiplayer.*;
import com.jair.battleship.battleshipbackend.services.MultiplayerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mesas")
public class MesaController {

    @Autowired
    private MultiplayerService multiplayerService;

    @GetMapping("/{mesaId}")
    public TableSnapshot table(@PathVariable Long mesaId,
            @RequestHeader(value = "X-Session-Token", required = false) String token) {
        return multiplayerService.table(mesaId, token);
    }

    @PostMapping("/{mesaId}/join")
    public TableSnapshot join(@PathVariable Long mesaId, @RequestHeader("X-Session-Token") String token) {
        return multiplayerService.joinTable(mesaId, token);
    }

    @PostMapping("/{mesaId}/leave")
    public TableSnapshot leave(@PathVariable Long mesaId, @RequestHeader("X-Session-Token") String token) {
        return multiplayerService.leaveTable(mesaId, token);
    }

    @PostMapping("/{mesaId}/seat/{seat}/sit")
    public TableSnapshot sit(@PathVariable Long mesaId, @PathVariable String seat,
            @RequestHeader("X-Session-Token") String token) {
        return multiplayerService.sit(mesaId, seat, token);
    }

    @PostMapping("/{mesaId}/seat/stand")
    public TableSnapshot stand(@PathVariable Long mesaId, @RequestHeader("X-Session-Token") String token) {
        return multiplayerService.stand(mesaId, token);
    }

    @PostMapping("/{mesaId}/ready")
    public TableSnapshot ready(@PathVariable Long mesaId, @RequestHeader("X-Session-Token") String token) {
        return multiplayerService.ready(mesaId, token);
    }

    @PostMapping("/{mesaId}/ships")
    public TableSnapshot ships(@PathVariable Long mesaId, @RequestHeader("X-Session-Token") String token,
            @RequestBody ShipPlacementRequest request) {
        return multiplayerService.placeShips(mesaId, token, request);
    }

    @PostMapping("/{mesaId}/shots")
    public ShotResult shot(@PathVariable Long mesaId, @RequestHeader("X-Session-Token") String token,
            @RequestBody ShotRequest request) {
        return multiplayerService.shoot(mesaId, token, request);
    }

    @PostMapping("/{mesaId}/resign")
    public TableSnapshot resign(@PathVariable Long mesaId, @RequestHeader("X-Session-Token") String token) {
        return multiplayerService.resign(mesaId, token);
    }

    @PostMapping("/{mesaId}/rematch")
    public TableSnapshot rematch(@PathVariable Long mesaId, @RequestHeader("X-Session-Token") String token) {
        return multiplayerService.rematch(mesaId, token);
    }

    @PostMapping("/{mesaId}/chat")
    public ChatMessageDto chat(@PathVariable Long mesaId, @RequestHeader("X-Session-Token") String token,
            @RequestBody ChatMessageDto request) {
        return multiplayerService.chat(mesaId, token, request);
    }
}
