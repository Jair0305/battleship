package com.jair.battleship.battleshipbackend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BattleshipBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(BattleshipBackendApplication.class, args);
	}

}
