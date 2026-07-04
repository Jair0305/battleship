package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

import java.time.Instant;

public record ShotSnapshot(
        Long atacanteId,
        Long defensorId,
        String posicion,
        boolean acierto,
        String resultado,
        String barcoHundido,
        Instant ts) {
}
