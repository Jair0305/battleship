package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

/** Public lobby identity; credentials are confined to private session responses. */
public record PublicPlayer(
        Long id,
        String displayName,
        boolean guest,
        Long usuarioId,
        Integer rating,
        Integer gamesPlayed,
        Integer wins,
        Integer losses) {
}
