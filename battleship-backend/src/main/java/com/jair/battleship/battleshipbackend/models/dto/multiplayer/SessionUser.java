package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

public record SessionUser(
        Long id,
        String token,
        String displayName,
        boolean guest,
        Long usuarioId,
        Integer rating,
        Integer gamesPlayed,
        Integer wins,
        Integer losses) {
}
