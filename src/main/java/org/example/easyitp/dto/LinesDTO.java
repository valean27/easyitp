package org.example.easyitp.dto;

import java.util.List;

// Liniile ITP ale statiei: cate sunt si numele lor (cate unul pe linie, "" = "Linia N"); names null la salvare = nu se schimba
public record LinesDTO(int count, List<String> names) {
}
