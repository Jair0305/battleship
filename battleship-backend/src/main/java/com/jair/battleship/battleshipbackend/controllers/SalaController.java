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

    @GetMapping("/todas")
    public List<Sala> obtenerTodas() {
        return salaService.obtenerTodas();
    }

    @PostMapping
    public Sala crearSala(@RequestParam String nombre) {
        return salaService.crearSala(nombre);
    }

    @PutMapping("/{id}/ocupar")
    public Sala ocuparSala(@PathVariable Long id) {
        return salaService.ocuparSala(id);
    }

    @PutMapping("/{id}/liberar")
    public Sala liberarSala(@PathVariable Long id) {
        return salaService.liberarSala(id);
    }
}
