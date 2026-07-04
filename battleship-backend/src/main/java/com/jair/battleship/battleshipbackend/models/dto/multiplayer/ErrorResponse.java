package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

import java.time.Instant;

public record ErrorResponse(String message, int status, Instant timestamp) {
}
