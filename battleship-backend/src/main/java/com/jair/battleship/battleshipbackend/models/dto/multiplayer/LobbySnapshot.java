package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

import java.util.List;

public record LobbySnapshot(
        List<RoomSnapshot> salas,
        List<SessionUser> onlinePlayers) {
}
