package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

public record TableSnapshot(
        Long id,
        Long salaId,
        String salaNombre,
        String nombre,
        String estado,
        SeatSnapshot seatA,
        SeatSnapshot seatB,
        int spectators,
        Long partidaId,
        Long turnoActualJugadorId,
        Long ganadorId,
        boolean rematchA,
        boolean rematchB,
        PrivateMatchView privateView,
        SpectatorMatchView spectatorView) {
}
