package com.jair.battleship.battleshipbackend;

import com.jair.battleship.battleshipbackend.models.dto.multiplayer.SessionUser;
import com.jair.battleship.battleshipbackend.models.dto.multiplayer.ShipPlacement;
import com.jair.battleship.battleshipbackend.models.dto.multiplayer.ShipPlacementRequest;
import com.jair.battleship.battleshipbackend.models.dto.multiplayer.ShotRequest;
import com.jair.battleship.battleshipbackend.models.dto.multiplayer.ShotResult;
import com.jair.battleship.battleshipbackend.models.dto.multiplayer.TableSnapshot;
import com.jair.battleship.battleshipbackend.models.entities.Disparo;
import com.jair.battleship.battleshipbackend.models.entities.Mesa;
import com.jair.battleship.battleshipbackend.models.entities.Partida;
import com.jair.battleship.battleshipbackend.models.entities.Sala;
import com.jair.battleship.battleshipbackend.models.entities.Usuario;
import com.jair.battleship.battleshipbackend.models.enums.EstadoPartida;
import com.jair.battleship.battleshipbackend.repositories.DisparoRepository;
import com.jair.battleship.battleshipbackend.repositories.JugadorRepository;
import com.jair.battleship.battleshipbackend.repositories.MesaRepository;
import com.jair.battleship.battleshipbackend.repositories.ParticipacionRepository;
import com.jair.battleship.battleshipbackend.repositories.PartidaRepository;
import com.jair.battleship.battleshipbackend.repositories.PuntuacionRepository;
import com.jair.battleship.battleshipbackend.repositories.SalaRepository;
import com.jair.battleship.battleshipbackend.repositories.SesionJugadorRepository;
import com.jair.battleship.battleshipbackend.repositories.TableroRepository;
import com.jair.battleship.battleshipbackend.repositories.UsuarioRepository;
import com.jair.battleship.battleshipbackend.services.MultiplayerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class MultiplayerServiceClassicRulesTests {

    private static final List<String> CLASSIC_CELLS = List.of(
            "A1", "A2", "A3", "A4",
            "C1", "C2", "C3",
            "C6", "C7", "C8",
            "E1", "E2",
            "E5", "E6",
            "E9", "E10",
            "G1", "G3", "G5", "G7");

    @Autowired
    private MultiplayerService service;
    @Autowired
    private SalaRepository salaRepository;
    @Autowired
    private SesionJugadorRepository sesionRepository;
    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private JugadorRepository jugadorRepository;
    @Autowired
    private MesaRepository mesaRepository;
    @Autowired
    private PartidaRepository partidaRepository;
    @Autowired
    private ParticipacionRepository participacionRepository;
    @Autowired
    private TableroRepository tableroRepository;
    @Autowired
    private DisparoRepository disparoRepository;
    @Autowired
    private PuntuacionRepository puntuacionRepository;

    @BeforeEach
    void cleanDatabase() {
        puntuacionRepository.deleteAll();
        disparoRepository.deleteAll();
        tableroRepository.deleteAll();
        participacionRepository.deleteAll();
        partidaRepository.deleteAll();
        mesaRepository.deleteAll();
        jugadorRepository.deleteAll();
        sesionRepository.deleteAll();
        usuarioRepository.deleteAll();
        salaRepository.deleteAll();
    }

    @Test
    void rejectsClassicShipsThatTouchAnotherShip() {
        GameFixture game = newGame();

        assertThatThrownBy(() -> service.placeShips(game.mesaId(), game.alpha().token(), touchingFleet()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Los barcos no pueden tocarse");
    }

    @Test
    void startsGameAfterBothClassicFleetsArePlaced() {
        GameFixture game = newGame();

        TableSnapshot afterAlpha = service.placeShips(game.mesaId(), game.alpha().token(), classicFleet());
        assertThat(afterAlpha.estado()).isEqualTo("PLACING_SHIPS");
        assertThat(afterAlpha.privateView().ownShipsPlaced()).isTrue();
        assertThat(afterAlpha.privateView().opponentShipsPlaced()).isFalse();

        TableSnapshot afterBravo = service.placeShips(game.mesaId(), game.bravo().token(), classicFleet());
        assertThat(afterBravo.estado()).isEqualTo("IN_PROGRESS");
        assertThat(afterBravo.ruleset()).isEqualTo("SEA_BATTLE_2_CLASSIC");
        assertThat(afterBravo.fleetSpec()).hasSize(10);
        assertThat(afterBravo.turnDeadlineAt()).isNotNull();
        assertThat(afterBravo.privateView().ownShips()).hasSize(20);
        assertThat(afterBravo.privateView().opponentShipsPlaced()).isTrue();
    }

    @Test
    void hitKeepsTurnMissPassesTurnAndDuplicateShotsAreRejected() {
        GameFixture game = startedGame();
        TableSnapshot table = service.table(game.mesaId(), game.alpha().token());
        PlayerTurn turn = currentTurn(game, table.turnoActualJugadorId());

        ShotResult hit = service.shoot(game.mesaId(), turn.token(), new ShotRequest("A1"));
        assertThat(hit.result()).isEqualTo("HIT");
        assertThat(hit.nextTurnJugadorId()).isEqualTo(turn.jugadorId());

        assertThatThrownBy(() -> service.shoot(game.mesaId(), turn.token(), new ShotRequest("A1")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Esa coordenada ya fue atacada");

        ShotResult miss = service.shoot(game.mesaId(), turn.token(), new ShotRequest("J10"));
        assertThat(miss.result()).isEqualTo("MISS");
        assertThat(miss.nextTurnJugadorId()).isEqualTo(turn.opponentJugadorId());
    }

    @Test
    void sinkingAllShipsWinsAndLocksOutFurtherShots() {
        GameFixture game = startedGame();
        TableSnapshot table = service.table(game.mesaId(), game.alpha().token());
        PlayerTurn turn = currentTurn(game, table.turnoActualJugadorId());

        ShotResult last = null;
        for (String cell : CLASSIC_CELLS) {
            last = service.shoot(game.mesaId(), turn.token(), new ShotRequest(cell));
        }

        assertThat(last).isNotNull();
        assertThat(last.result()).isEqualTo("WIN");
        assertThat(last.winnerId()).isEqualTo(turn.jugadorId());
        assertThat(last.nextTurnJugadorId()).isNull();

        TableSnapshot finished = service.table(game.mesaId(), turn.token());
        assertThat(finished.estado()).isEqualTo("FINISHED");
        assertThat(finished.ganadorId()).isEqualTo(turn.jugadorId());

        assertThatThrownBy(() -> service.shoot(game.mesaId(), turn.token(), new ShotRequest("J10")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("La partida no esta en curso");
    }

    @Test
    void placementTimeoutAutoPlacesMissingFleetsAndStartsGame() {
        GameFixture game = newGame();
        Partida partida = partidaRepository.findById(game.partidaId()).orElseThrow();
        partida.setPlacementDeadlineAt(Instant.now().minusSeconds(1));
        partidaRepository.save(partida);

        service.processDueAutoActions();

        TableSnapshot table = service.table(game.mesaId(), game.alpha().token());
        assertThat(table.estado()).isEqualTo("IN_PROGRESS");
        assertThat(table.privateView().ownShipsPlaced()).isTrue();
        assertThat(table.privateView().opponentShipsPlaced()).isTrue();
        assertThat(table.privateView().ownShips()).hasSize(20);
        assertThat(table.turnDeadlineAt()).isNotNull();
    }

    @Test
    void shotTimeoutCreatesAutomaticShot() {
        GameFixture game = startedGame();
        TableSnapshot table = service.table(game.mesaId(), game.alpha().token());
        Long attackerId = table.turnoActualJugadorId();
        Partida partida = partidaRepository.findById(game.partidaId()).orElseThrow();
        partida.setTurnDeadlineAt(Instant.now().minusSeconds(1));
        partidaRepository.save(partida);

        service.processDueAutoActions();

        List<Disparo> shots = disparoRepository.findByPartidaIdOrderByTimestampAsc(game.partidaId());
        assertThat(shots).hasSize(1);
        assertThat(shots.get(0).isAutomatic()).isTrue();
        assertThat(shots.get(0).getReason()).isEqualTo("SHOT_TIMEOUT");
        assertThat(shots.get(0).getAtacante().getId()).isEqualTo(attackerId);
    }

    @Test
    void ratedRegisteredMatchAppliesBalancedEloOnce() {
        GameFixture game = startedRegisteredGame(1200, 1200, 20, 20);
        TableSnapshot table = service.table(game.mesaId(), game.alpha().token());
        PlayerTurn turn = currentTurn(game, table.turnoActualJugadorId());
        Long winnerUsuarioId = usuarioIdForTurn(game, turn);
        Long loserUsuarioId = opponentUsuarioIdForTurn(game, turn);

        for (String cell : CLASSIC_CELLS) {
            service.shoot(game.mesaId(), turn.token(), new ShotRequest(cell));
        }

        Usuario winner = usuarioRepository.findById(winnerUsuarioId).orElseThrow();
        Usuario loser = usuarioRepository.findById(loserUsuarioId).orElseThrow();
        assertThat(winner.getRating()).isEqualTo(1212);
        assertThat(loser.getRating()).isEqualTo(1188);
        assertThat(winner.getGamesPlayed()).isEqualTo(21);
        assertThat(loser.getGamesPlayed()).isEqualTo(21);
        assertThat(winner.getWins()).isEqualTo(11);
        assertThat(loser.getLosses()).isEqualTo(11);
        assertThat(puntuacionRepository.findAll()).hasSize(2);

        service.table(game.mesaId(), turn.token());
        assertThat(puntuacionRepository.findAll()).hasSize(2);
        assertThat(partidaRepository.findById(game.partidaId()).orElseThrow().isRatingProcessed()).isTrue();
    }

    @Test
    void provisionalUpsetGetsMeaningfulButCappedRatingMove() {
        GameFixture game = startedRegisteredGame(1000, 1400, 0, 30);
        Partida partida = partidaRepository.findById(game.partidaId()).orElseThrow();
        partida.setTurnoActualJugadorId(game.alphaJugadorId());
        partidaRepository.save(partida);

        for (String cell : CLASSIC_CELLS) {
            service.shoot(game.mesaId(), game.alpha().token(), new ShotRequest(cell));
        }

        Usuario alpha = usuarioRepository.findById(game.alpha().usuarioId()).orElseThrow();
        Usuario bravo = usuarioRepository.findById(game.bravo().usuarioId()).orElseThrow();
        assertThat(alpha.getRating()).isEqualTo(1036);
        assertThat(bravo.getRating()).isEqualTo(1364);
    }

    @Test
    void registeredAbandonCountsAsRatedLoss() {
        GameFixture game = startedRegisteredGame(1200, 1200, 20, 20);

        service.resign(game.mesaId(), game.alpha().token());

        Usuario alpha = usuarioRepository.findById(game.alpha().usuarioId()).orElseThrow();
        Usuario bravo = usuarioRepository.findById(game.bravo().usuarioId()).orElseThrow();
        assertThat(alpha.getRating()).isEqualTo(1188);
        assertThat(alpha.getLosses()).isEqualTo(11);
        assertThat(bravo.getRating()).isEqualTo(1212);
        assertThat(bravo.getWins()).isEqualTo(11);
        assertThat(puntuacionRepository.findAll()).hasSize(2);
    }

    @Test
    void guestMatchesRemainUnrated() {
        GameFixture game = startedGame();
        TableSnapshot table = service.table(game.mesaId(), game.alpha().token());
        PlayerTurn turn = currentTurn(game, table.turnoActualJugadorId());

        for (String cell : CLASSIC_CELLS) {
            service.shoot(game.mesaId(), turn.token(), new ShotRequest(cell));
        }

        assertThat(puntuacionRepository.findAll()).isEmpty();
        assertThat(partidaRepository.findById(game.partidaId()).orElseThrow().isRatingProcessed()).isFalse();
    }

    @Test
    void readyTimeoutKicksTheUnreadySeatAndResetsReadyState() {
        SeatedFixture table = newSeatedTable();
        TableSnapshot waiting = service.ready(table.mesaId(), table.alpha().token());
        assertThat(waiting.readyDeadlineAt()).isNotNull();

        Mesa mesa = mesaRepository.findById(table.mesaId()).orElseThrow();
        mesa.setReadyDeadlineAt(Instant.now().minusSeconds(1));
        mesaRepository.save(mesa);

        service.processDueAutoActions();

        TableSnapshot afterTimeout = service.table(table.mesaId(), table.alpha().token());
        assertThat(afterTimeout.estado()).isEqualTo("WAITING_FOR_PLAYERS");
        assertThat(afterTimeout.seatA().occupied()).isTrue();
        assertThat(afterTimeout.seatA().ready()).isFalse();
        assertThat(afterTimeout.seatB().occupied()).isFalse();
        assertThat(afterTimeout.readyDeadlineAt()).isNull();
    }

    @Test
    void secondReadyBeforeDeadlineStartsPlacementAndClearsReadyDeadline() {
        SeatedFixture table = newSeatedTable();
        TableSnapshot waiting = service.ready(table.mesaId(), table.alpha().token());
        assertThat(waiting.readyDeadlineAt()).isNotNull();

        TableSnapshot started = service.ready(table.mesaId(), table.bravo().token());

        assertThat(started.estado()).isEqualTo("PLACING_SHIPS");
        assertThat(started.readyDeadlineAt()).isNull();
        assertThat(started.partidaId()).isNotNull();
    }

    @Test
    void lobbyToleratesPartialActiveTablesFromOlderData() {
        Sala sala = salaRepository.save(new Sala("Sala Legacy", true));
        Mesa mesa = new Mesa();
        mesa.setSala(sala);
        mesa.setNombre("Mesa Parcial");
        mesa.setEstado(EstadoPartida.PLACING_SHIPS);
        mesa = mesaRepository.save(mesa);
        Partida partida = new Partida();
        partida.setSala(sala);
        partida.setMesa(mesa);
        partida.setEstado(EstadoPartida.PLACING_SHIPS);
        partida.setRuleset("SEA_BATTLE_2_CLASSIC");
        partidaRepository.save(partida);

        assertThatCode(() -> service.lobby(null)).doesNotThrowAnyException();
    }

    private GameFixture startedGame() {
        GameFixture game = newGame();
        service.placeShips(game.mesaId(), game.alpha().token(), classicFleet());
        service.placeShips(game.mesaId(), game.bravo().token(), classicFleet());
        return game;
    }

    private GameFixture startedRegisteredGame(int alphaRating, int bravoRating, int alphaGames, int bravoGames) {
        GameFixture game = newRegisteredGame(alphaRating, bravoRating, alphaGames, bravoGames);
        service.placeShips(game.mesaId(), game.alpha().token(), classicFleet());
        service.placeShips(game.mesaId(), game.bravo().token(), classicFleet());
        return game;
    }

    private GameFixture newGame() {
        SeatedFixture seated = newSeatedTable();
        service.ready(seated.mesaId(), seated.alpha().token());
        TableSnapshot ready = service.ready(seated.mesaId(), seated.bravo().token());
        return new GameFixture(
                seated.mesaId(),
                ready.partidaId(),
                seated.alpha(),
                seated.bravo(),
                ready.seatA().jugadorId(),
                ready.seatB().jugadorId());
    }

    private GameFixture newRegisteredGame(int alphaRating, int bravoRating, int alphaGames, int bravoGames) {
        Sala sala = salaRepository.save(new Sala("Sala Rated", true));
        SessionUser alpha = createRegisteredSession("alpha_rated", alphaRating, alphaGames);
        SessionUser bravo = createRegisteredSession("bravo_rated", bravoRating, bravoGames);
        TableSnapshot table = service.createTable(sala.getId(), alpha.token(), "Mesa Rated");
        Long mesaId = table.id();
        service.sit(mesaId, "A", alpha.token());
        service.sit(mesaId, "B", bravo.token());
        service.ready(mesaId, alpha.token());
        TableSnapshot ready = service.ready(mesaId, bravo.token());
        return new GameFixture(
                mesaId,
                ready.partidaId(),
                alpha,
                bravo,
                ready.seatA().jugadorId(),
                ready.seatB().jugadorId());
    }

    private SeatedFixture newSeatedTable() {
        Sala sala = salaRepository.save(new Sala("Sala Test", true));
        SessionUser alpha = service.createGuest("Alpha");
        SessionUser bravo = service.createGuest("Bravo");
        TableSnapshot table = service.createTable(sala.getId(), alpha.token(), "Mesa Test");
        Long mesaId = table.id();
        service.sit(mesaId, "A", alpha.token());
        service.sit(mesaId, "B", bravo.token());
        return new SeatedFixture(mesaId, alpha, bravo);
    }

    private SessionUser createRegisteredSession(String username, int rating, int gamesPlayed) {
        Usuario usuario = new Usuario();
        usuario.setUsername(username);
        usuario.setPasswordHash("test");
        usuario.setRating(rating);
        usuario.setGamesPlayed(gamesPlayed);
        usuario.setWins(gamesPlayed / 2);
        usuario.setLosses(gamesPlayed - usuario.getWins());
        usuario = usuarioRepository.save(usuario);
        return service.createSessionForUser(usuario);
    }

    private PlayerTurn currentTurn(GameFixture game, Long jugadorId) {
        if (jugadorId.equals(game.alphaJugadorId())) {
            return new PlayerTurn(game.alpha().token(), game.alphaJugadorId(), game.bravoJugadorId());
        }
        return new PlayerTurn(game.bravo().token(), game.bravoJugadorId(), game.alphaJugadorId());
    }

    private Long usuarioIdForTurn(GameFixture game, PlayerTurn turn) {
        return turn.token().equals(game.alpha().token()) ? game.alpha().usuarioId() : game.bravo().usuarioId();
    }

    private Long opponentUsuarioIdForTurn(GameFixture game, PlayerTurn turn) {
        return turn.token().equals(game.alpha().token()) ? game.bravo().usuarioId() : game.alpha().usuarioId();
    }

    private ShipPlacementRequest classicFleet() {
        return new ShipPlacementRequest(List.of(
                ship("battleship_1", 4, "H", "A1", "A2", "A3", "A4"),
                ship("cruiser_1", 3, "H", "C1", "C2", "C3"),
                ship("cruiser_2", 3, "H", "C6", "C7", "C8"),
                ship("destroyer_1", 2, "H", "E1", "E2"),
                ship("destroyer_2", 2, "H", "E5", "E6"),
                ship("destroyer_3", 2, "H", "E9", "E10"),
                ship("boat_1", 1, "H", "G1"),
                ship("boat_2", 1, "H", "G3"),
                ship("boat_3", 1, "H", "G5"),
                ship("boat_4", 1, "H", "G7")));
    }

    private ShipPlacementRequest touchingFleet() {
        List<ShipPlacement> ships = new ArrayList<>(classicFleet().ships());
        ships.set(1, ship("cruiser_1", 3, "H", "B1", "B2", "B3"));
        return new ShipPlacementRequest(ships);
    }

    private ShipPlacement ship(String key, int size, String orientation, String... cells) {
        return new ShipPlacement(key, key, size, orientation, List.of(cells));
    }

    private record GameFixture(
            Long mesaId,
            Long partidaId,
            SessionUser alpha,
            SessionUser bravo,
            Long alphaJugadorId,
            Long bravoJugadorId) {
    }

    private record SeatedFixture(Long mesaId, SessionUser alpha, SessionUser bravo) {
    }

    private record PlayerTurn(String token, Long jugadorId, Long opponentJugadorId) {
    }
}
