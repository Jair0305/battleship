package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

import java.util.List;
import java.util.Map;

public record SpectatorMatchView(
        Map<Long, String> players,
        Map<Long, Map<String, String>> publicShots,
        Map<Long, Map<String, String>> revealedShips,
        List<ShotSnapshot> history) {
}
