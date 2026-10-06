package org.example.easyitp.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.Plans;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

// Module intregi care tin de un pachet (E1): flotele si facturarea sunt in Premium. Raspunsul e 402 cu mesaj.
// Portalul firmelor (/api/fleet-portal) ramane deschis: datele lor nu dispar daca statia trece pe Gratuit.
@Configuration
@RequiredArgsConstructor
public class PlanInterceptor implements WebMvcConfigurer {

    private final CurrentUser currentUser;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(require(Plans.Feature.FLEETS)).addPathPatterns("/api/fleets", "/api/fleets/**");
        registry.addInterceptor(require(Plans.Feature.INVOICING)).addPathPatterns("/api/invoicing/**");
    }

    private HandlerInterceptor require(Plans.Feature feature) {
        return new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                if (!"OPTIONS".equals(request.getMethod())) Plans.require(currentUser.get(), feature);
                return true;
            }
        };
    }
}
