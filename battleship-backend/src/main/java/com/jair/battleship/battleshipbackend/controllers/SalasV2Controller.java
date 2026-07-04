package com.jair.battleship.battleshipbackend.controllers;

import com.jair.battleship.battleshipbackend.models.dto.multiplayer.RoomSnapshot;
import com.jair.battleship.battleshipbackend.models.dto.multiplayer.TableSnapshot;
import com.jair.battleship.battleshipbackend.services.MultiplayerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/salas")
public class SalasV2Controller {

    @Autowired
    private MultiplayerService multiplayerService;

    @GetMapping("/{salaId}")
    public RoomSnapshot room(@PathVariable Long salaId,
            @RequestHeader(value = "X-Session-Token", required = false) String token) {
        return multiplayerService.room(salaId, token);
    }

    @PostMapping("/{salaId}/mesas")
    public TableSnapshot createTable(@PathVariable Long salaId,
            @RequestHeader("X-Session-Token") String token,
            @RequestBody(required = false) Map<String, String> body) {
        String name = body == null ? null : body.get("name");
        return multiplayerService.createTable(salaId, token, name);
    }
}
