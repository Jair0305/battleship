package com.jair.battleship.battleshipbackend.controllers;

import com.jair.battleship.battleshipbackend.models.dto.multiplayer.LobbySnapshot;
import com.jair.battleship.battleshipbackend.services.MultiplayerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/lobby")
public class LobbyController {

    @Autowired
    private MultiplayerService multiplayerService;

    @GetMapping
    public LobbySnapshot lobby(@RequestHeader(value = "X-Session-Token", required = false) String token) {
        return multiplayerService.lobby(token);
    }
}
