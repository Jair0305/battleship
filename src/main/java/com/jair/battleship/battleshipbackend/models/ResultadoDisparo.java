package com.jair.battleship.battleshipbackend.models;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ResultadoDisparo {
    private Long jugadorId;
    private String posicion;
    private boolean acierto;
    private Long ts;

    public Long getJugadorId() {
        return this.jugadorId;
    }

    public String getPosicion() {
        return this.posicion;
    }

    public boolean isAcierto() {
        return this.acierto;
    }

    public Long getTs() {
        return this.ts;
    }
}
