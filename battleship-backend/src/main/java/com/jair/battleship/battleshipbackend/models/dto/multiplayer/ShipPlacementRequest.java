package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

import java.util.List;

public record ShipPlacementRequest(List<ShipPlacement> ships) {
}
