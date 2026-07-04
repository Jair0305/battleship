package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

import java.util.List;

public record ShipPlacement(
        String key,
        String name,
        int size,
        String orientation,
        List<String> cells) {
}
