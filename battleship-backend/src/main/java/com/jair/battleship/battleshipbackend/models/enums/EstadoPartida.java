package com.jair.battleship.battleshipbackend.models.enums;

public enum EstadoPartida {
    WAITING_FOR_PLAYERS,
    PLAYERS_SEATED,
    PLACING_SHIPS,
    READY_TO_START,
    IN_PROGRESS,
    FINISHED,
    ABANDONED,
    CANCELLED,

    // Legacy states kept so existing endpoints/data keep compiling during migration.
    CREADA,
    EN_CURSO,
    FINALIZADA,
    CANCELADA
}
