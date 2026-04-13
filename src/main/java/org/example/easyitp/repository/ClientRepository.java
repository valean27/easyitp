package org.example.easyitp.repository;

import org.example.easyitp.entity.Client;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ClientRepository extends JpaRepository<Client, Long> {

    Optional<Client> findByNameAndPhoneAndUserId(String name, String phone, Long userId);

    Optional<Client> findByNameAndUserId(String name, Long userId);
}
