package com.jair.battleship.battleshipbackend.models.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ChatMessage {
    private String sender;
    private String content;
    private String type; // "CHAT", "JOIN", "LEAVE"

    public String getSender() {
        return this.sender;
    }

    public String getContent() {
        return this.content;
    }

    public String getType() {
        return this.type;
    }
}
