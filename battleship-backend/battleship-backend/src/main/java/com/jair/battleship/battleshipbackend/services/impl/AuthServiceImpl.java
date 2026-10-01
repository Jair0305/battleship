package com.jair.battleship.battleshipbackend.services.impl;

import com.jair.battleship.battleshipbackend.models.entities.Usuario;
import com.jair.battleship.battleshipbackend.repositories.UsuarioRepository;
import com.jair.battleship.battleshipbackend.services.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthServiceImpl implements AuthService {

    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @Override
    public Usuario register(String username, String password, String passwordConfirm) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("username requerido");
        }
        if (password == null || password.length() < 4) {
            throw new IllegalArgumentException("password demasiado corta");
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
        Usuario u = usuarioRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("credenciales inválidas"));
        if (!passwordEncoder.matches(password, u.getPasswordHash())) {
            throw new IllegalArgumentException("credenciales inválidas");
        }
        return u;
    }
}