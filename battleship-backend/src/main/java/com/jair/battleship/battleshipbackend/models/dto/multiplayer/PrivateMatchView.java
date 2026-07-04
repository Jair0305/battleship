package com.jair.battleship.battleshipbackend.models.dto.multiplayer;

import java.util.List;
import java.util.Map;

public record PrivateMatchView(
        String role,
        String mySeat,
        Long myJugadorId,
        Map<String, String> ownShips,
        Map<String, String> ownReceivedShots,
        Map<String, String> targetShots,
        boolean ownShipsPlaced,
        boolean opponentShipsPlaced,
        Map<Long, Map<String, String>> revealedShips,
        List<ShotSnapshot> history) {
}
