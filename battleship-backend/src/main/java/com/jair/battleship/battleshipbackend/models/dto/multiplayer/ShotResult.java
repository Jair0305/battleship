package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

public record ShotResult(
        Long mesaId,
        Long partidaId,
        Long atacanteId,
        Long defensorId,
        String position,
        String result,
        boolean hit,
        String sunkShip,
        Long winnerId,
        Long nextTurnJugadorId) {
}
