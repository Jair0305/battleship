package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

public record SeatSnapshot(
        String seat,
        Long jugadorId,
        String displayName,
        boolean guest,
        Integer rating,
        boolean ready,
        boolean occupied) {
}
