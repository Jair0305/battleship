package com.jair.battleship.battleshipbackend.controllers;

import com.jair.battleship.battleshipbackend.models.entities.Usuario;
import com.jair.battleship.battleshipbackend.models.dto.multiplayer.SessionUser;
import com.jair.battleship.battleshipbackend.services.AuthService;
import com.jair.battleship.battleshipbackend.services.MultiplayerService;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired private AuthService authService;
    @Autowired private MultiplayerService multiplayerService;

    @PostMapping("/register")
    public SessionUser register(@RequestBody RegisterRequest req) {
        Usuario usuario = authService.register(req.getUsername(), req.getPassword(), req.getPasswordConfirm());
        return multiplayerService.createSessionForUser(usuario);
    }

    @PostMapping("/login")
    public SessionUser login(@RequestBody LoginRequest req) {
        Usuario usuario = authService.login(req.getUsername(), req.getPassword());
        return multiplayerService.createSessionForUser(usuario);
    }

    @Data
    private static class RegisterRequest {
        private String username;
        private String password;
        private String passwordConfirm;
    }

    @Data
    private static class LoginRequest {
        private String username;
        private String password;
    }
}
