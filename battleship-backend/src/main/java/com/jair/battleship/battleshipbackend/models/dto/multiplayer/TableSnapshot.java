package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

import java.time.Instant;
import java.util.List;

public record TableSnapshot(
        Long id,
        Long salaId,
        String salaNombre,
        String nombre,
        String estado,
        Instant serverNow,
        Instant placementDeadlineAt,
        Instant turnDeadlineAt,
        String ruleset,
        List<FleetShipSpec> fleetSpec,
        SeatSnapshot seatA,
        SeatSnapshot seatB,
        String mySeat,
        int spectators,
        Long partidaId,
        Long turnoActualJugadorId,
        Long ganadorId,
        boolean rematchA,
        boolean rematchB,
        PrivateMatchView privateView,
        SpectatorMatchView spectatorView) {
}
