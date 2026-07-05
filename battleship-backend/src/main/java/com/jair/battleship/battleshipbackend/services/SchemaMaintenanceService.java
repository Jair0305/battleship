package com.jair.battleship.battleshipbackend.services;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SchemaMaintenanceService {

    private final JdbcTemplate jdbcTemplate;

    public SchemaMaintenanceService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Order(Ordered.HIGHEST_PRECEDENCE)
    @Transactional
    public void ensureClassicRulesColumns() {
        for (String statement : List.of(
                "ALTER TABLE disparo ADD COLUMN IF NOT EXISTS automatic boolean DEFAULT false",
                "UPDATE disparo SET automatic = false WHERE automatic IS NULL",
                "ALTER TABLE disparo ALTER COLUMN automatic SET DEFAULT false",
                "ALTER TABLE disparo ALTER COLUMN automatic SET NOT NULL",
                "ALTER TABLE disparo ADD COLUMN IF NOT EXISTS reason varchar(64) DEFAULT 'MANUAL'",
                "UPDATE disparo SET reason = 'MANUAL' WHERE reason IS NULL",
                "ALTER TABLE disparo ALTER COLUMN reason SET DEFAULT 'MANUAL'",
                "ALTER TABLE partida ADD COLUMN IF NOT EXISTS placement_deadline_at timestamp(6) with time zone",
                "ALTER TABLE partida ADD COLUMN IF NOT EXISTS turn_deadline_at timestamp(6) with time zone",
                "ALTER TABLE partida ADD COLUMN IF NOT EXISTS last_auto_action_at timestamp(6) with time zone",
                "ALTER TABLE partida ADD COLUMN IF NOT EXISTS ruleset varchar(255) DEFAULT 'SEA_BATTLE_2_CLASSIC'",
                "UPDATE partida SET ruleset = 'SEA_BATTLE_2_CLASSIC' WHERE ruleset IS NULL",
                "ALTER TABLE partida ALTER COLUMN ruleset SET DEFAULT 'SEA_BATTLE_2_CLASSIC'")) {
            jdbcTemplate.execute(statement);
        }
    }
}
