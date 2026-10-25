package com.jair.battleship.battleshipbackend;

import com.jair.battleship.battleshipbackend.models.entities.Usuario;
import com.jair.battleship.battleshipbackend.repositories.UsuarioRepository;
import com.jair.battleship.battleshipbackend.services.impl.AuthServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceSecurityTests {
    @Mock
    private UsuarioRepository users;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private AuthServiceImpl service;

    @BeforeEach
    void configureService() {
        service = new AuthServiceImpl();
        ReflectionTestUtils.setField(service, "usuarioRepository", users);
        ReflectionTestUtils.setField(service, "passwordEncoder", encoder);
    }

    @Test
    void rejectsPasswordsBeyondBcryptUtf8BoundaryBeforeSaving() {
        for (String password : new String[] {"a".repeat(73), "é".repeat(37)}) {
            assertThatThrownBy(() -> service.register("fixture", password, password))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("72 bytes UTF-8");
        }
        verify(users, never()).save(any());
    }

    @Test
    void acceptsMultibytePasswordAtExactly72Bytes() {
        when(users.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        String password = "é".repeat(36);
        Usuario user = service.register("fixture", password, password);
        assertThat(encoder.matches(password, user.getPasswordHash())).isTrue();
    }

    @Test
    void retainsExistingBcryptHashWhenLoginSucceeds() {
        String password = "migration-fixture";
        Usuario user = new Usuario();
        // Generated using Spring Security 6.2.4 BCrypt, not the encoder under test.
        String hash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeYjbSXpqnfwrtnfxSVV5BjTmjmLIGk2u";
        user.setPasswordHash(hash);
        when(users.findByUsername("fixture")).thenReturn(Optional.of(user));
        assertThat(service.login("fixture", password)).isSameAs(user);
        assertThat(user.getPasswordHash()).isEqualTo(hash);
        verify(users, never()).save(any());
    }

    @Test
    void acceptsLegacyHashesAtExactly72AsciiAndUtf8Bytes() {
        String[] passwords = {"a".repeat(72), "é".repeat(36)};
        String[] legacyHashes = {
                "$2a$10$N9qo8uLOickgx2ZMRZoMye5mlC/WoAmNnGP3YkHGchsBkco85S4ZC",
                "$2a$10$N9qo8uLOickgx2ZMRZoMye3Lo3HEQiwbJaIkddl76i2hDoGGTcu7S"
        };
        for (int i = 0; i < passwords.length; i++) {
            Usuario user = new Usuario();
            user.setPasswordHash(legacyHashes[i]);
            when(users.findByUsername("fixture")).thenReturn(Optional.of(user));
            assertThat(service.login("fixture", passwords[i])).isSameAs(user);
            assertThat(user.getPasswordHash()).isEqualTo(legacyHashes[i]);
        }
        verify(users, never()).save(any());
    }

    @Test
    void extraSuffixCannotAuthenticateAgainstA72BytePassword() {
        String password = "a".repeat(72);
        Usuario user = new Usuario();
        user.setPasswordHash(encoder.encode(password));
        lenient().when(users.findByUsername("fixture")).thenReturn(Optional.of(user));
        assertThatThrownBy(() -> service.login("fixture", password + "different"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(users, never()).save(any());
    }
}
