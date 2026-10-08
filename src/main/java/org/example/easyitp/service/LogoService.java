package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.StationLogo;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.StationLogoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.Iterator;
import java.util.Optional;

// Logo-ul statiei: orice PNG / JPG / GIF / BMP e citit si redesenat ca PNG de cel mult 400 px (fara metadate,
// fara SVG sau alte formate care pot purta cod). Se serveste public dupa un token care se schimba la fiecare logo nou.
@Service
@RequiredArgsConstructor
public class LogoService {

    static final int MAX_SIDE = 400;
    static final long MAX_UPLOAD = 5L * 1024 * 1024;
    // poze uriase (bombe de decompresie) se refuza inainte sa fie citite
    static final int MAX_SOURCE_SIDE = 8000;
    private static final String PUBLIC_PATH = "/api/public/logos/";

    private final StationLogoRepository logoRepository;
    private final AppUserRepository appUserRepository;

    // Calea publica a logo-ului (null = fara logo)
    public static String path(AppUser station) {
        return station.getLogoToken() == null ? null : PUBLIC_PATH + station.getLogoToken() + ".png";
    }

    @Transactional
    public String save(AppUser station, MultipartFile file) {
        if (file == null || file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Alegeți o imagine.");
        if (file.getSize() > MAX_UPLOAD) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Imaginea are peste 5 MB.");
        byte[] png;
        try (InputStream in = file.getInputStream()) {
            png = toPng(read(in));
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Imaginea nu a putut fi citită.");
        }
        StationLogo logo = logoRepository.findById(station.getId()).orElseGet(() -> StationLogo.builder().userId(station.getId()).build());
        logo.setImage(png);
        logo.setUpdatedAt(LocalDateTime.now());
        logoRepository.save(logo);
        station.setLogoToken(ClientKeys.newToken().substring(0, 24));
        appUserRepository.save(station);
        return path(station);
    }

    @Transactional
    public void delete(AppUser station) {
        logoRepository.deleteById(station.getId());
        logoRepository.flush();
        station.setLogoToken(null);
        appUserRepository.save(station);
    }

    @Transactional(readOnly = true)
    public Optional<byte[]> image(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{8,40}")) return Optional.empty();
        return appUserRepository.findByLogoToken(token)
                .flatMap(u -> logoRepository.findById(u.getId()))
                .map(StationLogo::getImage);
    }

    static BufferedImage read(InputStream in) throws IOException {
        try (ImageInputStream stream = ImageIO.createImageInputStream(in)) {
            Iterator<ImageReader> readers = stream == null ? null : ImageIO.getImageReaders(stream);
            if (readers == null || !readers.hasNext()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fișierul nu este o imagine PNG sau JPG.");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(stream, true, true);
                if (reader.getWidth(0) > MAX_SOURCE_SIDE || reader.getHeight(0) > MAX_SOURCE_SIDE) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Imaginea este prea mare (maxim 8000 px pe latură).");
                }
                return reader.read(0);
            } finally {
                reader.dispose();
            }
        }
    }

    // Micsorata la cel mult 400 px pe latura, cu transparenta pastrata
    static byte[] toPng(BufferedImage src) throws IOException {
        double scale = Math.min(1.0, (double) MAX_SIDE / Math.max(src.getWidth(), src.getHeight()));
        int w = Math.max(1, (int) Math.round(src.getWidth() * scale));
        int h = Math.max(1, (int) Math.round(src.getHeight() * scale));
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(src, 0, 0, w, h, null);
        g.dispose();
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(out, "png", bytes);
        return bytes.toByteArray();
    }
}
