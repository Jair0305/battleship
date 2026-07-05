package com.jair.battleship.battleshipbackend.services;

import com.jair.battleship.battleshipbackend.models.dto.multiplayer.*;
import com.jair.battleship.battleshipbackend.models.entities.*;
import com.jair.battleship.battleshipbackend.models.enums.EstadoPartida;
import com.jair.battleship.battleshipbackend.models.enums.ResultadoParticipacion;
import com.jair.battleship.battleshipbackend.repositories.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MultiplayerService {

    public static final int BOARD_SIZE = 10;
    private static final int ELO_K = 32;
    private static final String RULESET = "SEA_BATTLE_2_CLASSIC";
    private static final Duration PLACEMENT_LIMIT = Duration.ofSeconds(60);
    private static final Duration TURN_LIMIT = Duration.ofSeconds(30);
    private static final List<FleetShipSpec> FLEET = List.of(
            new FleetShipSpec("battleship_1", "Acorazado", 4),
            new FleetShipSpec("cruiser_1", "Crucero 1", 3),
            new FleetShipSpec("cruiser_2", "Crucero 2", 3),
            new FleetShipSpec("destroyer_1", "Destructor 1", 2),
            new FleetShipSpec("destroyer_2", "Destructor 2", 2),
            new FleetShipSpec("destroyer_3", "Destructor 3", 2),
            new FleetShipSpec("boat_1", "Lancha 1", 1),
            new FleetShipSpec("boat_2", "Lancha 2", 1),
            new FleetShipSpec("boat_3", "Lancha 3", 1),
            new FleetShipSpec("boat_4", "Lancha 4", 1));
    private static final Map<String, FleetShipSpec> FLEET_BY_KEY = FLEET.stream()
            .collect(Collectors.toMap(FleetShipSpec::key, spec -> spec, (a, b) -> a, LinkedHashMap::new));
    private static final int FLEET_CELLS = FLEET.stream().mapToInt(FleetShipSpec::size).sum();
    private static final List<EstadoPartida> ACTIVE_STATES = List.of(
            EstadoPartida.PLACING_SHIPS,
            EstadoPartida.READY_TO_START,
            EstadoPartida.IN_PROGRESS);

    @Autowired
    private SesionJugadorRepository sesionRepository;
    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private SalaRepository salaRepository;
    @Autowired
    private MesaRepository mesaRepository;
    @Autowired
    private JugadorRepository jugadorRepository;
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
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void cancelLegacyActiveMatches() {
        Instant now = Instant.now();
        for (Partida partida : partidaRepository.findByEstadoIn(ACTIVE_STATES)) {
            if (RULESET.equals(partida.getRuleset())) {
                continue;
            }
            partida.setEstado(EstadoPartida.CANCELLED);
            partida.setFin(now);
            partida.setTurnDeadlineAt(null);
            partida.setPlacementDeadlineAt(null);
            partidaRepository.save(partida);
            Mesa mesa = partida.getMesa();
            if (mesa != null) {
                mesa.setSeatA(null);
                mesa.setSeatB(null);
                mesa.setReadyA(false);
                mesa.setReadyB(false);
                mesa.setRematchA(false);
                mesa.setRematchB(false);
                mesa.setEstado(EstadoPartida.WAITING_FOR_PLAYERS);
                mesaRepository.save(mesa);
                broadcastRoomAndTable(mesa);
            }
        }
    }

    @Scheduled(fixedDelay = 1000)
    @Transactional
    public void processDueAutoActions() {
        resolveDueTimeoutsForAllActive();
    }

    @Transactional
    public SessionUser createGuest(String requestedName) {
        String name = sanitizeName(requestedName);
        if (name == null || name.isBlank()) {
            name = "Guest " + (1000 + new Random().nextInt(9000));
        }
        SesionJugador session = new SesionJugador();
        session.setToken(UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().substring(0, 8));
        session.setDisplayName(name);
        session.setGuest(true);
        session = sesionRepository.save(session);
        broadcastLobby();
        return toSessionUser(session);
    }

    @Transactional
    public SessionUser createSessionForUser(Usuario usuario) {
        SesionJugador session = new SesionJugador();
        session.setToken(UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().substring(0, 8));
        session.setDisplayName(usuario.getUsername());
        session.setGuest(false);
        session.setUsuario(usuario);
        session = sesionRepository.save(session);
        broadcastLobby();
        return toSessionUser(session);
    }

    @Transactional
    public SessionUser currentSession(String token) {
        return toSessionUser(requireSession(token));
    }

    @Transactional
    public LobbySnapshot lobby(String token) {
        if (token != null && !token.isBlank()) {
            requireSession(token);
        }
        resolveDueTimeoutsForAllActive();
        ensureDefaultTables();
        List<RoomSnapshot> rooms = salaRepository.findAll().stream()
                .sorted(Comparator.comparing(Sala::getId))
                .map(sala -> roomSnapshot(sala, null))
                .toList();
        List<SessionUser> online = sesionRepository.findAll().stream()
                .sorted(Comparator.comparing(SesionJugador::getLastSeenAt).reversed())
                .limit(50)
                .map(this::toSessionUser)
                .toList();
        return new LobbySnapshot(rooms, online);
    }

    @Transactional
    public RoomSnapshot room(Long salaId, String token) {
        if (token != null && !token.isBlank()) {
            requireSession(token);
        }
        resolveDueTimeoutsForAllActive();
        Sala sala = salaRepository.findById(salaId).orElseThrow(() -> notFound("Sala no encontrada"));
        ensureTableForRoom(sala);
        return roomSnapshot(sala, token);
    }

    @Transactional
    public TableSnapshot createTable(Long salaId, String token, String requestedName) {
        SesionJugador session = requireSession(token);
        Sala sala = salaRepository.findById(salaId).orElseThrow(() -> notFound("Sala no encontrada"));
        Mesa mesa = new Mesa();
        mesa.setSala(sala);
        mesa.setNombre(sanitizeTableName(requestedName, "Mesa " + (mesaRepository.findBySalaIdOrderByIdAsc(salaId).size() + 1)));
        mesa.setEstado(EstadoPartida.WAITING_FOR_PLAYERS);
        mesa.getSpectatorSessionIds().add(session.getId());
        mesa = mesaRepository.save(mesa);
        broadcastRoomAndTable(mesa);
        return tableSnapshot(mesa, token);
    }

    @Transactional
    public TableSnapshot table(Long mesaId, String token) {
        if (token != null && !token.isBlank()) {
            requireSession(token);
        }
        Mesa mesa = lockMesa(mesaId);
        resolveDueTimeouts(mesa);
        syncMesaState(mesa);
        mesa = mesaRepository.save(mesa);
        return tableSnapshot(mesa, token);
    }

    @Transactional
    public TableSnapshot joinTable(Long mesaId, String token) {
        SesionJugador session = requireSession(token);
        Mesa mesa = lockMesa(mesaId);
        resolveDueTimeouts(mesa);
        mesa.getSpectatorSessionIds().add(session.getId());
        syncMesaState(mesa);
        mesa = mesaRepository.save(mesa);
        broadcastRoomAndTable(mesa);
        return tableSnapshot(mesa, token);
    }

    @Transactional
    public TableSnapshot leaveTable(Long mesaId, String token) {
        SesionJugador session = requireSession(token);
        Mesa mesa = lockMesa(mesaId);
        if (isSeat(mesa.getSeatA(), session)) {
            if (requiresForfeit(mesa)) {
                resignLocked(mesa, session, false);
            } else {
                mesa.setSeatA(null);
                mesa.setReadyA(false);
            }
        }
        if (isSeat(mesa.getSeatB(), session)) {
            if (requiresForfeit(mesa)) {
                resignLocked(mesa, session, false);
            } else {
                mesa.setSeatB(null);
                mesa.setReadyB(false);
            }
        }
        mesa.getSpectatorSessionIds().remove(session.getId());
        syncMesaState(mesa);
        mesa = mesaRepository.save(mesa);
        broadcastRoomAndTable(mesa);
        return tableSnapshot(mesa, token);
    }

    @Transactional
    public TableSnapshot sit(Long mesaId, String seat, String token) {
        SesionJugador session = requireSession(token);
        Mesa mesa = lockMesa(mesaId);
        resolveDueTimeouts(mesa);
        if (currentPartida(mesa).filter(p -> p.getEstado() == EstadoPartida.IN_PROGRESS
                || p.getEstado() == EstadoPartida.PLACING_SHIPS
                || p.getEstado() == EstadoPartida.READY_TO_START).isPresent()) {
            throw conflict("No puedes sentarte mientras la partida esta activa");
        }
        if (isSeat(mesa.getSeatA(), session) || isSeat(mesa.getSeatB(), session)) {
            throw conflict("Ya estas sentado en esta mesa");
        }
        Jugador jugador = getOrCreateJugador(session, mesa.getSala());
        String normalized = normalizeSeat(seat);
        if ("A".equals(normalized)) {
            if (mesa.getSeatA() != null) {
                throw conflict("El asiento A esta ocupado");
            }
            mesa.setSeatA(jugador);
            mesa.setReadyA(false);
        } else {
            if (mesa.getSeatB() != null) {
                throw conflict("El asiento B esta ocupado");
            }
            mesa.setSeatB(jugador);
            mesa.setReadyB(false);
        }
        mesa.getSpectatorSessionIds().add(session.getId());
        syncMesaState(mesa);
        mesa = mesaRepository.save(mesa);
        broadcastRoomAndTable(mesa);
        return tableSnapshot(mesa, token);
    }

    @Transactional
    public TableSnapshot stand(Long mesaId, String token) {
        SesionJugador session = requireSession(token);
        Mesa mesa = lockMesa(mesaId);
        resolveDueTimeouts(mesa);
        if (requiresForfeit(mesa)) {
            resignLocked(mesa, session, true);
        } else if (isSeat(mesa.getSeatA(), session)) {
            mesa.setSeatA(null);
            mesa.setReadyA(false);
        } else if (isSeat(mesa.getSeatB(), session)) {
            mesa.setSeatB(null);
            mesa.setReadyB(false);
        } else {
            throw forbidden("Solo un jugador sentado puede liberar su asiento");
        }
        syncMesaState(mesa);
        mesa = mesaRepository.save(mesa);
        broadcastRoomAndTable(mesa);
        return tableSnapshot(mesa, token);
    }

    @Transactional
    public TableSnapshot ready(Long mesaId, String token) {
        SesionJugador session = requireSession(token);
        Mesa mesa = lockMesa(mesaId);
        resolveDueTimeouts(mesa);
        if (mesa.getSeatA() == null || mesa.getSeatB() == null) {
            throw conflict("Se necesitan dos jugadores sentados");
        }
        if (currentPartida(mesa).filter(p -> p.getEstado() == EstadoPartida.IN_PROGRESS
                || p.getEstado() == EstadoPartida.PLACING_SHIPS
                || p.getEstado() == EstadoPartida.READY_TO_START).isPresent()) {
            throw conflict("La partida ya esta en preparacion o en curso");
        }
        if (isSeat(mesa.getSeatA(), session)) {
            mesa.setReadyA(true);
        } else if (isSeat(mesa.getSeatB(), session)) {
            mesa.setReadyB(true);
        } else {
            throw forbidden("Solo jugadores sentados pueden marcarse listos");
        }
        if (mesa.isReadyA() && mesa.isReadyB()) {
            Partida partida = createMatchForMesa(mesa);
            mesa.setEstado(partida.getEstado());
        } else {
            mesa.setEstado(EstadoPartida.PLAYERS_SEATED);
        }
        mesa = mesaRepository.save(mesa);
        broadcastRoomAndTable(mesa);
        return tableSnapshot(mesa, token);
    }

    @Transactional
    public TableSnapshot placeShips(Long mesaId, String token, ShipPlacementRequest request) {
        SesionJugador session = requireSession(token);
        Mesa mesa = lockMesa(mesaId);
        resolveDueTimeouts(mesa);
        Partida partida = currentPartida(mesa).orElseThrow(() -> conflict("No hay partida en preparacion"));
        if (partida.getEstado() != EstadoPartida.PLACING_SHIPS && partida.getEstado() != EstadoPartida.READY_TO_START) {
            throw conflict("No se pueden colocar barcos en el estado actual");
        }
        Jugador jugador = seatedJugador(mesa, session);
        if (boardPlaced(partida, jugador)) {
            throw conflict("Tu flota ya fue colocada");
        }
        BoardBuild board = validateFleet(request);
        Tablero tablero = tableroRepository.findByJugadorIdAndPartidaId(jugador.getId(), partida.getId())
                .orElseGet(() -> {
                    Tablero t = new Tablero();
                    t.setPartida(partida);
                    t.setJugador(jugador);
                    return t;
                });
        tablero.setPosicionesBarcos(board.positions());
        tablero.setBarcosPorCelda(board.shipsByCell());
        tablero.setPosicionesAtacadas(new HashMap<>());
        tableroRepository.save(tablero);

        boolean bothPlaced = boardPlaced(partida, mesa.getSeatA()) && boardPlaced(partida, mesa.getSeatB());
        if (bothPlaced) {
            startInProgress(partida, mesa);
        } else {
            partida.setEstado(EstadoPartida.PLACING_SHIPS);
        }
        partidaRepository.save(partida);
        mesa.setEstado(partida.getEstado());
        mesa = mesaRepository.save(mesa);
        broadcastRoomAndTable(mesa);
        return tableSnapshot(mesa, token);
    }

    @Transactional
    public ShotResult shoot(Long mesaId, String token, ShotRequest request) {
        SesionJugador session = requireSession(token);
        Mesa mesa = lockMesa(mesaId);
        resolveDueTimeouts(mesa);
        Partida partida = currentPartida(mesa).orElseThrow(() -> conflict("No hay partida activa"));
        if (partida.getEstado() != EstadoPartida.IN_PROGRESS) {
            throw conflict("La partida no esta en curso");
        }
        Jugador atacante = seatedJugador(mesa, session);
        if (!Objects.equals(partida.getTurnoActualJugadorId(), atacante.getId())) {
            throw conflict("No es tu turno");
        }
        String position = normalizePosition(request == null ? null : request.position());
        return applyShot(mesa, partida, atacante, position, false, "MANUAL");
    }

    private ShotResult applyShot(Mesa mesa, Partida partida, Jugador atacante, String position, boolean automatic,
            String reason) {
        Jugador defensor = opponent(mesa, atacante);
        Tablero tableroDefensor = tableroRepository.findByJugadorIdAndPartidaId(defensor.getId(), partida.getId())
                .orElseThrow(() -> conflict("El oponente aun no ha colocado sus barcos"));
        if (tableroDefensor.getPosicionesAtacadas().containsKey(position)) {
            throw conflict("Esa coordenada ya fue atacada");
        }

        boolean hit = Boolean.TRUE.equals(tableroDefensor.getPosicionesBarcos().get(position));
        tableroDefensor.getPosicionesAtacadas().put(position, hit);
        String result = hit ? "HIT" : "MISS";
        String sunkShip = null;
        if (hit) {
            sunkShip = sunkShipAt(tableroDefensor, position);
            if (sunkShip != null) {
                result = "SUNK";
            }
        }
        boolean win = allShipsHit(tableroDefensor);
        if (win) {
            result = "WIN";
        }
        tableroRepository.save(tableroDefensor);

        Disparo disparo = new Disparo();
        disparo.setPartida(partida);
        disparo.setAtacante(atacante);
        disparo.setDefensor(defensor);
        disparo.setPosicion(position);
        disparo.setAcierto(hit);
        disparo.setResultado(result);
        disparo.setBarcoHundido(sunkShip);
        disparo.setAutomatic(automatic);
        disparo.setReason(reason);
        disparo.setTimestamp(Instant.now());
        disparoRepository.save(disparo);

        Long winnerId = null;
        if (win) {
            partida.setTurnDeadlineAt(null);
            partida.setTurnoActualJugadorId(null);
            finishMatch(partida, atacante, defensor, false);
            mesa.setEstado(EstadoPartida.FINISHED);
            winnerId = atacante.getId();
        } else {
            partida.setTurnoActualJugadorId(hit ? atacante.getId() : defensor.getId());
            partida.setTurnDeadlineAt(Instant.now().plus(TURN_LIMIT));
            partidaRepository.save(partida);
        }
        if (automatic) {
            partida.setLastAutoActionAt(Instant.now());
            partidaRepository.save(partida);
        }
        mesaRepository.save(mesa);
        broadcastRoomAndTable(mesa);
        return new ShotResult(mesa.getId(), partida.getId(), atacante.getId(), defensor.getId(), position, result, hit,
                sunkShip, automatic, reason, winnerId, partida.getTurnoActualJugadorId());
    }

    private void resolveDueTimeoutsForAllActive() {
        Set<Long> mesaIds = partidaRepository.findByEstadoIn(ACTIVE_STATES).stream()
                .map(Partida::getMesa)
                .filter(Objects::nonNull)
                .map(Mesa::getId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        for (Long mesaId : mesaIds) {
            mesaRepository.findByIdForUpdate(mesaId).ifPresent(this::resolveDueTimeouts);
        }
    }

    private boolean resolveDueTimeouts(Mesa mesa) {
        Partida partida = currentPartida(mesa).orElse(null);
        if (partida == null || !ACTIVE_STATES.contains(partida.getEstado())) {
            return false;
        }
        if (!RULESET.equals(partida.getRuleset())) {
            partida.setEstado(EstadoPartida.CANCELLED);
            partida.setFin(Instant.now());
            partidaRepository.save(partida);
            mesa.setSeatA(null);
            mesa.setSeatB(null);
            mesa.setReadyA(false);
            mesa.setReadyB(false);
            mesa.setEstado(EstadoPartida.WAITING_FOR_PLAYERS);
            mesaRepository.save(mesa);
            broadcastRoomAndTable(mesa);
            return true;
        }

        Instant now = Instant.now();
        if ((partida.getEstado() == EstadoPartida.PLACING_SHIPS || partida.getEstado() == EstadoPartida.READY_TO_START)
                && partida.getPlacementDeadlineAt() == null) {
            partida.setPlacementDeadlineAt(now.plus(PLACEMENT_LIMIT));
            partidaRepository.save(partida);
            return true;
        }
        if (partida.getEstado() == EstadoPartida.IN_PROGRESS && partida.getTurnDeadlineAt() == null) {
            partida.setTurnDeadlineAt(now.plus(TURN_LIMIT));
            partidaRepository.save(partida);
            return true;
        }

        if ((partida.getEstado() == EstadoPartida.PLACING_SHIPS || partida.getEstado() == EstadoPartida.READY_TO_START)
                && partida.getPlacementDeadlineAt() != null
                && !now.isBefore(partida.getPlacementDeadlineAt())) {
            boolean changed = false;
            if (mesa.getSeatA() != null && !boardPlaced(partida, mesa.getSeatA())) {
                autoPlaceFleet(partida, mesa.getSeatA());
                changed = true;
            }
            if (mesa.getSeatB() != null && !boardPlaced(partida, mesa.getSeatB())) {
                autoPlaceFleet(partida, mesa.getSeatB());
                changed = true;
            }
            if (boardPlaced(partida, mesa.getSeatA()) && boardPlaced(partida, mesa.getSeatB())) {
                startInProgress(partida, mesa);
                changed = true;
            }
            if (changed) {
                partida.setLastAutoActionAt(now);
                partidaRepository.save(partida);
                mesaRepository.save(mesa);
                broadcastRoomAndTable(mesa);
            }
            return changed;
        }

        if (partida.getEstado() == EstadoPartida.IN_PROGRESS
                && partida.getTurnDeadlineAt() != null
                && !now.isBefore(partida.getTurnDeadlineAt())) {
            Jugador atacante = playerById(mesa, partida.getTurnoActualJugadorId());
            if (atacante == null) {
                return false;
            }
            String position = randomUnattackedPosition(partida, opponent(mesa, atacante));
            if (position == null) {
                return false;
            }
            applyShot(mesa, partida, atacante, position, true, "SHOT_TIMEOUT");
            return true;
        }
        return false;
    }

    private void startInProgress(Partida partida, Mesa mesa) {
        partida.setEstado(EstadoPartida.IN_PROGRESS);
        partida.setInicio(partida.getInicio() == null ? Instant.now() : partida.getInicio());
        if (partida.getTurnoActualJugadorId() == null) {
            partida.setTurnoActualJugadorId(new Random().nextBoolean() ? mesa.getSeatA().getId() : mesa.getSeatB().getId());
        }
        partida.setTurnDeadlineAt(Instant.now().plus(TURN_LIMIT));
        mesa.setEstado(EstadoPartida.IN_PROGRESS);
    }

    private Jugador playerById(Mesa mesa, Long jugadorId) {
        if (jugadorId == null) {
            return null;
        }
        if (mesa.getSeatA() != null && Objects.equals(mesa.getSeatA().getId(), jugadorId)) {
            return mesa.getSeatA();
        }
        if (mesa.getSeatB() != null && Objects.equals(mesa.getSeatB().getId(), jugadorId)) {
            return mesa.getSeatB();
        }
        return null;
    }

    private String randomUnattackedPosition(Partida partida, Jugador defender) {
        Tablero tablero = tableroRepository.findByJugadorIdAndPartidaId(defender.getId(), partida.getId())
                .orElse(null);
        if (tablero == null) {
            return null;
        }
        Set<String> attacked = tablero.getPosicionesAtacadas() == null ? Set.of() : tablero.getPosicionesAtacadas().keySet();
        List<String> candidates = allCells().stream()
                .filter(cell -> !attacked.contains(cell))
                .toList();
        if (candidates.isEmpty()) {
            return null;
        }
        return candidates.get(new Random().nextInt(candidates.size()));
    }

    private List<String> allCells() {
        List<String> cells = new ArrayList<>(BOARD_SIZE * BOARD_SIZE);
        for (int row = 0; row < BOARD_SIZE; row++) {
            for (int col = 1; col <= BOARD_SIZE; col++) {
                cells.add(String.valueOf((char) ('A' + row)) + col);
            }
        }
        return cells;
    }

    private void autoPlaceFleet(Partida partida, Jugador jugador) {
        if (jugador == null || boardPlaced(partida, jugador)) {
            return;
        }
        BoardBuild board = randomFleetBuild();
        Tablero tablero = tableroRepository.findByJugadorIdAndPartidaId(jugador.getId(), partida.getId())
                .orElseGet(() -> {
                    Tablero t = new Tablero();
                    t.setPartida(partida);
                    t.setJugador(jugador);
                    return t;
                });
        tablero.setPosicionesBarcos(board.positions());
        tablero.setBarcosPorCelda(board.shipsByCell());
        tablero.setPosicionesAtacadas(new HashMap<>());
        tableroRepository.save(tablero);
    }

    private BoardBuild randomFleetBuild() {
        Random random = new Random();
        for (int restart = 0; restart < 200; restart++) {
            Map<String, Boolean> positions = new HashMap<>();
            Map<String, String> shipsByCell = new HashMap<>();
            boolean failed = false;
            for (FleetShipSpec ship : FLEET) {
                boolean placed = false;
                for (int attempt = 0; attempt < 300 && !placed; attempt++) {
                    boolean vertical = random.nextBoolean();
                    int rowLimit = vertical ? BOARD_SIZE - ship.size() : BOARD_SIZE - 1;
                    int colLimit = vertical ? BOARD_SIZE - 1 : BOARD_SIZE - ship.size();
                    int row = random.nextInt(rowLimit + 1);
                    int col = random.nextInt(colLimit + 1);
                    List<String> cells = new ArrayList<>();
                    for (int i = 0; i < ship.size(); i++) {
                        int nextRow = vertical ? row + i : row;
                        int nextCol = vertical ? col : col + i;
                        cells.add(String.valueOf((char) ('A' + nextRow)) + (nextCol + 1));
                    }
                    if (canPlaceRandomShip(cells, shipsByCell)) {
                        for (String cell : cells) {
                            positions.put(cell, true);
                            shipsByCell.put(cell, ship.key());
                        }
                        placed = true;
                    }
                }
                if (!placed) {
                    failed = true;
                    break;
                }
            }
            if (!failed) {
                return new BoardBuild(positions, shipsByCell);
            }
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo generar flota automatica");
    }

    private boolean canPlaceRandomShip(List<String> cells, Map<String, String> shipsByCell) {
        for (String cell : cells) {
            if (shipsByCell.containsKey(cell)) {
                return false;
            }
            Cell parsed = parseCell(cell);
            for (int row = parsed.row() - 1; row <= parsed.row() + 1; row++) {
                for (int col = parsed.col() - 1; col <= parsed.col() + 1; col++) {
                    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
                        continue;
                    }
                    String neighbor = String.valueOf((char) ('A' + row)) + (col + 1);
                    if (shipsByCell.containsKey(neighbor)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    @Transactional
    public TableSnapshot resign(Long mesaId, String token) {
        SesionJugador session = requireSession(token);
        Mesa mesa = lockMesa(mesaId);
        resolveDueTimeouts(mesa);
        resignLocked(mesa, session, true);
        mesa = mesaRepository.save(mesa);
        broadcastRoomAndTable(mesa);
        return tableSnapshot(mesa, token);
    }

    @Transactional
    public TableSnapshot rematch(Long mesaId, String token) {
        SesionJugador session = requireSession(token);
        Mesa mesa = lockMesa(mesaId);
        resolveDueTimeouts(mesa);
        Partida current = currentPartida(mesa).orElseThrow(() -> conflict("No hay partida para revancha"));
        if (current.getEstado() != EstadoPartida.FINISHED && current.getEstado() != EstadoPartida.ABANDONED) {
            throw conflict("La revancha solo esta disponible al terminar");
        }
        if (isSeat(mesa.getSeatA(), session)) {
            mesa.setRematchA(true);
        } else if (isSeat(mesa.getSeatB(), session)) {
            mesa.setRematchB(true);
        } else {
            throw forbidden("Solo jugadores sentados pueden pedir revancha");
        }
        if (mesa.isRematchA() && mesa.isRematchB()) {
            mesa.setRematchA(false);
            mesa.setRematchB(false);
            mesa.setReadyA(true);
            mesa.setReadyB(true);
            Partida partida = createMatchForMesa(mesa);
            mesa.setEstado(partida.getEstado());
        }
        mesa = mesaRepository.save(mesa);
        broadcastRoomAndTable(mesa);
        return tableSnapshot(mesa, token);
    }

    @Transactional
    public ChatMessageDto chat(Long mesaId, String token, ChatMessageDto request) {
        SesionJugador session = requireSession(token);
        Mesa mesa = mesaRepository.findById(mesaId).orElseThrow(() -> notFound("Mesa no encontrada"));
        String content = request == null ? "" : Optional.ofNullable(request.content()).orElse("");
        content = content.replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", "").trim();
        if (content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El mensaje esta vacio");
        }
        if (content.length() > 500) {
            content = content.substring(0, 500);
        }
        ChatMessageDto message = new ChatMessageDto(session.getDisplayName(), content, "CHAT", Instant.now());
        messagingTemplate.convertAndSend("/topic/mesas/" + mesa.getId() + "/chat", message);
        return message;
    }

    private void ensureDefaultTables() {
        for (Sala sala : salaRepository.findAll()) {
            ensureTableForRoom(sala);
        }
    }

    private void ensureTableForRoom(Sala sala) {
        if (mesaRepository.findBySalaIdOrderByIdAsc(sala.getId()).isEmpty()) {
            Mesa mesa = new Mesa();
            mesa.setSala(sala);
            mesa.setNombre("Mesa 1");
            mesa.setEstado(EstadoPartida.WAITING_FOR_PLAYERS);
            mesaRepository.save(mesa);
        }
    }

    private RoomSnapshot roomSnapshot(Sala sala, String token) {
        List<Mesa> mesas = mesaRepository.findBySalaIdOrderByIdAsc(sala.getId());
        List<TableSnapshot> mesaDtos = mesas.stream()
                .map(m -> tableSnapshot(m, token))
                .toList();
        int players = mesaDtos.stream()
                .mapToInt(t -> (t.seatA().occupied() ? 1 : 0) + (t.seatB().occupied() ? 1 : 0))
                .sum();
        int spectators = mesaDtos.stream().mapToInt(TableSnapshot::spectators).sum();
        return new RoomSnapshot(sala.getId(), sala.getNombre(), true, players, spectators, mesaDtos);
    }

    private TableSnapshot tableSnapshot(Mesa mesa, String token) {
        Optional<Partida> partida = currentPartida(mesa);
        SeatSnapshot seatA = seatSnapshot("A", mesa.getSeatA(), mesa.isReadyA());
        SeatSnapshot seatB = seatSnapshot("B", mesa.getSeatB(), mesa.isReadyB());
        SesionJugador session = findSessionOrNull(token);
        String mySeat = null;
        if (isSeat(mesa.getSeatA(), session)) {
            mySeat = "A";
        } else if (isSeat(mesa.getSeatB(), session)) {
            mySeat = "B";
        }
        Long partidaId = partida.map(Partida::getId).orElse(null);
        Long turno = partida.map(Partida::getTurnoActualJugadorId).orElse(null);
        Long ganador = partida.map(p -> p.getGanador() == null ? null : p.getGanador().getId()).orElse(null);
        PrivateMatchView privateView = null;
        SpectatorMatchView spectatorView = null;
        if (partida.isPresent()) {
            if (session != null && mySeat != null) {
                privateView = privateView(partida.get(), mesa, session);
            } else {
                spectatorView = spectatorView(partida.get(), mesa);
            }
        }
        return new TableSnapshot(
                mesa.getId(),
                mesa.getSala() == null ? null : mesa.getSala().getId(),
                mesa.getSala() == null ? null : mesa.getSala().getNombre(),
                mesa.getNombre(),
                mesa.getEstado().name(),
                Instant.now(),
                partida.map(Partida::getPlacementDeadlineAt).orElse(null),
                partida.map(Partida::getTurnDeadlineAt).orElse(null),
                partida.map(Partida::getRuleset).orElse(RULESET),
                FLEET,
                seatA,
                seatB,
                mySeat,
                mesa.getSpectatorSessionIds() == null ? 0 : mesa.getSpectatorSessionIds().size(),
                partidaId,
                turno,
                ganador,
                mesa.isRematchA(),
                mesa.isRematchB(),
                privateView,
                spectatorView);
    }

    private PrivateMatchView privateView(Partida partida, Mesa mesa, SesionJugador session) {
        Jugador me = isSeat(mesa.getSeatA(), session) ? mesa.getSeatA() : mesa.getSeatB();
        Jugador op = opponent(mesa, me);
        Optional<Tablero> ownBoard = tableroRepository.findByJugadorIdAndPartidaId(me.getId(), partida.getId());
        Optional<Tablero> opBoard = tableroRepository.findByJugadorIdAndPartidaId(op.getId(), partida.getId());
        Map<Long, Map<String, String>> revealed = shouldReveal(partida)
                ? revealedShips(List.of(mesa.getSeatA(), mesa.getSeatB()), partida)
                : Map.of();
        return new PrivateMatchView(
                "PLAYER",
                Objects.equals(mesa.getSeatA().getId(), me.getId()) ? "A" : "B",
                me.getId(),
                ownBoard.map(t -> new HashMap<>(t.getBarcosPorCelda())).orElseGet(HashMap::new),
                ownBoard.map(this::shotStatusForBoard).orElseGet(HashMap::new),
                opBoard.map(this::shotStatusForBoard).orElseGet(HashMap::new),
                ownBoard.map(this::hasFleet).orElse(false),
                opBoard.map(this::hasFleet).orElse(false),
                revealed,
                history(partida.getId()));
    }

    private SpectatorMatchView spectatorView(Partida partida, Mesa mesa) {
        Map<Long, String> players = new LinkedHashMap<>();
        if (mesa.getSeatA() != null) {
            players.put(mesa.getSeatA().getId(), mesa.getSeatA().getNombre());
        }
        if (mesa.getSeatB() != null) {
            players.put(mesa.getSeatB().getId(), mesa.getSeatB().getNombre());
        }
        Map<Long, Map<String, String>> publicShots = new LinkedHashMap<>();
        for (Jugador jugador : List.of(mesa.getSeatA(), mesa.getSeatB())) {
            if (jugador == null) {
                continue;
            }
            tableroRepository.findByJugadorIdAndPartidaId(jugador.getId(), partida.getId())
                    .ifPresent(tablero -> publicShots.put(jugador.getId(), shotStatusForBoard(tablero)));
        }
        Map<Long, Map<String, String>> revealed = shouldReveal(partida)
                ? revealedShips(List.of(mesa.getSeatA(), mesa.getSeatB()), partida)
                : Map.of();
        return new SpectatorMatchView(players, publicShots, revealed, history(partida.getId()));
    }

    private SeatSnapshot seatSnapshot(String seat, Jugador jugador, boolean ready) {
        if (jugador == null) {
            return new SeatSnapshot(seat, null, null, true, null, false, false);
        }
        Usuario usuario = jugador.getUsuario();
        return new SeatSnapshot(seat, jugador.getId(), jugador.getNombre(), jugador.isInvitado(),
                usuario == null ? null : usuario.getRating(), ready, true);
    }

    private List<ShotSnapshot> history(Long partidaId) {
        return disparoRepository.findByPartidaIdOrderByTimestampAsc(partidaId).stream()
                .map(d -> new ShotSnapshot(
                        d.getAtacante().getId(),
                        d.getDefensor().getId(),
                        d.getPosicion(),
                        d.isAcierto(),
                        d.getResultado(),
                        d.getBarcoHundido(),
                        d.isAutomatic(),
                        d.getReason(),
                        d.getTimestamp()))
                .toList();
    }

    private Map<Long, Map<String, String>> revealedShips(List<Jugador> jugadores, Partida partida) {
        Map<Long, Map<String, String>> result = new LinkedHashMap<>();
        for (Jugador jugador : jugadores) {
            if (jugador == null) {
                continue;
            }
            tableroRepository.findByJugadorIdAndPartidaId(jugador.getId(), partida.getId())
                    .ifPresent(t -> result.put(jugador.getId(), new HashMap<>(t.getBarcosPorCelda())));
        }
        return result;
    }

    private Map<String, String> shotStatusForBoard(Tablero tablero) {
        Map<String, String> result = new HashMap<>();
        Map<String, Boolean> attacked = tablero.getPosicionesAtacadas() == null ? Map.of() : tablero.getPosicionesAtacadas();
        for (Map.Entry<String, Boolean> entry : attacked.entrySet()) {
            if (Boolean.TRUE.equals(entry.getValue())) {
                String ship = tablero.getBarcosPorCelda() == null ? null : tablero.getBarcosPorCelda().get(entry.getKey());
                result.put(entry.getKey(), ship != null && isShipSunk(tablero, ship) ? "SUNK" : "HIT");
            } else {
                result.put(entry.getKey(), "MISS");
            }
        }
        return result;
    }

    private BoardBuild validateFleet(ShipPlacementRequest request) {
        if (request == null || request.ships() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Debes enviar la flota completa");
        }
        Map<String, ShipPlacement> byKey = request.ships().stream()
                .collect(Collectors.toMap(s -> normalizeShipKey(s.key()), ship -> ship, (a, b) -> {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Barco duplicado: " + a.key());
                }, LinkedHashMap::new));
        if (!byKey.keySet().equals(FLEET_BY_KEY.keySet())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La flota debe contener los 10 barcos clasicos");
        }
        Map<String, Boolean> positions = new HashMap<>();
        Map<String, String> shipsByCell = new HashMap<>();
        for (FleetShipSpec required : FLEET) {
            ShipPlacement ship = byKey.get(required.key());
            List<String> cells = ship.cells() == null ? List.of() : ship.cells().stream()
                    .map(this::normalizePosition)
                    .toList();
            if (ship.size() != required.size() || cells.size() != required.size()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tamano incorrecto para " + required.key());
            }
            validateLine(required.key(), cells);
            for (String cell : cells) {
                if (positions.containsKey(cell)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Los barcos no pueden superponerse");
                }
                positions.put(cell, true);
                shipsByCell.put(cell, required.key());
            }
        }
        validateNoAdjacentShips(shipsByCell);
        return new BoardBuild(positions, shipsByCell);
    }

    private void validateNoAdjacentShips(Map<String, String> shipsByCell) {
        List<Map.Entry<String, String>> entries = new ArrayList<>(shipsByCell.entrySet());
        for (int i = 0; i < entries.size(); i++) {
            Cell a = parseCell(entries.get(i).getKey());
            for (int j = i + 1; j < entries.size(); j++) {
                if (entries.get(i).getValue().equals(entries.get(j).getValue())) {
                    continue;
                }
                Cell b = parseCell(entries.get(j).getKey());
                if (Math.abs(a.row() - b.row()) <= 1 && Math.abs(a.col() - b.col()) <= 1) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Los barcos no pueden tocarse");
                }
            }
        }
    }

    private void validateLine(String shipKey, List<String> cells) {
        List<Cell> parsed = cells.stream().map(this::parseCell).toList();
        boolean sameRow = parsed.stream().allMatch(c -> c.row() == parsed.get(0).row());
        boolean sameCol = parsed.stream().allMatch(c -> c.col() == parsed.get(0).col());
        if (!sameRow && !sameCol) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, shipKey + " debe estar horizontal o vertical");
        }
        List<Integer> axis = parsed.stream().map(sameRow ? Cell::col : Cell::row).sorted().toList();
        for (int i = 1; i < axis.size(); i++) {
            if (axis.get(i) != axis.get(i - 1) + 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, shipKey + " debe ocupar celdas contiguas");
            }
        }
    }

    private String sunkShipAt(Tablero tablero, String position) {
        if (tablero.getBarcosPorCelda() == null) {
            return null;
        }
        String ship = tablero.getBarcosPorCelda().get(position);
        if (ship == null) {
            return null;
        }
        return isShipSunk(tablero, ship) ? ship : null;
    }

    private boolean isShipSunk(Tablero tablero, String ship) {
        Map<String, String> ships = tablero.getBarcosPorCelda() == null ? Map.of() : tablero.getBarcosPorCelda();
        Map<String, Boolean> attacked = tablero.getPosicionesAtacadas() == null ? Map.of() : tablero.getPosicionesAtacadas();
        return ships.entrySet().stream()
                .filter(e -> ship.equals(e.getValue()))
                .allMatch(e -> Boolean.TRUE.equals(attacked.get(e.getKey())));
    }

    private boolean allShipsHit(Tablero tablero) {
        Map<String, Boolean> ships = tablero.getPosicionesBarcos() == null ? Map.of() : tablero.getPosicionesBarcos();
        Map<String, Boolean> attacked = tablero.getPosicionesAtacadas() == null ? Map.of() : tablero.getPosicionesAtacadas();
        return !ships.isEmpty() && ships.keySet().stream().allMatch(cell -> Boolean.TRUE.equals(attacked.get(cell)));
    }

    private Partida createMatchForMesa(Mesa mesa) {
        if (mesa.getSeatA() == null || mesa.getSeatB() == null) {
            throw conflict("Se necesitan dos jugadores");
        }
        Instant now = Instant.now();
        Partida partida = new Partida();
        partida.setMesa(mesa);
        partida.setSala(mesa.getSala());
        partida.setEstado(EstadoPartida.PLACING_SHIPS);
        partida.setRuleset(RULESET);
        partida.setInicio(now);
        partida.setPlacementDeadlineAt(now.plus(PLACEMENT_LIMIT));
        partida.setTurnDeadlineAt(null);
        partida.setTurnoActualJugadorId(new Random().nextBoolean() ? mesa.getSeatA().getId() : mesa.getSeatB().getId());
        partida = partidaRepository.save(partida);
        createParticipation(partida, mesa.getSeatA(), 1);
        createParticipation(partida, mesa.getSeatB(), 2);
        createBlankBoard(partida, mesa.getSeatA());
        createBlankBoard(partida, mesa.getSeatB());
        return partida;
    }

    private void createParticipation(Partida partida, Jugador jugador, int order) {
        Participacion p = new Participacion();
        p.setPartida(partida);
        p.setJugador(jugador);
        p.setOrden(order);
        p.setPuntosObtenidos(0);
        participacionRepository.save(p);
    }

    private void createBlankBoard(Partida partida, Jugador jugador) {
        Tablero tablero = new Tablero();
        tablero.setPartida(partida);
        tablero.setJugador(jugador);
        tablero.setPosicionesBarcos(new HashMap<>());
        tablero.setBarcosPorCelda(new HashMap<>());
        tablero.setPosicionesAtacadas(new HashMap<>());
        tableroRepository.save(tablero);
    }

    private void finishMatch(Partida partida, Jugador ganador, Jugador perdedor, boolean abandono) {
        if (partida.getEstado() == EstadoPartida.FINISHED || partida.getEstado() == EstadoPartida.ABANDONED) {
            return;
        }
        partida.setEstado(abandono ? EstadoPartida.ABANDONED : EstadoPartida.FINISHED);
        partida.setAbandono(abandono);
        partida.setGanador(ganador);
        partida.setFin(Instant.now());
        partidaRepository.save(partida);

        Participacion win = participacionRepository.findByPartidaIdAndJugadorId(partida.getId(), ganador.getId()).orElse(null);
        Participacion lose = participacionRepository.findByPartidaIdAndJugadorId(partida.getId(), perdedor.getId()).orElse(null);
        if (win != null) {
            win.setResultado(ResultadoParticipacion.GANO);
            participacionRepository.save(win);
        }
        if (lose != null) {
            lose.setResultado(ResultadoParticipacion.PERDIO);
            participacionRepository.save(lose);
        }
        if (!abandono) {
            applyRatingOnce(partida, ganador, perdedor);
        }
    }

    private void applyRatingOnce(Partida partida, Jugador ganador, Jugador perdedor) {
        if (partida.isRatingProcessed() || ganador.getUsuario() == null || perdedor.getUsuario() == null) {
            return;
        }
        Usuario winUser = usuarioRepository.findById(ganador.getUsuario().getId()).orElseThrow();
        Usuario loseUser = usuarioRepository.findById(perdedor.getUsuario().getId()).orElseThrow();
        int winnerOld = winUser.getRating();
        int loserOld = loseUser.getRating();
        double expectedWin = 1.0 / (1.0 + Math.pow(10.0, (loserOld - winnerOld) / 400.0));
        int delta = (int) Math.round(ELO_K * (1.0 - expectedWin));
        winUser.setRating(winnerOld + delta);
        loseUser.setRating(Math.max(100, loserOld - delta));
        winUser.setGamesPlayed(winUser.getGamesPlayed() + 1);
        loseUser.setGamesPlayed(loseUser.getGamesPlayed() + 1);
        winUser.setWins(winUser.getWins() + 1);
        loseUser.setLosses(loseUser.getLosses() + 1);
        usuarioRepository.save(winUser);
        usuarioRepository.save(loseUser);

        Puntuacion pWin = new Puntuacion();
        pWin.setJugador(ganador);
        pWin.setPartida(partida);
        pWin.setPuntosBase(delta);
        pWin.setTotal(winUser.getRating());
        pWin.setFecha(Instant.now());
        puntuacionRepository.save(pWin);

        Puntuacion pLose = new Puntuacion();
        pLose.setJugador(perdedor);
        pLose.setPartida(partida);
        pLose.setPuntosBase(-delta);
        pLose.setTotal(loseUser.getRating());
        pLose.setFecha(Instant.now());
        puntuacionRepository.save(pLose);

        partida.setRatingProcessed(true);
        partidaRepository.save(partida);
    }

    private void resignLocked(Mesa mesa, SesionJugador session, boolean explicit) {
        Partida partida = currentPartida(mesa).orElse(null);
        if (partida == null || (partida.getEstado() != EstadoPartida.IN_PROGRESS
                && partida.getEstado() != EstadoPartida.PLACING_SHIPS
                && partida.getEstado() != EstadoPartida.READY_TO_START)) {
            throw conflict("No hay partida activa para abandonar");
        }
        Jugador resigning = seatedJugador(mesa, session);
        Jugador winner = opponent(mesa, resigning);
        finishMatch(partida, winner, resigning, true);
        mesa.setEstado(EstadoPartida.ABANDONED);
        if (!explicit) {
            mesa.getSpectatorSessionIds().remove(session.getId());
        }
    }

    private Jugador getOrCreateJugador(SesionJugador session, Sala sala) {
        return jugadorRepository.findTopBySessionTokenAndSalaIdOrderByIdDesc(session.getToken(), sala.getId())
                .orElseGet(() -> {
                    Jugador jugador = new Jugador();
                    jugador.setNombre(session.getDisplayName());
                    jugador.setUsername(session.getUsuario() == null ? session.getDisplayName() : session.getUsuario().getUsername());
                    jugador.setSessionToken(session.getToken());
                    jugador.setInvitado(session.isGuest());
                    jugador.setUsuario(session.getUsuario());
                    jugador.setSala(sala);
                    jugador.setPuntuacion(session.getUsuario() == null ? 0 : session.getUsuario().getRating());
                    return jugadorRepository.save(jugador);
                });
    }

    private SesionJugador requireSession(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sesion requerida");
        }
        SesionJugador session = sesionRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sesion invalida"));
        session.setLastSeenAt(Instant.now());
        return sesionRepository.save(session);
    }

    private SessionUser toSessionUser(SesionJugador session) {
        Usuario user = session.getUsuario();
        return new SessionUser(
                session.getId(),
                session.getToken(),
                session.getDisplayName(),
                session.isGuest(),
                user == null ? null : user.getId(),
                user == null ? null : user.getRating(),
                user == null ? null : user.getGamesPlayed(),
                user == null ? null : user.getWins(),
                user == null ? null : user.getLosses());
    }

    private SesionJugador findSessionOrNull(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        return sesionRepository.findByToken(token).orElse(null);
    }

    private Mesa lockMesa(Long mesaId) {
        return mesaRepository.findByIdForUpdate(mesaId).orElseThrow(() -> notFound("Mesa no encontrada"));
    }

    private Optional<Partida> currentPartida(Mesa mesa) {
        return partidaRepository.findByMesaIdOrderByIdDesc(mesa.getId()).stream().findFirst();
    }

    private void syncMesaState(Mesa mesa) {
        Optional<Partida> partida = currentPartida(mesa);
        if (partida.isPresent() && partida.get().getEstado() != null
                && partida.get().getEstado() != EstadoPartida.CANCELLED
                && partida.get().getEstado() != EstadoPartida.CANCELADA) {
            mesa.setEstado(partida.get().getEstado());
            return;
        }
        int seats = (mesa.getSeatA() == null ? 0 : 1) + (mesa.getSeatB() == null ? 0 : 1);
        if (seats < 2) {
            mesa.setEstado(EstadoPartida.WAITING_FOR_PLAYERS);
        } else if (mesa.isReadyA() && mesa.isReadyB()) {
            mesa.setEstado(EstadoPartida.READY_TO_START);
        } else {
            mesa.setEstado(EstadoPartida.PLAYERS_SEATED);
        }
    }

    private boolean requiresForfeit(Mesa mesa) {
        return currentPartida(mesa)
                .map(p -> p.getEstado() == EstadoPartida.IN_PROGRESS
                        || p.getEstado() == EstadoPartida.PLACING_SHIPS
                        || p.getEstado() == EstadoPartida.READY_TO_START)
                .orElse(false);
    }

    private boolean isSeat(Jugador jugador, SesionJugador session) {
        return jugador != null && session != null && session.getToken().equals(jugador.getSessionToken());
    }

    private Jugador seatedJugador(Mesa mesa, SesionJugador session) {
        if (isSeat(mesa.getSeatA(), session)) {
            return mesa.getSeatA();
        }
        if (isSeat(mesa.getSeatB(), session)) {
            return mesa.getSeatB();
        }
        throw forbidden("Solo jugadores sentados pueden realizar esta accion");
    }

    private Jugador opponent(Mesa mesa, Jugador jugador) {
        if (mesa.getSeatA() != null && Objects.equals(mesa.getSeatA().getId(), jugador.getId())) {
            if (mesa.getSeatB() == null) {
                throw conflict("No hay oponente");
            }
            return mesa.getSeatB();
        }
        if (mesa.getSeatB() != null && Objects.equals(mesa.getSeatB().getId(), jugador.getId())) {
            if (mesa.getSeatA() == null) {
                throw conflict("No hay oponente");
            }
            return mesa.getSeatA();
        }
        throw forbidden("El jugador no pertenece a esta mesa");
    }

    private boolean boardPlaced(Partida partida, Jugador jugador) {
        if (jugador == null) {
            return false;
        }
        return tableroRepository.findByJugadorIdAndPartidaId(jugador.getId(), partida.getId())
                .map(this::hasFleet)
                .orElse(false);
    }

    private boolean hasFleet(Tablero tablero) {
        return tablero.getPosicionesBarcos() != null && tablero.getPosicionesBarcos().size() == FLEET_CELLS
                && tablero.getBarcosPorCelda() != null && tablero.getBarcosPorCelda().size() == FLEET_CELLS;
    }

    private boolean shouldReveal(Partida partida) {
        return partida.getEstado() == EstadoPartida.FINISHED || partida.getEstado() == EstadoPartida.ABANDONED
                || partida.getEstado() == EstadoPartida.FINALIZADA;
    }

    private String normalizeSeat(String seat) {
        String normalized = seat == null ? "" : seat.trim().toUpperCase(Locale.ROOT);
        if (!"A".equals(normalized) && !"B".equals(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Asiento invalido");
        }
        return normalized;
    }

    private String normalizePosition(String input) {
        if (input == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordenada requerida");
        }
        String value = input.trim().toUpperCase(Locale.ROOT);
        parseCell(value);
        return value;
    }

    private Cell parseCell(String value) {
        if (value == null || value.length() < 2 || value.length() > 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordenada invalida");
        }
        char rowChar = value.charAt(0);
        if (rowChar < 'A' || rowChar >= 'A' + BOARD_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fila fuera del tablero");
        }
        int col;
        try {
            col = Integer.parseInt(value.substring(1));
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Columna invalida");
        }
        if (col < 1 || col > BOARD_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Columna fuera del tablero");
        }
        return new Cell(rowChar - 'A', col - 1);
    }

    private String normalizeShipKey(String key) {
        if (key == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Barco sin clave");
        }
        String normalized = key.trim().toLowerCase(Locale.ROOT);
        if (!FLEET_BY_KEY.containsKey(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Barco desconocido: " + key);
        }
        return normalized;
    }

    private String sanitizeName(String name) {
        if (name == null) {
            return null;
        }
        String cleaned = name.replaceAll("[^A-Za-z0-9 _.-]", "").trim();
        return cleaned.length() > 32 ? cleaned.substring(0, 32) : cleaned;
    }

    private String sanitizeTableName(String name, String fallback) {
        String cleaned = sanitizeName(name);
        if (cleaned == null || cleaned.isBlank()) {
            return fallback;
        }
        return cleaned.length() > 80 ? cleaned.substring(0, 80) : cleaned;
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private ResponseStatusException forbidden(String message) {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }

    private void broadcastRoomAndTable(Mesa mesa) {
        broadcastLobby();
        if (mesa.getSala() != null) {
            messagingTemplate.convertAndSend("/topic/salas/" + mesa.getSala().getId(), "UPDATE");
        }
        messagingTemplate.convertAndSend("/topic/mesas/" + mesa.getId(), "UPDATE");
    }

    private void broadcastLobby() {
        messagingTemplate.convertAndSend("/topic/lobby", "UPDATE");
    }

    private record Cell(int row, int col) {
    }

    private record BoardBuild(Map<String, Boolean> positions, Map<String, String> shipsByCell) {
    }
}
