package com.jair.battleship.battleshipbackend.controllers;

import com.jair.battleship.battleshipbackend.models.entities.Sala;
import com.jair.battleship.battleshipbackend.services.SalaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sala")
public class SalaController {

    @Autowired
    private SalaService salaService;

    @GetMapping
    public List<Sala> obtenerSalasDisponibles() {
        return salaService.obtenerSalasDisponibles();
    }

    @PostMapping
    public Sala crearSala(@RequestParam String nombre) {
        return salaService.crearSala(nombre);
    }

    @PutMapping("/{id}/ocupar")
    public void ocuparSala(@PathVariable Long id) {
        salaService.ocuparSala(id);
    }
}
 