package org.example.easyitp.dto;

import lombok.Data;

@Data
public class CreateUserRequest {
    private String email;
    private String password;
}
