package com.jair.battleship.battleshipbackend.controllers;

import com.jair.battleship.battleshipbackend.models.entities.Usuario;
import com.jair.battleship.battleshipbackend.services.AuthService;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired private AuthService authService;

    @PostMapping("/register")
    public Usuario register(@RequestBody RegisterRequest req) {
        return authService.register(req.getUsername(), req.getPassword(), req.getPasswordConfirm());
    }

    @PostMapping("/login")
    public Usuario login(@RequestBody LoginRequest req) {
        return authService.login(req.getUsername(), req.getPassword());
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