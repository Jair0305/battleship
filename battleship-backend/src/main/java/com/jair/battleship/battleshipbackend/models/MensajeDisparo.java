package com.jair.battleship.battleshipbackend.models;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MensajeDisparo {
    private Long jugadorId;
    private String posicion;

    public Long getJugadorId() {
        return this.jugadorId;
    }

    public String getPosicion() {
        return this.posicion;
    }
}
