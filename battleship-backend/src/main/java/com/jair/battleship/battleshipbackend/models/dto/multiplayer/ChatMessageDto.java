package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

import java.time.Instant;

public record ChatMessageDto(
        String sender,
        String content,
        String type,
        Instant receivedAt) {
}
