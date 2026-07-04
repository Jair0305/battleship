package com.jair.battleship.battleshipbackend.controllers;

import com.jair.battleship.battleshipbackend.models.dto.multiplayer.SessionUser;
import com.jair.battleship.battleshipbackend.services.MultiplayerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/session")
public class SessionController {

    @Autowired
    private MultiplayerService multiplayerService;

    @PostMapping("/guest")
    public SessionUser guest(@RequestBody(required = false) Map<String, String> body) {
        String displayName = body == null ? null : body.get("displayName");
        return multiplayerService.createGuest(displayName);
    }

    @GetMapping("/me")
    public SessionUser me(@RequestHeader("X-Session-Token") String token) {
        return multiplayerService.currentSession(token);
    }
}
