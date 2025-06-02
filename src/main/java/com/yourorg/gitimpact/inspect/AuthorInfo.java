package com.yourorg.gitimpact.inspect;

import com.fasterxml.jackson.annotation.JsonProperty;

public class AuthorInfo {
    @JsonProperty("name")
    private final String name;
    
    @JsonProperty("email")
    private final String email;

    public AuthorInfo(String name, String email) {
        this.name = name;
        this.email = email;
    }

    public String getName() { return name; }
    public String getEmail() { return email; }
} 