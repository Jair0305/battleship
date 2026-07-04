package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

import java.util.List;

public record RoomSnapshot(
        Long id,
        String nombre,
        boolean disponible,
        int onlinePlayers,
        int spectators,
        List<TableSnapshot> mesas) {
}
