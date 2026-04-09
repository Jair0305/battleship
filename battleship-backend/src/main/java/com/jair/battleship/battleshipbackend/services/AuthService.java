package com.jair.battleship.battleshipbackend.services;

import com.jair.battleship.battleshipbackend.models.entities.Usuario;

public interface AuthService {
    Usuario register(String username, String password, String passwordConfirm);
    Usuario login(String username, String password);
}