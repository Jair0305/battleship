package com.jair.battleship.battleshipbackend.services.impl;

import com.jair.battleship.battleshipbackend.models.entities.Usuario;
import com.jair.battleship.battleshipbackend.repositories.UsuarioRepository;
import com.jair.battleship.battleshipbackend.services.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Service
public class AuthServiceImpl implements AuthService {

    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @Override
    public Usuario register(String username, String password, String passwordConfirm) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("username requerido");
        }
        if (password == null || password.isBlank()) {
            throw new IllegalArgumentException("password requerido");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("password debe tener como máximo 72 bytes UTF-8");
        }
        if (!password.equals(passwordConfirm)) {
            throw new IllegalArgumentException("las contraseñas no coinciden");
        }
        if (usuarioRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("username ya existe");
        }
        Usuario u = new Usuario();
        u.setUsername(username.trim());
        u.setPasswordHash(passwordEncoder.encode(password));
        return usuarioRepository.save(u);
    }

    @Override
    public Usuario login(String username, String password) {
        if (password == null || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("credenciales inválidas");
        }
        Usuario u = usuarioRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("credenciales inválidas"));
        if (!passwordEncoder.matches(password, u.getPasswordHash())) {
            throw new IllegalArgumentException("credenciales inválidas");
        }
        return u;
    }
}
